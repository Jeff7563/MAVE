import React from 'react';
import type { ConversationState, PresenceState } from '../types';
import { ConversationShell } from './ConversationShell';

export interface ChatOnlyPanelProps {
  state: ConversationState;
  presenceState?: PresenceState;
  audioLevel?: number;
  onSendMessage?: (text: string) => void;
  onCollapse?: () => void;
  onExpand?: () => void;
  className?: string;
}

/**
 * ChatOnlyPanel
 *
 * Specialized narrow right-docked or floating chat surface.
 * Optimized for multi-tasking: allows the user to remain focused on another desktop app
 * while MAVE provides compact answers, video previews, source citations, and translation cards.
 */
export const ChatOnlyPanel: React.FC<ChatOnlyPanelProps> = ({
  state,
  presenceState,
  audioLevel,
  onSendMessage,
  onCollapse,
  onExpand,
  className = ''
}) => {
  return (
    <div
      className={`mave-v2-chat-only-panel ${className}`.trim()}
      style={{
        width: '380px',
        maxWidth: '100%',
        height: '620px',
        maxHeight: '90vh',
        boxSizing: 'border-box',
        display: 'flex'
      }}
      data-testid="chat-only-panel"
    >
      <ConversationShell
        state={state}
        presenceState={presenceState}
        audioLevel={audioLevel}
        onSendMessage={onSendMessage}
        onCollapseToPresence={onCollapse}
        onExpandToWorkspace={onExpand}
        width="100%"
        height="100%"
      />
    </div>
  );
};

