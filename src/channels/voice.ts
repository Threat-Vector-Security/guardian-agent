/**
 * Voice device channel adapter.
 *
 * Accepts trusted device registration, pre-transcribed text, or short audio
 * clips from local voice devices. Audio transcription is delegated to the
 * configured VoiceTranscriber, then the resulting text flows through the same
 * MessageCallback path as every other channel.
 */

import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import { randomUUID, timingSafeEqual } from 'node:crypto';
import type { AddressInfo } from 'node:net';
import type { AgentResponse, UserMessage } from '../agent/types.js';
import type { ChannelAdapter, MessageCallback } from './types.js';
import { sendJSON, readJsonBody } from './web-json.js';
import type { PrincipalRole } from '../tools/types.js';
import { createLogger } from '../util/logging.js';
import type { VoiceTranscriber, VoiceTranscriptionResult } from './voice-transcription.js';

const log = createLogger('channel:voice');
const DEFAULT_PORT = 3107;
const DEFAULT_HOST = 'localhost';
const DEFAULT_MAX_BODY_BYTES = 10 * 1024 * 1024;
const DEVICE_ID_PATTERN = /^[A-Za-z0-9._:-]{1,128}$/;

type VoiceAuthMode = 'bearer_required' | 'disabled';

export interface VoiceChannelAuthConfig {
  mode?: VoiceAuthMode;
  token?: string;
}

export interface VoiceChannelOptions {
  port?: number;
  host?: string;
  defaultAgent?: string;
  auth?: VoiceChannelAuthConfig;
  allowedDeviceIds?: string[];
  autoRegister?: boolean;
  maxBodyBytes?: number;
  transcriber?: VoiceTranscriber;
  now?: () => number;
}

export interface VoiceDeviceRecord {
  deviceId: string;
  deviceName?: string;
  model?: string;
  firmwareVersion?: string;
  capabilities: string[];
  remoteAddress?: string;
  registeredAt: number;
  lastSeenAt: number;
  lastTranscriptAt?: number;
  transcriptionProvider?: string;
}

interface TranscriptRequest {
  deviceId?: unknown;
  deviceName?: unknown;
  model?: unknown;
  firmwareVersion?: unknown;
  transcript?: unknown;
  text?: unknown;
  userId?: unknown;
  surfaceId?: unknown;
  requestId?: unknown;
  languageCode?: unknown;
  confidence?: unknown;
  metadata?: unknown;
}

interface AudioJsonRequest {
  deviceId?: unknown;
  deviceName?: unknown;
  model?: unknown;
  firmwareVersion?: unknown;
  audioBase64?: unknown;
  mimeType?: unknown;
  filename?: unknown;
  userId?: unknown;
  surfaceId?: unknown;
  requestId?: unknown;
  languageCode?: unknown;
  metadata?: unknown;
}

function trimString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function trimStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.map((entry) => trimString(entry)).filter((entry): entry is string => Boolean(entry))
    : [];
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : undefined;
}

function asNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function getHeaderString(req: IncomingMessage, name: string): string | undefined {
  const value = req.headers[name.toLowerCase()];
  if (Array.isArray(value)) return trimString(value[0]);
  return trimString(value);
}

function timingSafeEqualString(expected: string, provided: string): boolean {
  const expectedBytes = Buffer.from(expected, 'utf-8');
  const providedBytes = Buffer.from(provided, 'utf-8');
  if (expectedBytes.length !== providedBytes.length) return false;
  return timingSafeEqual(expectedBytes, providedBytes);
}

function normalizeAuthMode(value: VoiceAuthMode | undefined): VoiceAuthMode {
  return value === 'disabled' ? 'disabled' : 'bearer_required';
}

function readBufferBody(req: IncomingMessage, maxBytes: number): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    let totalBytes = 0;
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => {
      totalBytes += chunk.length;
      if (totalBytes > maxBytes) {
        req.destroy();
        reject(new Error(`Request body too large (limit: ${maxBytes} bytes)`));
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

function normalizeMimeType(value: string | undefined): string {
  const mime = value?.split(';')[0]?.trim().toLowerCase();
  return mime || 'application/octet-stream';
}

function decodeBase64Audio(value: unknown): Buffer | undefined {
  const encoded = trimString(value);
  if (!encoded) return undefined;
  const commaIndex = encoded.indexOf(',');
  const payload = commaIndex >= 0 ? encoded.slice(commaIndex + 1) : encoded;
  return Buffer.from(payload, 'base64');
}

function readQuery(url: URL, key: string): string | undefined {
  return trimString(url.searchParams.get(key) ?? undefined);
}

function readDeviceId(req: IncomingMessage, url: URL, value: unknown): string | undefined {
  return trimString(value)
    ?? getHeaderString(req, 'x-guardian-device-id')
    ?? readQuery(url, 'deviceId');
}

function isValidDeviceId(deviceId: string): boolean {
  return DEVICE_ID_PATTERN.test(deviceId);
}

function describeResponse(response: AgentResponse): { content: string; metadata?: Record<string, unknown> } {
  return {
    content: response.content,
    ...(response.metadata ? { metadata: response.metadata } : {}),
  };
}

export class VoiceChannel implements ChannelAdapter {
  readonly name = 'voice';

  private readonly port: number;
  private readonly host: string;
  private readonly defaultAgent?: string;
  private readonly authMode: VoiceAuthMode;
  private readonly authToken?: string;
  private readonly allowedDeviceIds: Set<string>;
  private readonly autoRegister: boolean;
  private readonly maxBodyBytes: number;
  private readonly transcriber?: VoiceTranscriber;
  private readonly now: () => number;
  private readonly devices = new Map<string, VoiceDeviceRecord>();
  private readonly outbox = new Map<string, string[]>();
  private server: Server | null = null;
  private onMessage: MessageCallback | null = null;

  constructor(options: VoiceChannelOptions = {}) {
    this.port = options.port ?? DEFAULT_PORT;
    this.host = options.host ?? DEFAULT_HOST;
    this.defaultAgent = options.defaultAgent?.trim() || undefined;
    this.authMode = normalizeAuthMode(options.auth?.mode);
    this.authToken = options.auth?.token?.trim() || undefined;
    this.allowedDeviceIds = new Set((options.allowedDeviceIds ?? []).map((id) => id.trim()).filter(Boolean));
    this.autoRegister = options.autoRegister ?? true;
    this.maxBodyBytes = options.maxBodyBytes ?? DEFAULT_MAX_BODY_BYTES;
    this.transcriber = options.transcriber;
    this.now = options.now ?? Date.now;
  }

  async start(onMessage: MessageCallback): Promise<void> {
    this.onMessage = onMessage;
    this.server = createServer(async (req, res) => {
      try {
        await this.handleRequest(req, res);
      } catch (err) {
        log.error({ err }, 'Unhandled voice channel request error');
        if (!res.headersSent) {
          sendJSON(res, 500, { error: 'Internal voice channel error' });
        }
      }
    });

    return new Promise((resolve, reject) => {
      this.server!.listen(this.port, this.host, () => {
        log.info({
          port: this.getListeningPort(),
          host: this.host,
          authMode: this.authMode,
          transcriptionProvider: this.transcriber?.provider ?? 'none',
        }, 'Voice channel started');
        resolve();
      });
      this.server!.on('error', reject);
    });
  }

  async stop(): Promise<void> {
    if (!this.server) return;
    await new Promise<void>((resolve, reject) => {
      this.server!.close((err) => err ? reject(err) : resolve());
    });
    this.server = null;
    this.onMessage = null;
    this.outbox.clear();
  }

  async send(userId: string, text: string): Promise<void> {
    const key = userId.trim();
    if (!key) return;
    const existing = this.outbox.get(key) ?? [];
    existing.push(text);
    this.outbox.set(key, existing);
  }

  getDevices(): VoiceDeviceRecord[] {
    return [...this.devices.values()].map((device) => ({
      ...device,
      capabilities: [...device.capabilities],
    }));
  }

  getListeningPort(): number {
    const address = this.server?.address();
    return typeof address === 'object' && address ? (address as AddressInfo).port : this.port;
  }

  private async handleRequest(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const url = new URL(req.url ?? '/', `http://${req.headers.host ?? `${this.host}:${this.port}`}`);
    if (req.method === 'GET' && (url.pathname === '/health' || url.pathname === '/api/voice/health')) {
      sendJSON(res, 200, {
        status: 'ok',
        channel: 'voice',
        defaultAgent: this.defaultAgent,
        transcriptionProvider: this.transcriber?.provider ?? 'none',
      });
      return;
    }

    if (!this.checkAuth(req, res)) return;

    if (req.method === 'GET' && url.pathname === '/api/voice/devices') {
      sendJSON(res, 200, { devices: this.getDevices() });
      return;
    }

    if (req.method === 'GET' && url.pathname === '/api/voice/outbox') {
      const deviceId = readDeviceId(req, url, undefined);
      if (!deviceId || !isValidDeviceId(deviceId)) {
        sendJSON(res, 400, { error: 'valid deviceId is required' });
        return;
      }
      if (!this.ensureDeviceAllowed(deviceId, res)) return;
      const key = `voice:${deviceId}`;
      const messages = this.outbox.get(key) ?? [];
      this.outbox.delete(key);
      sendJSON(res, 200, { messages });
      return;
    }

    if (req.method === 'POST' && url.pathname === '/api/voice/register') {
      await this.handleRegister(req, res, url);
      return;
    }

    if (req.method === 'POST' && url.pathname === '/api/voice/transcript') {
      await this.handleTranscript(req, res, url);
      return;
    }

    if (req.method === 'POST' && url.pathname === '/api/voice/audio') {
      await this.handleAudio(req, res, url);
      return;
    }

    sendJSON(res, 404, { error: 'Not found' });
  }

  private checkAuth(req: IncomingMessage, res: ServerResponse): boolean {
    if (this.authMode === 'disabled') return true;
    if (!this.authToken) {
      sendJSON(res, 401, { error: 'Voice channel authentication is not configured' });
      return false;
    }
    const header = req.headers.authorization;
    const authHeader = typeof header === 'string' ? header : undefined;
    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.slice(7);
      if (timingSafeEqualString(this.authToken, token)) return true;
      sendJSON(res, 403, { error: 'Invalid token' });
      return false;
    }
    sendJSON(res, 401, { error: 'Authentication required' });
    return false;
  }

  private ensureDeviceAllowed(deviceId: string, res: ServerResponse): boolean {
    if (this.allowedDeviceIds.size === 0 || this.allowedDeviceIds.has(deviceId)) return true;
    sendJSON(res, 403, { error: 'Device is not allowed' });
    return false;
  }

  private async handleRegister(req: IncomingMessage, res: ServerResponse, url: URL): Promise<void> {
    try {
      const parsed = await readJsonBody<Record<string, unknown>>(req, this.maxBodyBytes);
      const deviceId = readDeviceId(req, url, parsed.deviceId);
      if (!deviceId || !isValidDeviceId(deviceId)) {
        sendJSON(res, 400, { error: 'valid deviceId is required' });
        return;
      }
      if (!this.ensureDeviceAllowed(deviceId, res)) return;
      const device = this.upsertDevice(deviceId, req, parsed);
      sendJSON(res, 200, { success: true, device });
    } catch (err) {
      this.sendBadRequest(res, err);
    }
  }

  private async handleTranscript(req: IncomingMessage, res: ServerResponse, url: URL): Promise<void> {
    try {
      const parsed = await readJsonBody<TranscriptRequest>(req, this.maxBodyBytes);
      const deviceId = readDeviceId(req, url, parsed.deviceId);
      const transcript = trimString(parsed.transcript) ?? trimString(parsed.text);
      if (!deviceId || !isValidDeviceId(deviceId)) {
        sendJSON(res, 400, { error: 'valid deviceId is required' });
        return;
      }
      if (!transcript) {
        sendJSON(res, 400, { error: 'transcript is required' });
        return;
      }
      if (!this.ensureDeviceReady(deviceId, req, res, this.readDeviceMetadata(parsed))) return;
      const response = await this.dispatchTranscript({
        req,
        deviceId,
        transcript,
        userId: trimString(parsed.userId),
        surfaceId: trimString(parsed.surfaceId),
        requestId: trimString(parsed.requestId),
        languageCode: trimString(parsed.languageCode),
        confidence: asNumber(parsed.confidence),
        metadata: asRecord(parsed.metadata),
        transcription: {
          text: transcript,
          provider: 'device_or_bridge',
        },
      });
      sendJSON(res, 200, response);
    } catch (err) {
      this.sendBadRequest(res, err);
    }
  }

  private async handleAudio(req: IncomingMessage, res: ServerResponse, url: URL): Promise<void> {
    if (!this.transcriber) {
      sendJSON(res, 503, { error: 'Voice transcription provider is not configured' });
      return;
    }

    try {
      const parsed = await this.readAudioRequest(req, url);
      if (!this.ensureDeviceReady(parsed.deviceId, req, res, parsed.metadata)) return;
      const transcription = await this.transcriber.transcribe({
        audio: parsed.audio,
        mimeType: parsed.mimeType,
        filename: parsed.filename,
        languageCode: parsed.languageCode,
        deviceId: parsed.deviceId,
        requestId: parsed.requestId,
        metadata: parsed.metadata,
      });
      const response = await this.dispatchTranscript({
        req,
        deviceId: parsed.deviceId,
        transcript: transcription.text,
        userId: parsed.userId,
        surfaceId: parsed.surfaceId,
        requestId: parsed.requestId,
        languageCode: parsed.languageCode ?? transcription.languageCode,
        metadata: parsed.metadata,
        transcription,
      });
      sendJSON(res, 200, response);
    } catch (err) {
      this.sendBadRequest(res, err);
    }
  }

  private async readAudioRequest(req: IncomingMessage, url: URL): Promise<{
    deviceId: string;
    audio: Buffer;
    mimeType: string;
    filename?: string;
    userId?: string;
    surfaceId?: string;
    requestId?: string;
    languageCode?: string;
    metadata?: Record<string, unknown>;
  }> {
    const contentType = normalizeMimeType(getHeaderString(req, 'content-type'));
    if (contentType === 'application/json') {
      const parsed = await readJsonBody<AudioJsonRequest>(req, this.maxBodyBytes);
      const deviceId = readDeviceId(req, url, parsed.deviceId);
      const audio = decodeBase64Audio(parsed.audioBase64);
      if (!deviceId || !isValidDeviceId(deviceId)) throw new Error('valid deviceId is required');
      if (!audio || audio.length === 0) throw new Error('audioBase64 is required');
      return {
        deviceId,
        audio,
        mimeType: normalizeMimeType(trimString(parsed.mimeType) ?? 'audio/wav'),
        filename: trimString(parsed.filename),
        userId: trimString(parsed.userId),
        surfaceId: trimString(parsed.surfaceId),
        requestId: trimString(parsed.requestId),
        languageCode: trimString(parsed.languageCode),
        metadata: {
          ...(asRecord(parsed.metadata) ?? {}),
          ...this.readDeviceMetadata(parsed),
        },
      };
    }

    const deviceId = readDeviceId(req, url, undefined);
    if (!deviceId || !isValidDeviceId(deviceId)) throw new Error('valid deviceId is required');
    const audio = await readBufferBody(req, this.maxBodyBytes);
    if (audio.length === 0) throw new Error('audio body is required');
    return {
      deviceId,
      audio,
      mimeType: contentType,
      filename: getHeaderString(req, 'x-guardian-audio-filename') ?? readQuery(url, 'filename'),
      userId: readQuery(url, 'userId'),
      surfaceId: readQuery(url, 'surfaceId'),
      requestId: readQuery(url, 'requestId'),
      languageCode: getHeaderString(req, 'x-guardian-language-code') ?? readQuery(url, 'languageCode'),
      metadata: {},
    };
  }

  private ensureDeviceReady(
    deviceId: string,
    req: IncomingMessage,
    res: ServerResponse,
    metadata: Record<string, unknown> | undefined,
  ): boolean {
    if (!this.ensureDeviceAllowed(deviceId, res)) return false;
    if (this.devices.has(deviceId)) {
      this.upsertDevice(deviceId, req, metadata ?? {});
      return true;
    }
    if (!this.autoRegister) {
      sendJSON(res, 409, { error: 'Device is not registered' });
      return false;
    }
    this.upsertDevice(deviceId, req, metadata ?? {});
    return true;
  }

  private upsertDevice(deviceId: string, req: IncomingMessage, input: Record<string, unknown>): VoiceDeviceRecord {
    const now = this.now();
    const existing = this.devices.get(deviceId);
    const device: VoiceDeviceRecord = {
      deviceId,
      deviceName: trimString(input.deviceName) ?? existing?.deviceName,
      model: trimString(input.model) ?? existing?.model,
      firmwareVersion: trimString(input.firmwareVersion) ?? existing?.firmwareVersion,
      capabilities: trimStringArray(input.capabilities).length > 0
        ? trimStringArray(input.capabilities)
        : (existing?.capabilities ?? []),
      remoteAddress: req.socket.remoteAddress ?? existing?.remoteAddress,
      registeredAt: existing?.registeredAt ?? now,
      lastSeenAt: now,
      lastTranscriptAt: existing?.lastTranscriptAt,
      transcriptionProvider: this.transcriber?.provider ?? existing?.transcriptionProvider,
    };
    this.devices.set(deviceId, device);
    return { ...device, capabilities: [...device.capabilities] };
  }

  private readDeviceMetadata(input: { deviceName?: unknown; model?: unknown; firmwareVersion?: unknown }): Record<string, unknown> {
    const metadata: Record<string, unknown> = {};
    for (const key of ['deviceName', 'model', 'firmwareVersion'] as const) {
      const value = trimString(input[key]);
      if (value) metadata[key] = value;
    }
    return metadata;
  }

  private async dispatchTranscript(input: {
    req: IncomingMessage;
    deviceId: string;
    transcript: string;
    userId?: string;
    surfaceId?: string;
    requestId?: string;
    languageCode?: string;
    confidence?: number;
    metadata?: Record<string, unknown>;
    transcription: VoiceTranscriptionResult;
  }): Promise<Record<string, unknown>> {
    if (!this.onMessage) {
      throw new Error('No message handler registered');
    }

    const now = this.now();
    const requestId = input.requestId ?? randomUUID();
    const userId = input.userId ?? `voice:${input.deviceId}`;
    const surfaceId = input.surfaceId ?? `voice:${input.deviceId}`;
    const device = this.devices.get(input.deviceId);
    if (device) {
      device.lastTranscriptAt = now;
      device.lastSeenAt = now;
      device.transcriptionProvider = input.transcription.provider;
    }

    const message: UserMessage = {
      id: requestId,
      userId,
      surfaceId,
      principalId: `voice-device:${input.deviceId}`,
      principalRole: 'owner' satisfies PrincipalRole,
      channel: 'voice',
      content: input.transcript,
      metadata: {
        ...(input.metadata ?? {}),
        voice: {
          deviceId: input.deviceId,
          deviceName: device?.deviceName,
          model: device?.model,
          source: 'voice_channel',
          languageCode: input.languageCode,
          confidence: input.confidence,
          transcriptionProvider: input.transcription.provider,
          transcriptionModel: input.transcription.model,
          remoteAddress: input.req.socket.remoteAddress,
        },
      },
      timestamp: now,
    };

    const response = await this.onMessage(message);
    return {
      success: true,
      requestId,
      transcript: input.transcript,
      transcription: {
        provider: input.transcription.provider,
        model: input.transcription.model,
        languageCode: input.transcription.languageCode,
        languageProbability: input.transcription.languageProbability,
      },
      response: describeResponse(response),
    };
  }

  private sendBadRequest(res: ServerResponse, err: unknown): void {
    const message = err instanceof Error ? err.message : 'Bad request';
    const status = message.includes('too large') ? 413 : 400;
    sendJSON(res, status, { error: message });
  }
}
