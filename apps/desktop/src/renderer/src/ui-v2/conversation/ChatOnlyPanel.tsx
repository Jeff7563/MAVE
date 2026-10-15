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
  let borderRadius = '18px';
  let border = '1px solid rgba(255, 255, 255, 0.08)';

  if (placement === 'right') {
    borderRadius = '18px 0 0 18px';
    border = '1px solid rgba(255, 255, 255, 0.08)';
  } else if (placement === 'left') {
    borderRadius = '0 18px 18px 0';
    border = '1px solid rgba(255, 255, 255, 0.08)';
  } else if (placement === 'floating') {
    borderRadius = '18px';
    border = '1px solid rgba(255, 255, 255, 0.08)';
  }

  const boxShadow = internalPinned
    ? '0 16px 40px rgba(0, 0, 0, 0.6), 0 0 20px -3px rgba(56, 189, 248, 0.25)'
    : '0 16px 40px rgba(0, 0, 0, 0.55), 0 0 1px rgba(255, 255, 255, 0.12) inset';

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
        background: 'rgba(12, 16, 28, 0.88)',
        backdropFilter: 'blur(28px)',
        WebkitBackdropFilter: 'blur(28px)',
        boxShadow,
        overflow: 'hidden',
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
