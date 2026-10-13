import { describe, it, expect, beforeEach } from 'vitest';
import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';
import type { ChildProcess } from 'node:child_process';
import type { SpeechRequest } from '@mave/contracts';
import {
  EdgeTTSProvider,
  resolveTTSPythonExecutable
} from '../tts/edge-tts.js';

class MockTTSProcess extends EventEmitter {
  public stdout = new PassThrough();
  public stderr = new PassThrough();
  public stdin = new PassThrough();
  public killed = false;
  public pid = 7777;
  public receivedPackets: Array<{ type: number; length: number; data: Buffer }> = [];

  constructor() {
    super();

    let buffer = Buffer.alloc(0);
    this.stdin.on('data', (chunk: Buffer) => {
      buffer = Buffer.concat([buffer, chunk]);
      while (buffer.length >= 5) {
        const type = buffer.readUInt8(0);
        const length = buffer.readUInt32BE(1);
        if (buffer.length < 5 + length) break;
        const data = buffer.subarray(5, 5 + length);
        buffer = buffer.subarray(5 + length);
        this.receivedPackets.push({ type, length, data });
      }
    });

    process.nextTick(() => {
      this.stdout.write(
        JSON.stringify({
          type: 'ready',
          defaultVoiceTh: 'th-TH-PremwadeeNeural',
          defaultVoiceEn: 'en-US-JennyNeural',
          sampleRate: 16000,
          channels: 1,
          timestamp: Date.now()
        }) + '\n'
      );
    });
  }

  kill(signal: string = 'SIGTERM'): boolean {
    this.killed = true;
    process.nextTick(() => {
      this.emit('exit', 0, signal);
    });
    return true;
  }

  emitStdoutLine(obj: Record<string, unknown>): void {
    this.stdout.write(JSON.stringify(obj) + '\n');
  }
}

describe('EdgeTTSProvider', () => {
  let createdProcesses: MockTTSProcess[] = [];

  const mockSpawn = (): ChildProcess => {
    const proc = new MockTTSProcess();
    createdProcesses.push(proc);
    return proc as unknown as ChildProcess;
  };

  beforeEach(() => {
    createdProcesses = [];
  });

  describe('resolveTTSPythonExecutable', () => {
    it('returns explicit option when provided', () => {
      const res = resolveTTSPythonExecutable({ pythonExecutable: 'C:\\custom\\py.exe' });
      expect(res).toBe('C:\\custom\\py.exe');
    });

    it('returns MAVE_TTS_PYTHON env override', () => {
      const res = resolveTTSPythonExecutable({ env: { MAVE_TTS_PYTHON: 'C:\\env\\tts.exe' } });
      expect(res).toBe('C:\\env\\tts.exe');
    });

    it('resolves services/tts/.venv when exists on Windows', () => {
      const res = resolveTTSPythonExecutable({
        rootDir: 'C:\\project\\MAVE',
        platform: 'win32',
        fsExistsFn: (p) => p.includes('tts\\.venv')
      });
      expect(res).toContain('services\\tts\\.venv\\Scripts\\python.exe');
    });

    it('falls back to services/stt/.venv when tts venv does not exist', () => {
      const res = resolveTTSPythonExecutable({
        rootDir: 'C:\\project\\MAVE',
        platform: 'win32',
        fsExistsFn: (p) => p.includes('stt\\.venv')
      });
      expect(res).toContain('services\\stt\\.venv\\Scripts\\python.exe');
    });

    it('falls back to system python when neither venv exists', () => {
      const res = resolveTTSPythonExecutable({
        rootDir: 'C:\\project\\MAVE',
        platform: 'win32',
        fsExistsFn: () => false
      });
      expect(res).toBe('python');
    });
  });

  describe('Capabilities & Health', () => {
    it('returns valid TTSCapabilities descriptor', () => {
      const provider = new EdgeTTSProvider({ spawnFn: mockSpawn });
      const caps = provider.getCapabilities();
      expect(caps.streaming).toBe(true);
      expect(caps.languages).toContain('th');
      expect(caps.languages).toContain('en');
      expect(caps.local).toBe(false);
    });

    it('returns healthy status when subprocess is running', async () => {
      const provider = new EdgeTTSProvider({ spawnFn: mockSpawn });
      const health = await provider.health();
      expect(health.status).toBe('healthy');
      expect(health.checkedAt).toBeGreaterThan(0);
      expect(health.message).toContain('edge-tts');
    });

    it('returns unhealthy when provider is disposed', async () => {
      const provider = new EdgeTTSProvider({ spawnFn: mockSpawn });
      await provider.dispose();
      const health = await provider.health();
      expect(health.status).toBe('unhealthy');
      expect(health.message).toContain('disposed');
    });
  });

  describe('Speech Synthesis Stream', () => {
    it('synthesizes speech request into AudioFrames', async () => {
      const provider = new EdgeTTSProvider({ spawnFn: mockSpawn });
      const reqId = 'tts-req-1';

      const request: SpeechRequest = {
        requestId: reqId,
        text: 'วันนี้เหนื่อยมาก',
        language: 'th'
      };

      const synthPromise = (async () => {
        const events = [];
        for await (const evt of provider.synthesize(request)) {
          events.push(evt);
        }
        return events;
      })();

      await new Promise((r) => setTimeout(r, 20));
      expect(createdProcesses.length).toBe(1);
      const proc = createdProcesses[0]!;

      // Simulate python server responding with events
      proc.emitStdoutLine({
        type: 'started',
        requestId: reqId,
        timestamp: Date.now()
      });

      const fakePcmBase64 = Buffer.alloc(2560).toString('base64');
      proc.emitStdoutLine({
        type: 'audio',
        requestId: reqId,
        sequence: 0,
        timestampMs: 0,
        data: fakePcmBase64,
        timestamp: Date.now()
      });

      proc.emitStdoutLine({
        type: 'completed',
        requestId: reqId,
        durationMs: 80,
        timestamp: Date.now()
      });

      const events = await synthPromise;
      expect(events.map((e) => e.type)).toEqual(['started', 'audio', 'completed']);

      const audioEvt = events.find((e) => e.type === 'audio') as any;
      expect(audioEvt.frame.data).toBeInstanceOf(Uint8Array);
      expect(audioEvt.frame.data.byteLength).toBe(2560);

      // Verify control packet sent
      expect(proc.receivedPackets.length).toBeGreaterThan(0);
      const cmd = JSON.parse(proc.receivedPackets[0]!.data.toString('utf-8'));
      expect(cmd.action).toBe('synthesize');
      expect(cmd.text).toBe('วันนี้เหนื่อยมาก');
    });

    it('handles cancellation via AbortSignal', async () => {
      const provider = new EdgeTTSProvider({ spawnFn: mockSpawn });
      const reqId = 'tts-cancel-1';
      const controller = new AbortController();

      const request: SpeechRequest = {
        requestId: reqId,
        text: 'Test cancel'
      };

      const synthPromise = (async () => {
        const events = [];
        for await (const evt of provider.synthesize(request, { signal: controller.signal })) {
          events.push(evt);
        }
        return events;
      })();

      await new Promise((r) => setTimeout(r, 20));
      const proc = createdProcesses[0]!;

      controller.abort();
      proc.emitStdoutLine({
        type: 'cancelled',
        requestId: reqId,
        reason: 'caller_cancelled',
        timestamp: Date.now()
      });

      const events = await synthPromise;
      expect(events.some((e) => e.type === 'cancelled')).toBe(true);
    });

    it('handles unexpected process exit with tts_unavailable error', async () => {
      const provider = new EdgeTTSProvider({ spawnFn: mockSpawn });
      const reqId = 'tts-crash-1';

      const request: SpeechRequest = {
        requestId: reqId,
        text: 'Test crash'
      };

      const synthPromise = (async () => {
        const events = [];
        for await (const evt of provider.synthesize(request)) {
          events.push(evt);
        }
        return events;
      })();

      await new Promise((r) => setTimeout(r, 20));
      const proc = createdProcesses[0]!;
      proc.emit('exit', 1, 'SIGKILL');

      const events = await synthPromise;
      const errEvt = events.find((e) => e.type === 'error') as any;
      expect(errEvt).toBeDefined();
      expect(errEvt.error.code).toBe('tts_unavailable');
    });
  });
});
