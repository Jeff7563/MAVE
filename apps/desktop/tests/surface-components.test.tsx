import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import type { SurfaceSnapshot } from '@mave/contracts';
import {
  PresenceMark,
  computeVisualIntensity,
  computeBarScales
} from '../src/renderer/src/components/surface/PresenceMark';
import { MaveCapsule } from '../src/renderer/src/components/surface/MaveCapsule';
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
});

