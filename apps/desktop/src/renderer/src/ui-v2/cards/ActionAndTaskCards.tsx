import React from 'react';
import type { TaskCardData, ApprovalCardData, ErrorCardData } from '../types';
import { CardShell } from '../primitives/CardShell';
import '../tokens.css';

export interface TaskCardProps {
  data: TaskCardData;
  onCancel?: () => void;
  onRetry?: () => void;
}

export const TaskCard: React.FC<TaskCardProps> = ({ data, onCancel, onRetry }) => {
  const isRunning = data.status === 'running';
  const isCompleted = data.status === 'completed';
  const isFailed = data.status === 'failed';

  const statusColor = isCompleted
    ? 'var(--mave-v2-accent-success)'
    : isFailed
    ? 'var(--mave-v2-accent-error)'
    : 'var(--mave-v2-accent-thinking)';

  return (
    <CardShell
      id={data.id}
      badge={data.responsibleRuntime ?? 'MAVE Task'}
      badgeColor={statusColor}
      title={data.status.toUpperCase()}
      actions={
        isRunning && onCancel ? (
          <button
            onClick={onCancel}
            style={{
              background: 'transparent',
              border: '1px solid rgba(239, 68, 68, 0.4)',
              borderRadius: '4px',
              color: 'var(--mave-v2-accent-error)',
              padding: '3px 8px',
              fontSize: '11px',
              cursor: 'pointer'
            }}
          >
            Cancel Task
          </button>
        ) : isFailed && onRetry ? (
          <button
            onClick={onRetry}
            style={{
              background: 'transparent',
              border: '1px solid var(--mave-v2-border-subtle)',
              borderRadius: '4px',
              color: 'var(--mave-v2-text-secondary)',
              padding: '3px 8px',
              fontSize: '11px',
              cursor: 'pointer'
            }}
          >
            Retry
          </button>
        ) : undefined
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontWeight: 600, fontSize: '13px', color: 'var(--mave-v2-text-primary)' }}>
            {data.taskName}
          </span>
          {data.progressPercent !== undefined && (
            <span style={{ fontSize: '11px', color: 'var(--mave-v2-text-secondary)' }}>
              {data.progressPercent}%
            </span>
          )}
        </div>

        {/* Progress bar */}
        {data.progressPercent !== undefined && (
          <div
            style={{
              width: '100%',
              height: '4px',
              background: 'rgba(255, 255, 255, 0.08)',
              borderRadius: '2px',
              overflow: 'hidden'
            }}
          >
            <div
              style={{
                width: `${data.progressPercent}%`,
                height: '100%',
                background: statusColor,
                transition: 'width 250ms ease-out'
              }}
            />
          </div>
        )}

        {data.currentStep && (
          <div style={{ fontSize: '11px', color: 'var(--mave-v2-text-secondary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
            {isRunning && (
              <span
                style={{
                  display: 'inline-block',
                  width: '6px',
                  height: '6px',
                  borderRadius: '50%',
                  background: 'var(--mave-v2-accent-thinking)',
                  animation: 'mave-v2-pulse-ring 1.5s infinite'
                }}
              />
            )}
            <span>{data.currentStep}</span>
          </div>
        )}
      </div>
    </CardShell>
  );
};

export interface ApprovalCardProps {
  data: ApprovalCardData;
  onAllow?: () => void;
  onDeny?: () => void;
}

export const ApprovalCard: React.FC<ApprovalCardProps> = ({ data, onAllow, onDeny }) => {
  const isDestructive = data.riskClass === 'destructive';

  return (
    <CardShell
      id={data.id}
      badge="Action Approval Required"
      badgeColor="var(--mave-v2-accent-warning)"
      attention={isDestructive}
      highlighted={!isDestructive}
      actions={
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={onDeny}
            style={{
              background: 'rgba(255, 255, 255, 0.06)',
              border: '1px solid var(--mave-v2-border-subtle)',
              borderRadius: '6px',
              color: 'var(--mave-v2-text-secondary)',
              padding: '6px 14px',
              fontSize: '12px',
              fontWeight: 500,
              cursor: 'pointer'
            }}
          >
            Deny
          </button>
          <button
            onClick={onAllow}
            style={{
              background: isDestructive
                ? 'linear-gradient(135deg, #dc2626 0%, #b91c1c 100%)'
                : 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
              border: 'none',
              borderRadius: '6px',
              color: '#ffffff',
              padding: '6px 14px',
              fontSize: '12px',
              fontWeight: 600,
              cursor: 'pointer',
              boxShadow: isDestructive
                ? '0 0 12px rgba(220, 38, 38, 0.4)'
                : '0 0 12px rgba(2, 132, 199, 0.4)'
            }}
          >
            {isDestructive ? 'Confirm Destructive Action' : 'Allow Action'}
          </button>
        </div>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontWeight: 600, fontSize: '13px', color: 'var(--mave-v2-text-primary)' }}>
            MAVE wants to execute:
          </span>
          <span
            style={{
              fontSize: '10px',
              fontWeight: 600,
              color: isDestructive ? 'var(--mave-v2-accent-error)' : 'var(--mave-v2-accent-warning)',
              background: isDestructive ? 'rgba(239, 68, 68, 0.12)' : 'rgba(249, 115, 22, 0.12)',
              padding: '2px 6px',
              borderRadius: '4px'
            }}
          >
            {data.riskLevel}
          </span>
        </div>

        <div style={{ fontSize: '13px', color: 'var(--mave-v2-text-secondary)' }}>
          {data.actionRequested}
        </div>

        {data.command && (
          <div
            style={{
              background: 'rgba(0, 0, 0, 0.45)',
              padding: '8px 10px',
              borderRadius: '6px',
              fontFamily: 'Consolas, monospace',
              fontSize: '12px',
              color: '#38bdf8',
              border: '1px solid var(--mave-v2-border-subtle)'
            }}
          >
            $ {data.command}
          </div>
        )}

        {data.directory && (
          <div style={{ fontSize: '11px', color: 'var(--mave-v2-text-dim)' }}>
            Working Directory: <span style={{ color: 'var(--mave-v2-text-secondary)' }}>{data.directory}</span>
          </div>
        )}
      </div>
    </CardShell>
  );
};

export interface ErrorCardProps {
  data: ErrorCardData;
  onRetry?: () => void;
}

export const ErrorCard: React.FC<ErrorCardProps> = ({ data, onRetry }) => {
  return (
    <CardShell
      id={data.id}
      badge="Alert"
      badgeColor="var(--mave-v2-accent-error)"
      title={data.title ?? 'Error Encountered'}
      attention
      actions={
        data.recoverable && onRetry ? (
          <button
            onClick={onRetry}
            style={{
              background: 'transparent',
              border: '1px solid var(--mave-v2-border-subtle)',
              borderRadius: '4px',
              color: 'var(--mave-v2-text-secondary)',
              padding: '4px 10px',
              fontSize: '11px',
              cursor: 'pointer'
            }}
          >
            {data.suggestedAction ?? 'Retry'}
          </button>
        ) : undefined
      }
    >
      <div style={{ color: 'var(--mave-v2-accent-error)', fontSize: '13px', lineHeight: 1.4 }}>
        {data.errorMessage}
      </div>
    </CardShell>
  );
};

