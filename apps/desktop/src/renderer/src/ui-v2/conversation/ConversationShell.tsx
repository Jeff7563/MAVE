import React, { useState, useRef, useEffect } from 'react';
import type {
  ConversationState,
  PresenceState,
  ResponseGroup
} from '../types';
import { AdaptivePresenceMark } from '../primitives/AdaptivePresenceMark';
import { CardRenderer } from '../cards';
import { SourceCard } from '../cards/MediaCards';
import { groupConversationTimeline } from './conversation-rules';
import '../tokens.css';

export interface ConversationShellProps {
  state: ConversationState;
  presenceState?: PresenceState;
  audioLevel?: number;
  onSendMessage?: (text: string) => void;
  onCollapseToPresence?: () => void;
  onExpandToWorkspace?: () => void;
  onClose?: () => void;
  onSelectShortcut?: (shortcut: string) => void;
  onSelectFollowUp?: (suggestion: string) => void;
  onCancelGeneration?: () => void;
  onRetry?: (requestId?: string) => void;
  onLoadEarlierHistory?: () => void;
  onVoiceActivate?: () => void;
  onAllowAction?: (id: string) => void;
  onDenyAction?: (id: string) => void;
  onListen?: (text: string) => void;
  className?: string;
  width?: string | number;
  height?: string | number;
  officeMode?: boolean;
}

const DEFAULT_SHORTCUTS = ['Search', 'Analyze', 'Code', 'Write', 'Translate', 'Plan'];

/**
 * ConversationShell
 *
 * Level 2 Conversation Surface Foundation.
 * Supports floating compact canvas and narrow docked chat layouts.
 *
 * Core Semantics:
 * - Deterministic handoff & collapse (Surface State != Conversation Context)
 * - Grouped responses: Answer -> Sources -> Rich Cards -> Follow-up suggestions
 * - Typed Content Provenance (Citations rendered; technical substrate isolated)
 * - In-place streaming with observable progress (Zero fake reasoning steps)
 * - Deterministic scroll: Auto-follows when at bottom; subtle "New response ↓" when scrolled up
 * - Clean composer: Enter send, Shift+Enter newline, Stop generation, Mic trigger
 */
export const ConversationShell: React.FC<ConversationShellProps> = ({
  state,
  presenceState = 'idle',
  audioLevel = 0,
  onSendMessage,
  onCollapseToPresence,
  onExpandToWorkspace,
  onClose,
  onSelectShortcut,
  onSelectFollowUp,
  onCancelGeneration,
  onRetry,
  onLoadEarlierHistory,
  onVoiceActivate,
  onAllowAction,
  onDenyAction,
  onListen,
  className = '',
  width = '100%',
  height = '100%',
  officeMode = false
}) => {
  const [inputText, setInputText] = useState('');
  const [isScrolledUp, setIsScrolledUp] = useState(state.isScrolledUp ?? false);
  const timelineRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Sync isScrolledUp if controlled from props
  useEffect(() => {
    if (state.isScrolledUp !== undefined) {
      setIsScrolledUp(state.isScrolledUp);
    }
  }, [state.isScrolledUp]);

  // Handle scroll detection
  const handleScroll = () => {
    if (!timelineRef.current) return;
    const el = timelineRef.current;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 32;
    setIsScrolledUp(!atBottom);
  };

  // Scroll to bottom smoothly
  const scrollToBottom = () => {
    if (timelineRef.current) {
      timelineRef.current.scrollTo({
        top: timelineRef.current.scrollHeight,
        behavior: 'smooth'
      });
      setIsScrolledUp(false);
    }
  };

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

  const isStreaming =
    state.status === 'streaming' ||
    state.streamingStatus === 'streaming' ||
    Boolean(state.streamingText);

  const shortcuts = state.suggestedShortcuts ?? DEFAULT_SHORTCUTS;
  const groups: ResponseGroup[] = groupConversationTimeline(state);

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
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        position: 'relative'
      }}
      data-testid="conversation-shell"
    >
      {/* 1. Header with MAVE Identity, Context Label & Navigation Controls */}
      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '12px 16px',
          borderBottom: '1px solid var(--mave-v2-border-subtle)',
          background: 'rgba(255, 255, 255, 0.02)',
          userSelect: 'none'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <AdaptivePresenceMark
            size="compact"
            state={presenceState}
            audioLevel={officeMode ? 0 : audioLevel}
          />
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span
                style={{
                  fontWeight: 700,
                  fontSize: '14px',
                  letterSpacing: '-0.2px',
                  color: 'var(--mave-v2-text-primary)'
                }}
              >
                MAVE
              </span>
              {state.contextLabel && (
                <span
                  style={{
                    fontSize: '10px',
                    fontWeight: 600,
                    color: 'var(--mave-v2-accent-listening)',
                    background: 'rgba(56, 189, 248, 0.1)',
                    border: '1px solid rgba(56, 189, 248, 0.25)',
                    padding: '1px 6px',
                    borderRadius: '4px'
                  }}
                  data-testid="conversation-context-label"
                >
                  {state.contextLabel}
                </span>
              )}
            </div>
            <div
              style={{ fontSize: '11px', color: 'var(--mave-v2-text-dim)' }}
              data-testid="conversation-subtitle"
            >
              {state.semanticRuntimeLabel ?? 'Personal Assistant'}
            </div>
          </div>
        </div>

        {/* Level Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          {(state.workspaceEligible || onExpandToWorkspace) && (
            <button
              onClick={onExpandToWorkspace}
              title="Expand to Workspace"
              aria-label="Expand to Workspace"
              style={{
                background: state.workspaceEligible ? 'rgba(56, 189, 248, 0.15)' : 'transparent',
                border: state.workspaceEligible ? '1px solid var(--mave-v2-accent-listening)' : 'none',
                color: state.workspaceEligible ? 'var(--mave-v2-accent-listening)' : 'var(--mave-v2-text-muted)',
                cursor: 'pointer',
                padding: '4px 6px',
                borderRadius: '4px',
                fontSize: '13px'
              }}
              data-testid="btn-expand-workspace"
            >
              ⤢
            </button>
          )}

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
                padding: '4px 6px',
                borderRadius: '4px',
                fontSize: '13px'
              }}
              data-testid="btn-collapse-presence"
            >
              ↙
            </button>
          )}

          {onClose && (
            <button
              onClick={onClose}
              title="Close Conversation"
              aria-label="Close conversation"
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--mave-v2-text-muted)',
                cursor: 'pointer',
                padding: '4px 6px',
                borderRadius: '4px',
                fontSize: '13px'
              }}
              data-testid="btn-close-conversation"
            >
              ✕
            </button>
          )}
        </div>
      </header>

      {/* 2. Optional Task Shortcuts (Prompt Accelerators, NOT mandatory mode locks) */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          padding: '6px 16px',
          overflowX: 'auto',
          borderBottom: '1px solid rgba(255, 255, 255, 0.04)',
          background: 'rgba(0, 0, 0, 0.12)'
        }}
        data-testid="conversation-shortcuts-bar"
      >
        {shortcuts.map((shortcut) => (
          <button
            key={shortcut}
            onClick={() => {
              setInputText((prev) => (prev ? `${prev} ${shortcut}: ` : `${shortcut}: `));
              onSelectShortcut?.(shortcut);
              inputRef.current?.focus();
            }}
            style={{
              background: 'rgba(255, 255, 255, 0.04)',
              border: '1px solid var(--mave-v2-border-subtle)',
              borderRadius: 'var(--mave-v2-radius-pill)',
              padding: '2px 9px',
              fontSize: '11px',
              color: 'var(--mave-v2-text-secondary)',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              transition: 'all var(--mave-v2-motion-fast)'
            }}
            data-testid={`shortcut-${shortcut.toLowerCase()}`}
          >
            {shortcut}
          </button>
        ))}
      </div>

      {/* 3. Scrollable Timeline (Messages, Structured Answers & Rich Cards) */}
      <div
        ref={timelineRef}
        onScroll={handleScroll}
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '16px',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
          position: 'relative'
        }}
        role="log"
        aria-live="polite"
        data-testid="conversation-timeline"
      >
        {/* Load Earlier Conversation Banner */}
        {state.hasEarlierHistory && (
          <div style={{ textAlign: 'center', margin: '4px 0 8px 0' }}>
            <button
              onClick={onLoadEarlierHistory}
              style={{
                background: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid var(--mave-v2-border-subtle)',
                borderRadius: 'var(--mave-v2-radius-pill)',
                padding: '4px 12px',
                fontSize: '11px',
                color: 'var(--mave-v2-text-secondary)',
                cursor: 'pointer',
                transition: 'all var(--mave-v2-motion-fast)'
              }}
              data-testid="btn-load-earlier-history"
              aria-label="Load earlier conversation"
            >
              ⤊ Load earlier conversation {state.earlierHistoryCount ? `(${state.earlierHistoryCount})` : ''}
            </button>
          </div>
        )}

        {/* Response Groups: Canonical Structured Turn Anatomy */}
        {groups.map((group) => {
          const hasAssistantOutput =
            Boolean(group.answerText) ||
            Boolean(group.streamingText) ||
            Boolean(group.observableProgressText) ||
            (group.sources && group.sources.length > 0) ||
            (group.cards && group.cards.length > 0) ||
            Boolean(group.error);

          return (
            <div
              key={group.id}
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '10px',
                width: '100%'
              }}
              data-testid={`response-group-${group.id}`}
            >
              {/* User Message */}
              {group.userMessage && (
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'flex-end',
                    width: '100%'
                  }}
                  data-testid="message-card-user"
                >
                  <div
                    style={{
                      maxWidth: '85%',
                      background:
                        'linear-gradient(135deg, rgba(2, 132, 199, 0.25) 0%, rgba(56, 189, 248, 0.15) 100%)',
                      border: '1px solid rgba(56, 189, 248, 0.3)',
                      borderRadius: '14px 14px 2px 14px',
                      padding: '10px 14px',
                      color: 'var(--mave-v2-text-primary)',
                      fontSize: '13px',
                      lineHeight: '1.5',
                      boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)'
                    }}
                  >
                    <div style={{ whiteSpace: 'pre-wrap' }}>{group.userMessage.content}</div>
                  </div>
                </div>
              )}

              {/* MAVE Response Group */}
              {hasAssistantOutput && (
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'flex-start',
                    width: '100%',
                    gap: '8px'
                  }}
                  data-testid="message-card-assistant"
                >
                  {/* Subtle MAVE Header per turn */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      fontSize: '11px',
                      fontWeight: 600,
                      color: 'var(--mave-v2-text-dim)',
                      marginLeft: '2px'
                    }}
                    data-testid="response-group-header"
                  >
                    <AdaptivePresenceMark state="thinking" size="status" />
                    <span>MAVE</span>
                  </div>

                  {/* Observable Progress Banner (Truthful first-token states only) */}
                  {group.observableProgressText && (
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        fontSize: '12px',
                        color: 'var(--mave-v2-accent-listening)',
                        padding: '6px 12px',
                        background: 'rgba(56, 189, 248, 0.08)',
                        borderRadius: '6px',
                        width: '100%',
                        boxSizing: 'border-box'
                      }}
                      data-testid="observable-progress-banner"
                    >
                      <AdaptivePresenceMark state="thinking" size="status" />
                      <span>{group.observableProgressText}</span>
                    </div>
                  )}

                  {/* Primary Answer Text (Completed) */}
                  {group.answerText && (
                    <div
                      style={{
                        maxWidth: '92%',
                        background: 'var(--mave-v2-surface-elevated)',
                        border: '1px solid var(--mave-v2-border-subtle)',
                        borderRadius: '14px 14px 14px 2px',
                        padding: '12px 16px',
                        fontSize: '13px',
                        lineHeight: 1.6,
                        color: 'var(--mave-v2-text-primary)',
                        boxShadow: '0 2px 10px rgba(0, 0, 0, 0.2)'
                      }}
                      data-testid="response-answer-text"
                    >
                      <div style={{ whiteSpace: 'pre-wrap' }}>{group.answerText}</div>
                    </div>
                  )}

                  {/* Real-time Streaming Response Text Block */}
                  {group.streamingText && (
                    <div
                      style={{
                        maxWidth: '92%',
                        background: 'var(--mave-v2-surface-elevated)',
                        border: '1px solid var(--mave-v2-border-subtle)',
                        borderRadius: '14px 14px 14px 2px',
                        padding: '12px 16px',
                        fontSize: '13px',
                        lineHeight: 1.6,
                        color: 'var(--mave-v2-text-primary)',
                        boxShadow: '0 2px 10px rgba(0, 0, 0, 0.2)'
                      }}
                      data-testid="streaming-text-block"
                    >
                      <div style={{ whiteSpace: 'pre-wrap' }}>
                        {group.streamingText}
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
                    </div>
                  )}

                  {/* Generation Status Indicators: Stopped / Interrupted */}
                  {group.isCancelled && (
                    <div
                      style={{
                        fontSize: '11px',
                        color: 'var(--mave-v2-text-dim)',
                        fontStyle: 'italic',
                        padding: '2px 6px'
                      }}
                      data-testid="status-cancelled"
                    >
                      [Stopped]
                    </div>
                  )}
                  {group.isInterrupted && (
                    <div
                      style={{
                        fontSize: '11px',
                        color: 'var(--mave-v2-accent-warning)',
                        fontStyle: 'italic',
                        padding: '2px 6px'
                      }}
                      data-testid="status-interrupted"
                    >
                      [Interrupted]
                    </div>
                  )}

                  {/* Local Error Block with Retry */}
                  {group.error && (
                    <div
                      style={{
                        background: 'rgba(239, 68, 68, 0.1)',
                        border: '1px solid rgba(239, 68, 68, 0.3)',
                        borderRadius: '8px',
                        padding: '10px 14px',
                        maxWidth: '92%',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '8px'
                      }}
                      data-testid="local-error-card"
                    >
                      <div style={{ fontSize: '13px', color: '#f87171', fontWeight: 500 }}>
                        {group.error.message}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        {group.error.recoverable !== false && (
                          <button
                            onClick={() => onRetry?.(group.requestId)}
                            style={{
                              background: 'rgba(239, 68, 68, 0.2)',
                              border: '1px solid rgba(239, 68, 68, 0.4)',
                              borderRadius: '4px',
                              padding: '4px 10px',
                              color: '#fca5a5',
                              fontSize: '11px',
                              fontWeight: 600,
                              cursor: 'pointer'
                            }}
                            data-testid="btn-retry-error"
                          >
                            ↻ {group.error.suggestedAction || 'Retry'}
                          </button>
                        )}
                        {group.error.technicalDetails && (
                          <span style={{ fontSize: '10px', color: '#94a3b8' }}>
                            {group.error.technicalDetails}
                          </span>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Grouped Sources (Legitimate Content Provenance) */}
                  {group.sources && group.sources.length > 0 && (
                    <div
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '6px',
                        width: '100%',
                        maxWidth: '92%',
                        marginTop: '4px'
                      }}
                      data-testid="grouped-sources-section"
                    >
                      <div
                        style={{
                          fontSize: '11px',
                          fontWeight: 600,
                          color: 'var(--mave-v2-text-dim)',
                          textTransform: 'uppercase',
                          letterSpacing: '0.5px'
                        }}
                      >
                        Sources ({group.sources.length})
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        {group.sources.map((src) => (
                          <SourceCard key={src.id} data={src} />
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Rich Content Cards (Translations, Code, Video, Approvals) */}
                  {group.cards && group.cards.length > 0 && (
                    <div
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '8px',
                        width: '100%',
                        maxWidth: '92%',
                        marginTop: '4px'
                      }}
                      data-testid="rich-cards-section"
                    >
                      {group.cards.map((card) => (
                        <CardRenderer
                          key={card.id}
                          card={card}
                          onAllow={onAllowAction}
                          onDeny={onDenyAction}
                          onListen={onListen}
                        />
                      ))}
                    </div>
                  )}

                  {/* Contextual Follow-up Suggestions */}
                  {group.followUpSuggestions && group.followUpSuggestions.length > 0 && (
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        flexWrap: 'wrap',
                        gap: '6px',
                        marginTop: '6px'
                      }}
                      data-testid="followup-suggestions"
                    >
                      {group.followUpSuggestions.map((sug) => (
                        <button
                          key={sug}
                          onClick={() => {
                            onSelectFollowUp?.(sug);
                            onSendMessage?.(sug);
                          }}
                          style={{
                            background: 'rgba(56, 189, 248, 0.08)',
                            border: '1px solid rgba(56, 189, 248, 0.25)',
                            borderRadius: 'var(--mave-v2-radius-pill)',
                            padding: '3px 10px',
                            fontSize: '11px',
                            color: 'var(--mave-v2-accent-listening)',
                            cursor: 'pointer',
                            transition: 'all var(--mave-v2-motion-fast)'
                          }}
                          data-testid={`followup-${sug.replace(/\s+/g, '-').toLowerCase()}`}
                        >
                          {sug}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* 4. Non-intrusive Floating "New response ↓" Pill */}
      {isScrolledUp && (
        <div
          style={{
            position: 'absolute',
            bottom: '76px',
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 10
          }}
        >
          <button
            onClick={scrollToBottom}
            style={{
              background: 'var(--mave-v2-surface-elevated)',
              border: '1px solid var(--mave-v2-accent-listening)',
              borderRadius: 'var(--mave-v2-radius-pill)',
              padding: '6px 14px',
              fontSize: '12px',
              fontWeight: 600,
              color: 'var(--mave-v2-accent-listening)',
              boxShadow: '0 4px 16px rgba(0, 0, 0, 0.5)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              transition: 'all var(--mave-v2-motion-fast)'
            }}
            data-testid="scroll-to-bottom-pill"
          >
            <span>New response</span>
            <span>↓</span>
          </button>
        </div>
      )}

      {/* 5. Workspace Escalation Banner */}
      {state.workspaceEligible && (
        <div
          style={{
            padding: '6px 16px',
            background: 'rgba(56, 189, 248, 0.1)',
            borderTop: '1px solid rgba(56, 189, 248, 0.25)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: '11px',
            color: 'var(--mave-v2-text-secondary)'
          }}
          data-testid="workspace-escalation-banner"
        >
          <span>
            💡 {state.workspaceReason || 'This sustained workflow is eligible for Workspace escalation.'}
          </span>
          {onExpandToWorkspace && (
            <button
              onClick={onExpandToWorkspace}
              style={{
                background: 'var(--mave-v2-accent-listening)',
                border: 'none',
                borderRadius: '4px',
                color: '#0f172a',
                padding: '2px 8px',
                fontWeight: 600,
                fontSize: '10px',
                cursor: 'pointer'
              }}
            >
              Open Workspace ⤢
            </button>
          )}
        </div>
      )}

      {/* 6. Message Composer */}
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
          {/* Voice Activation Button */}
          {onVoiceActivate && (
            <button
              onClick={onVoiceActivate}
              title="Voice input"
              aria-label="Voice activation"
              style={{
                background: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid var(--mave-v2-border-subtle)',
                borderRadius: '8px',
                padding: '8px 10px',
                color: 'var(--mave-v2-text-muted)',
                fontSize: '14px',
                cursor: 'pointer'
              }}
              data-testid="conversation-voice-button"
            >
              🎙
            </button>
          )}

          <textarea
            ref={inputRef}
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

          {/* Dynamic Action: Stop Generation vs Send */}
          {isStreaming ? (
            <button
              onClick={onCancelGeneration}
              title="Stop generating"
              aria-label="Stop generating"
              style={{
                background: 'rgba(239, 68, 68, 0.2)',
                border: '1px solid rgba(239, 68, 68, 0.4)',
                borderRadius: '8px',
                color: '#f87171',
                padding: '10px 14px',
                fontWeight: 600,
                fontSize: '13px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '4px'
              }}
              data-testid="conversation-stop-button"
            >
              <span>⏹</span>
              <span>Stop</span>
            </button>
          ) : (
            <button
              onClick={handleSend}
              disabled={!inputText.trim()}
              title="Send message"
              aria-label="Send message"
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
          )}
        </div>
      </footer>
    </div>
  );
};
