import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { PresenceSurface } from '../src/renderer/src/ui-v2/presence/PresenceSurface';
import {
  smoothRms,
  evaluateExpansionEligibility,
  getPresenceButtonDescriptor
} from '../src/renderer/src/ui-v2/presence/presence-rules';
import { AdaptivePresenceMark } from '../src/renderer/src/ui-v2/primitives/AdaptivePresenceMark';
import type { UiV2Card } from '../src/renderer/src/ui-v2/types';

describe('MAVE UI V2 — U1 Presence Surface Identity & Interaction Tests', () => {
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

  describe('3. UI-Level Audio RMS Smoothing', () => {
    it('clamps zero and negative input to 0', () => {
      expect(smoothRms(0)).toBe(0);
      expect(smoothRms(-0.5)).toBe(0);
    });

    it('gates resting noise floor below 0.03 to zero', () => {
      expect(smoothRms(0.01)).toBe(0);
      expect(smoothRms(0.025)).toBe(0);
    });

    it('expands conversational speech smoothly using power curve', () => {
      const smoothedQuiet = smoothRms(0.1);
      const smoothedMedium = smoothRms(0.4);
      expect(smoothedQuiet).toBeGreaterThan(0);
      expect(smoothedMedium).toBeGreaterThan(smoothedQuiet);
    });

    it('clamps extreme clipping input > 1.0 to 1.0', () => {
      expect(smoothRms(1.5)).toBe(1);
      expect(smoothRms(10)).toBe(1);
    });
  });

  describe('4. Quick Response vs Conversation Expansion Rule', () => {
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

    it('requires expansion when code snippet exceeds 3 lines', () => {
      const multiLineCode = 'const a = 1;\nconst b = 2;\nconst c = 3;\nconst d = 4;';
      const result = evaluateExpansionEligibility({ codeSnippet: multiLineCode });
      expect(result.shouldExpand).toBe(true);
      expect(result.triggerType).toBe('code_snippet');
    });

    it('requires expansion when action authorization is requested', () => {
      const result = evaluateExpansionEligibility({ requiresInteraction: true });
      expect(result.shouldExpand).toBe(true);
      expect(result.triggerType).toBe('interactive_approval');
    });

    it('requires expansion when response text exceeds 240 chars', () => {
      const longText = 'A'.repeat(280);
      const result = evaluateExpansionEligibility({ text: longText });
      expect(result.shouldExpand).toBe(true);
      expect(result.triggerType).toBe('long_text');
    });

    it('requires expansion for ongoing multi-turn dialogue', () => {
      const result = evaluateExpansionEligibility({ isMultiTurn: true });
      expect(result.shouldExpand).toBe(true);
      expect(result.triggerType).toBe('task_workflow');
    });
  });

  describe('5. Quick Response Bubble Rendering & Dismissal', () => {
    it('renders bubble above capsule with text and source label', () => {
      const html = renderToStaticMarkup(
        <PresenceSurface
          state="speaking"
          quickResponse={{
            text: 'Timer set for 15 minutes.',
            sourceLabel: 'MAVE Clock'
          }}
          onExpand={() => {}}
          onDismissQuickResponse={() => {}}
        />
      );
      expect(html).toContain('data-testid="presence-quick-response"');
      expect(html).toContain('Timer set for 15 minutes.');
      expect(html).toContain('MAVE Clock');
      expect(html).toContain('data-testid="quick-response-expand"');
      expect(html).toContain('data-testid="quick-response-dismiss"');
    });
  });

  describe('6. Office Mode (Silent Presence)', () => {
    it('renders Silent indicator badge in idle state when Office Mode is active', () => {
      const html = renderToStaticMarkup(<PresenceSurface state="idle" officeMode={true} />);
      expect(html).toContain('data-testid="presence-office-badge"');
      expect(html).toContain('Silent');
    });

    it('labels speaking state as Silent Output in Office Mode', () => {
      const html = renderToStaticMarkup(<PresenceSurface state="speaking" officeMode={true} />);
      expect(html).toContain('Silent Output…');
    });
  });

  describe('7. Calm Error Representation', () => {
    it('renders restrained alert border and concise message without flooding capsule', () => {
      const html = renderToStaticMarkup(
        <PresenceSurface state="error" errorMessage="Microphone disconnected" />
      );
      expect(html).toContain('var(--mave-v2-presence-border-error)');
      expect(html).toContain('Microphone disconnected');
      expect(html).toContain('data-state="error"');
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
});

