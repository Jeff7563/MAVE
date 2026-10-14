import {
  type ModelRole,
  type RuntimeModelDescriptor,
  type RuntimeModelDiscoverySource,
  type RuntimeModelSelectionRequest,
  type RuntimeModelSelectionResult,
  RuntimeModelSelectionError
} from './types.js';

const DISCOVERY_SOURCE_WEIGHT: Record<RuntimeModelDiscoverySource, number> = {
  runtime_enumerated: 1,
  runtime_observed: 2,
  runtime_alias: 3,
  runtime_cache: 4,
  configured: 5,
  unknown: 6
};

/**
 * Normalizes an identifier string (trims leading/trailing whitespace, case-insensitive comparison helper).
 */
function matchesIdentifier(descriptor: RuntimeModelDescriptor, target: string): boolean {
  const normalized = target.trim().toLowerCase();
  if (descriptor.modelId.trim().toLowerCase() === normalized) return true;
  if (descriptor.alias && descriptor.alias.trim().toLowerCase() === normalized) return true;
  if (descriptor.canonicalName && descriptor.canonicalName.trim().toLowerCase() === normalized) return true;
  return false;
}

/**
 * Computes deterministic sort score for candidate models satisfying a Model Role.
 * Lower score = higher preference.
 *
 * Invariant: AVAILABLE models rank strictly ahead of UNKNOWN models.
 */
function compareCandidates(
  a: RuntimeModelDescriptor,
  b: RuntimeModelDescriptor,
  role: ModelRole
): number {
  // 1. Availability ranking: 'available' (1) strictly ranks ahead of 'unknown' (2)
  const aAvailScore = a.availability === 'available' ? 1 : 2;
  const bAvailScore = b.availability === 'available' ? 1 : 2;
  if (aAvailScore !== bAvailScore) {
    return aAvailScore - bAvailScore;
  }

  // 2. Check role-specific priority from metadata if available
  const aRolePrio = (a.metadata?.rolePriority as Record<string, number> | undefined)?.[role] ??
    (Array.isArray(a.metadata?.defaultFor) && a.metadata?.defaultFor.includes(role) ? 0 : 50);
  const bRolePrio = (b.metadata?.rolePriority as Record<string, number> | undefined)?.[role] ??
    (Array.isArray(b.metadata?.defaultFor) && b.metadata?.defaultFor.includes(role) ? 0 : 50);

  if (aRolePrio !== bRolePrio) {
    return aRolePrio - bRolePrio;
  }

  // 3. Generic priority number from metadata (lower is better)
  const aPrio = typeof a.metadata?.priority === 'number' ? a.metadata.priority : 100;
  const bPrio = typeof b.metadata?.priority === 'number' ? b.metadata.priority : 100;
  if (aPrio !== bPrio) {
    return aPrio - bPrio;
  }

  // 4. Discovery source hierarchy (enumerated > observed > alias > cache > configured > unknown)
  const aSourceWeight = DISCOVERY_SOURCE_WEIGHT[a.discoverySource] ?? 99;
  const bSourceWeight = DISCOVERY_SOURCE_WEIGHT[b.discoverySource] ?? 99;
  if (aSourceWeight !== bSourceWeight) {
    return aSourceWeight - bSourceWeight;
  }

  // 5. Deterministic string collation by modelId
  return a.modelId.localeCompare(b.modelId);
}

/**
 * Selects a runtime model for a subscription runtime according to AUTO, PREFERRED, or LOCKED policy.
 */
export function selectRuntimeModel(
  models: readonly RuntimeModelDescriptor[],
  request: RuntimeModelSelectionRequest
): RuntimeModelSelectionResult {
  const { runtimeProviderId, role } = request;
  const mode = request.mode ?? 'AUTO';

  if (!models || models.length === 0) {
    throw new RuntimeModelSelectionError(
      'no_models_discovered',
      `No models discovered or registered for subscription runtime '${runtimeProviderId}'`,
      { runtimeProviderId, role, mode }
    );
  }

  // ==========================================================================
  // Mode 1: LOCKED
  // Invariant: Exact match required. Silent switching or auto-fallback is forbidden.
  // ==========================================================================
  if (mode === 'LOCKED') {
    const targetId = request.lockedModelId || request.preferredModelId;
    if (!targetId || !targetId.trim()) {
      throw new RuntimeModelSelectionError(
        'locked_model_not_found',
        `LOCKED selection mode requires 'lockedModelId' for runtime '${runtimeProviderId}'`,
        { runtimeProviderId, role, mode }
      );
    }

    const matched = models.find((m) => matchesIdentifier(m, targetId));
    if (!matched) {
      throw new RuntimeModelSelectionError(
        'locked_model_not_found',
        `Locked model '${targetId}' was not found in runtime '${runtimeProviderId}'`,
        { runtimeProviderId, role, mode }
      );
    }

    if (!matched.supportedRoles.includes(role)) {
      throw new RuntimeModelSelectionError(
        'locked_model_incompatible',
        `Locked model '${matched.modelId}' (${matched.displayName}) does not support requested role '${role}'. Supported roles: [${matched.supportedRoles.join(', ')}]`,
        { runtimeProviderId, role, mode }
      );
    }

    // Strictly reject known unavailable, quota-limited, or rate-limited models
    if (
      matched.availability === 'unavailable' ||
      matched.availability === 'quota_limited' ||
      matched.availability === 'rate_limited'
    ) {
      throw new RuntimeModelSelectionError(
        'locked_model_unavailable',
        `Locked model '${matched.modelId}' is not available (status: '${matched.availability}') in runtime '${runtimeProviderId}'. Locked mode forbids fallback.`,
        { runtimeProviderId, role, mode }
      );
    }

    // Model is either 'available' or 'unknown' (selectable exact attempt, will fail at runtime if unentitled)
    const isUnknown = matched.availability === 'unknown';
    return {
      selectedModelId: matched.modelId,
      descriptor: matched,
      mode: 'LOCKED',
      role,
      fallbackOccurred: false,
      reason: isUnknown
        ? `Exact locked model match for '${targetId}' (${matched.displayName}) (availability: unknown; exact model will be attempted without fallback)`
        : `Exact locked model match for '${targetId}' (${matched.displayName}) (verified available)`
    };
  }

  // ==========================================================================
  // Mode 2: PREFERRED
  // Try preferred model if specified; fallback to AUTO if allowed.
  // ==========================================================================
  if (mode === 'PREFERRED' && request.preferredModelId && request.preferredModelId.trim()) {
    const preferredId = request.preferredModelId.trim();
    const matched = models.find((m) => matchesIdentifier(m, preferredId));
    const allowFallback = request.allowFallback !== false;

    // A preferred model is selectable if it supports the role and is not known to be unavailable/limited
    const isSelectable =
      matched &&
      matched.supportedRoles.includes(role) &&
      matched.availability !== 'unavailable' &&
      matched.availability !== 'quota_limited' &&
      matched.availability !== 'rate_limited';

    if (isSelectable && matched) {
      const isVerified = matched.availability === 'available';
      return {
        selectedModelId: matched.modelId,
        descriptor: matched,
        mode: 'PREFERRED',
        role,
        fallbackOccurred: false,
        reason: isVerified
          ? `Preferred model '${preferredId}' (${matched.displayName}) matched and verified available`
          : `Preferred model '${preferredId}' (${matched.displayName}) matched with unverified availability (unknown; entitlement will be tested at runtime)`
      };
    }

    // Preferred model failed: determine fallback behavior
    if (!allowFallback) {
      if (!matched) {
        throw new RuntimeModelSelectionError(
          'preferred_model_not_found',
          `Preferred model '${preferredId}' not found and allowFallback=false`,
          { runtimeProviderId, role, mode }
        );
      }
      if (!matched.supportedRoles.includes(role)) {
        throw new RuntimeModelSelectionError(
          'preferred_model_incompatible',
          `Preferred model '${matched.modelId}' incompatible with role '${role}' and allowFallback=false`,
          { runtimeProviderId, role, mode }
        );
      }
      throw new RuntimeModelSelectionError(
        'preferred_model_unavailable',
        `Preferred model '${matched.modelId}' is unavailable (status: '${matched.availability}') and allowFallback=false`,
        { runtimeProviderId, role, mode }
      );
    }

    // Fallback allowed: run auto selection and annotate fallback reason
    const failureReason = !matched
      ? `Preferred model '${preferredId}' was not found`
      : !matched.supportedRoles.includes(role)
      ? `Preferred model '${matched.modelId}' does not support role '${role}'`
      : `Preferred model '${matched.modelId}' is currently '${matched.availability}'`;

    const autoResult = runAutoSelection(models, runtimeProviderId, role);
    return {
      selectedModelId: autoResult.descriptor.modelId,
      descriptor: autoResult.descriptor,
      mode: 'PREFERRED',
      role,
      fallbackOccurred: true,
      reason: `${failureReason}; fell back to auto-selected model '${autoResult.descriptor.modelId}'`
    };
  }

  // ==========================================================================
  // Mode 3: AUTO
  // Deterministic role matching, availability filtering, and tie-breaking.
  // ==========================================================================
  const autoResult = runAutoSelection(models, runtimeProviderId, role);
  return {
    selectedModelId: autoResult.descriptor.modelId,
    descriptor: autoResult.descriptor,
    mode: 'AUTO',
    role,
    fallbackOccurred: false,
    reason: autoResult.reason
  };
}

function runAutoSelection(
  models: readonly RuntimeModelDescriptor[],
  runtimeProviderId: string,
  role: ModelRole
): { descriptor: RuntimeModelDescriptor; reason: string } {
  // 1. Role match
  const roleCandidates = models.filter((m) => m.supportedRoles.includes(role));
  if (roleCandidates.length === 0) {
    throw new RuntimeModelSelectionError(
      'role_not_supported',
      `No models in runtime '${runtimeProviderId}' support requested role '${role}'. Available models: [${models.map((m) => `${m.modelId} (${m.supportedRoles.join(',')})`).join('; ')}]`,
      { runtimeProviderId, role, mode: 'AUTO' }
    );
  }

  // 2. Filter out known unavailable / exhausted models
  const selectableCandidates = roleCandidates.filter(
    (m) =>
      m.availability !== 'unavailable' &&
      m.availability !== 'quota_limited' &&
      m.availability !== 'rate_limited'
  );

  if (selectableCandidates.length === 0) {
    const statuses = roleCandidates.map((m) => `${m.modelId}:${m.availability}`).join(', ');
    throw new RuntimeModelSelectionError(
      'no_available_model',
      `All models supporting role '${role}' in runtime '${runtimeProviderId}' are currently unavailable: [${statuses}]`,
      { runtimeProviderId, role, mode: 'AUTO' }
    );
  }

  // 3. Separate into verified 'available' vs unverified 'unknown' candidates
  const availableCandidates = selectableCandidates.filter((m) => m.availability === 'available');

  if (availableCandidates.length > 0) {
    // Deterministic sort among verified available models
    const sorted = [...availableCandidates].sort((a, b) => compareCandidates(a, b, role));
    const chosen = sorted[0];
    if (!chosen) {
      throw new RuntimeModelSelectionError(
        'no_available_model',
        `Unexpected empty candidate list for role '${role}' in runtime '${runtimeProviderId}'`,
        { runtimeProviderId, role, mode: 'AUTO' }
      );
    }

    return {
      descriptor: chosen,
      reason: `Auto-selected verified model '${chosen.modelId}' (${chosen.displayName}) for role '${role}'`
    };
  }

  // 4. No verified available candidate: optimistic selection among selectable 'unknown' candidates
  const sortedUnknown = [...selectableCandidates].sort((a, b) => compareCandidates(a, b, role));
  const chosen = sortedUnknown[0];
  if (!chosen) {
    throw new RuntimeModelSelectionError(
      'no_available_model',
      `No candidate models for role '${role}' in runtime '${runtimeProviderId}'`,
      { runtimeProviderId, role, mode: 'AUTO' }
    );
  }

  return {
    descriptor: chosen,
    reason: `Auto-selected model '${chosen.modelId}' (${chosen.displayName}) for role '${role}' (availability: unknown / optimistic selection; entitlement unverified until execution)`
  };
}
