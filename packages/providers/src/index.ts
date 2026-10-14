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
  MockModelCatalogProvider,
  type MockModelCatalogOptions,
  createDefaultMockModels,
  AntigravityBrainProvider,
  type AntigravityBrainProviderOptions,
  type SpawnFactory,
  OpenAIBrainProvider,
  type OpenAIBrainProviderOptions,
  type OpenAIApiMode,
  OPENAI_PROVIDER_ID,
  OPENAI_FAST_MODEL_ID,
  OPENAI_BALANCED_MODEL_ID,
  sanitizeErrorMessage,
  ClaudeCodeBrainProvider,
  type ClaudeCodeBrainProviderOptions,
  CLAUDE_CODE_PROVIDER_ID,
  type ClaudeRuntimeModelSnapshot,
  type ClaudeModelAlias,
  type ClaudeSupportedRole,
  CLAUDE_ROLE_MAPPING,
  resolveClaudeModelForRole,
  getClaudeDefaultRuntimeModels,
  createClaudeObservedRuntimeModel,
  ANTIGRAVITY_PROVIDER_ID,
  parseAntigravityModelsOutput,
  getAntigravityDefaultRuntimeModels,
  discoverAntigravityRuntimeModels,
  getAntigravityModelRoles,
  CODEX_PROVIDER_ID,
  CodexBrainProvider,
  type CodexBrainProviderOptions,
  buildCodexPrompt,
  classifyCodexError,
  mapCodexUsage,
  parseCodexModelsCache,
  getCodexDefaultRuntimeModels,
  discoverCodexRuntimeModels,
  getCodexModelRoles,
  type CodexModelsCacheJson,
  type CodexCacheModelEntry,
  MODEL_ROLES,
  type ModelRole,
  RUNTIME_MODEL_DISCOVERY_SOURCES,
  type RuntimeModelDiscoverySource,
  RUNTIME_MODEL_AVAILABILITIES,
  type RuntimeModelAvailability,
  type RuntimeModelDescriptor
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
