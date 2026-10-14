import type {
  BrainCapabilities,
  BrainProfileId,
  ModelContextClass,
  ModelCostClass,
  ModelDescriptor,
  ModelLatencyClass
} from '@mave/contracts';
import type {
  ModelSelectionCriteria,
  ModelSelectionResult
} from './types.js';

export const COST_CLASS_ORDER: Record<ModelCostClass, number> = {
  free: 0,
  low: 1,
  medium: 2,
  high: 3
};

export const LATENCY_CLASS_ORDER: Record<ModelLatencyClass, number> = {
  interactive: 0,
  balanced: 1,
  heavy: 2
};

export const CONTEXT_CLASS_ORDER: Record<ModelContextClass, number> = {
  standard: 0,
  large: 1,
  massive: 2
};

function getProfileQualityRank(model: ModelDescriptor, profileId?: BrainProfileId): number {
  switch (profileId) {
    case 'fast_conversation':
      if (model.qualityClass === 'fast' && model.latencyClass === 'interactive') return 0;
      if (model.qualityClass === 'fast') return 1;
      if (model.qualityClass === 'balanced' && model.latencyClass === 'interactive') return 2;
      if (model.qualityClass === 'balanced') return 3;
      if (model.qualityClass === 'reasoning') return 4;
      return 5;

    case 'deep_reasoning':
      if (model.qualityClass === 'reasoning') return 0;
      if (model.qualityClass === 'balanced') return 1;
      if (model.qualityClass === 'fast') return 2;
      return 3;

    case 'research':
      if (model.qualityClass === 'balanced') return 0;
      if (model.qualityClass === 'reasoning') return 1;
      if (model.qualityClass === 'fast') return 2;
      return 3;

    case 'local_offline':
      if (model.qualityClass === 'fast') return 0;
      if (model.qualityClass === 'balanced') return 1;
      if (model.qualityClass === 'reasoning') return 2;
      return 3;

    case 'agent_work':
      if (model.qualityClass === 'balanced') return 0;
      if (model.qualityClass === 'reasoning') return 1;
      if (model.qualityClass === 'fast') return 2;
      return 3;

    default:
      if (model.qualityClass === 'balanced') return 0;
      if (model.qualityClass === 'fast') return 1;
      if (model.qualityClass === 'reasoning') return 2;
      return 3;
  }
}

/**
 * Deterministic model selection policy inside a selected provider's catalog.
 *
 * Principles:
 * - Pure, synchronous selection: zero I/O, zero network, zero LLM calls, zero magic scoring.
 * - Hard constraint filtering: privacy (fail-closed), operational availability, required capabilities,
 *   cost/latency limits, and context capacity.
 * - Explicit override precedence: preferredModelId honors allowFallback constraints.
 * - Deterministic lexicographic ranking: tuple-based sorting across profile role, default model
 *   preference, latency class, cost class, and lexical ModelId tie-breaking.
 */
export class ModelPolicy {
  /**
   * Deterministically selects the optimal ModelDescriptor from a provider's catalog snapshot.
   */
  static select(criteria: ModelSelectionCriteria): ModelSelectionResult {
    const { providerId, catalog } = criteria;

    // 1. Invariant: catalog providerId must match criteria providerId
    if (catalog.providerId !== providerId) {
      return {
        success: false,
        providerId,
        reason: `Catalog providerId '${catalog.providerId}' does not match requested providerId '${providerId}'`,
        candidateCount: catalog.models.length,
        eligibleCount: 0
      };
    }

    // 2. Empty catalog handling
    if (catalog.models.length === 0) {
      return {
        success: false,
        providerId,
        reason: `Catalog for provider '${providerId}' contains zero models`,
        candidateCount: 0,
        eligibleCount: 0
      };
    }

    // 3. Extract criteria parameters
    const effectiveLocalOnly =
      criteria.effectiveLocalOnly === true ||
      criteria.overrides?.localOnly === true;

    const profileId: BrainProfileId | undefined =
      criteria.overrides?.profileId ??
      criteria.profileResolution?.profileId ??
      criteria.profileId;

    const requiredCaps: Partial<BrainCapabilities> = {
      ...criteria.profileResolution?.requiredCapabilities,
      ...criteria.requiredCapabilities
    };

    const preferredModelId =
      criteria.overrides?.preferredModelId?.trim() ||
      criteria.profileResolution?.preferredModelId?.trim() ||
      undefined;

    const allowFallback =
      criteria.allowFallback !== undefined
        ? criteria.allowFallback
        : criteria.profileResolution?.allowFallback !== undefined
          ? criteria.profileResolution.allowFallback
          : preferredModelId !== undefined
            ? false
            : true;

    const defaultModelId = criteria.defaultModelId?.trim();
    const maxCost = criteria.maxCostClass;
    const maxLatency = criteria.maxLatencyClass;
    const reqContextTokens = criteria.requiredContextTokens;
    const reqContextClass = criteria.requiredContextClass;
    const strictLanguage = criteria.strictLanguageCheck ?? false;

    // 4. Filter all candidate models against hard constraints
    const candidateCount = catalog.models.length;
    const eligibleModels: ModelDescriptor[] = [];
    const rejections: Record<string, string[]> = {};

    for (const model of catalog.models) {
      const reasons: string[] = [];

      // Constraint 1: Hard privacy constraint (fail-closed)
      if (effectiveLocalOnly && model.privacyClass !== 'local_only') {
        reasons.push(
          `privacy_mismatch: model privacyClass is '${model.privacyClass}' but local_only is required`
        );
      }

      // Constraint 2: Availability status (only 'available' models are eligible)
      if (model.status !== 'available') {
        reasons.push(
          `model_unavailable: status is '${model.status}', only 'available' models can be selected`
        );
      }

      // Constraint 3: Required capabilities compatibility
      for (const [key, val] of Object.entries(requiredCaps)) {
        if (val === true) {
          const modelVal = (model.capabilities as Record<string, boolean | undefined>)[key];
          if (modelVal === false) {
            reasons.push(`missing_capability: ${key}`);
          } else if (modelVal === undefined) {
            if (strictLanguage && (key === 'supportsThai' || key === 'supportsEnglish')) {
              reasons.push(`unverified_language_capability: ${key}`);
            } else if (
              key !== 'supportsThai' &&
              key !== 'supportsEnglish' &&
              key !== 'structuredOutput' &&
              key !== 'cancellation'
            ) {
              reasons.push(`missing_capability: ${key}`);
            }
          }
        }
      }

      // Constraint 4: Max cost class
      if (maxCost && COST_CLASS_ORDER[model.costClass] > COST_CLASS_ORDER[maxCost]) {
        reasons.push(
          `cost_exceeded: costClass '${model.costClass}' exceeds maxCostClass '${maxCost}'`
        );
      }

      // Constraint 5: Max latency class
      if (maxLatency && LATENCY_CLASS_ORDER[model.latencyClass] > LATENCY_CLASS_ORDER[maxLatency]) {
        reasons.push(
          `latency_exceeded: latencyClass '${model.latencyClass}' exceeds maxLatencyClass '${maxLatency}'`
        );
      }

      // Constraint 6: Context capacity
      if (reqContextClass && CONTEXT_CLASS_ORDER[model.contextClass] < CONTEXT_CLASS_ORDER[reqContextClass]) {
        reasons.push(
          `context_insufficient: contextClass '${model.contextClass}' is below required '${reqContextClass}'`
        );
      }
      if (reqContextTokens) {
        if (model.contextWindowTokens === undefined) {
          reasons.push(
            `context_tokens_unknown: requiredContextTokens is ${reqContextTokens} but model contextWindowTokens is undefined`
          );
        } else if (model.contextWindowTokens < reqContextTokens) {
          reasons.push(
            `context_tokens_insufficient: contextWindowTokens ${model.contextWindowTokens} below required ${reqContextTokens}`
          );
        }
      }

      if (reasons.length > 0) {
        rejections[model.id] = reasons;
      } else {
        eligibleModels.push(model);
      }
    }

    // 5. Handle explicit preferredModelId override
    if (preferredModelId) {
      const preferredModel = catalog.models.find((m) => m.id === preferredModelId);

      if (!preferredModel) {
        if (!rejections[preferredModelId]) {
          rejections[preferredModelId] = ['explicit_model_not_found'];
        }
        if (!allowFallback) {
          return {
            success: false,
            providerId,
            reason: `Preferred model '${preferredModelId}' not found in catalog and fallback is disallowed`,
            candidateCount,
            eligibleCount: eligibleModels.length,
            rejections
          };
        }
      } else {
        const isEligible = eligibleModels.some((m) => m.id === preferredModelId);
        if (isEligible) {
          return {
            success: true,
            providerId,
            selectedModel: preferredModel,
            modelId: preferredModel.id,
            reason: `Selected explicit preferred model '${preferredModel.id}'`,
            candidateCount,
            eligibleCount: eligibleModels.length,
            rejections
          };
        }

        // Preferred model is in catalog but failed hard constraints
        if (!allowFallback) {
          const issues = rejections[preferredModelId]?.join('; ') || 'ineligible';
          return {
            success: false,
            providerId,
            reason: `Preferred model '${preferredModelId}' is ineligible (${issues}) and fallback is disallowed`,
            candidateCount,
            eligibleCount: eligibleModels.length,
            rejections
          };
        }
        // If allowFallback is true, candidate falls through to general policy selection
      }
    }

    // 6. Check if any eligible models exist
    if (eligibleModels.length === 0) {
      const failReason = effectiveLocalOnly
        ? `No eligible local_only model available in catalog for provider '${providerId}' (fail closed)`
        : `No eligible model satisfies selection constraints in catalog for provider '${providerId}'`;

      return {
        success: false,
        providerId,
        reason: failReason,
        candidateCount,
        eligibleCount: 0,
        rejections
      };
    }

    // 7. Deterministic Lexicographic Ranking
    eligibleModels.sort((a, b) => {
      // 1. Profile Quality Rank (lowest number wins)
      const pA = getProfileQualityRank(a, profileId);
      const pB = getProfileQualityRank(b, profileId);
      if (pA !== pB) return pA - pB;

      // 2. Default Model Preference (defaultModelId gets priority 0 over 1)
      const dA = defaultModelId && a.id === defaultModelId ? 0 : 1;
      const dB = defaultModelId && b.id === defaultModelId ? 0 : 1;
      if (dA !== dB) return dA - dB;

      // 3. Latency Class Preference (faster wins)
      const lA = LATENCY_CLASS_ORDER[a.latencyClass];
      const lB = LATENCY_CLASS_ORDER[b.latencyClass];
      if (lA !== lB) return lA - lB;

      // 4. Cost Class Preference (cheaper wins)
      const cA = COST_CLASS_ORDER[a.costClass];
      const cB = COST_CLASS_ORDER[b.costClass];
      if (cA !== cB) return cA - cB;

      // 5. Stable Tie-breaker: lexical ModelId
      return a.id.localeCompare(b.id);
    });

    const winner = eligibleModels[0]!;
    const isDefault = Boolean(defaultModelId && winner.id === defaultModelId);
    const reason = isDefault
      ? `Selected provider default model '${winner.id}' (${winner.qualityClass}/${winner.latencyClass}) for profile '${profileId ?? 'default'}'`
      : `Selected model '${winner.id}' (${winner.qualityClass}/${winner.latencyClass}) for profile '${profileId ?? 'default'}'`;

    return {
      success: true,
      providerId,
      selectedModel: winner,
      modelId: winner.id,
      reason,
      candidateCount,
      eligibleCount: eligibleModels.length,
      rejections
    };
  }

  /**
   * Instance method delegating to static select.
   */
  select(criteria: ModelSelectionCriteria): ModelSelectionResult {
    return ModelPolicy.select(criteria);
  }
}

