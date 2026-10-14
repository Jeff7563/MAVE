import { describe, it, expect, vi } from 'vitest';
import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';
import type { ChildProcess } from 'node:child_process';
import type { BrainRequest } from '@mave/contracts';
import {
  CLAUDE_CODE_PROVIDER_ID,
  getClaudeDefaultRuntimeModels,
  createClaudeObservedRuntimeModel,
  resolveClaudeModelForRole,
  ANTIGRAVITY_PROVIDER_ID,
  parseAntigravityModelsOutput,
  getAntigravityDefaultRuntimeModels,
  discoverAntigravityRuntimeModels,
  AntigravityBrainProvider,
  type SpawnFactory,
  CODEX_PROVIDER_ID,
  parseCodexModelsCache,
  discoverCodexRuntimeModels
} from '../brain/index.js';

function createMockProcess(): {
  child: ChildProcess;
  emitStdout: (chunk: string) => void;
  emitStderr: (chunk: string) => void;
  emitClose: (code: number | null) => void;
} {
  const child = new EventEmitter() as unknown as ChildProcess;
  const stdout = new PassThrough();
  const stderr = new PassThrough();
  (child as any).stdout = stdout;
  (child as any).stderr = stderr;
  (child as any).kill = vi.fn();

  return {
    child,
    emitStdout: (chunk: string) => stdout.write(chunk),
    emitStderr: (chunk: string) => stderr.write(chunk),
    emitClose: (code: number | null) => {
      stdout.end();
      stderr.end();
      child.emit('close', code);
    }
  };
}

describe('Subscription Runtime Model Catalogs', () => {
  describe('Anthropic Claude Code Runtime Models', () => {
    it('declares CLAUDE_CODE_PROVIDER_ID = "claude-code"', () => {
      expect(CLAUDE_CODE_PROVIDER_ID).toBe('claude-code');
    });

    it('returns default models (sonnet, opus, haiku) with runtime_alias discovery source', () => {
      const models = getClaudeDefaultRuntimeModels();
      expect(models).toHaveLength(3);

      const sonnet = models.find((m) => m.modelId === 'sonnet');
      const opus = models.find((m) => m.modelId === 'opus');
      const haiku = models.find((m) => m.modelId === 'haiku');

      expect(sonnet).toBeDefined();
      expect(opus).toBeDefined();
      expect(haiku).toBeDefined();

      expect(sonnet?.discoverySource).toBe('runtime_alias');
      expect(opus?.discoverySource).toBe('runtime_alias');
      expect(haiku?.discoverySource).toBe('runtime_alias');

      expect(sonnet?.selectionMechanism).toBe('--model flag');
    });

    it('maps Haiku to FAST and BALANCED roles', () => {
      const models = getClaudeDefaultRuntimeModels();
      const haiku = models.find((m) => m.modelId === 'haiku');
      expect(haiku?.supportedRoles).toContain('FAST');
      expect(haiku?.supportedRoles).toContain('BALANCED');
    });

    it('resolves semantic roles through CLAUDE_ROLE_MAPPING', () => {
      expect(resolveClaudeModelForRole('FAST')).toBe('haiku');
      expect(resolveClaudeModelForRole('BALANCED')).toBe('sonnet');
      expect(resolveClaudeModelForRole('REASONING')).toBe('opus');
      expect(resolveClaudeModelForRole('CODING')).toBe('sonnet');
      expect(resolveClaudeModelForRole('AGENT')).toBe('sonnet');
    });

    it('creates runtime_observed descriptor from session init model event', () => {
      const descriptor = createClaudeObservedRuntimeModel('claude-sonnet-5', 'sonnet');
      expect(descriptor.discoverySource).toBe('runtime_observed');
      expect(descriptor.canonicalName).toBe('claude-sonnet-5');
      expect(descriptor.supportedRoles).toContain('CODING');
      expect(descriptor.supportedRoles).toContain('REASONING');
    });
  });

  describe('Google Antigravity Runtime Models', () => {
    it('declares ANTIGRAVITY_PROVIDER_ID = "antigravity"', () => {
      expect(ANTIGRAVITY_PROVIDER_ID).toBe('antigravity');
    });

    it('parses tab-separated output from agy models CLI command', () => {
      const sampleOutput = `Fetching available models...
gemini-3.8-flash-high\tGemini 3.8 Flash (High)
gemini-3.8-flash-medium\tGemini 3.8 Flash (Medium)
gemini-3.8-flash-low\tGemini 3.8 Flash (Low)
claude-sonnet-4-6\tClaude Sonnet 4.6 (Thinking)
claude-opus-4-6-thinking\tClaude Opus 4.6 (Thinking)
gpt-oss-120b-medium\tGPT-OSS 120B (Medium)`;

      const models = parseAntigravityModelsOutput(sampleOutput);
      expect(models).toHaveLength(6);

      const flashLow = models.find((m) => m.modelId === 'gemini-3.8-flash-low');
      expect(flashLow?.supportedRoles).toContain('FAST');
      expect(flashLow?.supportedRoles).toContain('BALANCED');
      expect(flashLow?.discoverySource).toBe('runtime_enumerated');

      const opus = models.find((m) => m.modelId === 'claude-opus-4-6-thinking');
      expect(opus?.supportedRoles).toContain('REASONING');

      const flashHigh = models.find((m) => m.modelId === 'gemini-3.8-flash-high');
      expect(flashHigh?.supportedRoles).toContain('CODING');
      expect(flashHigh?.supportedRoles).toContain('REASONING');
    });

    it('returns static configured fallbacks when agy models is unavailable', () => {
      const defaults = getAntigravityDefaultRuntimeModels();
      expect(defaults.length).toBeGreaterThanOrEqual(4);
      expect(defaults[0]?.discoverySource).toBe('configured');
    });

    it('discovers models via agy models child process without consuming quota', async () => {
      const mock = createMockProcess();
      const spawnFactory: SpawnFactory = vi.fn((cmd, args, _opts) => {
        expect(cmd).toBe('agy');
        expect(args).toEqual(['models']);
        queueMicrotask(() => {
          mock.emitStdout('gemini-3.8-flash-low\tGemini 3.8 Flash (Low)\n');
          mock.emitClose(0);
        });
        return mock.child;
      });

      const models = await discoverAntigravityRuntimeModels({ spawnFactory });
      expect(models).toHaveLength(1);
      expect(models[0]?.modelId).toBe('gemini-3.8-flash-low');
      expect(models[0]?.discoverySource).toBe('runtime_enumerated');
    });

    it('AntigravityBrainProvider passes options.modelId cleanly to child process arguments', async () => {
      const mock = createMockProcess();
      let capturedArgs: string[] = [];

      const spawnFactory: SpawnFactory = vi.fn((_cmd, args, _opts) => {
        capturedArgs = [...args];
        queueMicrotask(() => {
          mock.emitStdout(JSON.stringify({ type: 'text', text: 'Hello!' }) + '\n');
          mock.emitClose(0);
        });
        return mock.child;
      });

      const provider = new AntigravityBrainProvider({
        cwd: 'C:\\fake\\workspace',
        spawnFactory
      });

      const request: BrainRequest = {
        requestId: 'req-model-handoff',
        sessionId: 'sess-1',
        intent: 'conversation',
        messages: [{ role: 'user', content: 'Test' }]
      };

      // Call chat with options.modelId
      const events: any[] = [];
      for await (const event of provider.chat(request, { modelId: 'claude-opus-4-6-thinking' })) {
        events.push(event);
      }

      expect(capturedArgs).toContain('--model');
      expect(capturedArgs[capturedArgs.indexOf('--model') + 1]).toBe('claude-opus-4-6-thinking');
    });
  });

  describe('OpenAI Codex Runtime Models', () => {
    it('declares CODEX_PROVIDER_ID = "codex"', () => {
      expect(CODEX_PROVIDER_ID).toBe('codex');
    });

    it('parses models cache JSON from ~/.codex/models_cache.json', () => {
      const mockJson = {
        client_version: '0.162.0',
        fetched_at: new Date().toISOString(),
        identity: 'test-id',
        models: [
          {
            slug: 'gpt-6.1-sol',
            display_name: 'GPT-6.1-Sol',
            priority: 1
          },
          {
            slug: 'gpt-5.6-sol',
            display_name: 'GPT-5.6-Sol',
            priority: 5,
            default_model: true
          },
          {
            slug: 'gpt-6-luna',
            display_name: 'GPT-6-Luna',
            priority: 4
          },
          {
            slug: 'codex-auto-review',
            display_name: 'Codex Auto Review',
            priority: 43
          }
        ]
      };

      const models = parseCodexModelsCache(mockJson);
      // codex-auto-review is filtered out as an internal utility
      expect(models).toHaveLength(3);

      const gpt61 = models.find((m) => m.modelId === 'gpt-6.1-sol');
      const gpt56 = models.find((m) => m.modelId === 'gpt-5.6-sol');
      const luna = models.find((m) => m.modelId === 'gpt-6-luna');

      expect(gpt61?.supportedRoles).toContain('REASONING');
      expect(gpt61?.supportedRoles).toContain('CODING');
      expect(gpt61?.discoverySource).toBe('runtime_cache');
      expect(gpt61?.selectionMechanism).toBe('-m flag');

      expect(gpt56?.supportedRoles).toContain('CODING');
      expect(gpt56?.supportedRoles).toContain('AGENT');
      expect(gpt56?.metadata?.isDefault).toBe(true);

      expect(luna?.supportedRoles).toContain('FAST');
      expect(luna?.supportedRoles).toContain('BALANCED');
    });

    it('detects stale cache when fetched_at exceeds maxStalenessMs', () => {
      const eightDaysAgo = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString();
      const mockJson = {
        fetched_at: eightDaysAgo,
        models: [{ slug: 'gpt-5.6-sol', default_model: true }]
      };

      const models = parseCodexModelsCache(mockJson, { maxStalenessMs: 7 * 24 * 60 * 60 * 1000 });
      expect(models[0]?.metadata?.stale).toBe(true);
    });

    it('falls back to default configured models when cache file is missing or invalid', async () => {
      const models = await discoverCodexRuntimeModels({ cachePath: 'C:\\nonexistent\\cache.json' });
      expect(models.length).toBeGreaterThanOrEqual(3);
      expect(models[0]?.discoverySource).toBe('configured');
      expect(models.some((m) => m.modelId === 'gpt-5.6-sol')).toBe(true);
    });
  });
});
