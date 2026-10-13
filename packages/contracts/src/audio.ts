import { z } from 'zod';
import type { ProviderHealth } from './brain.js';

/**
 * Supported audio encodings for MAVE internal audio pipelines.
 */
export const AudioEncodingSchema = z.enum(['pcm_s16le']);
export type AudioEncoding = z.infer<typeof AudioEncodingSchema>;

/**
 * Canonical Audio Format specification.
 * MAVE standardizes on 16kHz, mono, 16-bit signed Linear PCM.
 */
export const AudioFormatSchema = z.object({
  encoding: AudioEncodingSchema.default('pcm_s16le'),
  sampleRate: z.number().int().positive().default(16000),
  channels: z.number().int().positive().default(1),
  bytesPerSample: z.number().int().positive().default(2)
});
export type AudioFormat = z.infer<typeof AudioFormatSchema>;

/**
 * Canonical MAVE Audio Constants.
 * 16 kHz, 16-bit signed integer, 1 channel (mono).
 * Standard frame: 1280 samples = 80 ms = 2560 bytes.
 */
export const DEFAULT_AUDIO_FORMAT: AudioFormat = Object.freeze({
  encoding: 'pcm_s16le',
  sampleRate: 16000,
  channels: 1,
  bytesPerSample: 2
});

export const DEFAULT_AUDIO_FRAME_SAMPLES = 1280;
export const DEFAULT_AUDIO_FRAME_DURATION_MS = 80;
export const DEFAULT_AUDIO_FRAME_BYTES = 2560; // 1280 samples * 2 bytes * 1 channel

/**
 * Calculates expected bytes for an audio frame.
 */
export function expectedFrameBytes(
  format: AudioFormat = DEFAULT_AUDIO_FORMAT,
  samples: number = DEFAULT_AUDIO_FRAME_SAMPLES
): number {
  return samples * format.channels * format.bytesPerSample;
}

/**
 * Calculates duration in milliseconds for a sample count or byte count.
 */
export function frameDurationMs(
  format: AudioFormat = DEFAULT_AUDIO_FORMAT,
  samples: number = DEFAULT_AUDIO_FRAME_SAMPLES
): number {
  return (samples / format.sampleRate) * 1000;
}

/**
 * Binary-safe Audio Frame interface for Main/Provider runtime pipelines.
 *
 * NOTE: Raw AudioFrames are strictly internal and must NOT be JSON-serialized
 * or passed across Electron IPC to the Renderer during normal operation.
 */
export interface AudioFrame {
  /**
   * Monotonically increasing sequence number within the stream (starts at 0).
   */
  readonly sequence: number;

  /**
   * Timestamp in milliseconds relative to stream start or epoch.
   */
  readonly timestampMs: number;

  /**
   * Audio format metadata describing the payload.
   */
  readonly format: AudioFormat;

  /**
   * Raw binary PCM samples.
   */
  readonly data: Uint8Array;

  /**
   * Flag indicating whether this is the final frame of an utterance or stream.
   * Final frames are permitted to be shorter than DEFAULT_AUDIO_FRAME_BYTES.
   */
  readonly isFinalChunk?: boolean;
}

/**
 * Error thrown when an AudioFrame fails validation.
 */
export class AudioFrameValidationError extends Error {
  constructor(message: string, public readonly frame?: unknown) {
    super(`AudioFrame validation error: ${message}`);
    this.name = 'AudioFrameValidationError';
  }
}

/**
 * Validates an AudioFrame against canonical format constraints.
 *
 * Rules:
 * 1. sequence must be an integer >= 0.
 * 2. timestampMs must be a finite number >= 0.
 * 3. format must match valid AudioFormat.
 * 4. data must be a Uint8Array with byteLength > 0.
 * 5. byteLength must align to sample boundaries: byteLength % (bytesPerSample * channels) === 0.
 * 6. Non-final frames must have exactly expectedFrameBytes unless allowShortFinalFrame or isFinalChunk is true.
 */
export function validateAudioFrame(
  frame: unknown,
  options?: { allowShortFinalFrame?: boolean; expectedSamples?: number }
): asserts frame is AudioFrame {
  if (!frame || typeof frame !== 'object') {
    throw new AudioFrameValidationError('Frame must be an object', frame);
  }

  const f = frame as Partial<AudioFrame>;

  if (typeof f.sequence !== 'number' || !Number.isInteger(f.sequence) || f.sequence < 0) {
    throw new AudioFrameValidationError('Sequence must be a non-negative integer', frame);
  }

  if (typeof f.timestampMs !== 'number' || !Number.isFinite(f.timestampMs) || f.timestampMs < 0) {
    throw new AudioFrameValidationError('Timestamp must be a finite non-negative number', frame);
  }

  const format = AudioFormatSchema.safeParse(f.format);
  if (!format.success) {
    throw new AudioFrameValidationError(`Invalid audio format: ${format.error.message}`, frame);
  }

  if (!(f.data instanceof Uint8Array)) {
    throw new AudioFrameValidationError('Payload data must be a Uint8Array', frame);
  }

  if (f.data.byteLength === 0) {
    throw new AudioFrameValidationError('Payload data cannot be empty', frame);
  }

  const sampleFrameBytes = format.data.channels * format.data.bytesPerSample;
  if (f.data.byteLength % sampleFrameBytes !== 0) {
    throw new AudioFrameValidationError(
      `Payload byte length (${f.data.byteLength}) must be a multiple of sample frame size (${sampleFrameBytes})`,
      frame
    );
  }

  const standardExpected = expectedFrameBytes(format.data, options?.expectedSamples ?? DEFAULT_AUDIO_FRAME_SAMPLES);
  const allowShort = options?.allowShortFinalFrame || f.isFinalChunk === true;

  if (!allowShort) {
    if (f.data.byteLength !== standardExpected) {
      throw new AudioFrameValidationError(
        `Payload byte length (${f.data.byteLength}) does not match expected frame length (${standardExpected})`,
        frame
      );
    }
  } else {
    if (f.data.byteLength > standardExpected) {
      throw new AudioFrameValidationError(
        `Short final frame cannot exceed standard frame length (${standardExpected})`,
        frame
      );
    }
  }
}

/**
 * Audio input device metadata.
 * Device IDs are opaque adapter identifiers, not raw OS pointers.
 */
export const AudioInputDeviceSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  isDefault: z.boolean().default(false)
});
export type AudioInputDevice = z.infer<typeof AudioInputDeviceSchema>;

/**
 * Audio input adapter capabilities.
 */
export const AudioInputCapabilitiesSchema = z.object({
  supportedFormats: z.array(AudioFormatSchema).default([DEFAULT_AUDIO_FORMAT])
});
export type AudioInputCapabilities = z.infer<typeof AudioInputCapabilitiesSchema>;

/**
 * Options for capturing audio from an AudioInputProvider.
 */
export interface AudioCaptureOptions {
  deviceId?: string;
  format?: AudioFormat;
  signal?: AbortSignal;
}

/**
 * Vendor-neutral AudioInputProvider contract.
 * Captures microphone audio and emits an asynchronous stream of AudioFrames.
 */
export interface AudioInputProvider {
  readonly id: string;
  listDevices(): Promise<AudioInputDevice[]>;
  capture(options?: AudioCaptureOptions): AsyncIterable<AudioFrame>;
  health?(): Promise<ProviderHealth>;
  onLevel?(callback: (level: AudioLevel) => void): () => void;
  dispose?(): Promise<void>;
}

/**
 * Audio output device metadata.
 */
export const AudioOutputDeviceSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  isDefault: z.boolean().default(false)
});
export type AudioOutputDevice = z.infer<typeof AudioOutputDeviceSchema>;

/**
 * Audio output adapter capabilities.
 */
export const AudioOutputCapabilitiesSchema = z.object({
  supportedFormats: z.array(AudioFormatSchema).default([DEFAULT_AUDIO_FORMAT])
});
export type AudioOutputCapabilities = z.infer<typeof AudioOutputCapabilitiesSchema>;

/**
 * Playback state for AudioOutput boundary.
 */
export const AudioOutputPlaybackStateSchema = z.enum([
  'idle',
  'playing',
  'paused',
  'stopped'
]);
export type AudioOutputPlaybackState = z.infer<typeof AudioOutputPlaybackStateSchema>;

/**
 * Options for playing audio streams through AudioOutput.
 */
export interface AudioPlaybackOptions {
  deviceId?: string;
  volume?: number; // 0.0 to 1.0
  signal?: AbortSignal;
}

/**
 * Telemetry representing normalized RMS audio amplitude for UI waveforms/capsules.
 * Normalized range is strictly bounded to [0.0, 1.0].
 */
export const AudioLevelSchema = z.object({
  timestampMs: z.number().nonnegative(),
  rms: z.number().min(0.0).max(1.0)
});
export type AudioLevel = z.infer<typeof AudioLevelSchema>;

/**
 * Vendor-neutral AudioOutput contract.
 * Separated cleanly from TTSProvider:
 * TTSProvider converts Text -> AudioFrame.
 * AudioOutput plays AudioFrame -> Hardware speakers.
 */
export interface AudioOutput {
  readonly id: string;
  listDevices(): Promise<AudioOutputDevice[]>;
  playStream(stream: AsyncIterable<AudioFrame>, options?: AudioPlaybackOptions): Promise<void>;
  stop(): Promise<void>;
  pause(): Promise<void>;
  resume(): Promise<void>;
  setVolume(volume: number): Promise<void>; // 0.0 to 1.0
  getPlaybackState(): AudioOutputPlaybackState;
  onLevel?(callback: (level: AudioLevel) => void): () => void;
  dispose?(): Promise<void>;
}
