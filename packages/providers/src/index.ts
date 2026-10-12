import type { VoiceProvider, WakeWordProvider } from '@mave/contracts';
import { createLogger } from '@mave/shared';

const logger = createLogger({ name: 'mave:providers' });

export class MockWakeWordProvider implements WakeWordProvider {
  private isRunning = false;

  async start(): Promise<void> {
    this.isRunning = true;
    logger.info('MockWakeWordProvider started (ready for Milestone 1)');
  }

  async stop(): Promise<void> {
    this.isRunning = false;
    logger.info('MockWakeWordProvider stopped');
  }

  get running(): boolean {
    return this.isRunning;
  }
}

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
