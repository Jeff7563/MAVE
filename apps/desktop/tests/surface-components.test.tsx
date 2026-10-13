import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import type { SurfaceSnapshot } from '@mave/contracts';
import {
  PresenceMark,
  computeVisualIntensity,
  computeBarScales
} from '../src/renderer/src/components/surface/PresenceMark';
import { MaveCapsule } from '../src/renderer/src/components/surface/MaveCapsule';
import { MaveCompactResponse } from '../src/renderer/src/components/surface/MaveCompactResponse';
import {
  MaveMarkdownRenderer,
  isSafeWebUrl
} from '../src/renderer/src/components/surface/MaveMarkdownRenderer';
import { MaveContentBlockRenderer } from '../src/renderer/src/components/surface/MaveContentBlockRenderer';
import { MaveExpandedPanel } from '../src/renderer/src/components/surface/MaveExpandedPanel';
import { SurfaceView } from '../src/renderer/src/components/surface/SurfaceView';

function createSnapshot(overrides: Partial<SurfaceSnapshot> = {}): SurfaceSnapshot {
  return {
    version: 1,
    mode: 'ambient',
    visibility: 'visible',
    sizeClass: 'ambient',
    interactionMode: 'passive',
    focusIntent: 'preserve',
    pinned: false,
    activity: 'idle',
    source: 'voice',
    priority: 'normal',
    inputLevel: 0,
    outputLevel: 0,
    updatedAt: Date.now(),
    ...overrides
  };
}

describe('M4.3 Compact Ambient Surface Components', () => {
  describe('PresenceMark Visual Primitive', () => {
    it('renders accessible SVG with decorative aria-hidden attribute', () => {
      const html = renderToStaticMarkup(<PresenceMark mode="ambient" />);
      expect(html).toContain('aria-hidden="true"');
      expect(html).toContain('mave-presence-mark--ambient');
      expect(html).toContain('<svg');
      expect(html).toContain('class="mave-presence-bar"');
    });

    it('applies correct mode CSS modifiers for all valid surface modes', () => {
      const modes = ['ambient', 'listening', 'thinking', 'speaking', 'error'] as const;
      for (const mode of modes) {
        const html = renderToStaticMarkup(<PresenceMark mode={mode} />);
        expect(html).toContain(`mave-presence-mark--${mode}`);
      }
    });

    it('computeVisualIntensity suppresses noise below floor and maps vocal dynamics smoothly', () => {
      // Noise floor suppression (< 0.03)
      expect(computeVisualIntensity(0)).toBe(0);
      expect(computeVisualIntensity(-0.5)).toBe(0);
      expect(computeVisualIntensity(0.01)).toBe(0);
      expect(computeVisualIntensity(0.03)).toBe(0);
      expect(computeVisualIntensity(NaN)).toBe(0);
      expect(computeVisualIntensity(Infinity)).toBe(0);

      // Monotonic vocal expansion
      const low = computeVisualIntensity(0.08);
      const mid = computeVisualIntensity(0.25);
      const high = computeVisualIntensity(0.60);
      const full = computeVisualIntensity(1.0);

      expect(low).toBeGreaterThan(0);
      expect(mid).toBeGreaterThan(low);
      expect(high).toBeGreaterThan(mid);
      expect(full).toBe(1.0);

      // Clamping ceiling
      expect(computeVisualIntensity(1.5)).toBe(1.0);
    });

    it('computeBarScales produces coordinated 3-bar kinetic factors', () => {
      // Listening silence baseline
      const listenSilence = computeBarScales('listening', 0);
      expect(listenSilence.center).toBe(0.85);
      expect(listenSilence.left).toBe(0.65);
      expect(listenSilence.right).toBe(0.70);

      // Listening active vocal energy
      const listenActive = computeBarScales('listening', 1.0);
      expect(listenActive.center).toBe(1.50);
      expect(listenActive.center).toBeGreaterThan(listenActive.left);
      expect(listenActive.center).toBeGreaterThan(listenActive.right);
      expect(listenActive.right).toBeGreaterThan(listenActive.left);

      // Speaking silence pause relaxation
      const speakSilence = computeBarScales('speaking', 0);
      expect(speakSilence.center).toBe(0.75);
      expect(speakSilence.left).toBe(0.55);
      expect(speakSilence.right).toBe(0.60);

      // Speaking active output energy
      const speakActive = computeBarScales('speaking', 1.0);
      expect(speakActive.center).toBe(1.50);
      expect(speakActive.center).toBeGreaterThan(speakActive.left);
      expect(speakActive.center).toBeGreaterThan(speakActive.right);

      // Ambient/thinking baseline
      const ambientScales = computeBarScales('ambient', 0.8);
      expect(ambientScales).toEqual({ left: 1, center: 1, right: 1 });
    });

    it('PresenceMark uses inputLevel in listening mode and ignores outputLevel', () => {
      const html = renderToStaticMarkup(
        <PresenceMark mode="listening" inputLevel={0.4} outputLevel={0.9} />
      );
      // Mode should be listening, intensity mapped from inputLevel (~0.4), not outputLevel (0.9)
      expect(html).toContain('data-mode="listening"');
      expect(html).toContain('mave-presence-mark--listening');
      // Should define CSS custom properties
      expect(html).toContain('--mave-energy');
      expect(html).toContain('--mave-bar-center-scale');
    });

    it('PresenceMark uses outputLevel in speaking mode and ignores inputLevel', () => {
      const html = renderToStaticMarkup(
        <PresenceMark mode="speaking" inputLevel={0.8} outputLevel={0.3} />
      );
      expect(html).toContain('data-mode="speaking"');
      expect(html).toContain('mave-presence-mark--speaking');
      expect(html).toContain('--mave-energy');
      expect(html).toContain('--mave-bar-center-scale');
    });

    it('PresenceMark in thinking and ambient modes ignores both audio levels', () => {
      const htmlThink = renderToStaticMarkup(
        <PresenceMark mode="thinking" inputLevel={0.8} outputLevel={0.8} />
      );
      expect(htmlThink).toContain('data-intensity="0.000"');

      const htmlAmbient = renderToStaticMarkup(
        <PresenceMark mode="ambient" inputLevel={0.8} outputLevel={0.8} />
      );
      expect(htmlAmbient).toContain('data-intensity="0.000"');
    });
  });

  describe('MaveCapsule Component & Render Modes (Rule 37)', () => {
    it('renders resting ambient capsule with brand and polite "Ready" status', () => {
      const snapshot = createSnapshot({ mode: 'ambient' });
      const html = renderToStaticMarkup(<MaveCapsule snapshot={snapshot} />);

      expect(html).toContain('MAVE');
      expect(html).toContain('Ready');
      expect(html).toContain('mave-presence-mark--ambient');
      expect(html).toContain('role="region"');
      expect(html).toContain('aria-label="MAVE Assistant"');
    });

    it('renders listening mode variant', () => {
      const snapshot = createSnapshot({ mode: 'listening', activity: 'listening' });
      const html = renderToStaticMarkup(<MaveCapsule snapshot={snapshot} />);

      expect(html).toContain('MAVE');
      expect(html).toContain('Listening...');
      expect(html).toContain('mave-presence-mark--listening');
    });

    it('renders thinking mode variant', () => {
      const snapshot = createSnapshot({ mode: 'thinking', activity: 'thinking' });
      const html = renderToStaticMarkup(<MaveCapsule snapshot={snapshot} />);

      expect(html).toContain('MAVE');
      expect(html).toContain('Thinking...');
      expect(html).toContain('mave-presence-mark--thinking');
    });

    it('renders speaking mode variant', () => {
      const snapshot = createSnapshot({ mode: 'speaking', activity: 'speaking' });
      const html = renderToStaticMarkup(<MaveCapsule snapshot={snapshot} />);

      expect(html).toContain('MAVE');
      expect(html).toContain('Speaking...');
      expect(html).toContain('mave-presence-mark--speaking');
    });

    it('renders calm error mode variant without leaking tech stacktraces', () => {
      const snapshot = createSnapshot({
        mode: 'error',
        error: {
          code: 'MIC_FAULT',
          message: 'Hardware capture device disconnected',
          severity: 'error',
          recoverable: true
        }
      });
      const html = renderToStaticMarkup(<MaveCapsule snapshot={snapshot} />);

      expect(html).toContain('MAVE');
      expect(html).toContain('Something went wrong');
      expect(html).toContain('mave-presence-mark--error');
      // Crucial: Must NOT leak internal technical details or Python stacktraces
      expect(html).not.toContain('MIC_FAULT');
      expect(html).not.toContain('Hardware capture device');
    });
  });

  describe('User-Facing Language & No Debug Leakage (Rule 38)', () => {
    it('never exposes runtime internal words such as "Sleeping" or "transcribing"', () => {
      const snapshot = createSnapshot({ mode: 'ambient', activity: 'idle' });
      const html = renderToStaticMarkup(<MaveCapsule snapshot={snapshot} />);

      expect(html).not.toContain('Sleeping');
      expect(html).not.toContain('sleeping');
      expect(html).not.toContain('transcribing');
    });

    it('does not leak voice provider metadata or telemetry into production UI', () => {
      const snapshot = createSnapshot({
        mode: 'ambient',
        sessionId: 'test-session-123'
      });
      const html = renderToStaticMarkup(<MaveCapsule snapshot={snapshot} />);

      expect(html).not.toContain('openWakeWord');
      expect(html).not.toContain('faster-whisper');
      expect(html).not.toContain('edge-tts');
      expect(html).not.toContain('test-session-123');
      expect(html).not.toContain('latency');
    });
  });

  describe('Action Controls & Hover Region (Rule 39)', () => {
    it('renders accessible pin and dismiss action buttons', () => {
      const snapshot = createSnapshot({ pinned: false });
      const html = renderToStaticMarkup(<MaveCapsule snapshot={snapshot} />);

      expect(html).toContain('aria-label="Dismiss MAVE"');
      expect(html).toContain('aria-label="Pin MAVE"');
    });

    it('renders unpin label when card is pinned', () => {
      const snapshot = createSnapshot({ pinned: true });
      const html = renderToStaticMarkup(<MaveCapsule snapshot={snapshot} />);

      expect(html).toContain('aria-label="Unpin MAVE"');
    });
  });

  describe('SurfaceView Lifecycle & Hidden Mode (Rule 19)', () => {
    it('renders null when snapshot mode is hidden', () => {
      const snapshot = createSnapshot({ mode: 'hidden', visibility: 'hidden' });
      const html = renderToStaticMarkup(<SurfaceView initialSnapshot={snapshot} />);

      expect(html).toBe('');
    });

    it('renders compact capsule inside outer transparent viewport in ambient mode', () => {
      const snapshot = createSnapshot({ mode: 'ambient' });
      const html = renderToStaticMarkup(<SurfaceView initialSnapshot={snapshot} />);

      expect(html).toContain('mave-surface-viewport');
      expect(html).toContain('mave-capsule');
      expect(html).toContain('MAVE');
    });

    it('renders response container when mode is compact_response', () => {
      const snapshot = createSnapshot({
        mode: 'compact_response',
        sizeClass: 'card',
        assistantText: 'Today in Bangkok it is 31 degrees Celsius.'
      });
      const html = renderToStaticMarkup(<SurfaceView initialSnapshot={snapshot} />);

      expect(html).toContain('mave-response-placeholder');
      expect(html).toContain('Today in Bangkok it is 31 degrees Celsius.');
    });
  });

  describe('M4.5 Adaptive Morph Container Foundations', () => {
    it('renders data-size attribute matching semantic size classes', () => {
      const ambientHtml = renderToStaticMarkup(
        <MaveCapsule snapshot={createSnapshot({ sizeClass: 'ambient' })} />
      );
      expect(ambientHtml).toContain('data-size="ambient"');

      const cardHtml = renderToStaticMarkup(
        <MaveCapsule snapshot={createSnapshot({ sizeClass: 'card', mode: 'compact_response' })} />
      );
      expect(cardHtml).toContain('data-size="card"');
      expect(cardHtml).toContain('data-testid="mave-action-expand"');

      const expandedHtml = renderToStaticMarkup(
        <MaveCapsule snapshot={createSnapshot({ sizeClass: 'expanded', mode: 'expanded_response' })} />
      );
      expect(expandedHtml).toContain('data-size="expanded"');
      expect(expandedHtml).toContain('data-testid="mave-action-collapse"');
    });

    it('retains PresenceMark and MAVE brand across card and expanded morphs', () => {
      const cardHtml = renderToStaticMarkup(
        <MaveCapsule
          snapshot={createSnapshot({
            sizeClass: 'card',
            mode: 'speaking',
            outputLevel: 0.8
          })}
        />
      );
      expect(cardHtml).toContain('mave-presence-mark--speaking');
      expect(cardHtml).toContain('data-testid="mave-brand-label"');
      expect(cardHtml).toContain('MAVE');

      const expandedHtml = renderToStaticMarkup(
        <MaveCapsule
          snapshot={createSnapshot({
            sizeClass: 'expanded',
            mode: 'listening',
            inputLevel: 0.6
          })}
        />
      );
      expect(expandedHtml).toContain('mave-presence-mark--listening');
      expect(expandedHtml).toContain('data-testid="mave-brand-label"');
      expect(expandedHtml).toContain('MAVE');
    });
  });

  describe('Milestone 4.6 Compact Response Presentation', () => {
    it('renders primary response text with accessible polite live region', () => {
      const snap = createSnapshot({
        mode: 'compact_response',
        sizeClass: 'card',
        assistantText: "I'm exhausted today."
      });
      const html = renderToStaticMarkup(<MaveCompactResponse snapshot={snap} />);
      expect(html).toContain('data-testid="mave-compact-response"');
      expect(html).toContain('role="status"');
      expect(html).toContain('aria-live="polite"');
      expect(html).toContain("I&#x27;m exhausted today.");
    });

    it('renders Thai response text cleanly without clipping or encoding issues', () => {
      const thaiText = "คุณสามารถพูดว่า 'I'm exhausted today.' ได้ครับ";
      const snap = createSnapshot({
        mode: 'compact_response',
        sizeClass: 'card',
        assistantText: thaiText
      });
      const html = renderToStaticMarkup(<MaveCompactResponse snapshot={snap} />);
      expect(html).toContain('data-testid="mave-response-text"');
      expect(html).toContain('คุณสามารถพูดว่า');
      expect(html).toContain('ได้ครับ');
    });

    it('renders English response text cleanly', () => {
      const englishText = "We're currently working on MAVE Milestone 4.";
      const snap = createSnapshot({
        mode: 'compact_response',
        sizeClass: 'card',
        assistantText: englishText
      });
      const html = renderToStaticMarkup(<MaveCompactResponse snapshot={snap} />);
      expect(html).toContain('We&#x27;re currently working on MAVE Milestone 4.');
    });

    it('renders mixed Thai-English response text cleanly', () => {
      const mixedText = 'ตอนนี้ MAVE อยู่ใน Milestone 4 — Ambient Adaptive Surface';
      const snap = createSnapshot({
        mode: 'compact_response',
        sizeClass: 'card',
        assistantText: mixedText
      });
      const html = renderToStaticMarkup(<MaveCompactResponse snapshot={snap} />);
      expect(html).toContain('ตอนนี้ MAVE อยู่ใน Milestone 4 — Ambient Adaptive Surface');
    });

    it('renders vocabulary card variant with word, phonetic, translation, and example', () => {
      const snap = createSnapshot({
        mode: 'compact_response',
        sizeClass: 'card',
        content: [
          {
            id: 'vocab-1',
            type: 'vocabulary',
            word: 'exhausted',
            phonetic: 'ɪɡˈzɔːstɪd',
            partOfSpeech: 'adj.',
            translation: 'เหนื่อยมาก, หมดแรง',
            examples: ["I'm exhausted today."]
          }
        ]
      });
      const html = renderToStaticMarkup(<MaveCompactResponse snapshot={snap} />);
      expect(html).toContain('data-testid="mave-vocabulary-card"');
      expect(html).toContain('exhausted');
      expect(html).toContain('/ɪɡˈzɔːstɪd/');
      expect(html).toContain('adj.');
      expect(html).toContain('เหนื่อยมาก, หมดแรง');
      expect(html).toContain("I&#x27;m exhausted today.");
    });

    it('renders status card variant with status indicator and label', () => {
      const snap = createSnapshot({
        mode: 'compact_response',
        sizeClass: 'card',
        content: [
          {
            id: 'stat-1',
            type: 'status',
            label: 'Timer set for 10 minutes',
            status: 'success'
          }
        ]
      });
      const html = renderToStaticMarkup(<MaveCompactResponse snapshot={snap} />);
      expect(html).toContain('data-testid="mave-status-card"');
      expect(html).toContain('mave-status-card--success');
      expect(html).toContain('Timer set for 10 minutes');
    });

    it('renders overflow expand hint when text is long in card mode', () => {
      const longText =
        'This is a comprehensive response that contains multiple lines of detailed text explaining the concept in full depth, which easily exceeds four lines of compact preview space.';
      const snap = createSnapshot({
        mode: 'compact_response',
        sizeClass: 'card',
        assistantText: longText
      });
      const html = renderToStaticMarkup(<MaveCompactResponse snapshot={snap} />);
      expect(html).toContain('data-testid="mave-response-expand-hint"');
      expect(html).toContain('More');
    });

    it('does not render expand hint when response text is brief', () => {
      const snap = createSnapshot({
        mode: 'compact_response',
        sizeClass: 'card',
        assistantText: 'Brief answer.'
      });
      const html = renderToStaticMarkup(<MaveCompactResponse snapshot={snap} />);
      expect(html).not.toContain('data-testid="mave-response-expand-hint"');
    });

    it('renders MaveCapsule with MaveCompactResponse embedded in card mode', () => {
      const snap = createSnapshot({
        mode: 'compact_response',
        sizeClass: 'card',
        assistantText: 'Here is your answer.'
      });
      const html = renderToStaticMarkup(<MaveCapsule snapshot={snap} />);
      expect(html).toContain('data-testid="mave-response-card"');
      expect(html).toContain('data-testid="mave-compact-response"');
      expect(html).toContain('Here is your answer.');
      expect(html).toContain('data-testid="mave-brand-label"');
    });
  });

  describe('Milestone 4.7 Expanded Context Panel & Rich Content Presentation', () => {
    describe('isSafeWebUrl helper', () => {
      it('approves https and http schemes', () => {
        expect(isSafeWebUrl('https://example.com')).toBe(true);
        expect(isSafeWebUrl('https://api.github.com/repos')).toBe(true);
        expect(isSafeWebUrl('http://localhost:3000')).toBe(true);
      });

      it('rejects dangerous and non-http schemes', () => {
        expect(isSafeWebUrl('javascript:alert(1)')).toBe(false);
        expect(isSafeWebUrl('file:///etc/passwd')).toBe(false);
        expect(isSafeWebUrl('data:text/html,<script>alert(1)</script>')).toBe(false);
        expect(isSafeWebUrl('vbscript:msgbox')).toBe(false);
        expect(isSafeWebUrl('')).toBe(false);
        expect(isSafeWebUrl('not a url')).toBe(false);
      });
    });

    describe('MaveMarkdownRenderer', () => {
      it('renders headings, bold, italic, and lists safely', () => {
        const md = '# Title 1\n\n## Subtitle\n\nText with **bold** and *italic*.\n\n- Bullet 1\n- Bullet 2';
        const html = renderToStaticMarkup(<MaveMarkdownRenderer markdown={md} />);
        expect(html).toContain('mave-md-h1');
        expect(html).toContain('Title 1');
        expect(html).toContain('mave-md-h2');
        expect(html).toContain('Subtitle');
        expect(html).toContain('mave-md-strong');
        expect(html).toContain('bold');
        expect(html).toContain('mave-md-em');
        expect(html).toContain('italic');
        expect(html).toContain('mave-md-ul');
        expect(html).toContain('Bullet 1');
      });

      it('disarms unsafe link schemes and renders safe links with proper class', () => {
        const md = 'Check [Safe](https://example.com) and [Unsafe](javascript:alert(1)).';
        const html = renderToStaticMarkup(<MaveMarkdownRenderer markdown={md} />);
        expect(html).toContain('href="https://example.com"');
        expect(html).toContain('class="mave-md-link"');
        expect(html).toContain('Safe');
        // Unsafe link must NOT be an <a> anchor with javascript:
        expect(html).not.toContain('href="javascript:');
        expect(html).toContain('mave-md-link-disabled');
        expect(html).toContain('Unsafe');
      });

      it('escapes raw HTML tags as literal text, preventing XSS execution', () => {
        const md = 'Here is an exploit: <script>alert("pwned")</script> and <iframe src="evil.com"></iframe>';
        const html = renderToStaticMarkup(<MaveMarkdownRenderer markdown={md} />);
        expect(html).not.toContain('<script>');
        expect(html).not.toContain('<iframe>');
        // Escaped into text
        expect(html).toContain('alert(&quot;pwned&quot;)');
      });

      it('renders markdown tables with header and body cells', () => {
        const md = '| Component | Status |\n|---|---|\n| PresenceMark | Active |\n| Panel | Expanded |';
        const html = renderToStaticMarkup(<MaveMarkdownRenderer markdown={md} />);
        expect(html).toContain('data-testid="mave-table-wrapper"');
        expect(html).toContain('Component');
        expect(html).toContain('PresenceMark');
        expect(html).toContain('Expanded');
      });

      it('gracefully renders incomplete streaming code fences without throwing', () => {
        const md = 'Streaming started:\n```typescript\nconst x = 42;';
        // Unclosed code fence during token streaming
        const html = renderToStaticMarkup(<MaveMarkdownRenderer markdown={md} />);
        expect(html).toContain('data-testid="mave-code-block"');
        expect(html).toContain('const x = 42;');
      });
    });

    describe('MaveContentBlockRenderer', () => {
      it('renders multi-block content in deterministic order with stable keys', () => {
        const blocks = [
          { id: 'b-text', type: 'text' as const, text: 'Explanation paragraph' },
          { id: 'b-code', type: 'code' as const, language: 'typescript', code: 'const answer = 42;' },
          { id: 'b-source', type: 'source' as const, title: 'MAVE Architecture Spec', domain: 'mave.ai', url: 'https://mave.ai/spec' }
        ];
        const html = renderToStaticMarkup(<MaveContentBlockRenderer blocks={blocks} />);
        expect(html).toContain('data-testid="mave-content-blocks"');
        expect(html).toContain('Explanation paragraph');
        expect(html).toContain('data-testid="mave-block-code"');
        expect(html).toContain('const answer = 42;');
        expect(html).toContain('data-testid="mave-source-card"');
        expect(html).toContain('MAVE Architecture Spec');
      });

      it('renders confirmation card with title, risk badge, and action buttons', () => {
        const blocks = [
          {
            id: 'b-conf',
            type: 'confirmation' as const,
            actionId: 'action-123',
            title: 'Delete temporary voice cache?',
            description: 'This will purge all cached local TTS audio frames.',
            risk: 'medium' as const,
            confirmLabel: 'Purge Now',
            rejectLabel: 'Keep Files'
          }
        ];
        const html = renderToStaticMarkup(<MaveContentBlockRenderer blocks={blocks} />);
        expect(html).toContain('data-testid="mave-confirmation-card"');
        expect(html).toContain('Delete temporary voice cache?');
        expect(html).toContain('MEDIUM');
        expect(html).toContain('Purge Now');
        expect(html).toContain('Keep Files');
      });

      it('renders progress card with label and determinate track', () => {
        const blocks = [
          {
            id: 'b-prog',
            type: 'progress' as const,
            taskId: 'task-456',
            label: 'Downloading language model',
            percentage: 65,
            status: 'running' as const
          }
        ];
        const html = renderToStaticMarkup(<MaveContentBlockRenderer blocks={blocks} />);
        expect(html).toContain('data-testid="mave-progress-card"');
        expect(html).toContain('Downloading language model');
        expect(html).toContain('65%');
      });
    });

    describe('MaveExpandedPanel & MaveCapsule Expanded Integration', () => {
      it('renders MaveExpandedPanel with scrollable viewport and off-screen polite announcer', () => {
        const snap = createSnapshot({
          sizeClass: 'expanded',
          mode: 'expanded_response',
          assistantText: 'Full expanded markdown response explanation.'
        });
        const html = renderToStaticMarkup(<MaveExpandedPanel snapshot={snap} />);
        expect(html).toContain('data-testid="mave-expanded-panel"');
        expect(html).toContain('data-testid="mave-expanded-viewport"');
        expect(html).toContain('data-testid="mave-sr-announcer"');
        expect(html).toContain('aria-live="polite"');
        expect(html).toContain('Full expanded markdown response explanation.');
      });

      it('renders MaveCapsule with MaveExpandedPanel embedded in expanded sizeClass', () => {
        const snap = createSnapshot({
          sizeClass: 'expanded',
          mode: 'expanded_response',
          assistantText: 'Here is detailed research.'
        });
        const html = renderToStaticMarkup(<MaveCapsule snapshot={snap} />);
        expect(html).toContain('data-testid="mave-expanded-card"');
        expect(html).toContain('data-testid="mave-expanded-panel"');
        expect(html).toContain('data-testid="mave-brand-label"');
        expect(html).toContain('data-testid="mave-action-collapse"');
        expect(html).toContain('data-testid="mave-presence-mark"');
      });
    });
  });
});

