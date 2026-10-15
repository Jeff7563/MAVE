/**
 * MAVE UI V2 — Presence Surface Interaction Rules & Utilities
 * Track: U1 Presence Surface Identity
 *
 * Encapsulates:
 * 1. UI-level RMS audio smoothing (noise gate + perceptual curve)
 * 2. Presence Quick Response vs Conversation expansion evaluation
 * 3. Unambiguous contextual button semantics
 */

import type { ExpansionEligibility, PresenceControlAction, UiV2Card } from '../types';

/**
 * Applies UI-level smoothing and perceptual response to raw audio RMS.
 *
 * Rules:
 * - Silence / noise floor (< 0.03): Clamped to 0 to prevent resting jitter.
 * - Human speech band (0.05 - 0.45): Expanded with non-linear power curve (0.75)
 *   so natural speech levels produce clear visual wave dynamics.
 * - Clipping (> 1.0): Clamped to 1.0 to avoid layout or SVG blowout.
 */
export function smoothRms(rawRms: number): number {
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

/**
 * Payload interface for evaluating expansion eligibility.
 */
export interface ExpansionEvaluationPayload {
  text?: string;
  cards?: UiV2Card[];
  isMultiTurn?: boolean;
  requiresInteraction?: boolean;
  codeSnippet?: string;
}

/**
 * Evaluates whether an interaction payload belongs in the Presence Quick Response bubble
 * or if it must semantically expand the surface to Level 2 (Conversation).
 *
 * Rule Principle:
 * Quick Response is strictly for:
 * - Single compact confirmation or answer (e.g. "Timer set for 10 min", "In French: Bonjour")
 * - No multi-card rich artifacts
 * - No code snippets exceeding 3 lines
 * - No interactive approvals or user decisions
 * - No multi-turn ongoing conversation
 */
export function evaluateExpansionEligibility(
  payload: ExpansionEvaluationPayload
): ExpansionEligibility {
  // 1. Interactive approvals / decisions require Conversation
  if (payload.requiresInteraction) {
    return {
      shouldExpand: true,
      triggerType: 'interactive_approval',
      reason: 'Interactive action authorization or decision requires Conversation surface.'
    };
  }

  // 2. Rich structured cards (sources, video, tasks, diffs, approvals) require Conversation
  if (payload.cards && payload.cards.length > 0) {
    return {
      shouldExpand: true,
      triggerType: 'rich_cards',
      reason: `Payload contains ${payload.cards.length} rich card(s) that require full Conversation rendering.`
    };
  }

  // 3. Multi-line code snippets require syntax-highlighted Conversation view
  if (payload.codeSnippet) {
    const lineCount = payload.codeSnippet.trim().split('\n').length;
    if (lineCount > 3) {
      return {
        shouldExpand: true,
        triggerType: 'code_snippet',
        reason: `Code snippet (${lineCount} lines) exceeds quick-response capacity.`
      };
    }
  }

  // 4. Multi-turn dialogue history requires conversation timeline
  if (payload.isMultiTurn) {
    return {
      shouldExpand: true,
      triggerType: 'task_workflow',
      reason: 'Multi-turn context requires Conversation timeline.'
    };
  }

  // 5. Long-form prose (> 240 chars) cannot comfortably fit in floating capsule bubble
  if (payload.text && payload.text.trim().length > 240) {
    return {
      shouldExpand: true,
      triggerType: 'long_text',
      reason: `Response text (${payload.text.length} chars) exceeds single quick-response capacity.`
    };
  }

  // Suitable for Presence quick response
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
        label: 'Wake MAVE',
        tooltip: 'Activate MAVE listening mode',
        icon: '•'
      };
  }
}

