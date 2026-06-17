import { afterEach, describe, expect, it, vi } from 'vitest';
import { Buffer } from 'node:buffer';
import { VoiceChannel } from './voice.js';
import {
  ElevenLabsVoiceTranscriber,
  LocalCommandVoiceTranscriber,
  OpenRouterVoiceTranscriber,
  type VoiceTranscriber,
} from './voice-transcription.js';
import type { AgentResponse, UserMessage } from '../agent/types.js';

const startedChannels: VoiceChannel[] = [];

async function startVoiceChannel(
  channel: VoiceChannel,
  handler?: (message: UserMessage) => Promise<AgentResponse>,
): Promise<number> {
  await channel.start(handler ?? (async (message) => ({ content: `heard: ${message.content}` })));
  startedChannels.push(channel);
  return channel.getListeningPort();
}

afterEach(async () => {
  await Promise.all(startedChannels.splice(0).map((channel) => channel.stop()));
});

describe('VoiceChannel', () => {
  it('rejects unauthenticated device requests when bearer auth is enabled', async () => {
    const channel = new VoiceChannel({
      host: '127.0.0.1',
      port: 0,
      auth: { mode: 'bearer_required', token: 'voice-token' },
    });
    const port = await startVoiceChannel(channel);

    const res = await fetch(`http://127.0.0.1:${port}/api/voice/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deviceId: 'box-3b' }),
    });

    expect(res.status).toBe(401);
  });

  it('registers devices and exposes detected device records', async () => {
    const channel = new VoiceChannel({
      host: '127.0.0.1',
      port: 0,
      auth: { mode: 'bearer_required', token: 'voice-token' },
      allowedDeviceIds: ['box-3b'],
      now: () => 123,
    });
    const port = await startVoiceChannel(channel);

    const register = await fetch(`http://127.0.0.1:${port}/api/voice/register`, {
      method: 'POST',
      headers: {
        Authorization: 'Bearer voice-token',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        deviceId: 'box-3b',
        deviceName: 'Kitchen Box',
        model: 'ESP32-S3-BOX-3B',
        capabilities: ['audio_upload'],
      }),
    });
    expect(register.status).toBe(200);

    const devices = await fetch(`http://127.0.0.1:${port}/api/voice/devices`, {
      headers: { Authorization: 'Bearer voice-token' },
    });
    const body = await devices.json() as { devices: Array<{ deviceId: string; deviceName?: string; capabilities: string[] }> };
    expect(body.devices).toEqual([
      expect.objectContaining({
        deviceId: 'box-3b',
        deviceName: 'Kitchen Box',
        capabilities: ['audio_upload'],
      }),
    ]);
  });

  it('dispatches pre-transcribed voice input through the normal message callback', async () => {
    const received: UserMessage[] = [];
    const channel = new VoiceChannel({
      host: '127.0.0.1',
      port: 0,
      auth: { mode: 'bearer_required', token: 'voice-token' },
      now: () => 456,
    });
    const port = await startVoiceChannel(channel, async (message) => {
      received.push(message);
      return { content: 'done' };
    });

    const res = await fetch(`http://127.0.0.1:${port}/api/voice/transcript`, {
      method: 'POST',
      headers: {
        Authorization: 'Bearer voice-token',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        deviceId: 'box-3b',
        transcript: 'Create a task to check the garage door',
        requestId: 'voice-req-1',
      }),
    });
    const body = await res.json() as { success: boolean; transcript: string; response: { content: string } };

    expect(res.status).toBe(200);
    expect(body).toMatchObject({
      success: true,
      transcript: 'Create a task to check the garage door',
      response: { content: 'done' },
    });
    expect(received).toHaveLength(1);
    expect(received[0]).toMatchObject({
      id: 'voice-req-1',
      userId: 'voice:box-3b',
      surfaceId: 'voice:box-3b',
      channel: 'voice',
      content: 'Create a task to check the garage door',
      principalId: 'voice-device:box-3b',
      principalRole: 'owner',
      metadata: {
        voice: expect.objectContaining({
          deviceId: 'box-3b',
          source: 'voice_channel',
          transcriptionProvider: 'device_or_bridge',
        }),
      },
    });
  });

  it('transcribes uploaded audio before dispatching the transcript', async () => {
    const received: UserMessage[] = [];
    const transcriber: VoiceTranscriber = {
      provider: 'fake_stt',
      async transcribe(input) {
        expect(input.mimeType).toBe('audio/wav');
        expect(input.audio.toString('utf-8')).toBe('fake audio');
        return {
          text: 'What is on my calendar today?',
          provider: 'fake_stt',
          model: 'fake-model',
          languageCode: 'en',
          languageProbability: 0.9,
        };
      },
    };
    const channel = new VoiceChannel({
      host: '127.0.0.1',
      port: 0,
      auth: { mode: 'bearer_required', token: 'voice-token' },
      transcriber,
    });
    const port = await startVoiceChannel(channel, async (message) => {
      received.push(message);
      return { content: 'calendar answer' };
    });

    const res = await fetch(`http://127.0.0.1:${port}/api/voice/audio`, {
      method: 'POST',
      headers: {
        Authorization: 'Bearer voice-token',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        deviceId: 'box-3b',
        audioBase64: Buffer.from('fake audio', 'utf-8').toString('base64'),
        mimeType: 'audio/wav',
      }),
    });
    const body = await res.json() as { transcript: string; transcription: { provider: string; model: string } };

    expect(res.status).toBe(200);
    expect(body).toMatchObject({
      transcript: 'What is on my calendar today?',
      transcription: { provider: 'fake_stt', model: 'fake-model' },
    });
    expect(received[0]?.content).toBe('What is on my calendar today?');
    expect(received[0]?.metadata?.voice).toMatchObject({
      transcriptionProvider: 'fake_stt',
      transcriptionModel: 'fake-model',
    });
  });
});

describe('voice transcribers', () => {
  it('calls ElevenLabs speech-to-text with multipart audio', async () => {
    const fetchImpl = vi.fn(async (_url: string, _init: RequestInit) => {
      return new Response(JSON.stringify({
        text: 'hello guardian',
        language_code: 'en',
        language_probability: 0.98,
      }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    });
    const transcriber = new ElevenLabsVoiceTranscriber({
      apiKey: 'eleven-key',
      modelId: 'scribe_v2',
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    const result = await transcriber.transcribe({
      audio: Buffer.from('audio'),
      mimeType: 'audio/wav',
      filename: 'sample.wav',
    });

    expect(result).toMatchObject({
      text: 'hello guardian',
      provider: 'elevenlabs',
      model: 'scribe_v2',
      languageCode: 'en',
      languageProbability: 0.98,
    });
    expect(fetchImpl).toHaveBeenCalledOnce();
    const [url, init] = fetchImpl.mock.calls[0]!;
    expect(url).toBe('https://api.elevenlabs.io/v1/speech-to-text');
    expect(init).toMatchObject({
      method: 'POST',
      headers: { 'xi-api-key': 'eleven-key' },
    });
    expect(init.body).toBeInstanceOf(FormData);
  });

  it('runs a local transcription command and reads stdout text', async () => {
    const transcriber = new LocalCommandVoiceTranscriber({
      command: process.execPath,
      args: ['-e', 'console.log("local transcript")'],
      outputFormat: 'text',
      timeoutMs: 10_000,
    });

    const result = await transcriber.transcribe({
      audio: Buffer.from('audio'),
      mimeType: 'audio/wav',
    });

    expect(result).toMatchObject({
      text: 'local transcript',
      provider: 'local_command',
    });
  });

  it('calls OpenRouter transcription with JSON base64 audio', async () => {
    const fetchImpl = vi.fn(async (_url: string, _init: RequestInit) => {
      return new Response(JSON.stringify({
        text: 'openrouter transcript',
      }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    });
    const transcriber = new OpenRouterVoiceTranscriber({
      apiKey: 'openrouter-key',
      model: 'openai/whisper-large-v3',
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    const result = await transcriber.transcribe({
      audio: Buffer.from('audio'),
      mimeType: 'audio/wav',
      filename: 'sample.wav',
      languageCode: 'en',
    });

    expect(result).toMatchObject({
      text: 'openrouter transcript',
      provider: 'openrouter',
      model: 'openai/whisper-large-v3',
      languageCode: 'en',
    });
    const [url, init] = fetchImpl.mock.calls[0]!;
    expect(url).toBe('https://openrouter.ai/api/v1/audio/transcriptions');
    expect(init).toMatchObject({
      method: 'POST',
      headers: {
        Authorization: 'Bearer openrouter-key',
        'Content-Type': 'application/json',
      },
    });
    expect(JSON.parse(String(init.body))).toEqual({
      input_audio: {
        data: Buffer.from('audio').toString('base64'),
        format: 'wav',
      },
      model: 'openai/whisper-large-v3',
      language: 'en',
    });
  });
});
