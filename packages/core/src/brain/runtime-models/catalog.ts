import {
  type RuntimeModelDescriptor,
  type RuntimeModelSelectionRequest,
  type RuntimeModelSelectionResult,
  RuntimeModelSelectionError
} from './types.js';
import { selectRuntimeModel } from './selector.js';

/**
 * Deep-freezes a RuntimeModelDescriptor to guarantee mutation isolation.
 */
function freezeDescriptor(desc: RuntimeModelDescriptor): RuntimeModelDescriptor {
  return Object.freeze({
    ...desc,
    supportedRoles: Object.freeze([...desc.supportedRoles]),
    metadata: desc.metadata ? Object.freeze({ ...desc.metadata }) : undefined
  });
}

/**
 * RuntimeModelCatalog
 *
 * In-memory catalog managing discovered model inventories and capabilities
 * for subscription runtimes (Claude Code, Codex, Antigravity).
 *
 * Architectural Invariants:
 * 1. STRICT SEPARATION: Does NOT touch or alter ModelCatalogProvider / ModelCatalogRuntime / ModelPolicy,
 *    which are strictly reserved for direct model_provider (e.g. OpenAI Direct API).
 * 2. AGENT RUNTIME BOUNDARY: Subscription runtimes remain agent_runtime_provider and are never faked as model_provider.
 * 3. IMMUTABILITY: All returned snapshots and descriptors are deeply frozen copies.
 * 4. NON-GENERATION DISCOVERY: Manages metadata without invoking chat or consuming AI quota.
 * 5. DETERMINISTIC SELECTION: Provides AUTO, PREFERRED, and LOCKED selection policies with tie-breaking.
 */
export class RuntimeModelCatalog {
  private readonly store = new Map<string, RuntimeModelDescriptor[]>();

  /**
   * Registers a list of runtime model descriptors for a subscription runtime.
   * Replaces any existing entries for that runtimeProviderId.
   */
  registerRuntimeModels(
    runtimeProviderId: string,
    models: readonly RuntimeModelDescriptor[]
  ): void {
    if (!runtimeProviderId || !runtimeProviderId.trim()) {
      throw new Error('runtimeProviderId must be a non-empty string');
    }
    const normalizedId = runtimeProviderId.trim();
    const frozenModels = models.map((m) => freezeDescriptor(m));
    this.store.set(normalizedId, frozenModels);
  }

  /**
   * Appends or updates a single runtime model descriptor in the catalog.
   */
  upsertRuntimeModel(descriptor: RuntimeModelDescriptor): void {
    const runtimeId = descriptor.runtimeProviderId.trim();
    const existing = this.store.get(runtimeId) ?? [];
    const normalizedModelId = descriptor.modelId.trim().toLowerCase();

    const index = existing.findIndex(
      (m) =>
        m.modelId.trim().toLowerCase() === normalizedModelId ||
        (m.alias && m.alias.trim().toLowerCase() === normalizedModelId)
    );

    const frozen = freezeDescriptor(descriptor);
    if (index >= 0) {
      existing[index] = frozen;
    } else {
      existing.push(frozen);
    }
    this.store.set(runtimeId, existing);
  }

  /**
   * Partially updates a runtime model (e.g. to mark availability changes such as quota_limited).
   */
  updateRuntimeModel(
    runtimeProviderId: string,
    modelIdOrAlias: string,
    patch: Partial<Omit<RuntimeModelDescriptor, 'runtimeProviderId' | 'modelId'>>
  ): boolean {
    const normalizedRuntimeId = runtimeProviderId.trim();
    const existing = this.store.get(normalizedRuntimeId);
    if (!existing) return false;

    const normalizedTarget = modelIdOrAlias.trim().toLowerCase();
    const index = existing.findIndex(
      (m) =>
        m.modelId.trim().toLowerCase() === normalizedTarget ||
        (m.alias && m.alias.trim().toLowerCase() === normalizedTarget) ||
        (m.canonicalName && m.canonicalName.trim().toLowerCase() === normalizedTarget)
    );

    if (index === -1) return false;

    const current = existing[index];
    if (!current) return false;

    const updated: RuntimeModelDescriptor = freezeDescriptor({
      ...current,
      ...patch,
      modelId: current.modelId,
      runtimeProviderId: current.runtimeProviderId,
      supportedRoles: patch.supportedRoles ? [...patch.supportedRoles] : current.supportedRoles,
      metadata: patch.metadata ? { ...current.metadata, ...patch.metadata } : current.metadata
    });

    existing[index] = updated;
    return true;
  }

  /**
   * Retrieves all registered runtime models for a given subscription runtime.
   * Returns empty array if none registered.
   */
  getRuntimeModels(runtimeProviderId: string): readonly RuntimeModelDescriptor[] {
    const models = this.store.get(runtimeProviderId.trim());
    return models ? [...models] : [];
  }

  /**
   * Finds a specific model descriptor by modelId, alias, or canonicalName.
   */
  getRuntimeModel(
    runtimeProviderId: string,
    modelIdOrAlias: string
  ): RuntimeModelDescriptor | undefined {
    const models = this.store.get(runtimeProviderId.trim());
    if (!models) return undefined;

    const normalized = modelIdOrAlias.trim().toLowerCase();
    return models.find(
      (m) =>
        m.modelId.trim().toLowerCase() === normalized ||
        (m.alias && m.alias.trim().toLowerCase() === normalized) ||
        (m.canonicalName && m.canonicalName.trim().toLowerCase() === normalized)
    );
  }

  /**
   * Returns list of all runtime provider IDs currently tracked in the catalog.
   */
  getTrackedRuntimes(): readonly string[] {
    return Array.from(this.store.keys());
  }

  /**
   * Clears models for a specific runtime, or all runtimes if omitted.
   */
  clear(runtimeProviderId?: string): void {
    if (runtimeProviderId) {
      this.store.delete(runtimeProviderId.trim());
    } else {
      this.store.clear();
    }
  }

  /**
   * Selects a model from the catalog for a given subscription runtime and role,
   * respecting AUTO, PREFERRED, or LOCKED selection mode.
   */
  selectModel(request: RuntimeModelSelectionRequest): RuntimeModelSelectionResult {
    const models = this.getRuntimeModels(request.runtimeProviderId);
    if (models.length === 0) {
      throw new RuntimeModelSelectionError(
        'no_models_discovered',
        `No models discovered or registered for subscription runtime '${request.runtimeProviderId}'`,
        {
          runtimeProviderId: request.runtimeProviderId,
          role: request.role,
          mode: request.mode ?? 'AUTO'
        }
      );
    }

    return selectRuntimeModel(models, request);
  }
}
