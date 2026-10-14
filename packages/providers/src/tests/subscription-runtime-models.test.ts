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
  ClaudeCodeBrainProvider,
  ANTIGRAVITY_PROVIDER_ID,
  parseAntigravityModelsOutput,
  getAntigravityDefaultRuntimeModels,
  discoverAntigravityRuntimeModels,
  AntigravityBrainProvider,
  type SpawnFactory,
  CODEX_PROVIDER_ID,
  parseCodexModelsCache,
  discoverCodexRuntimeModels,
  getCodexDefaultRuntimeModels
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

describe('Subscription Runtime Model Catalogs & Availability Semantics', () => {
  describe('Anthropic Claude Code Runtime Models', () => {
    it('declares CLAUDE_CODE_PROVIDER_ID = "claude-code"', () => {
      expect(CLAUDE_CODE_PROVIDER_ID).toBe('claude-code');
    });

    it('returns default models (sonnet, opus, haiku) with runtime_alias discovery source and conservative UNKNOWN availability', () => {
      const models = getClaudeDefaultRuntimeModels();
      expect(models).toHaveLength(3);

      const sonnet = models.find((m) => m.modelId === 'sonnet');
      const opus = models.find((m) => m.modelId === 'opus');
      const haiku = models.find((m) => m.modelId === 'haiku');

      expect(sonnet).toBeDefined();
      expect(opus).toBeDefined();
      expect(haiku).toBeDefined();

      // Invariant: alias existence != active account entitlement -> starts unknown
      expect(sonnet?.discoverySource).toBe('runtime_alias');
      expect(sonnet?.availability).toBe('unknown');

      expect(opus?.discoverySource).toBe('runtime_alias');
      expect(opus?.availability).toBe('unknown');

      expect(haiku?.discoverySource).toBe('runtime_alias');
      expect(haiku?.availability).toBe('unknown');

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

    it('creates runtime_observed descriptor with AVAILABLE status from session init model event', () => {
      const descriptor = createClaudeObservedRuntimeModel('claude-sonnet-5', 'sonnet');
      expect(descriptor.discoverySource).toBe('runtime_observed');
      expect(descriptor.availability).toBe('available');
      expect(descriptor.canonicalName).toBe('claude-sonnet-5');
      expect(descriptor.supportedRoles).toContain('CODING');
      expect(descriptor.supportedRoles).toContain('REASONING');
    });

    it('ClaudeCodeBrainProvider strictly ignores request.overrides.preferredModelId as execution target', async () => {
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

      const provider = new ClaudeCodeBrainProvider({
        cwd: 'C:\\fake\\workspace',
        spawnFactory
      });

      const request: BrainRequest = {
        requestId: 'req-no-bypass',
        sessionId: 'sess-1',
        intent: 'conversation',
        messages: [{ role: 'user', content: 'Test' }],
        overrides: {
          preferredModelId: 'haiku',
          localOnly: false
        }
      };

      // Invocations without options.modelId must NOT pick up preferredModelId
      for await (const _ of provider.chat(request)) {}

      // --model flag should NOT be present since options.modelId and defaultModel are undefined
      expect(capturedArgs).not.toContain('--model');
    });

    it('ClaudeCodeBrainProvider applies options.modelId when explicitly provided by router/caller', async () => {
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

      const provider = new ClaudeCodeBrainProvider({
        cwd: 'C:\\fake\\workspace',
        spawnFactory
      });

      const request: BrainRequest = {
        requestId: 'req-resolved-model',
        sessionId: 'sess-1',
        intent: 'conversation',
        messages: [{ role: 'user', content: 'Test' }]
      };

      for await (const _ of provider.chat(request, { modelId: 'opus' })) {}

      expect(capturedArgs).toContain('--model');
      expect(capturedArgs[capturedArgs.indexOf('--model') + 1]).toBe('opus');
    });
  });

  describe('Google Antigravity Runtime Models', () => {
    it('declares ANTIGRAVITY_PROVIDER_ID = "antigravity"', () => {
      expect(ANTIGRAVITY_PROVIDER_ID).toBe('antigravity');
    });

    it('parses tab-separated output from agy models CLI command as AVAILABLE', () => {
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
      expect(flashLow?.availability).toBe('available'); // Current authenticated account enumeration

      const opus = models.find((m) => m.modelId === 'claude-opus-4-6-thinking');
      expect(opus?.supportedRoles).toContain('REASONING');
      expect(opus?.availability).toBe('available');
    });

    it('returns static configured fallbacks with UNKNOWN availability when agy models is unavailable', () => {
      const defaults = getAntigravityDefaultRuntimeModels();
      expect(defaults.length).toBeGreaterThanOrEqual(4);
      expect(defaults[0]?.discoverySource).toBe('configured');
      expect(defaults[0]?.availability).toBe('unknown'); // Static fallback starts unknown
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
      expect(models[0]?.availability).toBe('available');
    });

    it('AntigravityBrainProvider strictly ignores request.overrides.preferredModelId as execution target', async () => {
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
        requestId: 'req-antigravity-no-bypass',
        sessionId: 'sess-1',
        intent: 'conversation',
        messages: [{ role: 'user', content: 'Test' }],
        overrides: {
          preferredModelId: 'claude-opus-4-6-thinking',
          localOnly: false
        }
      };

      for await (const _ of provider.chat(request)) {}

      // Must NOT directly consume request.overrides.preferredModelId
      expect(capturedArgs).not.toContain('--model');
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

      for await (const _ of provider.chat(request, { modelId: 'claude-opus-4-6-thinking' })) {}

      expect(capturedArgs).toContain('--model');
      expect(capturedArgs[capturedArgs.indexOf('--model') + 1]).toBe('claude-opus-4-6-thinking');
    });

    it('guarantees concurrency safety: simultaneous invocations pass distinct modelId without state leakage', async () => {
      const invocations: Array<{ modelArg?: string }> = [];

      const spawnFactory: SpawnFactory = vi.fn((_cmd, args, _opts) => {
        const mock = createMockProcess();
        const modelIndex = args.indexOf('--model');
        const modelArg = modelIndex >= 0 ? args[modelIndex + 1] : undefined;
        invocations.push({ modelArg });

        queueMicrotask(() => {
          mock.emitStdout(JSON.stringify({ type: 'text', text: 'Response' }) + '\n');
          mock.emitClose(0);
        });
        return mock.child;
      });

      const provider = new AntigravityBrainProvider({
        cwd: 'C:\\fake\\workspace',
        spawnFactory
      });

      const reqA: BrainRequest = {
        requestId: 'req-a',
        sessionId: 'sess-1',
        intent: 'conversation',
        messages: [{ role: 'user', content: 'A' }]
      };

      const reqB: BrainRequest = {
        requestId: 'req-b',
        sessionId: 'sess-2',
        intent: 'conversation',
        messages: [{ role: 'user', content: 'B' }]
      };

      // Run two invocations concurrently with different modelId options
      await Promise.all([
        (async () => {
          for await (const _ of provider.chat(reqA, { modelId: 'model-a' })) {}
        })(),
        (async () => {
          for await (const _ of provider.chat(reqB, { modelId: 'model-b' })) {}
        })()
      ]);

      // Both should complete with their per-call options without state leakage
      expect(invocations).toHaveLength(2);
      const modelArgs = invocations.map((i) => i.modelArg).sort();
      expect(modelArgs).toEqual(['model-a', 'model-b']);
      expect(provider.id).toBe('antigravity');
    });
  });

  describe('OpenAI Codex Runtime Models', () => {
    it('declares CODEX_PROVIDER_ID = "codex"', () => {
      expect(CODEX_PROVIDER_ID).toBe('codex');
    });

    it('parses models cache JSON from ~/.codex/models_cache.json with UNKNOWN availability', () => {
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
      expect(models).toHaveLength(3);

      const gpt61 = models.find((m) => m.modelId === 'gpt-6.1-sol');
      const gpt56 = models.find((m) => m.modelId === 'gpt-5.6-sol');
      const luna = models.find((m) => m.modelId === 'gpt-6-luna');

      // Conservative availability: cache file existence != active entitlement
      expect(gpt61?.supportedRoles).toContain('REASONING');
      expect(gpt61?.supportedRoles).toContain('CODING');
      expect(gpt61?.discoverySource).toBe('runtime_cache');
      expect(gpt61?.availability).toBe('unknown');
      expect(gpt61?.selectionMechanism).toBe('-m flag');

      expect(gpt56?.supportedRoles).toContain('CODING');
      expect(gpt56?.supportedRoles).toContain('AGENT');
      expect(gpt56?.availability).toBe('unknown');
      expect(gpt56?.metadata?.isDefault).toBe(true);

      expect(luna?.supportedRoles).toContain('FAST');
      expect(luna?.supportedRoles).toContain('BALANCED');
      expect(luna?.availability).toBe('unknown');
    });

    it('detects stale cache when fetched_at exceeds maxStalenessMs and preserves UNKNOWN status', () => {
      const eightDaysAgo = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString();
      const mockJson = {
        fetched_at: eightDaysAgo,
        models: [{ slug: 'gpt-5.6-sol', default_model: true }]
      };

      const models = parseCodexModelsCache(mockJson, { maxStalenessMs: 7 * 24 * 60 * 60 * 1000 });
      expect(models[0]?.metadata?.stale).toBe(true);
      expect(models[0]?.availability).toBe('unknown');
    });

    it('returns default configured models with UNKNOWN availability when cache is missing or invalid', async () => {
      const models = await discoverCodexRuntimeModels({ cachePath: 'C:\\nonexistent\\cache.json' });
      expect(models.length).toBeGreaterThanOrEqual(3);
      expect(models[0]?.discoverySource).toBe('configured');
      expect(models[0]?.availability).toBe('unknown');
      expect(models.some((m) => m.modelId === 'gpt-5.6-sol')).toBe(true);
    });

    it('getCodexDefaultRuntimeModels returns configured models with UNKNOWN availability', () => {
      const defaults = getCodexDefaultRuntimeModels();
      expect(defaults.every((m) => m.availability === 'unknown')).toBe(true);
      expect(defaults.every((m) => m.discoverySource === 'configured')).toBe(true);
    });
  });
});
