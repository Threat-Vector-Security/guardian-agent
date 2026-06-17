import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawn } from 'node:child_process';

export interface VoiceTranscriptionInput {
  audio: Buffer;
  mimeType: string;
  filename?: string;
  languageCode?: string;
  deviceId?: string;
  requestId?: string;
  metadata?: Record<string, unknown>;
}

export interface VoiceTranscriptionResult {
  text: string;
  provider: string;
  model?: string;
  languageCode?: string;
  languageProbability?: number;
  raw?: unknown;
}

export interface VoiceTranscriber {
  readonly provider: string;
  transcribe(input: VoiceTranscriptionInput): Promise<VoiceTranscriptionResult>;
}

export interface ElevenLabsVoiceTranscriberOptions {
  apiKey: string;
  apiBaseUrl?: string;
  modelId?: string;
  timeoutMs?: number;
  languageCode?: string;
  tagAudioEvents?: boolean;
  noVerbatim?: boolean;
  fileFormat?: 'pcm_s16le_16' | 'other';
  enableLogging?: boolean;
  fetchImpl?: typeof fetch;
}

export interface OpenAICompatibleVoiceTranscriberOptions {
  baseUrl: string;
  apiKey?: string;
  model: string;
  timeoutMs?: number;
  languageCode?: string;
  responseFormat?: 'json' | 'text' | 'verbose_json';
  fetchImpl?: typeof fetch;
}

export interface OpenRouterVoiceTranscriberOptions {
  apiKey: string;
  baseUrl?: string;
  model: string;
  timeoutMs?: number;
  languageCode?: string;
  audioFormat?: string;
  temperature?: number;
  provider?: Record<string, unknown>;
  fetchImpl?: typeof fetch;
}

export interface LocalCommandVoiceTranscriberOptions {
  command: string;
  args?: string[];
  outputFormat?: 'text' | 'json';
  timeoutMs?: number;
  workingDirectory?: string;
}

function requireNonEmpty(value: string | undefined, name: string): string {
  const trimmed = value?.trim();
  if (!trimmed) throw new Error(`${name} is required`);
  return trimmed;
}

function buildUrl(baseUrl: string, path: string): string {
  const base = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
  return new URL(path.replace(/^\/+/, ''), base).toString();
}

function withTimeout(timeoutMs: number | undefined): AbortSignal | undefined {
  return timeoutMs && timeoutMs > 0 ? AbortSignal.timeout(timeoutMs) : undefined;
}

function appendOptional(form: FormData, name: string, value: string | number | boolean | undefined | null): void {
  if (value === undefined || value === null) return;
  form.append(name, String(value));
}

function extractText(value: unknown): string | undefined {
  if (typeof value === 'string') return value.trim() || undefined;
  if (!value || typeof value !== 'object') return undefined;
  const record = value as Record<string, unknown>;
  if (typeof record.text === 'string' && record.text.trim()) return record.text.trim();
  const transcripts = record.transcripts;
  if (Array.isArray(transcripts)) {
    const combined = transcripts
      .map((entry) => extractText(entry))
      .filter((entry): entry is string => Boolean(entry))
      .join('\n')
      .trim();
    return combined || undefined;
  }
  if (transcripts && typeof transcripts === 'object') {
    const combined = Object.values(transcripts)
      .map((entry) => extractText(entry))
      .filter((entry): entry is string => Boolean(entry))
      .join('\n')
      .trim();
    return combined || undefined;
  }
  return undefined;
}

function readLanguageCode(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function readLanguageProbability(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function normalizeFilename(filename: string | undefined, mimeType: string): string {
  const clean = filename?.trim().replace(/[\\/]/g, '-');
  if (clean) return clean;
  if (mimeType.includes('wav')) return 'voice.wav';
  if (mimeType.includes('mpeg') || mimeType.includes('mp3')) return 'voice.mp3';
  if (mimeType.includes('ogg')) return 'voice.ogg';
  if (mimeType.includes('webm')) return 'voice.webm';
  if (mimeType.includes('flac')) return 'voice.flac';
  return 'voice.bin';
}

function inferOpenRouterAudioFormat(input: VoiceTranscriptionInput, fallback: string | undefined): string {
  const configured = fallback?.trim();
  if (configured) return configured;
  const filename = input.filename?.trim().toLowerCase();
  const extension = filename?.match(/\.([a-z0-9]+)$/)?.[1];
  if (extension) return extension === 'm4a' ? 'mp4' : extension;
  const mimeType = input.mimeType.toLowerCase();
  if (mimeType.includes('wav')) return 'wav';
  if (mimeType.includes('mpeg') || mimeType.includes('mp3')) return 'mp3';
  if (mimeType.includes('ogg')) return 'ogg';
  if (mimeType.includes('webm')) return 'webm';
  if (mimeType.includes('flac')) return 'flac';
  if (mimeType.includes('mp4') || mimeType.includes('m4a')) return 'mp4';
  return 'wav';
}

async function parseJsonOrText(response: Response): Promise<unknown> {
  const contentType = response.headers.get('content-type') ?? '';
  if (contentType.includes('application/json')) {
    return response.json();
  }
  return response.text();
}

export class ElevenLabsVoiceTranscriber implements VoiceTranscriber {
  readonly provider = 'elevenlabs';

  private readonly apiKey: string;
  private readonly apiBaseUrl: string;
  private readonly modelId: string;
  private readonly timeoutMs?: number;
  private readonly languageCode?: string;
  private readonly tagAudioEvents?: boolean;
  private readonly noVerbatim?: boolean;
  private readonly fileFormat?: 'pcm_s16le_16' | 'other';
  private readonly enableLogging?: boolean;
  private readonly fetchImpl: typeof fetch;

  constructor(options: ElevenLabsVoiceTranscriberOptions) {
    this.apiKey = requireNonEmpty(options.apiKey, 'ElevenLabs API key');
    this.apiBaseUrl = options.apiBaseUrl?.trim() || 'https://api.elevenlabs.io';
    this.modelId = options.modelId?.trim() || 'scribe_v2';
    this.timeoutMs = options.timeoutMs;
    this.languageCode = options.languageCode?.trim() || undefined;
    this.tagAudioEvents = options.tagAudioEvents;
    this.noVerbatim = options.noVerbatim;
    this.fileFormat = options.fileFormat;
    this.enableLogging = options.enableLogging;
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  async transcribe(input: VoiceTranscriptionInput): Promise<VoiceTranscriptionResult> {
    const form = new FormData();
    form.append('model_id', this.modelId);
    form.append(
      'file',
      new Blob([new Uint8Array(input.audio)], { type: input.mimeType || 'application/octet-stream' }),
      normalizeFilename(input.filename, input.mimeType),
    );
    appendOptional(form, 'language_code', input.languageCode ?? this.languageCode);
    appendOptional(form, 'tag_audio_events', this.tagAudioEvents);
    appendOptional(form, 'no_verbatim', this.noVerbatim);
    appendOptional(form, 'file_format', this.fileFormat);

    const url = new URL(buildUrl(this.apiBaseUrl, '/v1/speech-to-text'));
    if (this.enableLogging !== undefined) {
      url.searchParams.set('enable_logging', String(this.enableLogging));
    }

    const response = await this.fetchImpl(url.toString(), {
      method: 'POST',
      headers: { 'xi-api-key': this.apiKey },
      body: form,
      signal: withTimeout(this.timeoutMs),
    });
    const parsed = await parseJsonOrText(response);
    if (!response.ok) {
      throw new Error(`ElevenLabs transcription failed (${response.status}): ${extractText(parsed) ?? response.statusText}`);
    }

    const text = extractText(parsed);
    if (!text) {
      throw new Error('ElevenLabs transcription did not return text');
    }
    const record = parsed && typeof parsed === 'object' ? parsed as Record<string, unknown> : {};
    return {
      text,
      provider: this.provider,
      model: this.modelId,
      languageCode: readLanguageCode(record.language_code),
      languageProbability: readLanguageProbability(record.language_probability),
      raw: parsed,
    };
  }
}

export class OpenRouterVoiceTranscriber implements VoiceTranscriber {
  readonly provider = 'openrouter';

  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly model: string;
  private readonly timeoutMs?: number;
  private readonly languageCode?: string;
  private readonly audioFormat?: string;
  private readonly temperature?: number;
  private readonly providerConfig?: Record<string, unknown>;
  private readonly fetchImpl: typeof fetch;

  constructor(options: OpenRouterVoiceTranscriberOptions) {
    this.apiKey = requireNonEmpty(options.apiKey, 'OpenRouter API key');
    this.baseUrl = options.baseUrl?.trim() || 'https://openrouter.ai/api/v1';
    this.model = requireNonEmpty(options.model, 'OpenRouter transcription model');
    this.timeoutMs = options.timeoutMs;
    this.languageCode = options.languageCode?.trim() || undefined;
    this.audioFormat = options.audioFormat?.trim() || undefined;
    this.temperature = options.temperature;
    this.providerConfig = options.provider;
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  async transcribe(input: VoiceTranscriptionInput): Promise<VoiceTranscriptionResult> {
    const body: Record<string, unknown> = {
      input_audio: {
        data: input.audio.toString('base64'),
        format: inferOpenRouterAudioFormat(input, this.audioFormat),
      },
      model: this.model,
    };
    const language = input.languageCode ?? this.languageCode;
    if (language) body.language = language;
    if (this.providerConfig) body.provider = this.providerConfig;
    if (this.temperature !== undefined) body.temperature = this.temperature;

    const response = await this.fetchImpl(buildUrl(this.baseUrl, '/audio/transcriptions'), {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      signal: withTimeout(this.timeoutMs),
    });
    const parsed = await parseJsonOrText(response);
    if (!response.ok) {
      throw new Error(`OpenRouter transcription failed (${response.status}): ${extractText(parsed) ?? response.statusText}`);
    }
    const text = extractText(parsed);
    if (!text) {
      throw new Error('OpenRouter transcription did not return text');
    }
    return {
      text,
      provider: this.provider,
      model: this.model,
      languageCode: language,
      raw: parsed,
    };
  }
}

export class OpenAICompatibleVoiceTranscriber implements VoiceTranscriber {
  readonly provider = 'openai_compatible';

  private readonly baseUrl: string;
  private readonly apiKey?: string;
  private readonly model: string;
  private readonly timeoutMs?: number;
  private readonly languageCode?: string;
  private readonly responseFormat: 'json' | 'text' | 'verbose_json';
  private readonly fetchImpl: typeof fetch;

  constructor(options: OpenAICompatibleVoiceTranscriberOptions) {
    this.baseUrl = requireNonEmpty(options.baseUrl, 'OpenAI-compatible transcription base URL');
    this.apiKey = options.apiKey?.trim() || undefined;
    this.model = requireNonEmpty(options.model, 'OpenAI-compatible transcription model');
    this.timeoutMs = options.timeoutMs;
    this.languageCode = options.languageCode?.trim() || undefined;
    this.responseFormat = options.responseFormat ?? 'json';
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  async transcribe(input: VoiceTranscriptionInput): Promise<VoiceTranscriptionResult> {
    const form = new FormData();
    form.append('model', this.model);
    form.append(
      'file',
      new Blob([new Uint8Array(input.audio)], { type: input.mimeType || 'application/octet-stream' }),
      normalizeFilename(input.filename, input.mimeType),
    );
    appendOptional(form, 'language', input.languageCode ?? this.languageCode);
    appendOptional(form, 'response_format', this.responseFormat);

    const headers: Record<string, string> = {};
    if (this.apiKey) headers.Authorization = `Bearer ${this.apiKey}`;
    const response = await this.fetchImpl(buildUrl(this.baseUrl, '/audio/transcriptions'), {
      method: 'POST',
      headers,
      body: form,
      signal: withTimeout(this.timeoutMs),
    });
    const parsed = await parseJsonOrText(response);
    if (!response.ok) {
      throw new Error(`OpenAI-compatible transcription failed (${response.status}): ${extractText(parsed) ?? response.statusText}`);
    }
    const text = extractText(parsed);
    if (!text) {
      throw new Error('OpenAI-compatible transcription did not return text');
    }
    return {
      text,
      provider: this.provider,
      model: this.model,
      raw: parsed,
    };
  }
}

export class LocalCommandVoiceTranscriber implements VoiceTranscriber {
  readonly provider = 'local_command';

  private readonly command: string;
  private readonly args: string[];
  private readonly outputFormat: 'text' | 'json';
  private readonly timeoutMs: number;
  private readonly workingDirectory?: string;

  constructor(options: LocalCommandVoiceTranscriberOptions) {
    this.command = requireNonEmpty(options.command, 'Local transcription command');
    this.args = options.args ?? [];
    this.outputFormat = options.outputFormat ?? 'text';
    this.timeoutMs = options.timeoutMs ?? 120_000;
    this.workingDirectory = options.workingDirectory?.trim() || undefined;
  }

  async transcribe(input: VoiceTranscriptionInput): Promise<VoiceTranscriptionResult> {
    const tempRoot = resolve(tmpdir());
    const tempDir = await mkdtemp(join(tempRoot, 'guardian-voice-'));
    const resolvedTempDir = resolve(tempDir);
    const audioPath = join(resolvedTempDir, normalizeFilename(input.filename, input.mimeType));
    try {
      await writeFile(audioPath, input.audio);
      const args = this.buildArgs(audioPath);
      const stdout = await this.run(args, input, audioPath);
      const text = this.outputFormat === 'json'
        ? extractText(JSON.parse(stdout))
        : stdout.trim();
      if (!text) {
        throw new Error('Local transcription command did not return text');
      }
      return {
        text,
        provider: this.provider,
        raw: this.outputFormat === 'json' ? JSON.parse(stdout) : stdout,
      };
    } finally {
      if (resolvedTempDir.startsWith(`${tempRoot}${process.platform === 'win32' ? '\\' : '/'}`)) {
        await rm(resolvedTempDir, { recursive: true, force: true });
      }
    }
  }

  private buildArgs(audioPath: string): string[] {
    const replaced = this.args.map((arg) => arg.replaceAll('{{audioPath}}', audioPath));
    return replaced.some((arg) => arg.includes(audioPath)) ? replaced : [...replaced, audioPath];
  }

  private run(args: string[], input: VoiceTranscriptionInput, audioPath: string): Promise<string> {
    return new Promise((resolvePromise, reject) => {
      const child = spawn(this.command, args, {
        cwd: this.workingDirectory,
        shell: false,
        windowsHide: true,
        env: {
          ...process.env,
          GUARDIAN_VOICE_AUDIO_PATH: audioPath,
          GUARDIAN_VOICE_MIME_TYPE: input.mimeType,
          ...(input.languageCode ? { GUARDIAN_VOICE_LANGUAGE_CODE: input.languageCode } : {}),
          ...(input.deviceId ? { GUARDIAN_VOICE_DEVICE_ID: input.deviceId } : {}),
          ...(input.requestId ? { GUARDIAN_VOICE_REQUEST_ID: input.requestId } : {}),
        },
      });
      const stdout: Buffer[] = [];
      const stderr: Buffer[] = [];
      let settled = false;
      const timeout = setTimeout(() => {
        if (settled) return;
        settled = true;
        child.kill();
        reject(new Error(`Local transcription command timed out after ${this.timeoutMs}ms`));
      }, this.timeoutMs);

      child.stdout.on('data', (chunk: Buffer) => stdout.push(chunk));
      child.stderr.on('data', (chunk: Buffer) => stderr.push(chunk));
      child.on('error', (err) => {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        reject(err);
      });
      child.on('close', (code) => {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        if (code !== 0) {
          const detail = Buffer.concat(stderr).toString('utf-8').trim();
          reject(new Error(`Local transcription command exited with ${code}${detail ? `: ${detail}` : ''}`));
          return;
        }
        resolvePromise(Buffer.concat(stdout).toString('utf-8'));
      });
    });
  }
}
