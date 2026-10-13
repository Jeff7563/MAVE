import { describe, it, expect, beforeEach } from 'vitest';
import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';
import fs from 'node:fs';
import path from 'node:path';
import type { ChildProcess } from 'node:child_process';
import {
  DEFAULT_AUDIO_FORMAT,
  type AudioFrame,
  type STTRequestOptions
} from '@mave/contracts';
import {
  FasterWhisperSTTProvider,
  resolveSTTPythonExecutable
} from '../stt/faster-whisper.js';

class MockSTTProcess extends EventEmitter {
  public stdout = new PassThrough();
  public stderr = new PassThrough();
  public stdin = new PassThrough();
  public killed = false;
  public pid = 8888;
  public spawnArgs: { command: string; args: string[]; options: any };
  public receivedPackets: Array<{ type: number; length: number; data: Buffer }> = [];

  constructor(command: string, args: string[], options: any) {
    super();
    this.spawnArgs = { command, args, options };

    // Parse framed binary packets written to stdin
    let buffer = Buffer.alloc(0);
    this.stdin.on('data', (chunk: Buffer) => {
      buffer = Buffer.concat([buffer, chunk]);
      while (buffer.length >= 5) {
        const type = buffer.readUInt8(0);
        const length = buffer.readUInt32BE(1);
        if (buffer.length < 5 + length) {
          break;
        }
        const data = buffer.subarray(5, 5 + length);
        buffer = buffer.subarray(5 + length);
        this.receivedPackets.push({ type, length, data });
      }
    });

    // Auto-emit ready event on next tick
    process.nextTick(() => {
      this.stdout.write(
        JSON.stringify({
          type: 'ready',
          model: 'large-v3-turbo',
          device: 'cuda',
          computeType: 'float16',
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

describe('FasterWhisperSTTProvider', () => {
  let createdProcesses: MockSTTProcess[] = [];

  const mockSpawn = (cmd: string, args: string[], opts: any): ChildProcess => {
    const proc = new MockSTTProcess(cmd, args, opts);
    createdProcesses.push(proc);
    return proc as unknown as ChildProcess;
  };

  beforeEach(() => {
    createdProcesses = [];
  });

  describe('resolveSTTPythonExecutable', () => {
    it('returns explicit pythonExecutable when specified', () => {
      const res = resolveSTTPythonExecutable({
        pythonExecutable: 'C:\\custom\\python.exe'
      });
      expect(res).toBe('C:\\custom\\python.exe');
    });

    it('returns environment override MAVE_STT_PYTHON', () => {
      const res = resolveSTTPythonExecutable({
        env: { MAVE_STT_PYTHON: 'C:\\env\\python.exe' }
      });
      expect(res).toBe('C:\\env\\python.exe');
    });

    it('resolves virtual environment path when file exists on Windows', () => {
      const res = resolveSTTPythonExecutable({
        rootDir: 'C:\\project\\MAVE',
        platform: 'win32',
        fsExistsFn: (p) => p.includes('.venv')
      });
      expect(res).toContain('services\\stt\\.venv\\Scripts\\python.exe');
    });

    it('resolves virtual environment path when file exists on Linux/macOS', () => {
      const res = resolveSTTPythonExecutable({
        rootDir: '/home/user/MAVE',
        platform: 'linux',
        fsExistsFn: (p) => p.includes('.venv')
      });
      expect(res).toBe('/home/user/MAVE/services/stt/.venv/bin/python');
    });

    it('falls back to system python when venv does not exist', () => {
      const res = resolveSTTPythonExecutable({
        rootDir: 'C:\\project\\MAVE',
        platform: 'win32',
        fsExistsFn: () => false
      });
      expect(res).toBe('python');
    });
  });

  describe('Capabilities & Health', () => {
    it('returns valid STT capabilities conforming to schema', () => {
      const provider = new FasterWhisperSTTProvider({ spawnFn: mockSpawn });
      const caps = provider.getCapabilities();
      expect(caps.streaming).toBe(true);
      expect(caps.partialTranscripts).toBe(false);
      expect(caps.languageDetection).toBe(true);
      expect(caps.wordTimestamps).toBe(true);
      expect(caps.confidence).toBe(true);
      expect(caps.local).toBe(true);
    });

    it('reports healthy status when subprocess initializes successfully', async () => {
      const provider = new FasterWhisperSTTProvider({ spawnFn: mockSpawn });
      const health = await provider.health();
      expect(health.status).toBe('healthy');
      expect(health.checkedAt).toBeGreaterThan(0);
      expect(health.message).toContain('faster-whisper');
    });

    it('reports unhealthy when provider is disposed', async () => {
      const provider = new FasterWhisperSTTProvider({ spawnFn: mockSpawn });
      await provider.dispose();
      const health = await provider.health();
      expect(health.status).toBe('unhealthy');
      expect(health.message).toContain('disposed');
    });
  });

  describe('Transcription Stream', () => {
    const makeAudioFrame = (seq: number): AudioFrame => ({
      data: new Uint8Array(1280 * 2), // 80ms mono 16kHz s16le
      format: DEFAULT_AUDIO_FORMAT,
      sequence: seq,
      timestampMs: Date.now()
    });

    async function* makeAudioStream(count: number): AsyncIterable<AudioFrame> {
      for (let i = 0; i < count; i++) {
        yield makeAudioFrame(i);
      }
    }

    it('successfully streams audio frames and receives Thai transcript', async () => {
      const provider = new FasterWhisperSTTProvider({ spawnFn: mockSpawn });
      const reqId = 'req-thai-123';

      const audio = makeAudioStream(3);
      const options: STTRequestOptions = {
        requestId: reqId,
        languageHint: 'th-TH'
      };

      const transcribePromise = (async () => {
        const events = [];
        for await (const evt of provider.transcribe(audio, options)) {
          events.push(evt);
        }
        return events;
      })();

      // Wait a tick for process to be created and start packet sent
      await new Promise((r) => setTimeout(r, 20));
      expect(createdProcesses.length).toBe(1);
      const proc = createdProcesses[0]!;

      // Simulate python server responding with events
      proc.emitStdoutLine({
        type: 'started',
        requestId: reqId,
        timestamp: Date.now()
      });
      proc.emitStdoutLine({
        type: 'speech_started',
        requestId: reqId,
        timestamp: Date.now()
      });
      proc.emitStdoutLine({
        type: 'speech_ended',
        requestId: reqId,
        timestamp: Date.now()
      });
      proc.emitStdoutLine({
        type: 'final_transcript',
        requestId: reqId,
        text: 'วันนี้เหนื่อยมาก ภาษาอังกฤษพูดยังไง',
        confidence: 0.985,
        language: 'th',
        words: [
          { text: 'วันนี้', startMs: 0, endMs: 400, confidence: 0.99 },
          { text: 'เหนื่อยมาก', startMs: 450, endMs: 900, confidence: 0.98 }
        ],
        timestamp: Date.now()
      });

      const events = await transcribePromise;

      expect(events.map((e) => e.type)).toEqual([
        'started',
        'speech_started',
        'speech_ended',
        'final_transcript'
      ]);

      const finalEvt = events.find((e) => e.type === 'final_transcript') as any;
      expect(finalEvt.text).toBe('วันนี้เหนื่อยมาก ภาษาอังกฤษพูดยังไง');
      expect(finalEvt.language).toBe('th');
      expect(finalEvt.words).toHaveLength(2);

      // Verify that stdin packets were sent (type 1 for JSON, type 2 for PCM)
      const packetTypes = proc.receivedPackets.map((p) => p.type);
      expect(packetTypes).toContain(1); // control packet
      expect(packetTypes).toContain(2); // audio PCM packet

      // Check start command in first control packet
      const firstCtrl = JSON.parse(proc.receivedPackets[0]!.data.toString('utf-8'));
      expect(firstCtrl.action).toBe('start');
      expect(firstCtrl.requestId).toBe(reqId);
      expect(firstCtrl.language).toBe('th-TH');
    });

    it('handles cancellation via AbortSignal', async () => {
      const provider = new FasterWhisperSTTProvider({ spawnFn: mockSpawn });
      const reqId = 'req-cancel-456';
      const controller = new AbortController();

      const audio = makeAudioStream(5);
      const options: STTRequestOptions = {
        requestId: reqId,
        signal: controller.signal
      };

      const transcribePromise = (async () => {
        const events = [];
        for await (const evt of provider.transcribe(audio, options)) {
          events.push(evt);
        }
        return events;
      })();

      await new Promise((r) => setTimeout(r, 20));
      const proc = createdProcesses[0]!;

      // Abort signal
      controller.abort();

      // Simulate python server acknowledging cancellation
      proc.emitStdoutLine({
        type: 'cancelled',
        requestId: reqId,
        reason: 'caller_cancelled',
        timestamp: Date.now()
      });

      const events = await transcribePromise;
      expect(events.some((e) => e.type === 'cancelled')).toBe(true);
    });

    it('handles unexpected process exit by emitting stt_unavailable error event', async () => {
      const provider = new FasterWhisperSTTProvider({ spawnFn: mockSpawn });
      const reqId = 'req-crash-789';

      const audio = makeAudioStream(3);
      const options: STTRequestOptions = { requestId: reqId };

      const transcribePromise = (async () => {
        const events = [];
        for await (const evt of provider.transcribe(audio, options)) {
          events.push(evt);
        }
        return events;
      })();

      await new Promise((r) => setTimeout(r, 20));
      const proc = createdProcesses[0]!;

      // Crash process
      proc.emit('exit', 1, 'SIGKILL');

      const events = await transcribePromise;
      const errEvt = events.find((e) => e.type === 'error') as any;
      expect(errEvt).toBeDefined();
      expect(errEvt.error.code).toBe('stt_unavailable');
    });

    it('transcribes real WAV audio file end-to-end with real python subprocess when available', async () => {
      const candidates = [
        path.resolve(process.cwd(), 'test_audio/thai_tired.wav'),
        path.resolve(process.cwd(), '../../test_audio/thai_tired.wav')
      ];
      const wavPath = candidates.find((p) => fs.existsSync(p));
      if (!wavPath) {
        return;
      }

      const provider = new FasterWhisperSTTProvider();
      const pythonExe = provider.getResolvedPythonExecutable();
      if (!fs.existsSync(pythonExe)) {
        return;
      }

      // Read WAV file header and PCM bytes
      const fileBuf = fs.readFileSync(wavPath);
      // Skip 44-byte WAV header
      const pcmBytes = fileBuf.subarray(44);
      const chunkSize = 1280 * 2; // 80ms chunks

      async function* streamWavChunks(): AsyncIterable<AudioFrame> {
        let offset = 0;
        let seq = 0;
        while (offset < pcmBytes.length) {
          const end = Math.min(offset + chunkSize, pcmBytes.length);
          const chunk = pcmBytes.subarray(offset, end);
          yield {
            data: new Uint8Array(chunk),
            format: DEFAULT_AUDIO_FORMAT,
            sequence: seq++,
            timestampMs: Date.now()
          };
          offset = end;
        }
      }

      const events: any[] = [];
      for await (const evt of provider.transcribe(streamWavChunks(), {
        requestId: 'req-live-wav-test',
        languageHint: 'th'
      })) {
        events.push(evt);
      }

      const finalEvt = events.find((e) => e.type === 'final_transcript') as any;
      expect(finalEvt).toBeDefined();
      expect(finalEvt.text).toContain('เหนื่อย');
      expect(finalEvt.language).toBe('th');

      await provider.dispose();
    }, 30000);
  });
});

