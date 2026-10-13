import { describe, it, expect, beforeEach } from 'vitest';
import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';
import type { ChildProcess } from 'node:child_process';
import {
  DEFAULT_AUDIO_FORMAT,
  type AudioFrame
} from '@mave/contracts';
import { SounddeviceAudioOutput } from '../audio/sounddevice-output.js';

class MockAudioOutputProcess extends EventEmitter {
  public stdout = new PassThrough();
  public stderr = new PassThrough();
  public stdin = new PassThrough();
  public killed = false;
  public pid = 6666;
  public spawnArgs: { command: string; args: string[]; options: any };
  public receivedPackets: Array<{ type: number; length: number; data: Buffer }> = [];

  constructor(command: string, args: string[], options: any) {
    super();
    this.spawnArgs = { command, args, options };

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

    if (!args.includes('--list-devices')) {
      process.nextTick(() => {
        this.stdout.write(
          JSON.stringify({
            type: 'ready',
            sampleRate: 16000,
            channels: 1,
            timestampMs: Date.now()
          }) + '\n'
        );
      });
    }
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

describe('SounddeviceAudioOutput', () => {
  let createdProcesses: MockAudioOutputProcess[] = [];

  const mockSpawn = (cmd: string, args: string[], opts: any): ChildProcess => {
    const proc = new MockAudioOutputProcess(cmd, args, opts);
    createdProcesses.push(proc);
    return proc as unknown as ChildProcess;
  };

  beforeEach(() => {
    createdProcesses = [];
  });

  describe('Device Enumeration', () => {
    it('successfully queries output devices', async () => {
      const output = new SounddeviceAudioOutput({
        spawnFn: (cmd, args, opts) => {
          const proc = new MockAudioOutputProcess(cmd, args, opts);
          createdProcesses.push(proc);
          process.nextTick(() => {
            proc.stdout.write(
              JSON.stringify([
                { id: '4', label: 'Speakers (Realtek Audio)', isDefault: true },
                { id: '6', label: 'FIFINE K690 Headphone', isDefault: false }
              ]) + '\n'
            );
            proc.emit('close', 0, null);
          });
          return proc as unknown as ChildProcess;
        }
      });

      const devices = await output.listDevices();
      expect(devices).toHaveLength(2);
      expect(devices[0]!.id).toBe('4');
      expect(devices[0]!.isDefault).toBe(true);
      expect(devices[1]!.label).toContain('FIFINE');
    });
  });

  describe('Playback Controls & Barge-In Stop', () => {
    const makeFrame = (seq: number): AudioFrame => ({
      data: new Uint8Array(2560),
      format: DEFAULT_AUDIO_FORMAT,
      sequence: seq,
      timestampMs: seq * 80
    });

    async function* makeStream(count: number): AsyncIterable<AudioFrame> {
      for (let i = 0; i < count; i++) {
        yield makeFrame(i);
      }
    }

    it('plays stream and writes PCM chunks to stdin', async () => {
      const output = new SounddeviceAudioOutput({ spawnFn: mockSpawn });
      const stream = makeStream(3);

      const playPromise = output.playStream(stream, { volume: 0.8 });

      await new Promise((r) => setTimeout(r, 20));
      expect(createdProcesses.length).toBe(1);
      const proc = createdProcesses[0]!;

      // Simulate playback complete event
      proc.emitStdoutLine({ type: 'playback_completed' });

      await playPromise;

      const pcmPackets = proc.receivedPackets.filter((p) => p.type === 2);
      expect(pcmPackets.length).toBe(3);
      expect(pcmPackets[0]!.length).toBe(2560);
    });

    it('immediately ceases playback on stop() for barge-in', async () => {
      const output = new SounddeviceAudioOutput({ spawnFn: mockSpawn });
      const stream = makeStream(10);

      const playPromise = output.playStream(stream);

      await new Promise((r) => setTimeout(r, 20));
      const proc = createdProcesses[0]!;

      // User interrupts / barge-in occurs!
      await output.stop();

      expect(output.getPlaybackState()).toBe('stopped');

      // Check that stop control command was sent
      const stopCmd = proc.receivedPackets.find((p) => {
        if (p.type !== 1) return false;
        try {
          return JSON.parse(p.data.toString('utf-8')).action === 'stop';
        } catch {
          return false;
        }
      });
      expect(stopCmd).toBeDefined();

      await playPromise;
    });

    it('pauses and resumes playback', async () => {
      const output = new SounddeviceAudioOutput({ spawnFn: mockSpawn });
      await (output as any).ensureProcess();

      await output.pause();
      expect(output.getPlaybackState()).toBe('paused');

      await output.resume();
      expect(output.getPlaybackState()).toBe('playing');
    });

    it('dispatches level telemetry callbacks', async () => {
      const output = new SounddeviceAudioOutput({ spawnFn: mockSpawn });
      await (output as any).ensureProcess();
      const proc = createdProcesses[0]!;

      const levels: number[] = [];
      const unsubscribe = output.onLevel((lvl) => {
        levels.push(lvl.rms);
      });

      proc.emitStdoutLine({ type: 'level', rms: 0.42, timestampMs: Date.now() });
      expect(levels).toEqual([0.42]);

      unsubscribe();
      proc.emitStdoutLine({ type: 'level', rms: 0.99, timestampMs: Date.now() });
      expect(levels).toEqual([0.42]);
    });
  });
});
