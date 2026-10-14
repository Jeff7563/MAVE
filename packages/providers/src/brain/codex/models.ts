import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import type {
  ModelRole,
  RuntimeModelDescriptor
} from '../models/types.js';

export const CODEX_PROVIDER_ID = 'codex';

export interface CodexCacheModelEntry {
  slug: string;
  display_name?: string;
  priority?: number;
  default_model?: boolean;
  context_window?: number;
  supports_reasoning_effort_updates?: boolean;
}

export interface CodexModelsCacheJson {
  client_version?: string;
  fetched_at?: string;
  identity?: string;
  models?: CodexCacheModelEntry[];
}

/**
 * Semantic role mapping heuristics for OpenAI Codex models.
 */
export function getCodexModelRoles(slug: string, isDefault = false): {
  roles: ModelRole[];
  priority: number;
  rolePriority?: Record<string, number>;
  defaultFor?: ModelRole[];
} {
  const s = slug.trim().toLowerCase();

  if (s.includes('luna')) {
    return {
      roles: ['FAST', 'BALANCED'],
      priority: 1,
      rolePriority: { FAST: 1, BALANCED: 3 },
      defaultFor: ['FAST']
    };
  }

  if (s.includes('astra')) {
    return {
      roles: ['REASONING', 'CODING'],
      priority: 2,
      rolePriority: { REASONING: 2, CODING: 2 }
    };
  }

  if (s.includes('6.1-sol')) {
    return {
      roles: ['REASONING', 'CODING', 'AGENT', 'BALANCED'],
      priority: 1,
      rolePriority: { REASONING: 1, CODING: 2, AGENT: 2, BALANCED: 2 },
      defaultFor: ['REASONING']
    };
  }

  if (s.includes('5.6-sol') || isDefault) {
    return {
      roles: ['CODING', 'AGENT', 'BALANCED', 'REASONING'],
      priority: 1,
      rolePriority: { CODING: 1, AGENT: 1, BALANCED: 1, REASONING: 3 },
      defaultFor: ['CODING', 'AGENT', 'BALANCED']
    };
  }

  if (s.includes('sol')) {
    return {
      roles: ['CODING', 'AGENT', 'BALANCED', 'REASONING'],
      priority: 2,
      rolePriority: { CODING: 2, AGENT: 2, BALANCED: 2, REASONING: 2 }
    };
  }

  if (s.includes('terra') || s.includes('5.5')) {
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
 * Parses raw Codex models cache JSON into RuntimeModelDescriptor list.
 * Inspects fetched_at to evaluate staleness while preserving non-quota discovery.
 */
export function parseCodexModelsCache(
  input: string | CodexModelsCacheJson,
  options?: { maxStalenessMs?: number; now?: number }
): RuntimeModelDescriptor[] {
  let json: CodexModelsCacheJson;
  if (typeof input === 'string') {
    try {
      json = JSON.parse(input);
    } catch {
      return getCodexDefaultRuntimeModels();
    }
  } else {
    json = input;
  }

  if (!json || !Array.isArray(json.models) || json.models.length === 0) {
    return getCodexDefaultRuntimeModels();
  }

  const now = options?.now ?? Date.now();
  const maxStaleness = options?.maxStalenessMs ?? 7 * 24 * 60 * 60 * 1000; // 7 days

  let isStale = false;
  let cacheAgeMs: number | undefined;
  if (json.fetched_at) {
    const fetchedTime = new Date(json.fetched_at).getTime();
    if (!isNaN(fetchedTime)) {
      cacheAgeMs = Math.max(0, now - fetchedTime);
      if (cacheAgeMs > maxStaleness) {
        isStale = true;
      }
    }
  }

  const descriptors: RuntimeModelDescriptor[] = [];

  for (const entry of json.models) {
    if (!entry.slug || typeof entry.slug !== 'string') continue;
    const slug = entry.slug.trim();
    if (!slug) continue;

    // Filter out internal non-LLM or review-only utilities if not general models
    if (slug === 'codex-auto-review') continue;

    const isDefault = Boolean(entry.default_model);
    const mapping = getCodexModelRoles(slug, isDefault);

    descriptors.push({
      modelId: slug,
      runtimeProviderId: CODEX_PROVIDER_ID,
      displayName: entry.display_name || slug,
      canonicalName: slug,
      supportedRoles: mapping.roles,
      discoverySource: 'runtime_cache',
      availability: 'unknown', // Conservative: local cache != active account entitlement
      discoveredAt: now,
      selectionMechanism: '-m flag',
      metadata: {
        priority: entry.priority ?? mapping.priority,
        rolePriority: mapping.rolePriority,
        defaultFor: mapping.defaultFor,
        isDefault,
        contextWindow: entry.context_window,
        stale: isStale,
        cacheAgeMs,
        clientVersion: json.client_version
      }
    });
  }

  return descriptors;
}

/**
 * Returns default configured model descriptors for Codex when ~/.codex/models_cache.json
 * is missing or invalid.
 */
export function getCodexDefaultRuntimeModels(): RuntimeModelDescriptor[] {
  const now = Date.now();
  return [
    {
      modelId: 'gpt-5.6-sol',
      runtimeProviderId: CODEX_PROVIDER_ID,
      displayName: 'GPT-5.6-Sol (Codex Default)',
      canonicalName: 'gpt-5.6-sol',
      supportedRoles: ['CODING', 'AGENT', 'BALANCED', 'REASONING'],
      discoverySource: 'configured',
      availability: 'unknown',
      discoveredAt: now,
      selectionMechanism: '-m flag',
      metadata: {
        priority: 1,
        isDefault: true,
        rolePriority: { CODING: 1, AGENT: 1, BALANCED: 1, REASONING: 3 },
        defaultFor: ['CODING', 'AGENT', 'BALANCED']
      }
    },
    {
      modelId: 'gpt-6.1-sol',
      runtimeProviderId: CODEX_PROVIDER_ID,
      displayName: 'GPT-6.1-Sol',
      canonicalName: 'gpt-6.1-sol',
      supportedRoles: ['REASONING', 'CODING', 'AGENT', 'BALANCED'],
      discoverySource: 'configured',
      availability: 'unknown',
      discoveredAt: now,
      selectionMechanism: '-m flag',
      metadata: {
        priority: 1,
        rolePriority: { REASONING: 1, CODING: 2, AGENT: 2, BALANCED: 2 },
        defaultFor: ['REASONING']
      }
    },
    {
      modelId: 'gpt-6-luna',
      runtimeProviderId: CODEX_PROVIDER_ID,
      displayName: 'GPT-6-Luna',
      canonicalName: 'gpt-6-luna',
      supportedRoles: ['FAST', 'BALANCED'],
      discoverySource: 'configured',
      availability: 'unknown',
      discoveredAt: now,
      selectionMechanism: '-m flag',
      metadata: {
        priority: 1,
        rolePriority: { FAST: 1, BALANCED: 3 },
        defaultFor: ['FAST']
      }
    },
    {
      modelId: 'gpt-6-astra',
      runtimeProviderId: CODEX_PROVIDER_ID,
      displayName: 'GPT-6-Astra',
      canonicalName: 'gpt-6-astra',
      supportedRoles: ['REASONING', 'CODING'],
      discoverySource: 'configured',
      availability: 'unknown',
      discoveredAt: now,
      selectionMechanism: '-m flag',
      metadata: {
        priority: 2,
        rolePriority: { REASONING: 2, CODING: 2 }
      }
    }
  ];
}

/**
 * Discovers Codex models non-invasively by reading ~/.codex/models_cache.json.
 * Invariant: Consumes ZERO generation quota and makes ZERO external network requests.
 */
export async function discoverCodexRuntimeModels(options?: {
  cachePath?: string;
  maxStalenessMs?: number;
}): Promise<RuntimeModelDescriptor[]> {
  const cachePath =
    options?.cachePath ||
    path.join(os.homedir(), '.codex', 'models_cache.json');

  try {
    if (!fs.existsSync(cachePath)) {
      return getCodexDefaultRuntimeModels();
    }
    const content = await fs.promises.readFile(cachePath, 'utf8');
    const parsed = parseCodexModelsCache(content, options);
    if (parsed.length > 0) {
      return parsed;
    }
  } catch {
    // Fail-safe non-throwing fallback
  }

  return getCodexDefaultRuntimeModels();
}

