import {
  DEFAULT_AUDIO_FORMAT,
  DEFAULT_AUDIO_FRAME_SAMPLES,
  type AudioFormat,
  type AudioFrame
} from '@mave/contracts';

export interface CreateSilentAudioFrameOptions {
  sequence?: number;
  timestampMs?: number;
  samples?: number;
  isFinalChunk?: boolean;
  format?: AudioFormat;
}

/**
 * Creates a deterministic, canonical silent PCM S16LE AudioFrame.
 */
export function createSilentAudioFrame(
  options: CreateSilentAudioFrameOptions = {}
): AudioFrame {
  const format = options.format ?? DEFAULT_AUDIO_FORMAT;
  const samples = options.samples ?? DEFAULT_AUDIO_FRAME_SAMPLES;
  const byteLength = samples * format.channels * format.bytesPerSample;
  const sequence = options.sequence ?? 0;
  const timestampMs = options.timestampMs ?? sequence * ((samples / format.sampleRate) * 1000);

  return {
    sequence,
    timestampMs,
    format,
    data: new Uint8Array(byteLength),
    isFinalChunk: options.isFinalChunk
  };
}

/**
 * Generates an array of deterministic canonical PCM AudioFrames.
 */
export function createPCMFixtureFrames(
  count: number,
  options: {
    frameSamples?: number;
    format?: AudioFormat;
    finalShortSamples?: number;
  } = {}
): AudioFrame[] {
  const frames: AudioFrame[] = [];
  const samples = options.frameSamples ?? DEFAULT_AUDIO_FRAME_SAMPLES;
  const format = options.format ?? DEFAULT_AUDIO_FORMAT;
  const frameDuration = (samples / format.sampleRate) * 1000;

  for (let i = 0; i < count; i++) {
    const isLast = i === count - 1;
    const frameSampleCount = isLast && options.finalShortSamples ? options.finalShortSamples : samples;

    frames.push(
      createSilentAudioFrame({
        sequence: i,
        timestampMs: i * frameDuration,
        samples: frameSampleCount,
        format,
        isFinalChunk: isLast
      })
    );
  }

  return frames;
}

/**
 * Deep clones an AudioFrame to prevent accidental shared array buffer mutations.
 */
export function cloneAudioFrame(frame: AudioFrame): AudioFrame {
  const clonedData = new Uint8Array(frame.data.byteLength);
  clonedData.set(frame.data);

  return {
    sequence: frame.sequence,
    timestampMs: frame.timestampMs,
    format: { ...frame.format },
    data: clonedData,
    isFinalChunk: frame.isFinalChunk
  };
}
