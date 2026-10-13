import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import type { SurfaceSnapshot } from '@mave/contracts';
import { PresenceMark } from '../src/renderer/src/components/surface/PresenceMark';
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
});
