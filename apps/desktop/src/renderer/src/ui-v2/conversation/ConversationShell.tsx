import React, { useState } from 'react';
import type { ConversationState, PresenceState } from '../types';
import { AdaptivePresenceMark } from '../primitives/AdaptivePresenceMark';
import { CardRenderer } from '../cards';
import '../tokens.css';

export interface ConversationShellProps {
  state: ConversationState;
  presenceState?: PresenceState;
  audioLevel?: number;
  onSendMessage?: (text: string) => void;
  onCollapseToPresence?: () => void;
  onExpandToWorkspace?: () => void;
  onSelectShortcut?: (shortcut: string) => void;
  onAllowAction?: (id: string) => void;
  onDenyAction?: (id: string) => void;
  onListen?: (text: string) => void;
  className?: string;
  width?: string | number;
  height?: string | number;
}

const DEFAULT_SHORTCUTS = ['Search', 'Analyze', 'Create', 'Write', 'Code', 'Plan'];

/**
 * ConversationShell
 *
 * Level 2 Conversation Surface.
 * Supports compact floating and narrow side-docked chat layouts.
 * Features:
 * - MAVE identity header with status badge (Provider details abstracted away)
 * - Optional intent suggestions/shortcuts (NOT mandatory modes)
 * - Scrollable message and rich card timeline
 * - Observable progress state (No fake thinking steps)
 * - Interactive composer
 * - Collapse to Presence and Expand to Workspace controls
 */
export const ConversationShell: React.FC<ConversationShellProps> = ({
  state,
  presenceState = 'idle',
  audioLevel = 0,
  onSendMessage,
  onCollapseToPresence,
  onExpandToWorkspace,
  onSelectShortcut,
  onAllowAction,
  onDenyAction,
  onListen,
  className = '',
  width = '100%',
  height = '100%'
}) => {
  const [inputText, setInputText] = useState('');

  const handleSend = () => {
    if (!inputText.trim()) return;
    onSendMessage?.(inputText.trim());
    setInputText('');
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const shortcuts = state.suggestedShortcuts ?? DEFAULT_SHORTCUTS;

  return (
    <div
      className={`mave-v2-conversation-shell ${className}`.trim()}
      style={{
        width,
        height,
        background: 'var(--mave-v2-surface-resting)',
        backdropFilter: 'blur(var(--mave-v2-blur))',
        WebkitBackdropFilter: 'blur(var(--mave-v2-blur))',
        border: '1px solid var(--mave-v2-border-subtle)',
        borderRadius: 'var(--mave-v2-radius-panel)',
        boxShadow: '0 12px 36px rgba(0, 0, 0, 0.45)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        boxSizing: 'border-box',
        color: 'var(--mave-v2-text-primary)',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
      }}
      data-testid="conversation-shell"
    >
      {/* 1. Header with MAVE Identity & Navigation Controls */}
      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '12px 16px',
          borderBottom: '1px solid var(--mave-v2-border-subtle)',
          background: 'rgba(255, 255, 255, 0.02)'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <AdaptivePresenceMark
            size="compact"
            state={presenceState}
            audioLevel={audioLevel}
          />
          <div>
            <div style={{ fontWeight: 700, fontSize: '14px', letterSpacing: '-0.2px' }}>
              MAVE
            </div>
            <div style={{ fontSize: '11px', color: 'var(--mave-v2-text-dim)' }}>
              {state.semanticRuntimeLabel ?? 'Personal Assistant'}
            </div>
          </div>
        </div>

        {/* Level Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          {onCollapseToPresence && (
            <button
              onClick={onCollapseToPresence}
              title="Minimize to Presence"
              aria-label="Minimize to Presence"
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--mave-v2-text-muted)',
                cursor: 'pointer',
                padding: '4px',
                borderRadius: '4px',
                fontSize: '12px'
              }}
            >
              ↙
            </button>
          )}
          {onExpandToWorkspace && (
            <button
              onClick={onExpandToWorkspace}
              title="Expand to Workspace"
              aria-label="Expand to Workspace"
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--mave-v2-text-muted)',
                cursor: 'pointer',
                padding: '4px',
                borderRadius: '4px',
                fontSize: '12px'
              }}
            >
              ⤢
            </button>
          )}
        </div>
      </header>

      {/* 2. Optional Task Shortcuts (Suggestions, NOT mandatory mode selectors) */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          padding: '8px 16px',
          overflowX: 'auto',
          borderBottom: '1px solid rgba(255, 255, 255, 0.04)',
          background: 'rgba(0, 0, 0, 0.15)'
        }}
      >
        {shortcuts.map((shortcut) => (
          <button
            key={shortcut}
            onClick={() => {
              setInputText(`${shortcut}: `);
              onSelectShortcut?.(shortcut);
            }}
            style={{
              background: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid var(--mave-v2-border-subtle)',
              borderRadius: 'var(--mave-v2-radius-pill)',
              padding: '3px 10px',
              fontSize: '11px',
              color: 'var(--mave-v2-text-secondary)',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              transition: 'all var(--mave-v2-motion-fast)'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = 'var(--mave-v2-text-primary)';
              e.currentTarget.style.borderColor = 'var(--mave-v2-border-active)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = 'var(--mave-v2-text-secondary)';
              e.currentTarget.style.borderColor = 'var(--mave-v2-border-subtle)';
            }}
          >
            {shortcut}
          </button>
        ))}
      </div>

      {/* 3. Scrollable Timeline (Messages and Rich Cards) */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '16px',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px'
        }}
        data-testid="conversation-timeline"
      >
        {state.messages.map((msg) => (
          <CardRenderer key={msg.id} card={msg} />
        ))}

        {/* Embedded Cards (Sources, Video, Translation, Approvals) */}
        {state.cards.map((card) => (
          <CardRenderer
            key={card.id}
            card={card}
            onAllow={onAllowAction}
            onDeny={onDenyAction}
            onListen={onListen}
          />
        ))}

        {/* Real-time Streaming Response Text */}
        {state.streamingText && (
          <div
            style={{
              background: 'var(--mave-v2-surface-elevated)',
              border: '1px solid var(--mave-v2-border-subtle)',
              borderRadius: '14px 14px 14px 2px',
              padding: '10px 14px',
              fontSize: '13px',
              lineHeight: 1.5,
              color: 'var(--mave-v2-text-primary)'
            }}
            data-testid="streaming-text-block"
          >
            <div>{state.streamingText}</div>
            <span
              style={{
                display: 'inline-block',
                width: '6px',
                height: '14px',
                background: 'var(--mave-v2-accent-listening)',
                marginLeft: '4px',
                verticalAlign: 'middle',
                animation: 'mave-v2-pulse-ring 1s infinite'
              }}
            />
          </div>
        )}

        {/* Observable Progress State (Honest progress string) */}
        {state.observableProgressText && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              fontSize: '12px',
              color: 'var(--mave-v2-accent-listening)',
              padding: '6px 10px',
              background: 'rgba(56, 189, 248, 0.08)',
              borderRadius: '6px'
            }}
            data-testid="observable-progress-banner"
          >
            <AdaptivePresenceMark state="thinking" size="status" />
            <span>{state.observableProgressText}</span>
          </div>
        )}
      </div>

      {/* 4. Message Composer */}
      <footer
        style={{
          padding: '12px 16px',
          borderTop: '1px solid var(--mave-v2-border-subtle)',
          background: 'rgba(0, 0, 0, 0.25)',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <textarea
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask MAVE anything, search, or practice speaking…"
            rows={1}
            style={{
              flex: 1,
              background: 'var(--mave-v2-surface-active)',
              border: '1px solid var(--mave-v2-border-subtle)',
              borderRadius: '10px',
              padding: '10px 12px',
              color: 'var(--mave-v2-text-primary)',
              fontSize: '13px',
              resize: 'none',
              outline: 'none',
              fontFamily: 'inherit'
            }}
            data-testid="conversation-composer-input"
          />

          <button
            onClick={handleSend}
            disabled={!inputText.trim()}
            style={{
              background: inputText.trim()
                ? 'var(--mave-v2-accent-listening)'
                : 'rgba(255, 255, 255, 0.08)',
              border: 'none',
              borderRadius: '8px',
              color: inputText.trim() ? '#0f172a' : 'var(--mave-v2-text-dim)',
              padding: '10px 14px',
              fontWeight: 600,
              fontSize: '13px',
              cursor: inputText.trim() ? 'pointer' : 'default',
              transition: 'all var(--mave-v2-motion-fast)'
            }}
            data-testid="conversation-send-button"
          >
            Send
          </button>
        </div>
      </footer>
    </div>
  );
};

