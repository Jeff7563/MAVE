import React, { useState, useRef, useEffect } from 'react';
import type {
  ConversationState,
  PresenceState,
  ResponseGroup,
  PresentationMode,
  SidecarPlacement
} from '../types';
import { AdaptivePresenceMark } from '../primitives/AdaptivePresenceMark';
import {
  PinIcon,
  ExpandIcon,
  MinimizeIcon,
  CloseIcon,
  MicIcon,
  PauseIcon
} from '../primitives/Icons';
import { CardRenderer } from '../cards';
import { SourceCard } from '../cards/MediaCards';
import { groupConversationTimeline } from './conversation-rules';
import '../tokens.css';


export interface ConversationShellProps {
  state: ConversationState;
  presenceState?: PresenceState;
  audioLevel?: number;
  presentationMode?: PresentationMode;
  sidecarPlacement?: SidecarPlacement;
  isPinned?: boolean;
  onTogglePin?: () => void;
  onExpandToFloating?: () => void;
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
  initialInputText?: string;
  className?: string;
  width?: string | number;
  height?: string | number;
  officeMode?: boolean;
}

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
  presentationMode,
  sidecarPlacement,
  isPinned = false,
  onTogglePin,
  onExpandToFloating,
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
  initialInputText,
  className = '',
  width = '100%',
  height = '100%',
  officeMode = false
}) => {
  const [inputText, setInputText] = useState(initialInputText ?? '');
  const [isScrolledUp, setIsScrolledUp] = useState(state.isScrolledUp ?? false);
  const [activeFollowUpsDismissed, setActiveFollowUpsDismissed] = useState<boolean>(false);
  const [liveAnnouncement, setLiveAnnouncement] = useState<string>('');
  const timelineRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const effectiveMode: PresentationMode =
    presentationMode || state.presentationMode || 'floating';
  const effectivePlacement: SidecarPlacement =
    sidecarPlacement || state.sidecarPlacement || 'right';
  const isSidecar = effectiveMode === 'sidecar';

  // Screen-reader live region updates (Announces coherent milestones, never token-by-token noise)
  useEffect(() => {
    if (state.streamingStatus === 'streaming' || state.status === 'streaming') {
      if (state.observableProgressText) {
        setLiveAnnouncement(state.observableProgressText);
      } else {
        setLiveAnnouncement('MAVE is generating a response…');
      }
    } else if (state.streamingStatus === 'completed' || state.status === 'result' || state.status === 'richResult') {
      setLiveAnnouncement('Response completed.');
      setActiveFollowUpsDismissed(false); // Follow-up suggestions appear upon response completion
    } else if (state.streamingStatus === 'cancelled') {
      setLiveAnnouncement('Response stopped.');
    } else if (state.status === 'error' || state.streamingStatus === 'failed') {
      setLiveAnnouncement('Request encountered an error.');
    }
  }, [state.status, state.streamingStatus, state.observableProgressText]);

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
    setActiveFollowUpsDismissed(true); // User begins next turn -> dismiss prior suggestions
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

  const shortcuts = state.suggestedShortcuts ?? [];
  const groups: ResponseGroup[] = groupConversationTimeline(state);

  return (
    <div
      className={`mave-v2-conversation-shell ${isSidecar ? 'mave-v2-conversation-sidecar' : ''} ${className}`.trim()}
      style={{
        width,
        height,
        background: isSidecar ? 'transparent' : 'var(--mave-glass-gradient)',
        backdropFilter: isSidecar ? undefined : 'var(--mave-backdrop-glass)',
        WebkitBackdropFilter: isSidecar ? undefined : 'var(--mave-backdrop-glass)',
        border: isSidecar ? 'none' : '1px solid var(--mave-edge)',
        borderRadius: isSidecar ? undefined : 'var(--mave-radius-card)',
        boxShadow: isSidecar
          ? undefined
          : 'var(--mave-shadow-glass)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        overflowX: 'hidden',
        boxSizing: 'border-box',
        color: 'var(--mave-ink)',
        fontFamily: "var(--mave-font-sans, system-ui, sans-serif)",
        position: 'relative'
      }}
      data-testid="conversation-shell"
      data-presentation-mode={effectiveMode}
      data-placement={isSidecar ? effectivePlacement : undefined}
    >
      {/* 1. Header with MAVE Identity, Context Label & Navigation Controls */}
      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '12px 16px',
          borderBottom: '1px solid var(--mave-line)',
          background: 'rgba(255, 255, 255, 0.015)',
          userSelect: 'none',
          boxSizing: 'border-box',
          overflowX: 'hidden'
        }}
        data-testid="conversation-header"
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
                  fontFamily: "var(--mave-font-wordmark, 'Jost', sans-serif)",
                  fontWeight: 300,
                  fontSize: '14px',
                  letterSpacing: '0.36em',
                  color: 'var(--mave-ink)'
                }}
              >
                MAVE
              </span>
              {state.contextLabel && (
                <span
                  style={{
                    fontSize: '10px',
                    fontWeight: 600,
                    color: 'var(--mave-cyan)',
                    background: 'rgba(95, 210, 255, 0.1)',
                    border: '1px solid rgba(95, 210, 255, 0.25)',
                    padding: '1px 6px',
                    borderRadius: '4px'
                  }}
                  data-testid="conversation-context-label"
                >
                  {state.contextLabel}
                </span>
              )}
            </div>
            {state.semanticRuntimeLabel && state.semanticRuntimeLabel !== 'Desktop Companion' && (
              <div
                style={{ fontSize: '11px', color: 'var(--mave-faint)', marginTop: '1px' }}
                data-testid="conversation-subtitle"
              >
                {state.semanticRuntimeLabel}
              </div>
            )}
          </div>
        </div>

        {/* Level & Presentation Mode Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          {isSidecar && onTogglePin && (
            <button
              onClick={onTogglePin}
              title={isPinned ? 'Unpin Sidecar' : 'Pin Sidecar on Top'}
              aria-label={isPinned ? 'Unpin Sidecar' : 'Pin Sidecar on Top'}
              style={{
                background: isPinned ? 'rgba(95, 210, 255, 0.15)' : 'transparent',
                border: isPinned ? '1px solid var(--mave-cyan)' : 'none',
                color: isPinned ? 'var(--mave-cyan)' : 'var(--mave-faint)',
                cursor: 'pointer',
                padding: '4px 6px',
                borderRadius: '4px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '12px'
              }}
              data-testid="btn-pin-sidecar"
              aria-pressed={isPinned}
            >
              <PinIcon size={13} color={isPinned ? 'var(--mave-cyan)' : 'var(--mave-faint)'} />
            </button>
          )}

          {isSidecar && (onExpandToFloating || onExpandToWorkspace) && (
            <button
              onClick={onExpandToFloating || onExpandToWorkspace}
              title="Expand to Floating Conversation"
              aria-label="Expand to Floating Conversation"
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--mave-faint)',
                cursor: 'pointer',
                padding: '4px 6px',
                borderRadius: '4px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '13px'
              }}
              data-testid="btn-expand-conversation"
            >
              <ExpandIcon size={13} color="var(--mave-faint)" />
            </button>
          )}

          {!isSidecar && (state.workspaceEligible || onExpandToWorkspace) && (
            <button
              onClick={onExpandToWorkspace}
              title="Expand to Workspace"
              aria-label="Expand to Workspace"
              style={{
                background: state.workspaceEligible ? 'rgba(95, 210, 255, 0.15)' : 'transparent',
                border: state.workspaceEligible ? '1px solid var(--mave-cyan)' : 'none',
                color: state.workspaceEligible ? 'var(--mave-cyan)' : 'var(--mave-faint)',
                cursor: 'pointer',
                padding: '4px 6px',
                borderRadius: '4px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '13px'
              }}
              data-testid="btn-expand-workspace"
            >
              <ExpandIcon size={13} color={state.workspaceEligible ? 'var(--mave-cyan)' : 'var(--mave-faint)'} />
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
                color: 'var(--mave-faint)',
                cursor: 'pointer',
                padding: '4px 6px',
                borderRadius: '4px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '13px'
              }}
              data-testid="btn-collapse-presence"
            >
              <MinimizeIcon size={13} color="var(--mave-faint)" />
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
                color: 'var(--mave-faint)',
                cursor: 'pointer',
                padding: '4px 6px',
                borderRadius: '4px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '13px'
              }}
              data-testid="btn-close-conversation"
            >
              <CloseIcon size={13} color="var(--mave-faint)" />
            </button>
          )}
        </div>
      </header>

      {/* 2. Optional Task Shortcuts (Prompt Accelerators, NOT mandatory mode locks) */}
      {shortcuts.length > 0 && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '7px 16px',
            overflowX: 'auto',
            scrollbarWidth: 'none',
            msOverflowStyle: 'none',
            borderBottom: '1px solid var(--mave-line)',
            background: 'rgba(0, 0, 0, 0.2)'
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
                background: 'var(--mave-raised)',
                border: '1px solid var(--mave-line)',
                borderRadius: 'var(--mave-radius-chip)',
                padding: '3px 11px',
                fontSize: '11px',
                fontWeight: 500,
                color: 'var(--mave-dim)',
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
      )}

      {/* Screen Reader Live Region: Announces coherent milestones, never token-by-token noise */}
      <div
        className="mave-v2-sr-live"
        aria-live="polite"
        role="status"
        style={{
          position: 'absolute',
          width: '1px',
          height: '1px',
          padding: 0,
          margin: '-1px',
          overflow: 'hidden',
          clip: 'rect(0, 0, 0, 0)',
          whiteSpace: 'nowrap',
          border: 0
        }}
        data-testid="streaming-live-region"
      >
        {liveAnnouncement}
      </div>

      {/* 3. Scrollable Timeline (Messages, Structured Answers & Rich Cards) */}
      <div
        ref={timelineRef}
        onScroll={handleScroll}
        style={{
          flex: 1,
          overflowY: 'auto',
          overflowX: 'hidden',
          scrollbarWidth: 'none',
          msOverflowStyle: 'none',
          padding: '16px 20px',
          display: 'flex',
          flexDirection: 'column',
          gap: '20px',
          position: 'relative',
          WebkitMaskImage: 'linear-gradient(180deg, transparent 0, #000 20px)',
          maskImage: 'linear-gradient(180deg, transparent 0, #000 20px)'
        }}
        role="log"
        data-testid="conversation-timeline"
      >
        {/* Load Earlier Conversation Banner */}
        {state.hasEarlierHistory && (
          <div style={{ textAlign: 'center', margin: '4px 0 8px 0' }}>
            <button
              onClick={onLoadEarlierHistory}
              style={{
                background: 'var(--mave-raised)',
                border: '1px solid var(--mave-line)',
                borderRadius: 'var(--mave-radius-chip)',
                padding: '4px 12px',
                fontSize: '11px',
                color: 'var(--mave-dim)',
                cursor: 'pointer',
                fontFamily: 'var(--mave-font-sans)',
                transition: 'all var(--mave-v2-motion-fast)'
              }}
              data-testid="btn-load-earlier-history"
              aria-label="Load earlier conversation"
            >
              ⤊ Load earlier conversation {state.earlierHistoryCount ? `(${state.earlierHistoryCount})` : ''}
            </button>
          </div>
        )}

        {/* Minimal Empty State (Section 34) */}
        {groups.length === 0 && (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              flex: 1,
              gap: '12px',
              textAlign: 'center',
              padding: '32px 16px',
              color: 'var(--mave-dim)',
              minHeight: '220px'
            }}
            data-testid="sidecar-empty-state"
          >
            <AdaptivePresenceMark size="medium" state={presenceState} />
            <div>
              <div
                style={{
                  fontFamily: "var(--mave-font-wordmark, 'Jost', sans-serif)",
                  fontWeight: 300,
                  fontSize: '18px',
                  letterSpacing: '0.42em',
                  color: 'var(--mave-ink)'
                }}
              >
                MAVE
              </div>
              <div
                style={{
                  fontSize: '13px',
                  color: 'var(--mave-faint)',
                  marginTop: '4px',
                  fontFamily: 'var(--mave-font-sans)'
                }}
              >
                What can I help with?
              </div>
            </div>
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
                width: '100%',
                maxWidth: '260px',
                marginTop: '10px'
              }}
            >
              {['Find tutorial video', 'Translate phrase', 'Explain code'].map((sug) => (
                <button
                  key={sug}
                  onClick={() => {
                    setInputText(sug);
                    onSendMessage?.(sug);
                  }}
                  style={{
                    background: 'var(--mave-raised)',
                    border: '1px solid var(--mave-line)',
                    borderRadius: 'var(--mave-radius-chip)',
                    padding: '8px 14px',
                    fontSize: '12px',
                    color: 'var(--mave-dim)',
                    cursor: 'pointer',
                    textAlign: 'left',
                    fontFamily: 'var(--mave-font-sans)',
                    transition: 'all var(--mave-v2-motion-fast)'
                  }}
                  data-testid="sidecar-empty-suggestion"
                >
                  ✦ {sug}
                </button>
              ))}
            </div>
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
                width: '100%',
                minWidth: 0
              }}
              data-testid={`response-group-${group.id}`}
            >
              {/* User Message — Open Spatial Typography (Aligned Right) */}
              {group.userMessage && (
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'flex-end',
                    width: '100%',
                    gap: '4px',
                    minWidth: 0
                  }}
                  data-testid="message-card-user"
                >
                  <div
                    className="mave-label"
                    style={{
                      fontSize: '11px',
                      letterSpacing: '0.18em',
                      color: 'var(--mave-faint)',
                      textTransform: 'uppercase',
                      paddingRight: '2px',
                      fontFamily: 'var(--mave-font-mono)',
                      textAlign: 'right'
                    }}
                  >
                    YOU
                  </div>
                  <div
                    style={{
                      maxWidth: '85%',
                      boxSizing: 'border-box',
                      padding: '2px 2px 6px 2px',
                      color: 'var(--mave-dim)',
                      fontFamily: 'var(--mave-font-sans)',
                      fontSize: '14.5px',
                      lineHeight: '1.55',
                      letterSpacing: '-0.005em',
                      wordBreak: 'break-word',
                      overflowWrap: 'anywhere',
                      textAlign: 'right'
                    }}
                  >
                    <div style={{ whiteSpace: 'pre-wrap', textAlign: 'right' }}>{group.userMessage.content}</div>
                  </div>
                </div>
              )}

              {/* MAVE Response Group — Open Spatial Typography */}
              {hasAssistantOutput && (
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'flex-start',
                    width: '100%',
                    gap: '6px',
                    minWidth: 0
                  }}
                  data-testid="message-card-assistant"
                >
                  {/* Subtle MAVE Header per turn */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      fontSize: '11px',
                      fontWeight: 600,
                      color: 'var(--mave-cyan)',
                      letterSpacing: '0.24em',
                      marginLeft: '2px',
                      textTransform: 'uppercase'
                    }}
                    data-testid="response-group-header"
                  >
                    <div
                      style={{
                        width: '6px',
                        height: '6px',
                        borderRadius: '50%',
                        background: 'var(--mave-cyan)',
                        boxShadow: '0 0 8px var(--mave-cyan)',
                        flex: 'none'
                      }}
                    />
                    <span
                      style={{
                        fontFamily: "var(--mave-font-wordmark, 'Jost', sans-serif)",
                        fontWeight: 300,
                        letterSpacing: '0.36em',
                        color: 'var(--mave-faint)'
                      }}
                    >
                      MAVE
                    </span>
                  </div>

                  {/* Observable Progress Banner (Truthful first-token states only) */}
                  {group.observableProgressText && (
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        fontSize: '12px',
                        color: 'var(--mave-cyan)',
                        padding: '6px 12px',
                        background: 'rgba(95, 210, 255, 0.08)',
                        border: '1px solid rgba(95, 210, 255, 0.2)',
                        borderRadius: 'var(--mave-radius-sm)',
                        width: '100%',
                        boxSizing: 'border-box'
                      }}
                      data-testid="observable-progress-banner"
                    >
                      <AdaptivePresenceMark state="thinking" size="status" />
                      <span>{group.observableProgressText}</span>
                    </div>
                  )}

                  {/* Primary Answer Text (Completed) — Open Spatial Typography */}
                  {group.answerText && (
                    <div
                      style={{
                        maxWidth: '100%',
                        width: '100%',
                        boxSizing: 'border-box',
                        padding: '2px 2px 6px 2px',
                        fontSize: '14.5px',
                        lineHeight: '1.6',
                        letterSpacing: '-0.005em',
                        color: 'var(--mave-ink)',
                        fontFamily: 'var(--mave-font-sans)',
                        wordBreak: 'break-word',
                        overflowWrap: 'anywhere'
                      }}
                      data-testid="response-answer-text"
                    >
                      <div style={{ whiteSpace: 'pre-wrap' }}>{group.answerText}</div>
                    </div>
                  )}

                  {/* Real-time Streaming Response Text Block */}
                  {group.streamingText && (
                    <div
                      aria-hidden="true"
                      style={{
                        maxWidth: '100%',
                        width: '100%',
                        boxSizing: 'border-box',
                        padding: '2px 2px 6px 2px',
                        fontSize: '14.5px',
                        lineHeight: '1.6',
                        letterSpacing: '-0.005em',
                        color: 'var(--mave-ink)',
                        fontFamily: 'var(--mave-font-sans)',
                        wordBreak: 'break-word',
                        overflowWrap: 'anywhere'
                      }}
                      data-testid="streaming-text-block"
                    >
                      <div style={{ whiteSpace: 'pre-wrap' }}>
                        {group.streamingText}
                        <span
                          style={{
                            display: 'inline-block',
                            width: '4px',
                            height: '14px',
                            background: '#38bdf8',
                            marginLeft: '4px',
                            verticalAlign: 'middle',
                            borderRadius: '1px',
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
                        maxWidth: isSidecar ? '100%' : 'min(680px, 100%)',
                        minWidth: 0,
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
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', width: '100%', minWidth: 0 }}>
                        {group.sources.map((src) => (
                          <div key={src.id} style={{ width: '100%', minWidth: 0 }}>
                            <SourceCard data={isSidecar && !src.density ? { ...src, density: 'compact' } : src} />
                          </div>
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
                        maxWidth: isSidecar ? '100%' : 'min(680px, 100%)',
                        minWidth: 0,
                        marginTop: '4px'
                      }}
                      data-testid="rich-cards-section"
                    >
                      {group.cards.map((card) => (
                        <div key={card.id} style={{ width: '100%', minWidth: 0 }}>
                          <CardRenderer
                            card={isSidecar && !card.density ? { ...card, density: 'compact' } : card}
                            onAllow={onAllowAction}
                            onDeny={onDenyAction}
                            onListen={onListen}
                            onOpenWorkspace={onExpandToWorkspace}
                          />
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Contextual Follow-up Suggestions (Retained until user begins next turn, selects, or dismisses) */}
                  {!activeFollowUpsDismissed && group.followUpSuggestions && group.followUpSuggestions.length > 0 && (
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
                            setActiveFollowUpsDismissed(true);
                          }}
                          style={{
                            background: 'rgba(91, 132, 255, 0.1)',
                            border: '1px solid var(--mave-edge)',
                            borderRadius: 'var(--mave-radius-chip)',
                            padding: '4px 12px',
                            fontSize: '12px',
                            fontFamily: 'var(--mave-font-sans)',
                            color: 'var(--mave-ink)',
                            cursor: 'pointer',
                            transition: 'all var(--mave-v2-motion-fast)'
                          }}
                          data-testid={`followup-${sug.replace(/\s+/g, '-').toLowerCase()}`}
                        >
                          ✦ {sug}
                        </button>
                      ))}
                      <button
                        onClick={() => setActiveFollowUpsDismissed(true)}
                        title="Dismiss suggestions"
                        aria-label="Dismiss suggestions"
                        style={{
                          background: 'transparent',
                          border: 'none',
                          color: 'var(--mave-faint)',
                          fontSize: '11px',
                          cursor: 'pointer',
                          padding: '2px 4px',
                          borderRadius: '4px'
                        }}
                        data-testid="btn-dismiss-followups"
                      >
                        ✕
                      </button>
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
              background: 'var(--mave-glass-gradient)',
              backdropFilter: 'var(--mave-backdrop-glass)',
              WebkitBackdropFilter: 'var(--mave-backdrop-glass)',
              border: '1px solid var(--mave-cyan)',
              borderRadius: 'var(--mave-radius-chip)',
              padding: '6px 14px',
              fontSize: '12px',
              fontWeight: 600,
              color: 'var(--mave-cyan)',
              boxShadow: 'var(--mave-shadow-glass)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontFamily: 'var(--mave-font-sans)',
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
            padding: '8px 16px',
            background: 'rgba(95, 210, 255, 0.08)',
            borderTop: '1px solid rgba(95, 210, 255, 0.2)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: '12px',
            fontFamily: 'var(--mave-font-sans)',
            color: 'var(--mave-dim)'
          }}
          data-testid="workspace-escalation-banner"
        >
          <span>
            💡 {state.workspaceReason || 'This task works better in Workspace.'}
          </span>
          {onExpandToWorkspace && (
            <button
              onClick={onExpandToWorkspace}
              style={{
                background: 'var(--mave-cyan)',
                border: 'none',
                borderRadius: 'var(--mave-radius-chip)',
                color: '#05060d',
                padding: '4px 10px',
                fontWeight: 600,
                fontSize: '11px',
                cursor: 'pointer',
                fontFamily: 'var(--mave-font-sans)'
              }}
            >
              Open Workspace ⤢
            </button>
          )}
        </div>
      )}

      {/* 6. Message Composer — Compact and Premium */}
      <footer
        style={{
          padding: '12px 14px',
          borderTop: '1px solid var(--mave-line)',
          background: 'linear-gradient(180deg, rgba(255, 255, 255, 0.04), rgba(255, 255, 255, 0.01)), rgba(8, 10, 20, 0.75)',
          backdropFilter: 'var(--mave-backdrop-glass)',
          WebkitBackdropFilter: 'var(--mave-backdrop-glass)',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
          boxSizing: 'border-box',
          overflowX: 'hidden'
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            background: 'var(--mave-raised)',
            border: '1px solid var(--mave-line)',
            borderRadius: '20px',
            padding: '4px 6px 4px 14px',
            boxSizing: 'border-box'
          }}
        >
          <textarea
            ref={inputRef}
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask MAVE anything… · ถาม MAVE ได้"
            rows={1}
            style={{
              flex: 1,
              background: 'transparent',
              border: 'none',
              padding: '7px 0',
              color: 'var(--mave-ink)',
              fontSize: '13.5px',
              lineHeight: '1.4',
              resize: 'none',
              outline: 'none',
              fontFamily: 'var(--mave-font-sans)',
              scrollbarWidth: 'none',
              msOverflowStyle: 'none'
            }}
            data-testid="conversation-composer-input"
          />

          {/* Voice Activation Button */}
          {onVoiceActivate && (
            <button
              onClick={onVoiceActivate}
              title="Voice input"
              aria-label="Voice activation"
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '50%',
                background: 'rgba(255, 255, 255, 0.04)',
                border: '1px solid var(--mave-line)',
                color: 'var(--mave-faint)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '13px',
                cursor: 'pointer',
                flex: 'none',
                transition: 'all var(--mave-v2-motion-fast)'
              }}
              data-testid="conversation-voice-button"
            >
              <MicIcon size={14} color="var(--mave-faint)" />
            </button>
          )}

          {/* Dynamic Action: Stop Generation vs Send */}
          {isStreaming ? (
            <button
              onClick={onCancelGeneration}
              title="Stop generating"
              aria-label="Stop generating"
              style={{
                height: '32px',
                padding: '0 12px',
                borderRadius: '16px',
                background: 'rgba(255, 122, 133, 0.15)',
                border: '1px solid rgba(255, 122, 133, 0.3)',
                color: 'var(--mave-err)',
                fontWeight: 600,
                fontSize: '12px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                flex: 'none'
              }}
              data-testid="conversation-stop-button"
            >
              <PauseIcon size={11} color="var(--mave-err)" />
              <span>Stop</span>
            </button>
          ) : (
            <button
              onClick={handleSend}
              disabled={!inputText.trim()}
              title="Send message"
              aria-label="Send message"
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '50%',
                background: inputText.trim()
                  ? 'var(--mave-blue)'
                  : 'rgba(255, 255, 255, 0.05)',
                border: 'none',
                color: inputText.trim() ? '#ffffff' : 'var(--mave-faint)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '13px',
                fontWeight: 600,
                cursor: inputText.trim() ? 'pointer' : 'default',
                flex: 'none',
                transition: 'all var(--mave-v2-motion-fast)'
              }}
              data-testid="conversation-send-button"
            >
              ↑
            </button>
          )}
        </div>
      </footer>
    </div>
  );
};
