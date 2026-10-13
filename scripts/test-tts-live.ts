#!/usr/bin/env node
import { EdgeTTSProvider, SounddeviceAudioOutput } from '@mave/providers';
import type { AudioFrame } from '@mave/contracts';

/**
 * Opt-in manual live verification script for MAVE TTS and AudioOutput.
 * Synthesizes text via EdgeTTSProvider and plays audio through SounddeviceAudioOutput.
 *
 * Usage:
 *   pnpm tsx scripts/test-tts-live.ts
 *   pnpm tsx scripts/test-tts-live.ts "Hello world"
 *   pnpm tsx scripts/test-tts-live.ts "สวัสดีครับ ผมชื่อเมฟ"
 */
async function runLiveTTSTest(): Promise<void> {
  const customText = process.argv.slice(2).join(' ').trim();
  const testPhrase =
    customText.length > 0
      ? customText
      : 'สวัสดีครับ ผม MAVE ระบบผู้ช่วยพร้อมทำงานแล้วครับ';

  console.log('====================================================');
  console.log(' MAVE — Real TTS & AudioOutput Live Verification   ');
  console.log('====================================================\n');
  console.log(`Test phrase: "${testPhrase}"\n`);

  const tts = new EdgeTTSProvider();
  const audioOutput = new SounddeviceAudioOutput();

  try {
    // 1. Health check
    console.log('[1/4] Checking TTS Provider Health...');
    const ttsHealth = await tts.health();
    console.log(`TTS Health:   ${ttsHealth.status} (${ttsHealth.message ?? 'ok'})`);
    console.log(`Python Path:  ${tts.getResolvedPythonExecutable()}`);

    if (ttsHealth.status !== 'healthy') {
      console.error('TTS Provider is not healthy. Exiting.');
      process.exit(1);
    }

    // 2. Query audio devices
    console.log('\n[2/4] Querying Audio Output Devices...');
    const devices = await audioOutput.listDevices();
    console.log(`Found ${devices.length} output devices:`);
    for (const d of devices) {
      console.log(`  - [${d.id}] ${d.label}${d.isDefault ? ' [DEFAULT]' : ''}`);
    }

    // 3. Synthesize speech and stream
    console.log('\n[3/4] Synthesizing Speech...');
    const requestId = `test-tts-${Date.now()}`;
    const startTime = Date.now();
    let ttfa: number | null = null;
    let totalFrames = 0;
    let totalBytes = 0;

    const audioFrames: AudioFrame[] = [];

    const stream = tts.synthesize({
      requestId,
      text: testPhrase
    });

    for await (const event of stream) {
      if (event.type === 'audio') {
        if (ttfa === null) {
          ttfa = Date.now() - startTime;
          console.log(`Time-to-First-Audio (TTFA): ${ttfa}ms`);
        }
        totalFrames++;
        totalBytes += event.frame.data.byteLength;
        audioFrames.push(event.frame);
      } else if (event.type === 'completed') {
        const synthesisDuration = Date.now() - startTime;
        console.log(`Synthesis Completed: ${synthesisDuration}ms`);
        console.log(`Total Frames: ${totalFrames} (${totalBytes} bytes PCM)`);
        console.log(`Estimated Audio Duration: ${(totalFrames * 80).toFixed(0)}ms`);
      } else if (event.type === 'error') {
        console.error(`Synthesis Error [${event.error.code}]: ${event.error.message}`);
        process.exit(1);
      }
    }

    if (audioFrames.length === 0) {
      console.error('No audio frames received from TTS engine!');
      process.exit(1);
    }

    // 4. Play audio through speakers
    console.log('\n[4/4] Playing Audio Stream via SounddeviceAudioOutput...');
    const playbackStart = Date.now();

    async function* frameGenerator(): AsyncIterable<AudioFrame> {
      for (const frame of audioFrames) {
        yield frame;
      }
    }

    const unsubLevel = audioOutput.onLevel?.((level) => {
      const bars = Math.round(level.rms * 30);
      const meter = '█'.repeat(bars) + ' '.repeat(Math.max(0, 30 - bars));
      process.stdout.write(`\rPlaying: [${meter}] RMS: ${(level.rms * 100).toFixed(1)}%`);
    });

    await audioOutput.playStream(frameGenerator());
    unsubLevel?.();

    const playbackDuration = Date.now() - playbackStart;
    console.log(`\nPlayback Completed: ${playbackDuration}ms`);

    console.log('\n====================================================');
    console.log(' LIVE TTS & AUDIO OUTPUT VERIFICATION PASSED!       ');
    console.log('====================================================');
  } catch (err: any) {
    console.error(`\nUnexpected error: ${err?.message || err}`);
    process.exit(1);
  } finally {
    await tts.dispose();
    await audioOutput.dispose();
  }
}

runLiveTTSTest().catch((err) => {
  console.error('Fatal execution error:', err);
  process.exit(1);
});
