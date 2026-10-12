import { describe, it, expect, vi } from 'vitest';
import { MockWakeWordProvider } from '../wake/mock.js';
import { PicovoiceWakeWordProvider, type PorcupineLike, type PvRecorderLike } from '../wake/picovoice.js';

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

  it('manages device selection and sensitivity', () => {
    const provider = new MockWakeWordProvider();
    provider.setAvailableDevices(['System Default', 'USB Mic 1']);
    provider.setMicrophone(1);

    const diag = provider.getDiagnostics();
    expect(diag.microphoneIndex).toBe(1);
    expect(diag.microphoneName).toBe('USB Mic 1');

    provider.setSensitivity(0.75);
    expect(provider.getDiagnostics().sensitivity).toBe(0.75);
  });
});

describe('PicovoiceWakeWordProvider', () => {
  it('returns not_configured when PICOVOICE_ACCESS_KEY is missing', async () => {
    const provider = new PicovoiceWakeWordProvider({
      accessKey: '',
      keywordModelPath: 'nonexistent.ppn'
    });

    const initialized = await provider.initialize();
    expect(initialized).toBe(false);
    expect(provider.getStatus()).toBe('not_configured');
    expect(provider.getDiagnostics().isConfigured).toBe(false);
    expect(provider.getDiagnostics().errorMessage).toContain('PICOVOICE_ACCESS_KEY');

    // start() should not throw and should remain safe
    await provider.start();
    expect(provider.getStatus()).toBe('not_configured');
  });

  it('returns not_configured when keyword model file is missing', async () => {
    const provider = new PicovoiceWakeWordProvider({
      accessKey: 'test-dummy-key-12345',
      keywordModelPath: 'missing_folder/mave.ppn'
    });

    const initialized = await provider.initialize();
    expect(initialized).toBe(false);
    expect(provider.getStatus()).toBe('not_configured');
    expect(provider.getDiagnostics().isConfigured).toBe(false);
    expect(provider.getDiagnostics().errorMessage).toContain('Keyword model file missing');
  });

  it('handles empty audio devices safely without crashing', async () => {
    const provider = new PicovoiceWakeWordProvider({
      accessKey: 'test-dummy-key-12345',
      keywordModelPath: 'package.json', // existing file for test
      getAvailableDevices: () => []
    });

    const initialized = await provider.initialize();
    expect(initialized).toBe(false);
    expect(provider.getStatus()).toBe('error');
    expect(provider.getDiagnostics().errorMessage).toContain('No audio input devices');
  });

  it('never exposes raw access key in diagnostics or errors', async () => {
    const secretKey = 'super-secret-picovoice-token-999';
    const provider = new PicovoiceWakeWordProvider({
      accessKey: secretKey,
      keywordModelPath: 'package.json',
      getAvailableDevices: () => ['Mic 1'],
      porcupineFactory: () => {
        throw new Error(`Failed to activate with ${secretKey}`);
      }
    });

    await provider.initialize();
    const diag = provider.getDiagnostics();

    expect(diag.status).toBe('error');
    expect(diag.errorMessage).not.toContain(secretKey);
    expect(diag.errorMessage).toContain('[REDACTED]');
  });

  it('runs complete lifecycle with injected factories', async () => {
    let recorderRecording = false;
    let releasedRecorder = false;
    let releasedPorcupine = false;
    let frameCount = 0;

    const fakePorcupine: PorcupineLike = {
      frameLength: 512,
      sampleRate: 16000,
      process: vi.fn((_pcm: Int16Array) => {
        frameCount++;
        return frameCount === 2 ? 0 : -1; // Trigger wake on 2nd frame
      }),
      release: () => {
        releasedPorcupine = true;
      }
    };

    const fakeRecorder: PvRecorderLike = {
      get isRecording() {
        return recorderRecording;
      },
      start: () => {
        recorderRecording = true;
      },
      stop: () => {
        recorderRecording = false;
      },
      read: async () => {
        await new Promise((r) => setTimeout(r, 5));
        return new Int16Array(512);
      },
      release: () => {
        releasedRecorder = true;
      }
    };

    const provider = new PicovoiceWakeWordProvider({
      accessKey: 'fake-valid-key',
      keywordModelPath: 'package.json',
      getAvailableDevices: () => ['Desk USB Mic', 'Builtin Mic'],
      deviceIndex: 0,
      sensitivity: 0.6,
      porcupineFactory: () => fakePorcupine,
      recorderFactory: () => fakeRecorder
    });

    const wakeSpy = vi.fn();
    provider.onWake(wakeSpy);

    const initialized = await provider.initialize();
    expect(initialized).toBe(true);
    expect(provider.getStatus()).toBe('ready');
    expect(provider.getDiagnostics().microphoneName).toBe('Desk USB Mic');
    expect(provider.getDiagnostics().sensitivity).toBe(0.6);

    // Start engine
    await provider.start();
    expect(provider.getStatus()).toBe('listening');
    expect(recorderRecording).toBe(true);

    // Wait for loop to process frames
    await new Promise((r) => setTimeout(r, 40));

    expect(wakeSpy).toHaveBeenCalled();
    expect(provider.getDiagnostics().lastWakeAt).toBeDefined();

    // Stop engine
    await provider.stop();
    expect(provider.getStatus()).toBe('ready');
    expect(recorderRecording).toBe(false);

    // Dispose engine
    await provider.dispose();
    expect(provider.getStatus()).toBe('not_configured');
    expect(releasedRecorder).toBe(true);
    expect(releasedPorcupine).toBe(true);
  });
});
