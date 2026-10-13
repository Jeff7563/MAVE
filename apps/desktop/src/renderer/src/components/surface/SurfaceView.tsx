import React, { useEffect, useState, useCallback } from 'react';
import type { SurfaceSnapshot, SurfaceEvent, SurfaceAction } from '@mave/contracts';
import { MaveCapsule } from './MaveCapsule';
import './surface.css';

export interface SurfaceViewProps {
  /**
   * Optional initial snapshot (e.g. for testing without Electron IPC).
   */
  initialSnapshot?: SurfaceSnapshot | null;
}

/**
 * SurfaceView
 *
 * Root React container for the MAVE Ambient Surface window.
 * Ensures the native transparent background is preserved, hydrates snapshot,
 * tracks interactive hover bounds, and delegates to production surface components.
 */
export const SurfaceView: React.FC<SurfaceViewProps> = ({ initialSnapshot = null }) => {
  const [snapshot, setSnapshot] = useState<SurfaceSnapshot | null>(initialSnapshot);
  const [showDevDiagnostics, setShowDevDiagnostics] = useState(false);

  useEffect(() => {
    // Ensure document and body roots remain strictly transparent
    document.documentElement.style.background = 'transparent';
    document.body.style.background = 'transparent';
    document.body.style.margin = '0';
    document.body.style.overflow = 'hidden';

    // 1. Hydrate snapshot once on mount (no polling)
    if (window.mave?.surface?.getSnapshot) {
      window.mave.surface
        .getSnapshot()
        .then((s) => setSnapshot(s))
        .catch((err) => console.error('Failed to hydrate initial surface snapshot:', err));
    }

    // 2. Subscribe to push updates
    let unsubscribe: (() => void) | undefined;
    if (window.mave?.surface?.subscribe) {
      unsubscribe = window.mave.surface.subscribe((event: SurfaceEvent) => {
        if (event.type === 'snapshot_updated') {
          setSnapshot(event.snapshot);
        }
      });
    }

    // 3. Global developer shortcut (Alt+D) to toggle diagnostics overlay
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.altKey && e.key.toLowerCase() === 'd') {
        setShowDevDiagnostics((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      unsubscribe?.();
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  const handleHoverChange = useCallback((isHovering: boolean) => {
    if (window.mave?.surface?.reportInteractiveHover) {
      window.mave.surface.reportInteractiveHover(isHovering);
    }
  }, []);

  const handleAction = useCallback((action: SurfaceAction) => {
    if (window.mave?.surface?.dispatchAction) {
      window.mave.surface.dispatchAction(action);
    }
  }, []);

  if (!snapshot || snapshot.mode === 'hidden') {
    return null;
  }

  // Response modes (M4.6 & M4.7 foundation placeholders)
  const isResponseMode =
    snapshot.mode === 'compact_response' || snapshot.mode === 'expanded_response';

  return (
    <div
      className="mave-surface-viewport"
      data-testid="mave-surface-viewport"
    >
      <div className="mave-surface-anchor">
        {isResponseMode ? (
          <div
            className="mave-response-placeholder"
            onMouseEnter={() => handleHoverChange(true)}
            onMouseLeave={() => handleHoverChange(false)}
            data-testid="mave-response-card"
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
              <MaveCapsule
                snapshot={snapshot}
                onAction={handleAction}
                onHoverChange={handleHoverChange}
              />
            </div>
            {snapshot.assistantText && (
              <div
                style={{
                  color: 'var(--mave-surface-text)',
                  fontSize: '13px',
                  lineHeight: '1.4',
                  marginTop: '8px'
                }}
                data-testid="mave-response-text"
              >
                {snapshot.assistantText}
              </div>
            )}
          </div>
        ) : (
          <MaveCapsule
            snapshot={snapshot}
            onAction={handleAction}
            onHoverChange={handleHoverChange}
          />
        )}

        {/* Optional Developer Diagnostic Overlay (Alt+D) */}
        {showDevDiagnostics && (
          <div
            style={{
              position: 'fixed',
              top: '8px',
              left: '8px',
              background: 'rgba(0, 0, 0, 0.85)',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              borderRadius: '6px',
              padding: '6px 10px',
              color: '#38bdf8',
              fontSize: '11px',
              fontFamily: 'monospace',
              pointerEvents: 'auto',
              zIndex: 9999
            }}
            data-testid="mave-dev-diagnostics-overlay"
          >
            <div>MODE: {snapshot.mode}</div>
            <div>SIZE: {snapshot.sizeClass}</div>
            <div>PINNED: {String(snapshot.pinned)}</div>
            <div>ACT: {snapshot.activity}</div>
            <div>IN: {snapshot.inputLevel.toFixed(3)}</div>
            <div>OUT: {snapshot.outputLevel.toFixed(3)}</div>
          </div>
        )}
      </div>
    </div>
  );
};
