import React, { useState } from 'react';
import type {
  ConversationState,
  PresenceState,
  SidecarPlacement
} from '../types';
import { ConversationShell } from './ConversationShell';
import '../tokens.css';

export interface ChatOnlyPanelProps {
  state: ConversationState;
  presenceState?: PresenceState;
  audioLevel?: number;
  placement?: SidecarPlacement;
  isPinned?: boolean;
  onTogglePin?: () => void;
  onSendMessage?: (text: string) => void;
  onCollapseToPresence?: () => void;
  onCollapse?: () => void; // Backwards compatible alias for onCollapseToPresence
  onExpandToConversation?: () => void;
  onExpand?: () => void; // Backwards compatible alias for onExpandToConversation
  onClose?: () => void;
  onCancelGeneration?: () => void;
  onRetry?: (requestId?: string) => void;
  onAllowAction?: (id: string) => void;
  onDenyAction?: (id: string) => void;
  onListen?: (text: string) => void;
  className?: string;
  width?: string | number;
  height?: string | number;
  officeMode?: boolean;
}

/**
 * ChatOnlyPanel
 *
 * Dedicated narrow sidecar surface for MAVE's multitasking companion experience.
 *
 * Primary Architectural Invariants:
 * 1. Presentation Mode ('sidecar') != Surface Level ('conversation')
 *    - Chat-only is a compact physical presentation mode of the SAME Conversation surface level.
 *    - Reuses the identical session, request ID, accumulated stream, timeline groups, cards, and composer.
 * 2. Visual Dismiss != Cancel Request
 *    - Closing the sidecar hides the visual panel; it does NOT destroy session context or cancel background tasks.
 * 3. Coexistence Without Application Takeover
 *    - Designed to live beside VS Code, Browser, Word, Photoshop, or IDEs as a lightweight companion.
 */
export const ChatOnlyPanel: React.FC<ChatOnlyPanelProps> = ({
  state,
  presenceState = 'idle',
  audioLevel = 0,
  placement = 'right',
  isPinned = false,
  onTogglePin,
  onSendMessage,
  onCollapseToPresence,
  onCollapse,
  onExpandToConversation,
  onExpand,
  onClose,
  onCancelGeneration,
  onRetry,
  onAllowAction,
  onDenyAction,
  onListen,
  className = '',
  width = '380px',
  height = '100%',
  officeMode = false
}) => {
  const [internalPinned, setInternalPinned] = useState<boolean>(isPinned);

  const handleTogglePin = () => {
    setInternalPinned(!internalPinned);
    onTogglePin?.();
  };

  const handleCollapse = onCollapseToPresence || onCollapse;
  const handleExpand = onExpandToConversation || onExpand;

  // Placement-specific sidecar borders and radii
  let borderRadius = '24px 0 0 24px';
  let border = '1px solid var(--mave-edge)';

  if (placement === 'right') {
    borderRadius = '24px 0 0 24px';
    border = '1px solid var(--mave-edge)';
  } else if (placement === 'left') {
    borderRadius = '0 24px 24px 0';
    border = '1px solid var(--mave-edge)';
  } else if (placement === 'floating') {
    borderRadius = '24px';
    border = '1px solid var(--mave-edge)';
  }

  const boxShadow = internalPinned
    ? 'var(--mave-shadow-glass), 0 0 24px -2px rgba(95, 210, 255, 0.35)'
    : 'var(--mave-shadow-glass)';

  return (
    <div
      className={`mave-v2-chat-only-panel mave-v2-sidecar-${placement} ${className}`.trim()}
      style={{
        width,
        height,
        maxWidth: '100%',
        boxSizing: 'border-box',
        display: 'flex',
        flexDirection: 'column',
        borderRadius,
        border,
        background: 'var(--mave-glass-gradient)',
        backdropFilter: 'var(--mave-backdrop-glass)',
        WebkitBackdropFilter: 'var(--mave-backdrop-glass)',
        boxShadow,
        overflow: 'hidden',
        overflowX: 'hidden',
        position: 'relative'
      }}
      data-testid="chat-only-panel"
      data-placement={placement}
      data-pinned={internalPinned ? 'true' : 'false'}
    >
      <ConversationShell
        state={{
          ...state,
          presentationMode: 'sidecar',
          sidecarPlacement: placement,
          isPinned: internalPinned
        }}
        presenceState={presenceState}
        audioLevel={audioLevel}
        presentationMode="sidecar"
        sidecarPlacement={placement}
        isPinned={internalPinned}
        onTogglePin={handleTogglePin}
        onSendMessage={onSendMessage}
        onCollapseToPresence={handleCollapse}
        onExpandToFloating={handleExpand}
        onClose={onClose}
        onCancelGeneration={onCancelGeneration}
        onRetry={onRetry}
        onAllowAction={onAllowAction}
        onDenyAction={onDenyAction}
        onListen={onListen}
        officeMode={officeMode}
        width="100%"
        height="100%"
      />
    </div>
  );
};
