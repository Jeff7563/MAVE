import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';
import type { ChildProcess } from 'node:child_process';
import { MockWakeWordProvider } from '../wake/mock.js';
import { OpenWakeWordProvider } from '../wake/openwakeword.js';

class MockChildProcess extends EventEmitter {
  public stdout = new PassThrough();
  public stderr = new PassThrough();
  public stdin = new PassThrough();
  public killed = false;
  public pid = 12345;
  public writtenCommands: any[] = [];

  constructor() {
    super();
    let buffer = '';
    this.stdin.on('data', (chunk) => {
      buffer += chunk.toString();
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';
      for (const line of lines) {
        if (line.trim()) {
          try {
            this.writtenCommands.push(JSON.parse(line.trim()));
          } catch {
            this.writtenCommands.push(line.trim());
          }
        }
      }
    });
  }

  kill(signal?: string): boolean {
    this.killed = true;
    this.emit('exit', 0, signal || 'SIGTERM');
    return true;
  }

  sendStdoutLine(data: Record<string, unknown> | string): void {
    const text = typeof data === 'string' ? data : JSON.stringify(data);
    this.stdout.write(text + '\n');
  }
}

describe('MockWakeWordProvider', () => {
  it('manages lifecycle correctly', async () => {
    const provider = new MockWakeWordProvider();
    expect(provider.getStatus()).toBe('ready');

    await provider.start();
    expect(provider.getStatus()).toBe('listening');
    expect(provider.running).toBe(true);

    // Repeated start should be idempotent
    await provider.start();
    expect(provider.getStatus()).toBe('listening');

    await provider.stop();
    expect(provider.getStatus()).toBe('ready');
    expect(provider.running).toBe(false);

    // Repeated stop should be idempotent
    await provider.stop();
    expect(provider.getStatus()).toBe('ready');

    await provider.dispose();
    expect(provider.getStatus()).toBe('not_configured');
  });

  it('delivers wake events to subscribers', async () => {
    const provider = new MockWakeWordProvider();
    const wakeSpy = vi.fn();
    const unsubscribe = provider.onWake(wakeSpy);

    await provider.start();
    provider.simulateWake();

    expect(wakeSpy).toHaveBeenCalledTimes(1);
    expect(provider.getDiagnostics().lastWakeAt).toBeDefined();

    unsubscribe();
    provider.simulateWake();
    expect(wakeSpy).toHaveBeenCalledTimes(1);
  });

  it('manages device selection and threshold', () => {
    const provider = new MockWakeWordProvider();
    provider.setAvailableDevices(['System Default', 'USB Mic 1']);
    provider.setMicrophone(1);

    const diag = provider.getDiagnostics();
    expect(diag.microphoneIndex).toBe(1);
    expect(diag.microphoneName).toBe('USB Mic 1');
    expect(diag.wakeProvider).toBe('openWakeWord');

    provider.setThreshold(0.75);
    expect(provider.getDiagnostics().threshold).toBe(0.75);
    expect(provider.getDiagnostics().sensitivity).toBe(0.75);
  });

  it('supports testAudioFile for offline evaluation', async () => {
    const provider = new MockWakeWordProvider();
    const result = await provider.testAudioFile('test_sample.wav');

    expect(result.path).toBe('test_sample.wav');
    expect(result.wakeDetected).toBe(true);
    expect(result.maxScore).toBe(0.85);
  });
});

describe('OpenWakeWordProvider Supervisor & Protocol', () => {
  let mockProc: MockChildProcess;
  let spawnCalls: { command: string; args: string[]; options: any }[];

  beforeEach(() => {
    mockProc = new MockChildProcess();
    spawnCalls = [];
  });

  function createProvider(overrides?: any): OpenWakeWordProvider {
    return new OpenWakeWordProvider({
      modelPath: 'assets/wake/mave.onnx',
      threshold: 0.5,
      spawnFn: (command, args, options) => {
        spawnCalls.push({ command, args, options });
        // Emit an initial status line as real Python service does
        setTimeout(() => {
          mockProc.sendStdoutLine({
            type: 'status',
            status: 'ready',
            device: 'Mock Mic',
            device_index: 0,
            threshold: 0.5,
            available_devices: ['Mock Mic'],
            model_loaded: true
          });
        }, 10);
        return mockProc as unknown as ChildProcess;
      },
      ...overrides
    });
  }

  it('starts process supervisor and transitions status', async () => {
    const provider = createProvider();
    await provider.start();

    expect(spawnCalls.length).toBe(1);
    expect(provider.getStatus()).toBe('listening');
    expect(provider.running).toBe(true);
    expect(mockProc.writtenCommands).toContainEqual({ command: 'start' });
  });

  it('prevents duplicate start (idempotent start)', async () => {
    const provider = createProvider();
    await provider.start();
    await provider.start(); // second call

    expect(spawnCalls.length).toBe(1);
    expect(provider.getStatus()).toBe('listening');
  });

  it('stops and performs clean shutdown on dispose', async () => {
    const provider = createProvider();
    await provider.start();

    await provider.stop();
    expect(provider.getStatus()).toBe('ready');
    expect(mockProc.writtenCommands).toContainEqual({ command: 'stop' });

    await provider.dispose();
    expect(provider.getStatus()).toBe('not_configured');
    expect(mockProc.writtenCommands).toContainEqual({ command: 'quit' });
  });

  it('parses JSON protocol wake_detected and notifies listeners', async () => {
    const provider = createProvider();
    const wakeSpy = vi.fn();
    provider.onWake(wakeSpy);

    await provider.start();

    mockProc.sendStdoutLine({
      type: 'wake_detected',
      model: 'mave',
      score: 0.88,
      timestamp: 1700000000000
    });

    expect(wakeSpy).toHaveBeenCalledTimes(1);
    expect(provider.getDiagnostics().lastWakeAt).toBe(1700000000000);
  });

  it('handles malformed protocol lines and empty lines gracefully without crashing', async () => {
    const provider = createProvider();
    await provider.start();

    // Malformed JSON and empty lines
    mockProc.sendStdoutLine('');
    mockProc.sendStdoutLine('   ');
    mockProc.sendStdoutLine('{ invalid json not closed');
    mockProc.sendStdoutLine('just random stderr log leaking to stdout');

    // Subsequent valid message still parses correctly
    mockProc.sendStdoutLine({
      type: 'status',
      status: 'listening',
      device: 'Mock Mic 2',
      threshold: 0.6,
      model_loaded: true
    });

    expect(provider.getDiagnostics().microphoneName).toBe('Mock Mic 2');
    expect(provider.getDiagnostics().threshold).toBe(0.6);
  });

  it('handles error protocol messages safely', async () => {
    const provider = createProvider();
    const errorSpy = vi.fn();
    provider.onError(errorSpy);

    await provider.start();

    mockProc.sendStdoutLine({
      type: 'error',
      code: 'AUDIO_DEVICE_ERROR',
      message: 'Failed to access audio hardware'
    });

    expect(provider.getStatus()).toBe('error');
    expect(provider.getDiagnostics().errorMessage).toBe('Failed to access audio hardware');
    expect(errorSpy).toHaveBeenCalled();
  });

  it('reports missing model safely', async () => {
    const provider = createProvider();
    await provider.start();

    mockProc.sendStdoutLine({
      type: 'status',
      status: 'not_configured',
      device: 'Mock Mic',
      threshold: 0.5,
      model_loaded: false,
      error_message: 'Keyword model file missing: assets/wake/mave.onnx'
    });

    const diag = provider.getDiagnostics();
    expect(diag.isConfigured).toBe(false);
    expect(diag.errorMessage).toContain('Keyword model file missing');
  });

  it('processes offline WAV audio test via protocol', async () => {
    const provider = createProvider();
    await provider.start();

    const testPromise = provider.testAudioFile('fixtures/wake_test.wav');

    // Allow tick for testAudioFile to register in pendingWavTests
    await new Promise((r) => setTimeout(r, 10));

    // Python service responds with test_audio_result
    mockProc.sendStdoutLine({
      type: 'test_audio_result',
      path: 'fixtures/wake_test.wav',
      max_score: 0.92,
      wake_detected: true,
      frames_processed: 25,
      scores: [0.1, 0.4, 0.92]
    });

    const result = await testPromise;
    expect(result.path).toBe('fixtures/wake_test.wav');
    expect(result.maxScore).toBe(0.92);
    expect(result.wakeDetected).toBe(true);
    expect(result.framesProcessed).toBe(25);
  });

  it('sends device selection and threshold update commands', async () => {
    const provider = createProvider();
    await provider.start();

    await provider.setMicrophone(2);
    expect(mockProc.writtenCommands).toContainEqual({ command: 'set_device', index: 2 });

    await provider.setThreshold(0.7);
    expect(mockProc.writtenCommands).toContainEqual({ command: 'set_threshold', threshold: 0.7 });
  });

  it('surfaces unexpected process exit after retry backoff', async () => {
    let activeProc = mockProc;
    const provider = new OpenWakeWordProvider({
      modelPath: 'assets/wake/mave.onnx',
      threshold: 0.5,
      spawnFn: () => {
        const p = new MockChildProcess();
        activeProc = p;
        setTimeout(() => {
          p.sendStdoutLine({
            type: 'status',
            status: 'ready',
            device: 'Mock Mic',
            device_index: 0,
            threshold: 0.5,
            available_devices: ['Mock Mic'],
            model_loaded: true
          });
        }, 5);
        return p as unknown as ChildProcess;
      }
    });

    const errorSpy = vi.fn();
    provider.onError(errorSpy);

    await provider.start();

    // Trigger unexpected exit when retries are exhausted
    (provider as any).restartAttempts = 3;
    activeProc.emit('exit', 1, null);

    expect(provider.getStatus()).toBe('error');
    expect(provider.getDiagnostics().errorMessage).toContain('exited unexpectedly');
    expect(errorSpy).toHaveBeenCalled();
  });

  it('receives telemetry event and notifies telemetry subscribers', async () => {
    const provider = createProvider();
    const telemetrySpy = vi.fn();
    provider.onTelemetry(telemetrySpy);

    await provider.start();

    mockProc.sendStdoutLine({
      type: 'telemetry',
      latest_score: 0.35,
      peak_score: 0.49,
      last_wake_score: 0.88,
      threshold: 0.5
    });

    expect(telemetrySpy).toHaveBeenCalledWith({
      latestScore: 0.35,
      peakScore: 0.49,
      lastWakeScore: 0.88,
      threshold: 0.5
    });

    const diag = provider.getDiagnostics();
    expect(diag.latestScore).toBe(0.35);
    expect(diag.peakScore).toBe(0.49);
    expect(diag.lastWakeScore).toBe(0.88);
  });
});

