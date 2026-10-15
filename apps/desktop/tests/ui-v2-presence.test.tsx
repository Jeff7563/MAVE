import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { PresenceSurface } from '../src/renderer/src/ui-v2/presence/PresenceSurface';
import {
  normalizeAudioRms,
  smoothRms,
  applyTemporalSmoothing,
  createRmsTemporalSmoother,
  evaluateExpansionEligibility,
  sanitizeQuickResponseSource,
  getPresenceButtonDescriptor
} from '../src/renderer/src/ui-v2/presence/presence-rules';
import { AdaptivePresenceMark } from '../src/renderer/src/ui-v2/primitives/AdaptivePresenceMark';
import type { UiV2Card } from '../src/renderer/src/ui-v2/types';

describe('MAVE UI V2 — U1.1 Presence Interaction Semantics Hardening Tests', () => {
  describe('1. Idle State Minimality & Wordmark Identity', () => {
    it('renders MAVE wordmark and Presence Mark in idle state', () => {
      const html = renderToStaticMarkup(<PresenceSurface state="idle" />);
      expect(html).toContain('data-testid="presence-wordmark"');
      expect(html).toContain('MAVE');
      expect(html).toContain('data-testid="adaptive-presence-mark"');
    });

    it('does NOT render status label "IDLE" or "idle" in resting idle state', () => {
      const html = renderToStaticMarkup(<PresenceSurface state="idle" />);
      expect(html).not.toContain('data-testid="presence-state-label"');
      expect(html).not.toContain('IDLE');
    });

    it('does NOT render persistent action buttons in idle state', () => {
      const html = renderToStaticMarkup(<PresenceSurface state="idle" />);
      expect(html).not.toContain('data-testid="presence-action-stop-listening"');
      expect(html).not.toContain('data-testid="presence-action-cancel-thinking"');
      expect(html).not.toContain('data-testid="presence-action-stop-speaking"');
      expect(html).not.toContain('data-testid="presence-action-retry-error"');
    });

    it('applies strict zero glow in resting idle state', () => {
      const html = renderToStaticMarkup(<PresenceSurface state="idle" />);
      expect(html).toContain('var(--mave-v2-presence-glow-resting)');
    });
  });

  describe('2. Contextual Action Buttons & Semantic Disclosure', () => {
    it('renders Stop Listening button exclusively in listening state', () => {
      const htmlListening = renderToStaticMarkup(
        <PresenceSurface state="listening" onStopListening={() => {}} />
      );
      expect(htmlListening).toContain('data-testid="presence-action-stop-listening"');
      expect(htmlListening).toContain('aria-label="Stop listening"');
      expect(htmlListening).toContain('Listening…');

      const htmlIdle = renderToStaticMarkup(<PresenceSurface state="idle" onStopListening={() => {}} />);
      expect(htmlIdle).not.toContain('data-testid="presence-action-stop-listening"');
    });

    it('renders Cancel button exclusively in thinking state', () => {
      const htmlThinking = renderToStaticMarkup(
        <PresenceSurface state="thinking" onCancelThinking={() => {}} />
      );
      expect(htmlThinking).toContain('data-testid="presence-action-cancel-thinking"');
      expect(htmlThinking).toContain('aria-label="Cancel thinking"');
      expect(htmlThinking).toContain('Thinking…');
    });

    it('renders Stop Speaking button in speaking state for barge-in / mute', () => {
      const htmlSpeaking = renderToStaticMarkup(
        <PresenceSurface state="speaking" onStopSpeaking={() => {}} />
      );
      expect(htmlSpeaking).toContain('data-testid="presence-action-stop-speaking"');
      expect(htmlSpeaking).toContain('aria-label="Stop speaking"');
      expect(htmlSpeaking).toContain('Speaking…');
    });

    it('renders Retry button exclusively in error state', () => {
      const htmlError = renderToStaticMarkup(
        <PresenceSurface state="error" errorMessage="Local brain unavailable" onRetryError={() => {}} />
      );
      expect(htmlError).toContain('data-testid="presence-action-retry-error"');
      expect(htmlError).toContain('aria-label="Retry request"');
      expect(htmlError).toContain('Local brain unavailable');
    });

    it('unambiguous button descriptors provide distinct labels and tooltips', () => {
      const stopList = getPresenceButtonDescriptor('stop-listening');
      const stopSpk = getPresenceButtonDescriptor('stop-speaking');
      const cancel = getPresenceButtonDescriptor('cancel-thinking');
      const retry = getPresenceButtonDescriptor('retry');

      expect(stopList.label).toBe('Stop listening');
      expect(stopSpk.label).toBe('Stop speaking');
      expect(cancel.label).toBe('Cancel thinking');
      expect(retry.label).toBe('Retry request');
      expect(stopList.tooltip).not.toEqual(stopSpk.tooltip);
    });
  });

  describe('3. UI-Level Audio RMS Amplitude Normalization', () => {
    it('clamps zero and negative input to 0', () => {
      expect(normalizeAudioRms(0)).toBe(0);
      expect(normalizeAudioRms(-0.5)).toBe(0);
      expect(smoothRms(0)).toBe(0); // Alias check
    });

    it('gates resting noise floor below 0.03 to zero', () => {
      expect(normalizeAudioRms(0.01)).toBe(0);
      expect(normalizeAudioRms(0.025)).toBe(0);
    });

    it('expands conversational speech smoothly using power curve', () => {
      const normQuiet = normalizeAudioRms(0.1);
      const normMedium = normalizeAudioRms(0.4);
      expect(normQuiet).toBeGreaterThan(0);
      expect(normMedium).toBeGreaterThan(normQuiet);
    });

    it('clamps extreme clipping input > 1.0 to 1.0', () => {
      expect(normalizeAudioRms(1.5)).toBe(1);
      expect(normalizeAudioRms(10)).toBe(1);
    });
  });

  describe('4. Temporal RMS Display Smoothing (Attack vs Release Dynamics)', () => {
    it('responds faster on speech onset (attack) than on speech decay (release)', () => {
      const initial = 0.0;
      const speechOnsetTarget = 0.8;
      const attackStep = applyTemporalSmoothing(initial, speechOnsetTarget, { attack: 0.55, release: 0.18 });
      const riseDelta = attackStep - initial;

      const peak = 0.8;
      const speechDecayTarget = 0.0;
      const decayStep = applyTemporalSmoothing(peak, speechDecayTarget, { attack: 0.55, release: 0.18 });
      const decayDelta = peak - decayStep;

      // Fast attack ensures instant onset responsiveness; gentle release avoids premature visual drop-off
      expect(riseDelta).toBeGreaterThan(decayDelta);
      expect(attackStep).toBe(0.44);
      expect(decayStep).toBe(0.656);
    });

    it('createRmsTemporalSmoother smooths continuous stream and resets cleanly', () => {
      const smoother = createRmsTemporalSmoother({ attack: 0.5, release: 0.2 });
      expect(smoother.current()).toBe(0);

      // Frame 1: loud speech input
      const val1 = smoother.step(0.6);
      expect(val1).toBeGreaterThan(0);

      // Frame 2: silence - decay is smooth, not instant drop to 0
      const val2 = smoother.step(0.0);
      expect(val2).toBeGreaterThan(0);
      expect(val2).toBeLessThan(val1);

      smoother.reset();
      expect(smoother.current()).toBe(0);
    });
  });

  describe('5. Canonical Expansion Principle (Visual Need Invariants)', () => {
    it('does NOT force visual expansion solely because multi-turn dialogue is active', () => {
      const result = evaluateExpansionEligibility({
        isMultiTurn: true,
        text: 'Short follow-up answer'
      });
      // Invariant: Conversation Context != Surface Level
      expect(result.shouldExpand).toBe(false);
      expect(result.triggerType).toBe('single_compact');
    });

    it('approves single compact text for Presence Quick Response', () => {
      const result = evaluateExpansionEligibility({
        text: 'In French, that is “Bonjour”. It means “Hello”.'
      });
      expect(result.shouldExpand).toBe(false);
      expect(result.triggerType).toBe('single_compact');
    });

    it('requires expansion when payload includes rich cards', () => {
      const mockCard: UiV2Card = {
        id: 'c1',
        type: 'source',
        domain: 'example.com',
        url: 'https://example.com',
        snippet: 'citation test'
      };
      const result = evaluateExpansionEligibility({ cards: [mockCard] });
      expect(result.shouldExpand).toBe(true);
      expect(result.triggerType).toBe('rich_cards');
    });

    it('requires expansion when structured visual content (table / comparison) is present', () => {
      const result = evaluateExpansionEligibility({ structuredContent: true });
      expect(result.shouldExpand).toBe(true);
      expect(result.triggerType).toBe('structured_content');
    });

    it('requires expansion when code benefits from inspection or exceeds heuristic lines', () => {
      const codeInspectionResult = evaluateExpansionEligibility({ codeRequiresInspection: true });
      expect(codeInspectionResult.shouldExpand).toBe(true);
      expect(codeInspectionResult.triggerType).toBe('code_inspection');

      const multiLineCode = 'const a = 1;\nconst b = 2;\nconst c = 3;\nconst d = 4;';
      const lineLimitResult = evaluateExpansionEligibility({ codeSnippet: multiLineCode });
      expect(lineLimitResult.shouldExpand).toBe(true);
      expect(lineLimitResult.triggerType).toBe('code_inspection');
    });

    it('allows tiny one-line inline code in Quick Response', () => {
      const result = evaluateExpansionEligibility({ codeSnippet: 'npm install @mave/core' });
      expect(result.shouldExpand).toBe(false);
      expect(result.triggerType).toBe('single_compact');
    });

    it('requires expansion when action authorization is requested', () => {
      const result = evaluateExpansionEligibility({ requiresInteraction: true });
      expect(result.shouldExpand).toBe(true);
      expect(result.triggerType).toBe('interactive_approval');
    });

    it('requires expansion when response text exceeds defensive heuristic limit', () => {
      const longText = 'A'.repeat(280);
      const result = evaluateExpansionEligibility({ text: longText });
      expect(result.shouldExpand).toBe(true);
      expect(result.triggerType).toBe('long_text');
    });

    it('requires expansion on explicit user request', () => {
      const result = evaluateExpansionEligibility({ explicitUserExpand: true });
      expect(result.shouldExpand).toBe(true);
      expect(result.triggerType).toBe('explicit_user_request');
    });
  });

  describe('6. Quick Response Privacy Filter vs Content Provenance', () => {
    it('sanitizes AI execution substrate / provider names from UI metadata', () => {
      expect(sanitizeQuickResponseSource('Local Fast Brain')).toBeUndefined();
      expect(sanitizeQuickResponseSource('Ollama / llama3.2')).toBeUndefined();
      expect(sanitizeQuickResponseSource('Claude 3.5 Sonnet')).toBeUndefined();
      expect(sanitizeQuickResponseSource('Antigravity Deep Brain')).toBeUndefined();
      expect(sanitizeQuickResponseSource('OpenAI gpt-4o')).toBeUndefined();
    });

    it('preserves genuine content provenance / citations', () => {
      expect(sanitizeQuickResponseSource('Documentation')).toBe('Documentation');
      expect(sanitizeQuickResponseSource('YouTube')).toBe('YouTube');
      expect(sanitizeQuickResponseSource('Wikipedia')).toBe('Wikipedia');
      expect(sanitizeQuickResponseSource('French Reference')).toBe('French Reference');
    });

    it('PresenceSurface does NOT render provider names even if passed in sourceLabel', () => {
      const htmlWithProvider = renderToStaticMarkup(
        <PresenceSurface
          state="speaking"
          quickResponse={{
            text: 'Here is an answer.',
            sourceLabel: 'Local Fast Brain'
          }}
        />
      );
      expect(htmlWithProvider).not.toContain('Local Fast Brain');
      expect(htmlWithProvider).not.toContain('data-testid="quick-response-source"');
    });

    it('PresenceSurface renders genuine content provenance when clean source is provided', () => {
      const htmlWithProvenance = renderToStaticMarkup(
        <PresenceSurface
          state="speaking"
          quickResponse={{
            text: 'Here is an answer.',
            sourceLabel: 'Documentation'
          }}
        />
      );
      expect(htmlWithProvenance).toContain('Documentation');
      expect(htmlWithProvenance).toContain('data-testid="quick-response-source"');
    });
  });

  describe('7. Office Mode & Manual Activation Semantics', () => {
    it('renders subtle mute micro-indicator in idle state when Office Mode is active', () => {
      const html = renderToStaticMarkup(<PresenceSurface state="idle" officeMode={true} />);
      expect(html).toContain('data-testid="presence-office-badge"');
      expect(html).toContain('🔇');
    });

    it('labels speaking state as Silent Output in Office Mode', () => {
      const html = renderToStaticMarkup(<PresenceSurface state="speaking" officeMode={true} />);
      expect(html).toContain('Silent Output…');
    });

    it('wordmark and mark expose manual activation semantics on click', () => {
      const html = renderToStaticMarkup(<PresenceSurface state="idle" onManualActivate={() => {}} />);
      expect(html).toContain('title="Manual activation: start listening"');
      expect(html).toContain('aria-label="Manual activation"');
    });
  });

  describe('8. AdaptivePresenceMark Restrained Motion', () => {
    it('renders restrained cognitive arc for thinking state without aggressive double rings', () => {
      const html = renderToStaticMarkup(<AdaptivePresenceMark state="thinking" size="compact" />);
      expect(html).toContain('stroke-dasharray="8 22"');
      expect(html).toContain('mave-v2-orbit 3.5s');
    });

    it('renders waking pulse ring for waking state', () => {
      const html = renderToStaticMarkup(<AdaptivePresenceMark state="waking" size="compact" />);
      expect(html).toContain('mave-v2-wake-pulse');
    });
  });

  // -------------------------------------------------------------------------
  // 9. Visual QA Patch P1 — Presence Scale, Non-Acoustic Thinking, and Action Styling
  // -------------------------------------------------------------------------
  describe('9. Visual QA Patch P1 — Presence Scale, Non-Acoustic Thinking, and Action Styling', () => {
    it('Thinking state renders non-acoustic cognitive pulse sequence and zero audio waveform', () => {
      const htmlThinking = renderToStaticMarkup(
        <PresenceSurface state="thinking" onCancelThinking={() => {}} />
      );

      // Must render cognitive shimmer indicator
      expect(htmlThinking).toContain('data-testid="presence-thinking-indicator"');
      expect(htmlThinking).toContain('mave-v3-cognitive-pulse');

      // Invariant: Non-acoustic, zero waveform in thinking
      expect(htmlThinking).not.toContain('data-testid="presence-waveform"');
    });

    it('Eliminates square stop button glyph in favor of subtle circular action controls', () => {
      const htmlListening = renderToStaticMarkup(
        <PresenceSurface state="listening" onStopListening={() => {}} />
      );
      const htmlSpeaking = renderToStaticMarkup(
        <PresenceSurface state="speaking" onStopSpeaking={() => {}} />
      );

      // Must NOT contain heavy square stop glyph
      expect(htmlListening).not.toContain('⏹');
      expect(htmlSpeaking).not.toContain('⏹');

      // Uses subtle dismiss glyph and circular button styling
      expect(htmlListening).toContain('border-radius:50%');
      expect(htmlListening).toContain('data-testid="presence-action-stop-listening"');
      expect(htmlSpeaking).toContain('border-radius:50%');
      expect(htmlSpeaking).toContain('data-testid="presence-action-stop-speaking"');
    });

    it('Presence capsule maintains constant 50px height across states for seamless morphing', () => {
      const htmlIdle = renderToStaticMarkup(<PresenceSurface state="idle" />);
      const htmlListening = renderToStaticMarkup(<PresenceSurface state="listening" />);
      const htmlThinking = renderToStaticMarkup(<PresenceSurface state="thinking" />);
      const htmlSpeaking = renderToStaticMarkup(<PresenceSurface state="speaking" />);

      // Height is constant 50px, border-radius 25px across all states
      expect(htmlIdle).toContain('height:50px');
      expect(htmlIdle).toContain('border-radius:25px');
      expect(htmlListening).toContain('height:50px');
      expect(htmlListening).toContain('border-radius:25px');
      expect(htmlThinking).toContain('height:50px');
      expect(htmlThinking).toContain('border-radius:25px');
      expect(htmlSpeaking).toContain('height:50px');
      expect(htmlSpeaking).toContain('border-radius:25px');
    });

    it('Optional regions collapse completely with zero unexplained blank visual gap', () => {
      const htmlActiveMinimal = renderToStaticMarkup(
        <PresenceSurface state="listening" />
      );

      // No cancel or stop actions rendered when handlers are absent
      expect(htmlActiveMinimal).not.toContain('data-testid="presence-action-stop-listening"');
      expect(htmlActiveMinimal).not.toContain('data-testid="presence-action-expand"');
      expect(htmlActiveMinimal).not.toContain('data-testid="presence-background-task"');
      expect(htmlActiveMinimal).not.toContain('data-testid="presence-live-transcript"');

      // Status label is present with state dot
      expect(htmlActiveMinimal).toContain('data-testid="presence-state-label"');
      expect(htmlActiveMinimal).toContain('Listening…');
    });
  });
});
