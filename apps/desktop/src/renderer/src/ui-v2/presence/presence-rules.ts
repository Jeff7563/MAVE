/**
 * MAVE UI V2 — Presence Surface Interaction Rules & Utilities
 * Track: U1.1 Presence Interaction Semantics Hardening
 *
 * Encapsulates:
 * 1. UI-level Audio RMS Amplitude Normalization (noise gate + perceptual power curve)
 * 2. Temporal RMS Display Smoothing (attack/release dynamics for voice activity)
 * 3. Quick Response Privacy Filter (separates content provenance from provider execution substrate)
 * 4. Presence Quick Response vs Conversation Expansion Evaluation (Visual Need Principle)
 * 5. Unambiguous contextual button semantics
 */

import type { ExpansionEligibility, PresenceControlAction, UiV2Card } from '../types';

/**
 * Normalizes raw microphone audio RMS into a perceptual amplitude range [0, 1].
 *
 * Operations:
 * 1. Bounding: Clamps input to [0, 1] to prevent SVG/layout blowout from clipping.
 * 2. Noise-Floor Gate: Clamps values below NOISE_FLOOR (0.03) to 0.0 to guarantee stillness in ambient silence.
 * 3. Perceptual Power Curve: Non-linear gamma curve (normalized^0.75) elevates natural human conversational speech (0.05 - 0.45)
 *    into visible, responsive dynamics.
 *
 * NOTE: This is amplitude normalization / perceptual mapping. It is NOT temporal smoothing.
 */
export function normalizeAudioRms(rawRms: number): number {
  if (typeof rawRms !== 'number' || isNaN(rawRms) || rawRms <= 0) {
    return 0;
  }
  const clamped = Math.max(0, Math.min(1, rawRms));

  // Noise floor gate
  const NOISE_FLOOR = 0.03;
  if (clamped < NOISE_FLOOR) {
    return 0;
  }

  // Normalize above noise floor
  const normalized = (clamped - NOISE_FLOOR) / (1 - NOISE_FLOOR);

  // Perceptual expansion curve (gamma ~ 0.75 lifts quiet speech)
  const perceptual = Math.pow(normalized, 0.75);

  return Math.round(perceptual * 1000) / 1000;
}

/** Backward-compatible alias for normalizeAudioRms */
export const smoothRms = normalizeAudioRms;

export interface TemporalSmoothingOptions {
  attack?: number; // Speed of response when amplitude increases (default 0.55)
  release?: number; // Speed of decay when amplitude decreases (default 0.18)
}

/**
 * Applies asymmetric attack/release temporal smoothing between animation frames.
 * - Speech onset (target > current): Fast attack responds immediately to spoken words.
 * - Speech decay (target < current): Gentle release prevents jitter and avoids premature visual silence between syllables.
 *
 * NOTE: This provides lightweight conversational voice activity visualization. It is NOT calibrated audio metering.
 */
export function applyTemporalSmoothing(
  currentDisplay: number,
  targetNormalized: number,
  options?: TemporalSmoothingOptions
): number {
  const attack = options?.attack ?? 0.55;
  const release = options?.release ?? 0.18;

  const current = Math.max(0, Math.min(1, currentDisplay));
  const target = Math.max(0, Math.min(1, targetNormalized));

  let next: number;
  if (target > current) {
    next = current + (target - current) * attack;
  } else {
    next = current + (target - current) * release;
  }

  // Snap to zero if below audible display threshold to avoid infinite asymptotic tail
  if (next < 0.005) {
    return 0;
  }

  return Math.round(next * 1000) / 1000;
}

/**
 * Creates a stateful temporal smoother instance.
 */
export function createRmsTemporalSmoother(options?: TemporalSmoothingOptions) {
  let displayValue = 0;

  return {
    step(rawRms: number): number {
      const normalized = normalizeAudioRms(rawRms);
      displayValue = applyTemporalSmoothing(displayValue, normalized, options);
      return displayValue;
    },
    current(): number {
      return displayValue;
    },
    reset(): void {
      displayValue = 0;
    }
  };
}

/**
 * Known internal AI provider / runtime keywords that MUST NOT leak into
 * normal conversational UI metadata.
 */
const KNOWN_PROVIDER_PATTERNS = [
  /ollama/i,
  /claude/i,
  /codex/i,
  /antigravity/i,
  /openai/i,
  /anthropic/i,
  /google/i,
  /gemini/i,
  /gpt-/i,
  /fast brain/i,
  /deep brain/i,
  /subscription runtime/i,
  /local runtime/i
];

/**
 * Sanitizes quick response source labels to ensure underlying AI provider / runtime
 * identities do NOT leak into normal conversational UI metadata.
 *
 * - Content provenance (e.g. "YouTube", "Official Documentation", "Wikipedia") is preserved.
 * - Intelligence execution substrate (e.g. "Local Fast Brain", "Claude", "Ollama") is stripped.
 */
export function sanitizeQuickResponseSource(sourceLabel?: string): string | undefined {
  if (!sourceLabel || typeof sourceLabel !== 'string') {
    return undefined;
  }

  const trimmed = sourceLabel.trim();
  if (!trimmed) {
    return undefined;
  }

  // If label matches internal execution provider names, filter it out
  for (const pattern of KNOWN_PROVIDER_PATTERNS) {
    if (pattern.test(trimmed)) {
      return undefined;
    }
  }

  return trimmed;
}

/**
 * Prototype heuristic limits for floating Quick Response bubble.
 * NOTE: These numeric thresholds are implementation-local defensive heuristics, NOT frozen canonical invariants.
 */
export const PROTOTYPE_HEURISTICS = {
  maxQuickResponseChars: 240,
  maxQuickResponseCodeLines: 3
} as const;

/**
 * Payload interface for evaluating expansion eligibility.
 */
export interface ExpansionEvaluationPayload {
  text?: string;
  cards?: UiV2Card[];
  structuredContent?: boolean; // Short structured tables, comparison grids, etc.
  codeSnippet?: string;
  codeRequiresInspection?: boolean; // Code that benefits from copying, diffing, editing
  requiresInteraction?: boolean; // Action approvals, user confirmations
  explicitUserExpand?: boolean; // User clicked ↗ or requested expand
  isMultiTurn?: boolean; // NOTE: Multi-turn alone does NOT force visual expansion
}

/**
 * Evaluates whether an interaction payload belongs in the Presence Quick Response bubble
 * or if a meaningful VISUAL INTERACTION NEED requires expanding to Level 2 (Conversation).
 *
 * CANONICAL EXPANSION INVARIANTS:
 * 1. Conversation Context != Surface Level.
 *    Multi-turn voice dialogue history is runtime/context state and does NOT itself force visual expansion.
 *    MAVE can sustain long ambient spoken conversations entirely in Presence.
 * 2. Visual Need Drives Expansion.
 *    Presence -> Conversation occurs ONLY when there is a genuine visual interaction need:
 *    - Rich cards (sources, video, tasks, diffs, approvals)
 *    - Structured tables or comparisons
 *    - Interactive user approvals or decisions
 *    - Code requiring inspection/copying
 *    - Explicit user request to expand (↗)
 *    - Content that cannot comfortably fit in a single floating bubble (defensive heuristic).
 */
export function evaluateExpansionEligibility(
  payload: ExpansionEvaluationPayload
): ExpansionEligibility {
  // 1. Explicit user request (e.g. user clicked ↗ Expand)
  if (payload.explicitUserExpand) {
    return {
      shouldExpand: true,
      triggerType: 'explicit_user_request',
      reason: 'Explicit user request to expand to Conversation surface.'
    };
  }

  // 2. Interactive action approvals (M5 sensitive permission, tool authorization)
  if (payload.requiresInteraction) {
    return {
      shouldExpand: true,
      triggerType: 'interactive_approval',
      reason: 'Interactive action authorization or user decision requires Conversation surface.'
    };
  }

  // 3. Structured visual content (tables, comparison grids, multi-column breakdown)
  if (payload.structuredContent) {
    return {
      shouldExpand: true,
      triggerType: 'structured_content',
      reason: 'Structured visual content (table / comparison) requires Conversation surface.'
    };
  }

  // 4. Rich structured cards (sources, video, tasks, diffs, approvals)
  if (payload.cards && payload.cards.length > 0) {
    return {
      shouldExpand: true,
      triggerType: 'rich_cards',
      reason: `Payload contains ${payload.cards.length} rich card(s) that require full Conversation rendering.`
    };
  }

  // 5. Code requiring inspection / copying / editing, or multi-line blocks exceeding defensive bubble height
  if (payload.codeRequiresInspection) {
    return {
      shouldExpand: true,
      triggerType: 'code_inspection',
      reason: 'Code requiring inspection, copying, or syntax view requires Conversation surface.'
    };
  }
  if (payload.codeSnippet) {
    const lineCount = payload.codeSnippet.trim().split('\n').length;
    if (lineCount > PROTOTYPE_HEURISTICS.maxQuickResponseCodeLines) {
      return {
        shouldExpand: true,
        triggerType: 'code_inspection',
        reason: `Code snippet (${lineCount} lines) exceeds quick-response capacity (heuristic limit: ${PROTOTYPE_HEURISTICS.maxQuickResponseCodeLines} lines).`
      };
    }
  }

  // 6. Long-form prose exceeding floating capsule bubble capacity (defensive UI heuristic)
  if (payload.text && payload.text.trim().length > PROTOTYPE_HEURISTICS.maxQuickResponseChars) {
    return {
      shouldExpand: true,
      triggerType: 'long_text',
      reason: `Response text (${payload.text.length} chars) exceeds single quick-response capacity (heuristic limit: ${PROTOTYPE_HEURISTICS.maxQuickResponseChars} chars).`
    };
  }

  // Default: suitable for Presence quick response (even if part of a multi-turn conversation)
  return {
    shouldExpand: false,
    triggerType: 'single_compact',
    reason: 'Single compact response suitable for Presence quick-response bubble.'
  };
}

/**
 * Returns unambiguous UI metadata for contextual presence buttons.
 * Guarantees users always understand what action a button will perform.
 */
export function getPresenceButtonDescriptor(action: PresenceControlAction): {
  label: string;
  tooltip: string;
  icon: string;
} {
  switch (action) {
    case 'stop-listening':
      return {
        label: 'Stop listening',
        tooltip: 'Stop listening to microphone',
        icon: '⏹'
      };
    case 'cancel-thinking':
      return {
        label: 'Cancel thinking',
        tooltip: 'Cancel active request and return to idle',
        icon: '✕'
      };
    case 'stop-speaking':
      return {
        label: 'Stop speaking',
        tooltip: 'Stop voice speech playback immediately',
        icon: '⏹'
      };
    case 'retry':
      return {
        label: 'Retry request',
        tooltip: 'Retry previous operation',
        icon: '↻'
      };
    case 'dismiss':
      return {
        label: 'Dismiss error',
        tooltip: 'Dismiss error and return to idle',
        icon: '✕'
      };
    case 'expand':
      return {
        label: 'Expand to Conversation',
        tooltip: 'Open full Conversation surface',
        icon: '↗'
      };
    case 'wake':
      return {
        label: 'Manual activation',
        tooltip: 'Manually activate MAVE listening mode',
        icon: '•'
      };
  }
}
