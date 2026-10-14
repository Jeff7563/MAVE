import type { ChildProcess, SpawnOptions } from 'node:child_process';
import { spawn } from 'node:child_process';
import type {
  ModelRole,
  RuntimeModelDescriptor
} from '../models/types.js';

export const ANTIGRAVITY_PROVIDER_ID = 'antigravity';

export type SpawnFactory = (
  command: string,
  args: string[],
  options: SpawnOptions
) => ChildProcess;

/**
 * Semantic role mapping heuristics for Antigravity models.
 */
export function getAntigravityModelRoles(modelId: string): {
  roles: ModelRole[];
  priority: number;
  rolePriority?: Record<string, number>;
  defaultFor?: ModelRole[];
} {
  const id = modelId.trim().toLowerCase();

  if (id.includes('flash-low')) {
    return {
      roles: ['FAST', 'BALANCED'],
      priority: 1,
      rolePriority: { FAST: 1, BALANCED: 3 },
      defaultFor: ['FAST']
    };
  }

  if (id.includes('flash-medium')) {
    return {
      roles: ['AGENT', 'BALANCED', 'CODING'],
      priority: 1,
      rolePriority: { AGENT: 1, BALANCED: 1, CODING: 2 },
      defaultFor: ['AGENT', 'BALANCED']
    };
  }

  if (id.includes('flash-high')) {
    return {
      roles: ['REASONING', 'CODING'],
      priority: 1,
      rolePriority: { CODING: 1, REASONING: 2 },
      defaultFor: ['CODING']
    };
  }

  if (id.includes('opus')) {
    return {
      roles: ['REASONING'],
      priority: 1,
      rolePriority: { REASONING: 1 },
      defaultFor: ['REASONING']
    };
  }

  if (id.includes('sonnet')) {
    return {
      roles: ['CODING', 'REASONING', 'AGENT'],
      priority: 2,
      rolePriority: { CODING: 2, REASONING: 2, AGENT: 2 }
    };
  }

  if (id.includes('gpt-oss')) {
    return {
      roles: ['BALANCED', 'CODING'],
      priority: 3,
      rolePriority: { BALANCED: 2, CODING: 3 }
    };
  }

  return {
    roles: ['BALANCED'],
    priority: 5,
    rolePriority: { BALANCED: 5 }
  };
}

/**
 * Parses raw text output from the non-quota `agy models` CLI command into RuntimeModelDescriptor list.
 */
export function parseAntigravityModelsOutput(
  rawOutput: string,
  timestamp = Date.now()
): RuntimeModelDescriptor[] {
  const lines = rawOutput.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const descriptors: RuntimeModelDescriptor[] = [];

  for (const line of lines) {
    // Ignore informational header lines emitted by CLI
    if (line.toLowerCase().startsWith('fetching')) {
      continue;
    }

    // Line format is tab-separated: <slug>\t<display_name>
    const tabIndex = line.indexOf('\t');
    let modelId: string;
    let displayName: string;

    if (tabIndex > 0) {
      modelId = line.substring(0, tabIndex).trim();
      displayName = line.substring(tabIndex + 1).trim();
    } else {
      const parts = line.split(/\s{2,}/);
      const firstPart = parts[0];
      const secondPart = parts[1];
      if (firstPart && secondPart) {
        modelId = firstPart.trim();
        displayName = secondPart.trim();
      } else {
        modelId = line;
        displayName = line;
      }
    }

    if (!modelId) continue;

    const mapping = getAntigravityModelRoles(modelId);
    descriptors.push({
      modelId,
      runtimeProviderId: ANTIGRAVITY_PROVIDER_ID,
      displayName: displayName || modelId,
      canonicalName: modelId,
      supportedRoles: mapping.roles,
      discoverySource: 'runtime_enumerated',
      availability: 'available',
      discoveredAt: timestamp,
      selectionMechanism: '--model flag',
      metadata: {
        priority: mapping.priority,
        rolePriority: mapping.rolePriority,
        defaultFor: mapping.defaultFor
      }
    });
  }

  return descriptors;
}

/**
 * Returns default configured model descriptors for Antigravity when live CLI enumeration
 * has not run or is unavailable.
 */
export function getAntigravityDefaultRuntimeModels(): RuntimeModelDescriptor[] {
  const now = Date.now();
  const rawDefaultText = [
    'gemini-3.8-flash-high\tGemini 3.8 Flash (High)',
    'gemini-3.8-flash-medium\tGemini 3.8 Flash (Medium)',
    'gemini-3.8-flash-low\tGemini 3.8 Flash (Low)',
    'claude-sonnet-4-6\tClaude Sonnet 4.6 (Thinking)',
    'claude-opus-4-6-thinking\tClaude Opus 4.6 (Thinking)',
    'gpt-oss-120b-medium\tGPT-OSS 120B (Medium)'
  ].join('\n');

  const models = parseAntigravityModelsOutput(rawDefaultText, now);
  // Mark default static list as configured
  return models.map((m) => ({
    ...m,
    discoverySource: 'configured' as const
  }));
}

/**
 * Discovers Antigravity models by running `agy models`.
 * Invariant: Consumes ZERO generation quota.
 */
export async function discoverAntigravityRuntimeModels(options?: {
  executable?: string;
  spawnFactory?: SpawnFactory;
  timeoutMs?: number;
}): Promise<RuntimeModelDescriptor[]> {
  const executable = options?.executable || 'agy';
  const spawnFn = options?.spawnFactory || spawn;
  const timeoutMs = options?.timeoutMs ?? 3000;

  return new Promise<RuntimeModelDescriptor[]>((resolve) => {
    let stdout = '';
    let settled = false;

    let child: ChildProcess;
    try {
      child = spawnFn(executable, ['models'], {
        shell: false,
        stdio: ['ignore', 'pipe', 'pipe']
      });
    } catch {
      resolve(getAntigravityDefaultRuntimeModels());
      return;
    }

    const timer = setTimeout(() => {
      if (!settled) {
        settled = true;
        try {
          child.kill();
        } catch {}
        resolve(getAntigravityDefaultRuntimeModels());
      }
    }, timeoutMs);

    child.stdout?.on('data', (d) => {
      stdout += d.toString();
    });

    child.on('error', () => {
      if (!settled) {
        settled = true;
        clearTimeout(timer);
        resolve(getAntigravityDefaultRuntimeModels());
      }
    });

    child.on('close', (code) => {
      if (!settled) {
        settled = true;
        clearTimeout(timer);
        if (code === 0 && stdout.trim()) {
          const parsed = parseAntigravityModelsOutput(stdout);
          if (parsed.length > 0) {
            resolve(parsed);
            return;
          }
        }
        resolve(getAntigravityDefaultRuntimeModels());
      }
    });
  });
}
