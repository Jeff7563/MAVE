// ============================================================================
// Residency Observation Utility (C3.1 / C4-B)
//
// Invariant: Pure observational snapshotting.
// NEVER simulate or fake successful residency.
// Safe when Ollama daemon is offline.
// ============================================================================

import type {
  OllamaPsModelInfo,
  ResidencyCheckpoint,
  ResidencyCheckpointPhase
} from './types.js';

export interface ResidencyObserverDeps {
  readonly baseUrl?: string;
  readonly fetchFn?: typeof fetch;
  readonly getLifecycleState?: () => 'unloaded' | 'loading' | 'resident' | 'unloading' | undefined;
  readonly getActiveLeases?: () => number | undefined;
}

/**
 * Captures a point-in-time snapshot of Ollama daemon /api/ps and residency state.
 */
export async function captureResidencyCheckpoint(
  phase: ResidencyCheckpointPhase,
  deps?: ResidencyObserverDeps
): Promise<ResidencyCheckpoint> {
  const timestamp = new Date().toISOString();
  const baseUrl = deps?.baseUrl ?? 'http://127.0.0.1:11434';
  const fetchFn = deps?.fetchFn ?? fetch;

  try {
    const res = await fetchFn(`${baseUrl}/api/ps`, {
      method: 'GET',
      headers: { Accept: 'application/json' }
    });

    if (!res.ok) {
      return {
        phase,
        timestamp,
        daemonReachable: false,
        loadedModels: [],
        lifecycleState: deps?.getLifecycleState?.(),
        activeLeases: deps?.getActiveLeases?.(),
        rawPsData: { status: res.status, statusText: res.statusText }
      };
    }

    const data = (await res.json()) as {
      models?: Array<{
        name?: string;
        model?: string;
        size?: number;
        size_vram?: number;
        expires_at?: string;
      }>;
    };

    const loadedModels: OllamaPsModelInfo[] = (data.models ?? []).map((m) => ({
      name: m.name ?? m.model ?? 'unknown',
      model: m.model ?? m.name ?? 'unknown',
      size: m.size ?? 0,
      sizeVram: m.size_vram ?? 0,
      expiresAt: m.expires_at ?? ''
    }));

    return {
      phase,
      timestamp,
      daemonReachable: true,
      loadedModels,
      lifecycleState: deps?.getLifecycleState?.(),
      activeLeases: deps?.getActiveLeases?.(),
      rawPsData: data
    };
  } catch (err) {
    return {
      phase,
      timestamp,
      daemonReachable: false,
      loadedModels: [],
      lifecycleState: deps?.getLifecycleState?.(),
      activeLeases: deps?.getActiveLeases?.(),
      rawPsData: { error: err instanceof Error ? err.message : String(err) }
    };
  }
}
