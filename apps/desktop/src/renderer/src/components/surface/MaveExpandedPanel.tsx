import React, { useRef, useEffect, useState } from 'react';
import type { SurfaceSnapshot, SurfaceAction } from '@mave/contracts';
import { MaveContentBlockRenderer } from './MaveContentBlockRenderer';
import { MaveMarkdownRenderer } from './MaveMarkdownRenderer';

export interface MaveExpandedPanelProps {
  snapshot: SurfaceSnapshot;
  onAction?: (action: SurfaceAction) => void;
  className?: string;
}

/**
 * MaveExpandedPanel
 *
 * Production Level 3 Expanded Context Panel (440x580 DIP native envelope).
 * Renders rich semantic content blocks (markdown, code, vocabulary, sources, tables)
 * with scroll-follow ergonomics, user-activity timer resets, and accessible live regions.
 */
export const MaveExpandedPanel: React.FC<MaveExpandedPanelProps> = ({
  snapshot,
  onAction,
  className = ''
}) => {
  const viewportRef = useRef<HTMLDivElement>(null);
  const isNearBottomRef = useRef<boolean>(true);
  const lastActivityReportRef = useRef<number>(0);
  const [announcement, setAnnouncement] = useState<string>('');

  // 1. Accessibility Policy:
  // Announce meaningful completed response content to screen readers.
  // Never live-announce every incremental token during continuous TTS streaming.
  useEffect(() => {
    if (
      snapshot.mode === 'expanded_response' ||
      snapshot.mode === 'confirmation' ||
      snapshot.activity === 'idle'
    ) {
      if (snapshot.assistantText && snapshot.assistantText.trim().length > 0) {
        setAnnouncement(snapshot.assistantText);
      } else if (snapshot.content && snapshot.content.length > 0) {
        const firstText = snapshot.content.find(
          (b) => b.type === 'text' || b.type === 'markdown'
        );
        if (firstText && 'text' in firstText) {
          setAnnouncement(firstText.text);
        } else if (firstText && 'markdown' in firstText) {
          setAnnouncement(firstText.markdown);
        }
      }
    }
  }, [snapshot.mode, snapshot.activity, snapshot.assistantText, snapshot.content]);

  // 2. Throttled User Activity Reporter:
  // Notifies Electron Main of user scrolling/interaction to reset the auto-collapse timer.
  const reportUserActivity = () => {
    const now = Date.now();
    if (now - lastActivityReportRef.current > 1200) {
      lastActivityReportRef.current = now;
      onAction?.({ type: 'user_activity', origin: 'user' });
    }
  };

  const handleScroll = () => {
    const el = viewportRef.current;
    if (!el) return;

    // Check if user is within 40px of bottom
    const distFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    isNearBottomRef.current = distFromBottom <= 40;

    reportUserActivity();
  };

  const handlePointerDown = () => {
    reportUserActivity();
  };

  // 3. Respectful Scroll-Follow Policy:
  // When streaming content appends, auto-scroll only if user is already near bottom.
  // If user has deliberately scrolled up to read earlier content, do NOT force them down.
  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;

    if (isNearBottomRef.current) {
      el.scrollTop = el.scrollHeight;
    }
  }, [snapshot.assistantText, snapshot.content]);

  const handleOpenLink = (url: string) => {
    onAction?.({ type: 'open_link', origin: 'user', url });
  };

  const hasBlocks = snapshot.content && snapshot.content.length > 0;
  const hasMarkdownText = Boolean(snapshot.assistantText && snapshot.assistantText.trim().length > 0);

  return (
    <div
      className={`mave-expanded-panel ${className}`.trim()}
      data-testid="mave-expanded-panel"
      onPointerDown={handlePointerDown}
    >
      {/* Off-screen screen reader live announcer (throttled boundary only) */}
      <div
        className="mave-sr-announcer"
        role="status"
        aria-live="polite"
        aria-atomic="true"
        data-testid="mave-sr-announcer"
      >
        {announcement}
      </div>

      {/* Main scrollable content viewport */}
      <div
        ref={viewportRef}
        className="mave-expanded-viewport"
        onScroll={handleScroll}
        data-testid="mave-expanded-viewport"
        role="region"
        aria-label="MAVE Response Content"
        tabIndex={0}
      >
        {hasBlocks ? (
          <MaveContentBlockRenderer
            blocks={snapshot.content!}
            onAction={onAction}
          />
        ) : hasMarkdownText ? (
          <div className="mave-block-markdown" data-testid="mave-block-markdown">
            <MaveMarkdownRenderer
              markdown={snapshot.assistantText!}
              onOpenLink={handleOpenLink}
            />
          </div>
        ) : (
          <div className="mave-expanded-empty">
            <p className="mave-empty-label">No details to display.</p>
          </div>
        )}
      </div>
    </div>
  );
};

