import React from 'react';
import type { WorkspaceState } from '../types';
import { ApprovalCard } from '../cards/ActionAndTaskCards';
import '../tokens.css';

export interface AgentWorkspaceViewProps {
  state: WorkspaceState;
  onAllowApproval?: (id: string) => void;
  onDenyApproval?: (id: string) => void;
}

export const AgentWorkspaceView: React.FC<AgentWorkspaceViewProps> = ({
  state,
  onAllowApproval,
  onDenyApproval
}) => {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '1fr 340px',
        gap: '16px',
        height: '100%',
        overflow: 'hidden'
      }}
      data-testid="agent-workspace-view"
    >
      {/* Main Work Area: Plan Steps & Execution Output */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '14px',
          overflowY: 'auto',
          paddingRight: '4px'
        }}
      >
        {/* Objective Card */}
        {state.currentObjective && (
          <div
            style={{
              background: 'var(--mave-v2-surface-elevated)',
              border: '1px solid var(--mave-v2-border-subtle)',
              borderRadius: 'var(--mave-v2-radius-card)',
              padding: '12px 16px'
            }}
          >
            <div style={{ fontSize: '11px', color: 'var(--mave-v2-accent-listening)', fontWeight: 600, textTransform: 'uppercase' }}>
              Target Objective
            </div>
            <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--mave-v2-text-primary)', marginTop: '4px' }}>
              {state.currentObjective}
            </div>
          </div>
        )}

        {/* Plan Decomposition / Step Tracker */}
        {state.steps && state.steps.length > 0 && (
          <div
            style={{
              background: 'var(--mave-v2-surface-elevated)',
              border: '1px solid var(--mave-v2-border-subtle)',
              borderRadius: 'var(--mave-v2-radius-card)',
              padding: '14px 16px',
              display: 'flex',
              flexDirection: 'column',
              gap: '10px'
            }}
          >
            <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--mave-v2-text-secondary)' }}>
              Execution Plan
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {state.steps.map((step, idx) => {
              const isCompleted = step.status === 'completed';
              const isActive = step.status === 'active';
              return (
                <div
                  key={step.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    fontSize: '12px',
                    color: isCompleted
                      ? 'var(--mave-v2-text-muted)'
                      : isActive
                      ? 'var(--mave-v2-text-primary)'
                      : 'var(--mave-v2-text-dim)',
                    background: isActive ? 'rgba(56, 189, 248, 0.08)' : 'transparent',
                    padding: '6px 10px',
                    borderRadius: '6px',
                    borderLeft: isActive ? '3px solid var(--mave-v2-accent-listening)' : '3px solid transparent'
                  }}
                >
                  <span style={{ fontWeight: 700, width: '16px' }}>{idx + 1}.</span>
                  <span style={{ flex: 1 }}>{step.label}</span>
                  <span
                    style={{
                      fontSize: '10px',
                      padding: '2px 6px',
                      borderRadius: '4px',
                      background: isCompleted ? 'rgba(34, 197, 94, 0.15)' : isActive ? 'rgba(56, 189, 248, 0.15)' : 'rgba(255, 255, 255, 0.04)',
                      color: isCompleted ? 'var(--mave-v2-accent-success)' : isActive ? 'var(--mave-v2-accent-listening)' : 'var(--mave-v2-text-dim)',
                      fontWeight: 600
                    }}
                  >
                    {step.status.toUpperCase()}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Live Output Summary / Logs */}
        {state.outputSummary && (
          <div
            style={{
              background: 'rgba(0, 0, 0, 0.4)',
              border: '1px solid var(--mave-v2-border-subtle)',
              borderRadius: 'var(--mave-v2-radius-card)',
              padding: '12px 14px',
              fontFamily: 'Consolas, monospace',
              fontSize: '11px',
              color: '#38bdf8',
              lineHeight: 1.5,
              whiteSpace: 'pre-wrap'
            }}
          >
            {state.outputSummary}
          </div>
        )}
      </div>

      {/* Side Column: Context Files & Approvals */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '14px',
          overflowY: 'auto'
        }}
      >
        {/* Active Approval Card if waiting */}
        {state.activeApproval && (
          <ApprovalCard
            data={state.activeApproval}
            onAllow={() => onAllowApproval?.(state.activeApproval!.id)}
            onDeny={() => onDenyApproval?.(state.activeApproval!.id)}
          />
        )}

        {/* Workspace Files */}
        {state.files && state.files.length > 0 && (
          <div
            style={{
              background: 'var(--mave-v2-surface-elevated)',
              border: '1px solid var(--mave-v2-border-subtle)',
              borderRadius: 'var(--mave-v2-radius-card)',
              padding: '12px 14px',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px'
            }}
          >
            <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--mave-v2-text-secondary)', textTransform: 'uppercase' }}>
              Target Files ({state.files.length})
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {state.files.map((file, i) => (
                <div
                  key={i}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    fontSize: '11px',
                    padding: '4px 6px',
                    borderRadius: '4px',
                    background: 'rgba(255, 255, 255, 0.03)'
                  }}
                >
                  <span style={{ color: 'var(--mave-v2-text-primary)', fontFamily: 'monospace' }}>
                    {file.path.split(/[\\/]/).pop()}
                  </span>
                  <span
                    style={{
                      fontSize: '9px',
                      color: file.status === 'modified' ? 'var(--mave-v2-accent-warning)' : 'var(--mave-v2-accent-listening)',
                      fontWeight: 600
                    }}
                  >
                    {file.status.toUpperCase()}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

