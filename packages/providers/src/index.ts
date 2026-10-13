export { MockWakeWordProvider, type MockWakeWordProviderOptions } from './wake/mock.js';
export {
  OpenWakeWordProvider,
  type OpenWakeWordProviderOptions,
  resolveWakePythonExecutable,
  findRepoRoot,
  type ResolvePythonOptions
} from './wake/openwakeword.js';
export {
  MockBrainProvider,
  type MockBrainOptions,
  AntigravityBrainProvider,
  type AntigravityBrainProviderOptions,
  type SpawnFactory
} from './brain/index.js';
export * from './audio/index.js';
export * from './stt/index.js';
export * from './tts/index.js';

import type { VoiceProvider } from '@mave/contracts';
import { createLogger } from '@mave/shared';

const logger = createLogger({ name: 'mave:providers' });

export class MockVoiceProvider implements VoiceProvider {
  private isConnected = false;

  async connect(): Promise<void> {
    this.isConnected = true;
    logger.info('MockVoiceProvider connected (ready for Milestone 2)');
  }

  async disconnect(): Promise<void> {
    this.isConnected = false;
    logger.info('MockVoiceProvider disconnected');
  }

  async interrupt(): Promise<void> {
    logger.info('MockVoiceProvider interrupted');
  }

  get connected(): boolean {
    return this.isConnected;
  }
}
