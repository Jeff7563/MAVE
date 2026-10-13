import React, { useEffect, useState } from 'react';
import type { SurfaceSnapshot, SurfaceEvent } from '@mave/contracts';

export const SurfaceView: React.FC = () => {
  const [snapshot, setSnapshot] = useState<SurfaceSnapshot | null>(null);

  useEffect(() => {
    // Ensure parent document and body are completely transparent
    document.documentElement.style.background = 'transparent';
    document.body.style.background = 'transparent';
    document.body.style.margin = '0';
    document.body.style.overflow = 'hidden';

    // Hydrate initial snapshot
    if (window.mave?.surface?.getSnapshot) {
      window.mave.surface
        .getSnapshot()
        .then((s: SurfaceSnapshot) => setSnapshot(s))
        .catch((err: any) => console.error('Failed to get surface snapshot:', err));
    }

    // Subscribe to surface snapshot events
    let unsubscribe: (() => void) | undefined;
    if (window.mave?.surface?.subscribe) {
      unsubscribe = window.mave.surface.subscribe((event: SurfaceEvent) => {
        if (event.type === 'snapshot_updated') {
          setSnapshot(event.snapshot);
        }
      });
    }

    return () => {
      unsubscribe?.();
    };
  }, []);

  const handleMouseEnter = () => {
    if (window.mave?.surface?.reportInteractiveHover) {
      window.mave.surface.reportInteractiveHover(true);
    }
  };

  const handleMouseLeave = () => {
    if (window.mave?.surface?.reportInteractiveHover) {
      window.mave.surface.reportInteractiveHover(false);
    }
  };

  const dispatchAction = (action: any) => {
    if (window.mave?.surface?.dispatchAction) {
      window.mave.surface.dispatchAction(action);
    }
  };

  if (!snapshot) {
    return null;
  }

  // Minimal M4.2 native validation debug container
  return (
    <div
      style={{
        width: '100vw',
        height: '100vh',
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'flex-end',
        padding: '0px',
        boxSizing: 'border-box',
        pointerEvents: 'none' // outer transparent area passes clicks through
      }}
    >
      <div
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        style={{
          width: '100%',
          height: '100%',
          boxSizing: 'border-box',
          backgroundColor: 'rgba(18, 18, 22, 0.95)',
          border: '1px solid rgba(255, 255, 255, 0.12)',
          borderRadius: '12px',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.45)',
          color: '#f0f0f4',
          fontFamily: 'system-ui, -apple-system, sans-serif',
          fontSize: '12px',
          padding: '10px 14px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          pointerEvents: 'auto', // visual card intercepts clicks
          userSelect: 'none'
        }}
      >
        <div>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '4px'
            }}
          >
            <span style={{ fontWeight: 700, color: '#60a5fa', letterSpacing: '0.05em' }}>
              MAVE SURFACE
            </span>
            <span
              style={{
                fontSize: '10px',
                padding: '1px 6px',
                borderRadius: '4px',
                backgroundColor: snapshot.pinned ? '#3b82f6' : 'rgba(255, 255, 255, 0.1)',
                color: '#fff'
              }}
            >
              {snapshot.pinned ? 'PINNED' : snapshot.sizeClass.toUpperCase()}
            </span>
          </div>

          <div style={{ color: '#94a3b8', fontSize: '11px', lineHeight: '1.4' }}>
            <div>
              Mode: <strong style={{ color: '#f8fafc' }}>{snapshot.mode}</strong> | Activity:{' '}
              <strong style={{ color: '#f8fafc' }}>{snapshot.activity}</strong>
            </div>
            {snapshot.transcript?.text && (
              <div style={{ marginTop: '2px', color: '#cbd5e1' }}>
                You: "{snapshot.transcript.text}"
              </div>
            )}
            {snapshot.assistantText && (
              <div style={{ marginTop: '2px', color: '#93c5fd' }}>
                MAVE: "{snapshot.assistantText}"
              </div>
            )}
          </div>
        </div>

        {/* Minimal M4.2 diagnostic action triggers */}
        <div style={{ display: 'flex', gap: '6px', marginTop: '6px' }}>
          <button
            onClick={() => dispatchAction({ type: 'expand' })}
            style={{
              fontSize: '10px',
              padding: '3px 8px',
              borderRadius: '4px',
              border: '1px solid rgba(255, 255, 255, 0.15)',
              backgroundColor: 'rgba(255, 255, 255, 0.08)',
              color: '#e2e8f0',
              cursor: 'pointer'
            }}
          >
            Expand
          </button>
          <button
            onClick={() => dispatchAction({ type: 'collapse' })}
            style={{
              fontSize: '10px',
              padding: '3px 8px',
              borderRadius: '4px',
              border: '1px solid rgba(255, 255, 255, 0.15)',
              backgroundColor: 'rgba(255, 255, 255, 0.08)',
              color: '#e2e8f0',
              cursor: 'pointer'
            }}
          >
            Collapse
          </button>
          <button
            onClick={() => dispatchAction({ type: 'toggle_pin' })}
            style={{
              fontSize: '10px',
              padding: '3px 8px',
              borderRadius: '4px',
              border: '1px solid rgba(255, 255, 255, 0.15)',
              backgroundColor: snapshot.pinned ? '#2563eb' : 'rgba(255, 255, 255, 0.08)',
              color: '#e2e8f0',
              cursor: 'pointer'
            }}
          >
            {snapshot.pinned ? 'Unpin' : 'Pin'}
          </button>
          <button
            onClick={() => dispatchAction({ type: 'dismiss' })}
            style={{
              fontSize: '10px',
              padding: '3px 8px',
              borderRadius: '4px',
              border: '1px solid rgba(239, 68, 68, 0.4)',
              backgroundColor: 'rgba(239, 68, 68, 0.15)',
              color: '#fca5a5',
              cursor: 'pointer'
            }}
          >
            Dismiss
          </button>
        </div>
      </div>
    </div>
  );
};
