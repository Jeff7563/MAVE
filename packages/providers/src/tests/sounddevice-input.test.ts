import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';
import type { ChildProcess } from 'node:child_process';
import {
  DEFAULT_AUDIO_FORMAT,
  DEFAULT_AUDIO_FRAME_BYTES,
  validateAudioFrame,
  type AudioFrame
} from '@mave/contracts';
import { SounddeviceAudioInputProvider } from '../audio/sounddevice-input.js';

class MockAudioCaptureProcess extends EventEmitter {
  public stdout = new PassThrough();
  public stderr = new PassThrough();
  public stdin = new PassThrough();
  public killed = false;
  public pid = 9999;
  public spawnArgs: { command: string; args: string[]; options: any };

  constructor(command: string, args: string[], options: any) {
    super();
    this.spawnArgs = { command, args, options };
  }

  kill(signal: string = 'SIGTERM'): boolean {
    this.killed = true;
    process.nextTick(() => {
      this.emit('close', 0, signal);
    });
    return true;
  }

  emitChunk(bytes: Uint8Array | Buffer): void {
    this.stdout.write(Buffer.from(bytes));
  }

  emitStderr(text: string): void {
    this.stderr.write(text);
  }

  closeProcess(code: number = 0): void {
    this.stdout.end();
    process.nextTick(() => {
      this.emit('close', code, null);
    });
  }
}

describe('SounddeviceAudioInputProvider', () => {
  let createdProcesses: MockAudioCaptureProcess[] = [];

  const mockSpawn = (command: string, args: string[], options: any): ChildProcess => {
    const proc = new MockAudioCaptureProcess(command, args, options);
    createdProcesses.push(proc);
    return proc as unknown as ChildProcess;
  };

  beforeEach(() => {
    createdProcesses = [];
  });

  describe('Device Enumeration', () => {
    it('successfully queries and parses available audio input devices', async () => {
      const provider = new SounddeviceAudioInputProvider({
        spawnFn: (cmd, args, opts) => {
          const proc = new MockAudioCaptureProcess(cmd, args, opts);
          createdProcesses.push(proc);
          process.nextTick(() => {
            proc.stdout.write(
              JSON.stringify([
                { id: '0', label: 'Default Microphone', isDefault: false },
                { id: '1', label: 'FIFINE K690 Microphone', isDefault: true }
              ]) + '\n'
            );
            proc.closeProcess(0);
          });
          return proc as unknown as ChildProcess;
        }
      });

      const devices = await provider.listDevices();
      expect(devices).toHaveLength(2);
      expect(devices[0]).toEqual({
        id: '0',
        label: 'Default Microphone',
        isDefault: false
      });
      expect(devices[1]).toEqual({
        id: '1',
        label: 'FIFINE K690 Microphone',
        isDefault: true
      });

      expect(createdProcesses[0]?.spawnArgs.args).toContain('--list-devices');
    });

    it('handles process exit failure during device listing', async () => {
      const provider = new SounddeviceAudioInputProvider({
        spawnFn: (cmd, args, opts) => {
          const proc = new MockAudioCaptureProcess(cmd, args, opts);
          createdProcesses.push(proc);
          process.nextTick(() => {
            proc.emitStderr('Device enumeration failed');
            proc.closeProcess(1);
          });
          return proc as unknown as ChildProcess;
        }
      });

      await expect(provider.listDevices()).rejects.toThrow(
        /Audio device enumeration exited with code 1/
      );
    });

    it('handles malformed JSON during device listing', async () => {
      const provider = new SounddeviceAudioInputProvider({
        spawnFn: (cmd, args, opts) => {
          const proc = new MockAudioCaptureProcess(cmd, args, opts);
          createdProcesses.push(proc);
          process.nextTick(() => {
            proc.stdout.write('INVALID_JSON\n');
            proc.closeProcess(0);
          });
          return proc as unknown as ChildProcess;
        }
      });

      await expect(provider.listDevices()).rejects.toThrow(
        /Failed to parse audio input device list/
      );
    });
  });

  describe('Audio Capture & Framing', () => {
    it('captures raw audio and emits canonical sequenced AudioFrames', async () => {
      let captureProcess: MockAudioCaptureProcess | null = null;

      const provider = new SounddeviceAudioInputProvider({
        deviceId: '1',
        spawnFn: (cmd, args, opts) => {
          captureProcess = new MockAudioCaptureProcess(cmd, args, opts);
          createdProcesses.push(captureProcess);
          return captureProcess as unknown as ChildProcess;
        }
      });

      const abortController = new AbortController();
      const frames: AudioFrame[] = [];

      const capturePromise = (async () => {
        for await (const frame of provider.capture({ signal: abortController.signal })) {
          validateAudioFrame(frame);
          frames.push(frame);
          if (frames.length === 3) {
            abortController.abort();
            break;
          }
        }
      })();

      // Emit 3 full 2560-byte PCM chunks
      await vi.waitFor(() => expect(captureProcess).not.toBeNull());

      for (let i = 0; i < 3; i++) {
        const dummyBuffer = Buffer.alloc(DEFAULT_AUDIO_FRAME_BYTES, i + 1);
        captureProcess!.emitChunk(dummyBuffer);
      }

      await capturePromise;

      expect(frames).toHaveLength(3);

      // Verify Frame 0
      expect(frames[0]!.sequence).toBe(0);
      expect(frames[0]!.timestampMs).toBe(0);
      expect(frames[0]!.format).toEqual(DEFAULT_AUDIO_FORMAT);
      expect(frames[0]!.data.byteLength).toBe(DEFAULT_AUDIO_FRAME_BYTES);
      expect(frames[0]!.data[0]).toBe(1);

      // Verify Frame 1
      expect(frames[1]!.sequence).toBe(1);
      expect(frames[1]!.timestampMs).toBe(80);
      expect(frames[1]!.data[0]).toBe(2);

      // Verify Frame 2
      expect(frames[2]!.sequence).toBe(2);
      expect(frames[2]!.timestampMs).toBe(160);
      expect(frames[2]!.data[0]).toBe(3);

      // Verify CLI arguments included --device 1
      expect(captureProcess!.spawnArgs.args).toContain('--device');
      expect(captureProcess!.spawnArgs.args).toContain('1');
    });

    it('correctly re-chunks arbitrary incoming buffer slices into 2560-byte frames', async () => {
      let captureProcess: MockAudioCaptureProcess | null = null;

      const provider = new SounddeviceAudioInputProvider({
        spawnFn: (cmd, args, opts) => {
          captureProcess = new MockAudioCaptureProcess(cmd, args, opts);
          createdProcesses.push(captureProcess);
          return captureProcess as unknown as ChildProcess;
        }
      });

      const abortController = new AbortController();
      const frames: AudioFrame[] = [];

      const capturePromise = (async () => {
        for await (const frame of provider.capture({ signal: abortController.signal })) {
          frames.push(frame);
          if (frames.length === 2) {
            abortController.abort();
            break;
          }
        }
      })();

      await vi.waitFor(() => expect(captureProcess).not.toBeNull());

      // Emit 5120 bytes split unevenly across 5 chunks (1024 bytes each)
      for (let i = 0; i < 5; i++) {
        captureProcess!.emitChunk(Buffer.alloc(1024, 42));
      }

      await capturePromise;

      expect(frames).toHaveLength(2);
      expect(frames[0]!.data.byteLength).toBe(2560);
      expect(frames[1]!.data.byteLength).toBe(2560);
    });

    it('handles short final frame on clean stream completion', async () => {
      let captureProcess: MockAudioCaptureProcess | null = null;

      const provider = new SounddeviceAudioInputProvider({
        spawnFn: (cmd, args, opts) => {
          captureProcess = new MockAudioCaptureProcess(cmd, args, opts);
          createdProcesses.push(captureProcess);
          return captureProcess as unknown as ChildProcess;
        }
      });

      const frames: AudioFrame[] = [];

      const capturePromise = (async () => {
        for await (const frame of provider.capture()) {
          frames.push(frame);
        }
      })();

      await vi.waitFor(() => expect(captureProcess).not.toBeNull());

      // Send 1 standard frame + 1000 bytes (even number of bytes for int16 samples)
      captureProcess!.emitChunk(Buffer.alloc(DEFAULT_AUDIO_FRAME_BYTES, 1));
      captureProcess!.emitChunk(Buffer.alloc(1000, 2));
      captureProcess!.closeProcess(0);

      await capturePromise;

      expect(frames).toHaveLength(2);
      expect(frames[0]!.data.byteLength).toBe(2560);
      expect(frames[0]!.isFinalChunk).toBeUndefined();

      expect(frames[1]!.data.byteLength).toBe(1000);
      expect(frames[1]!.isFinalChunk).toBe(true);
    });

    it('returns immediately if AbortSignal is already aborted', async () => {
      const provider = new SounddeviceAudioInputProvider({
        spawnFn: mockSpawn
      });

      const controller = new AbortController();
      controller.abort();

      const frames: AudioFrame[] = [];
      for await (const frame of provider.capture({ signal: controller.signal })) {
        frames.push(frame);
      }

      expect(frames).toHaveLength(0);
      expect(createdProcesses).toHaveLength(0);
    });

    it('cleans up process and stops emitting frames when AbortSignal fires', async () => {
      let captureProcess: MockAudioCaptureProcess | null = null;

      const provider = new SounddeviceAudioInputProvider({
        spawnFn: (cmd, args, opts) => {
          captureProcess = new MockAudioCaptureProcess(cmd, args, opts);
          createdProcesses.push(captureProcess);
          return captureProcess as unknown as ChildProcess;
        }
      });

      const controller = new AbortController();
      const frames: AudioFrame[] = [];

      const capturePromise = (async () => {
        for await (const frame of provider.capture({ signal: controller.signal })) {
          frames.push(frame);
        }
      })();

      await vi.waitFor(() => expect(captureProcess).not.toBeNull());

      // Emit 1 frame
      captureProcess!.emitChunk(Buffer.alloc(DEFAULT_AUDIO_FRAME_BYTES));
      await vi.waitFor(() => expect(frames).toHaveLength(1));

      // Abort
      controller.abort();

      // Emit another frame after abort
      captureProcess!.emitChunk(Buffer.alloc(DEFAULT_AUDIO_FRAME_BYTES));

      await capturePromise;

      // No new frames after abort
      expect(frames).toHaveLength(1);
      expect(captureProcess!.killed).toBe(true);
    });

    it('normalizes error on device not found / invalid device', async () => {
      let captureProcess: MockAudioCaptureProcess | null = null;

      const provider = new SounddeviceAudioInputProvider({
        deviceId: 'invalid-device-999',
        spawnFn: (cmd, args, opts) => {
          captureProcess = new MockAudioCaptureProcess(cmd, args, opts);
          createdProcesses.push(captureProcess);
          return captureProcess as unknown as ChildProcess;
        }
      });

      const capturePromise = (async () => {
        const frames: AudioFrame[] = [];
        for await (const frame of provider.capture()) {
          frames.push(frame);
        }
      })();

      await vi.waitFor(() => expect(captureProcess).not.toBeNull());
      captureProcess!.emitStderr('Specified audio input device not found');
      captureProcess!.closeProcess(1);

      await expect(capturePromise).rejects.toThrow(
        /Audio input device 'invalid-device-999' not found or unavailable/
      );
    });

    it('normalizes error on device busy / permission denied', async () => {
      let captureProcess: MockAudioCaptureProcess | null = null;

      const provider = new SounddeviceAudioInputProvider({
        deviceId: 'fifine-busy',
        spawnFn: (cmd, args, opts) => {
          captureProcess = new MockAudioCaptureProcess(cmd, args, opts);
          createdProcesses.push(captureProcess);
          return captureProcess as unknown as ChildProcess;
        }
      });

      const capturePromise = (async () => {
        const frames: AudioFrame[] = [];
        for await (const frame of provider.capture()) {
          frames.push(frame);
        }
      })();

      await vi.waitFor(() => expect(captureProcess).not.toBeNull());
      captureProcess!.emitStderr('Audio device is busy: exclusive lock failed');
      captureProcess!.closeProcess(1);

      await expect(capturePromise).rejects.toThrow(
        /Audio input device 'fifine-busy' is busy or permission was denied/
      );
    });

    it('enforces bounded queue policy by dropping oldest frames on overflow', async () => {
      let captureProcess: MockAudioCaptureProcess | null = null;

      const provider = new SounddeviceAudioInputProvider({
        maxQueueSize: 2, // Tiny queue for testing overflow
        spawnFn: (cmd, args, opts) => {
          captureProcess = new MockAudioCaptureProcess(cmd, args, opts);
          createdProcesses.push(captureProcess);
          return captureProcess as unknown as ChildProcess;
        }
      });

      const abortController = new AbortController();

      // Start capture: calling next() initiates the async generator body and spawns the process
      const generator = provider.capture({ signal: abortController.signal })[Symbol.asyncIterator]();
      const firstPullPromise = generator.next();

      await vi.waitFor(() => expect(captureProcess).not.toBeNull());

      // Push 4 frames into a queue of max size 2
      // Frame 0: value 1
      // Frame 1: value 2
      // Frame 2: value 3 (causes Frame 0 to drop)
      // Frame 3: value 4 (causes Frame 1 to drop)
      captureProcess!.emitChunk(Buffer.alloc(DEFAULT_AUDIO_FRAME_BYTES, 1));
      captureProcess!.emitChunk(Buffer.alloc(DEFAULT_AUDIO_FRAME_BYTES, 2));
      captureProcess!.emitChunk(Buffer.alloc(DEFAULT_AUDIO_FRAME_BYTES, 3));
      captureProcess!.emitChunk(Buffer.alloc(DEFAULT_AUDIO_FRAME_BYTES, 4));

      // First frame resolved
      const f1 = await firstPullPromise;
      const f2 = await generator.next();

      abortController.abort();

      expect(f1.done).toBe(false);
      expect(f2.done).toBe(false);

      // Remaining frames should be frame 2 (val 3) and frame 3 (val 4)
      expect(f1.value.data[0]).toBe(3);
      expect(f2.value.data[0]).toBe(4);
    });

    it('supports multiple sequential capture sessions without leak or state conflict', async () => {
      let processCounter = 0;

      const provider = new SounddeviceAudioInputProvider({
        spawnFn: (cmd, args, opts) => {
          processCounter++;
          const proc = new MockAudioCaptureProcess(cmd, args, opts);
          createdProcesses.push(proc);
          return proc as unknown as ChildProcess;
        }
      });

      // Session 1
      const ac1 = new AbortController();
      const p1 = (async () => {
        for await (const _frame of provider.capture({ signal: ac1.signal })) {
          ac1.abort();
          break;
        }
      })();
      await vi.waitFor(() => expect(createdProcesses.length).toBe(1));
      createdProcesses[0]!.emitChunk(Buffer.alloc(DEFAULT_AUDIO_FRAME_BYTES));
      await p1;

      // Session 2
      const ac2 = new AbortController();
      const p2 = (async () => {
        for await (const _frame of provider.capture({ signal: ac2.signal })) {
          ac2.abort();
          break;
        }
      })();
      await vi.waitFor(() => expect(createdProcesses.length).toBe(2));
      createdProcesses[1]!.emitChunk(Buffer.alloc(DEFAULT_AUDIO_FRAME_BYTES));
      await p2;

      expect(processCounter).toBe(2);
    });
  });

  describe('Lifecycle & Health', () => {
    it('reports health accurately and degrades when disposed', async () => {
      const provider = new SounddeviceAudioInputProvider({
        fsExistsFn: () => true
      });

      const h1 = await provider.health();
      expect(h1.status).toBe('healthy');

      await provider.dispose();

      const h2 = await provider.health();
      expect(h2.status).toBe('degraded');

      await expect(provider.listDevices()).rejects.toThrow(/disposed/);
      await expect(async () => {
        for await (const _ of provider.capture()) {
          // should throw
        }
      }).rejects.toThrow(/disposed/);
    });
  });
});
