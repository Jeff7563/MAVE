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

    // 3. Pointer drag & text-selection tracking on window
    const handlePointerDown = () => {
      isPointerDownRef.current = true;
    };
    const handlePointerUp = () => {
      isPointerDownRef.current = false;
      if (pendingUnhoverRef.current) {
        pendingUnhoverRef.current = false;
        if (window.mave?.surface?.reportInteractiveHover) {
          window.mave.surface.reportInteractiveHover(false);
        }
      }
    };
    window.addEventListener('pointerdown', handlePointerDown);
    window.addEventListener('pointerup', handlePointerUp);

    return () => {
      unsubscribe?.();
      window.removeEventListener('pointerdown', handlePointerDown);
      window.removeEventListener('pointerup', handlePointerUp);
    };
  }, []);

  const isPointerDownRef = React.useRef(false);
  const pendingUnhoverRef = React.useRef(false);

  const handleAction = useCallback((action: SurfaceAction) => {
    if (window.mave?.surface?.dispatchAction) {
      window.mave.surface.dispatchAction(action);
    }
  }, []);

  // Global Keyboard Navigation & Escape Policy (M4.8)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.altKey && e.key.toLowerCase() === 'd') {
        setShowDevDiagnostics((prev) => !prev);
        return;
      }

      if (e.key === 'Escape') {
        // If surface currently owns focus or a DOM element inside surface is focused:
        const hasFocusedElement = document.activeElement && document.activeElement !== document.body;
        if (snapshot?.focusIntent === 'request' || hasFocusedElement) {
          e.preventDefault();
          e.stopPropagation();
          handleAction({ type: 'release_focus', origin: 'user' });
          if (document.activeElement instanceof HTMLElement) {
            document.activeElement.blur();
          }
          return;
        }

        // If already passive: follow presentation policy
        if (snapshot?.mode === 'expanded_response' || snapshot?.sizeClass === 'expanded') {
          e.preventDefault();
          handleAction({ type: 'collapse', origin: 'user' });
        } else if (snapshot?.mode === 'compact_response' || snapshot?.sizeClass === 'card') {
          e.preventDefault();
          handleAction({ type: 'dismiss', origin: 'user' });
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [snapshot, handleAction]);

  const handleHoverChange = useCallback((isHovering: boolean) => {
    if (isHovering) {
      pendingUnhoverRef.current = false;
      if (window.mave?.surface?.reportInteractiveHover) {
        window.mave.surface.reportInteractiveHover(true);
      }
    } else {
      // If user is currently dragging / selecting text, defer unhover until pointerup
      if (isPointerDownRef.current) {
        pendingUnhoverRef.current = true;
      } else {
        if (window.mave?.surface?.reportInteractiveHover) {
          window.mave.surface.reportInteractiveHover(false);
        }
      }
    }
  }, []);

  if (!snapshot || snapshot.mode === 'hidden') {
    return null;
  }

  return (
    <div
      className={`mave-surface-viewport ${showDevDiagnostics ? 'mave-dev-outline-active' : ''}`.trim()}
      data-testid="mave-surface-viewport"
    >
      <div className="mave-surface-anchor">
        <MaveCapsule
          snapshot={snapshot}
          onAction={handleAction}
          onHoverChange={handleHoverChange}
        />

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
