import React from 'react';
import type { WorkspaceState } from '../types';
import { AdaptivePresenceMark } from '../primitives/AdaptivePresenceMark';
import { AgentWorkspaceView } from './AgentWorkspaceView';
import { LanguageWorkspaceView } from './LanguageWorkspaceView';
import '../tokens.css';

export interface WorkspaceShellProps {
  state: WorkspaceState;
  onMinimizeToConversation?: () => void;
  onCollapseToPresence?: () => void;
  onAllowApproval?: (id: string) => void;
  onDenyApproval?: (id: string) => void;
  className?: string;
}

/**
 * WorkspaceShell
 *
 * Level 3 Workspace Surface.
 * Reserved for substantial tasks (Agent Workflow, Language Practice, Research, Project Work).
 * Composable regions:
 * - Top: MAVE identity, workspace title, status badge, minimize/collapse controls
 * - Content: AgentWorkspaceView or LanguageWorkspaceView based on task type
 */
export const WorkspaceShell: React.FC<WorkspaceShellProps> = ({
  state,
  onMinimizeToConversation,
  onCollapseToPresence,
  onAllowApproval,
  onDenyApproval,
  className = ''
}) => {
  const isRunning = state.status === 'running';
  const isWaitingApproval = state.status === 'waiting_approval';
  const isCompleted = state.status === 'completed';

  const statusColor = isCompleted
    ? 'var(--mave-v2-accent-success)'
    : isWaitingApproval
    ? 'var(--mave-v2-accent-warning)'
    : isRunning
    ? 'var(--mave-v2-accent-thinking)'
    : 'var(--mave-v2-text-muted)';

  return (
    <div
      className={`mave-v2-workspace-shell ${className}`.trim()}
      style={{
        width: '100%',
        height: '100%',
        background: 'var(--mave-v2-surface-resting)',
        backdropFilter: 'blur(var(--mave-v2-blur))',
        WebkitBackdropFilter: 'blur(var(--mave-v2-blur))',
        border: '1px solid var(--mave-v2-border-subtle)',
        borderRadius: 'var(--mave-v2-radius-workspace)',
        boxShadow: '0 16px 48px rgba(0, 0, 0, 0.55)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        boxSizing: 'border-box',
        color: 'var(--mave-v2-text-primary)'
      }}
      data-testid="workspace-shell"
      data-type={state.type}
    >
      {/* Workspace Header */}
      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '12px 20px',
          borderBottom: '1px solid var(--mave-v2-border-subtle)',
          background: 'rgba(255, 255, 255, 0.02)'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <AdaptivePresenceMark size="status" state={isRunning ? 'thinking' : 'idle'} />
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontWeight: 700, fontSize: '14px', letterSpacing: '-0.2px' }}>
                MAVE
              </span>
              <span style={{ color: 'var(--mave-v2-text-dim)', fontSize: '13px' }}>/</span>
              <span style={{ fontWeight: 600, fontSize: '13px', color: 'var(--mave-v2-text-primary)' }}>
                {state.title}
              </span>
              <span
                style={{
                  fontSize: '10px',
                  fontWeight: 600,
                  color: statusColor,
                  background: 'rgba(255, 255, 255, 0.05)',
                  padding: '2px 6px',
                  borderRadius: '4px',
                  textTransform: 'uppercase'
                }}
              >
                {state.status.replace('_', ' ')}
              </span>
            </div>
          </div>
        </div>

        {/* Workspace Window Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          {onMinimizeToConversation && (
            <button
              onClick={onMinimizeToConversation}
              title="Minimize to Conversation"
              aria-label="Minimize to Conversation"
              style={{
                background: 'transparent',
                border: '1px solid var(--mave-v2-border-subtle)',
                borderRadius: '6px',
                color: 'var(--mave-v2-text-secondary)',
                padding: '4px 8px',
                fontSize: '11px',
                cursor: 'pointer'
              }}
            >
              ↙ Chat
            </button>
          )}
          {onCollapseToPresence && (
            <button
              onClick={onCollapseToPresence}
              title="Collapse to Ambient Presence"
              aria-label="Collapse to Ambient Presence"
              style={{
                background: 'transparent',
                border: '1px solid var(--mave-v2-border-subtle)',
                borderRadius: '6px',
                color: 'var(--mave-v2-text-secondary)',
                padding: '4px 8px',
                fontSize: '11px',
                cursor: 'pointer'
              }}
            >
              • Ambient
            </button>
          )}
        </div>
      </header>

      {/* Main Workspace Canvas */}
      <div style={{ flex: 1, padding: '16px 20px', overflow: 'hidden' }}>
        {state.type === 'language' ? (
          <LanguageWorkspaceView state={state} />
        ) : (
          <AgentWorkspaceView
            state={state}
            onAllowApproval={onAllowApproval}
            onDenyApproval={onDenyApproval}
          />
        )}
      </div>
    </div>
  );
};

