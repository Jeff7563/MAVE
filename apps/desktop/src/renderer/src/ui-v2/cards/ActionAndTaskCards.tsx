import React, { useState } from 'react';
import type { TaskCardData, ProgressCardData, ApprovalCardData, ErrorCardData } from '../types';
import { CardShell } from '../primitives/CardShell';
import '../tokens.css';

export interface TaskCardProps {
  data: TaskCardData;
  onCancel?: () => void;
  onRetry?: () => void;
}

/**
 * TaskCard
 *
 * Represents an active, completed, or failed task in the conversation timeline.
 * Features:
 * - Responsible runtime badge (clean semantic label)
 * - Status indicator with color coding
 * - Progress Truthfulness Invariant:
 *   - If determinate: renders real known percentage/steps
 *   - If indeterminate: renders ongoing pulsing activity state, NEVER synthesizes fake percentage numbers
 * - Cancel and Retry synthetic action affordances
 */
export const TaskCard: React.FC<TaskCardProps> = ({ data, onCancel, onRetry }) => {
  const isRunning = data.status === 'running';
  const isCompleted = data.status === 'completed';
  const isFailed = data.status === 'failed';
  const isDeterminate = data.determinate !== false && data.progressPercent !== undefined;

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
      intent={data.intent || (isFailed ? 'warning' : 'default')}
      density={data.density || 'standard'}
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
            data-testid="btn-cancel-task"
            aria-label="Cancel task"
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
            data-testid="btn-retry-task"
            aria-label="Retry task"
          >
            Retry
          </button>
        ) : undefined
      }
    >
      <div
        style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}
        data-testid="task-card"
        data-determinate={isDeterminate ? 'true' : 'false'}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontWeight: 600, fontSize: '13px', color: 'var(--mave-v2-text-primary)' }}>
            {data.taskName}
          </span>
          {isDeterminate ? (
            <span
              style={{ fontSize: '11px', color: 'var(--mave-v2-text-secondary)', fontWeight: 600 }}
              data-testid="task-percent"
            >
              {data.progressPercent}%
            </span>
          ) : isRunning ? (
            <span
              style={{ fontSize: '11px', color: 'var(--mave-v2-text-dim)', fontStyle: 'italic' }}
              data-testid="task-indeterminate-status"
            >
              In progress…
            </span>
          ) : null}
        </div>

        {/* Progress bar: determinate vs indeterminate */}
        {isDeterminate ? (
          <div
            style={{
              width: '100%',
              height: '4px',
              background: 'rgba(255, 255, 255, 0.08)',
              borderRadius: '2px',
              overflow: 'hidden'
            }}
            role="progressbar"
            aria-valuenow={data.progressPercent}
            aria-valuemin={0}
            aria-valuemax={100}
            data-testid="task-determinate-bar"
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
        ) : isRunning ? (
          <div
            style={{
              width: '100%',
              height: '4px',
              background: 'rgba(255, 255, 255, 0.08)',
              borderRadius: '2px',
              overflow: 'hidden',
              position: 'relative'
            }}
            data-testid="task-indeterminate-bar"
          >
            <div
              style={{
                width: '40%',
                height: '100%',
                background: 'var(--mave-v2-accent-thinking)',
                borderRadius: '2px',
                animation: 'mave-v2-pulse-ring 1.5s infinite ease-in-out'
              }}
            />
          </div>
        ) : null}

        {data.currentStep && (
          <div
            style={{
              fontSize: '11px',
              color: 'var(--mave-v2-text-secondary)',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
            data-testid="task-current-step"
          >
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

export interface ProgressCardProps {
  data: ProgressCardData;
  onCancel?: () => void;
}

/**
 * ProgressCard
 *
 * Dedicated card for multi-step progress and ongoing background activity.
 * Strict Invariant: Progress Truthfulness
 * - Determinate progress: Displays real known steps (completedSteps / totalSteps) and percent.
 * - Indeterminate activity: Displays ongoing work state, NEVER fabricates elapsed-time percentages.
 */
export const ProgressCard: React.FC<ProgressCardProps> = ({ data, onCancel }) => {
  const isDeterminate = data.determinate === true;
  const percent = data.percent ?? (
    isDeterminate && data.completedSteps !== undefined && data.totalSteps && data.totalSteps > 0
      ? Math.round((data.completedSteps / data.totalSteps) * 100)
      : undefined
  );

  return (
    <CardShell
      id={data.id}
      badge="PROGRESS"
      badgeColor="var(--mave-v2-accent-thinking)"
      title={data.label}
      intent={data.intent || 'default'}
      density={data.density || 'standard'}
      actions={
        onCancel ? (
          <button
            onClick={onCancel}
            style={{
              background: 'transparent',
              border: '1px solid var(--mave-v2-border-subtle)',
              borderRadius: '4px',
              color: 'var(--mave-v2-text-secondary)',
              padding: '3px 8px',
              fontSize: '11px',
              cursor: 'pointer'
            }}
            data-testid="btn-cancel-progress"
            aria-label="Cancel progress operation"
          >
            Cancel
          </button>
        ) : undefined
      }
    >
      <div
        style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}
        data-testid="progress-card"
        data-determinate={isDeterminate ? 'true' : 'false'}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontWeight: 600, fontSize: '13px', color: 'var(--mave-v2-text-primary)' }}>
            {data.label}
          </span>

          {isDeterminate ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              {data.completedSteps !== undefined && data.totalSteps !== undefined && (
                <span
                  style={{ fontSize: '11px', color: 'var(--mave-v2-text-dim)' }}
                  data-testid="progress-step-count"
                >
                  Step {data.completedSteps}/{data.totalSteps}
                </span>
              )}
              {percent !== undefined && (
                <span
                  style={{ fontSize: '12px', color: 'var(--mave-v2-accent-listening)', fontWeight: 700 }}
                  data-testid="progress-percentage-label"
                >
                  {percent}%
                </span>
              )}
            </div>
          ) : (
            <span
              style={{
                fontSize: '11px',
                color: 'var(--mave-v2-text-dim)',
                fontStyle: 'italic'
              }}
              data-testid="indeterminate-activity-badge"
            >
              Working…
            </span>
          )}
        </div>

        {/* Progress Bar Representation */}
        {isDeterminate && percent !== undefined ? (
          <div
            style={{
              width: '100%',
              height: '6px',
              background: 'rgba(255, 255, 255, 0.08)',
              borderRadius: '3px',
              overflow: 'hidden'
            }}
            role="progressbar"
            aria-valuenow={percent}
            aria-valuemin={0}
            aria-valuemax={100}
            data-testid="determinate-progress-bar"
          >
            <div
              style={{
                width: `${percent}%`,
                height: '100%',
                background: 'linear-gradient(90deg, #0284c7 0%, #38bdf8 100%)',
                borderRadius: '3px',
                transition: 'width 250ms ease-out'
              }}
            />
          </div>
        ) : (
          <div
            style={{
              width: '100%',
              height: '6px',
              background: 'rgba(255, 255, 255, 0.08)',
              borderRadius: '3px',
              overflow: 'hidden',
              position: 'relative'
            }}
            data-testid="indeterminate-progress-bar"
          >
            <div
              style={{
                width: '50%',
                height: '100%',
                background: 'linear-gradient(90deg, rgba(56, 189, 248, 0.2) 0%, rgba(56, 189, 248, 0.8) 50%, rgba(56, 189, 248, 0.2) 100%)',
                borderRadius: '3px',
                animation: 'mave-v2-pulse-ring 1.8s infinite ease-in-out'
              }}
            />
          </div>
        )}

        {/* Sub-status or step description */}
        {(data.currentStep || data.statusMessage) && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '11px',
              color: 'var(--mave-v2-text-secondary)'
            }}
            data-testid="progress-status-message"
          >
            <span
              style={{
                display: 'inline-block',
                width: '6px',
                height: '6px',
                borderRadius: '50%',
                background: 'var(--mave-v2-accent-listening)',
                animation: 'mave-v2-pulse-ring 1.5s infinite'
              }}
            />
            <span>{data.currentStep || data.statusMessage}</span>
          </div>
        )}
      </div>
    </CardShell>
  );
};

export interface ApprovalCardProps {
  data: ApprovalCardData;
  onAllowMock?: (id: string) => void;
  onDenyMock?: (id: string) => void;
  onAllow?: () => void;
  onDeny?: () => void;
}

/**
 * ApprovalCard
 *
 * Structural presentation for action and tool execution approvals.
 *
 * CRITICAL ARCHITECTURAL BOUNDARY:
 * - ApprovalCard in UI V2 is PRESENTATION ONLY.
 * - M5 permission architecture and execution gates are NOT implemented here.
 * - Allow/Deny buttons emit synthetic UI intent callbacks (onAllowMock / onDenyMock).
 * - Risk levels (Level 0-3, Read Only / Safe Local / External / Destructive) remain
 *   prototype/mock taxonomy and are NOT frozen as production permission policies.
 * - Zero real shell, filesystem, or MCP tool authority exists in this surface.
 */
export const ApprovalCard: React.FC<ApprovalCardProps> = ({
  data,
  onAllowMock,
  onDenyMock,
  onAllow,
  onDeny
}) => {
  const isDestructive = data.riskClass === 'destructive';
  const isResolved = data.status === 'allowed' || data.status === 'denied';

  const handleAllow = () => {
    onAllowMock?.(data.id);
    onAllow?.();
  };

  const handleDeny = () => {
    onDenyMock?.(data.id);
    onDeny?.();
  };

  return (
    <CardShell
      id={data.id}
      badge="Action Approval Required"
      badgeColor={isDestructive ? 'var(--mave-v2-accent-error)' : 'var(--mave-v2-accent-warning)'}
      title="Prototype Permission Gate"
      intent={data.intent || (isDestructive ? 'destructive' : 'attention')}
      density={data.density || 'standard'}
      actions={
        !isResolved ? (
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={handleDeny}
              style={{
                background: 'rgba(255, 255, 255, 0.06)',
                border: '1px solid var(--mave-v2-border-subtle)',
                borderRadius: '6px',
                color: 'var(--mave-v2-text-secondary)',
                padding: '5px 12px',
                fontSize: '12px',
                fontWeight: 500,
                cursor: 'pointer'
              }}
              data-testid="btn-deny-action"
              aria-label="Deny requested action (mock)"
            >
              Deny
            </button>
            <button
              onClick={handleAllow}
              style={{
                background: isDestructive
                  ? 'linear-gradient(135deg, #dc2626 0%, #b91c1c 100%)'
                  : 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
                border: 'none',
                borderRadius: '6px',
                color: '#ffffff',
                padding: '5px 14px',
                fontSize: '12px',
                fontWeight: 600,
                cursor: 'pointer',
                boxShadow: isDestructive
                  ? '0 0 10px rgba(220, 38, 38, 0.4)'
                  : '0 0 10px rgba(2, 132, 199, 0.4)'
              }}
              data-testid="btn-allow-action"
              aria-label={isDestructive ? 'Confirm destructive action (mock)' : 'Allow action (mock)'}
            >
              {isDestructive ? 'Confirm Destructive Action' : 'Allow Action'}
            </button>
          </div>
        ) : (
          <div
            style={{
              fontSize: '11px',
              fontWeight: 600,
              color: data.status === 'allowed' ? 'var(--mave-v2-accent-success)' : 'var(--mave-v2-accent-error)',
              padding: '2px 8px',
              background: data.status === 'allowed' ? 'rgba(34, 197, 94, 0.1)' : 'rgba(239, 68, 68, 0.1)',
              borderRadius: '4px'
            }}
            data-testid="approval-status-resolved"
          >
            {data.status === 'allowed' ? '✓ Allowed (Mock Intent Emitted)' : '✕ Denied (Mock Intent Emitted)'}
          </div>
        )
      }
    >
      <div
        style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}
        data-testid="approval-card"
        data-prototype-gate="true"
      >
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
            data-testid="approval-risk-badge"
          >
            {data.riskLevel}
          </span>
        </div>

        <div
          style={{ fontSize: '13px', color: 'var(--mave-v2-text-secondary)', lineHeight: 1.45 }}
          data-testid="approval-action-requested"
        >
          {data.actionRequested}
        </div>

        {/* Risk Explanation */}
        {data.riskExplanation && (
          <div
            style={{
              fontSize: '11px',
              color: isDestructive ? '#fca5a5' : '#fed7aa',
              background: isDestructive ? 'rgba(239, 68, 68, 0.08)' : 'rgba(245, 158, 11, 0.08)',
              padding: '6px 8px',
              borderRadius: '4px',
              borderLeft: isDestructive ? '3px solid #ef4444' : '3px solid #f59e0b'
            }}
            data-testid="approval-risk-explanation"
          >
            {data.riskExplanation}
          </div>
        )}

        {/* Command string preview */}
        {data.command && (
          <div
            style={{
              background: 'rgba(0, 0, 0, 0.45)',
              padding: '8px 10px',
              borderRadius: '6px',
              fontFamily: 'Consolas, Monaco, monospace',
              fontSize: '12px',
              color: '#38bdf8',
              border: '1px solid var(--mave-v2-border-subtle)',
              overflowX: 'auto',
              whiteSpace: 'pre'
            }}
            data-testid="approval-command-preview"
          >
            $ {data.command}
          </div>
        )}

        {/* Working directory breadcrumb */}
        {data.directory && (
          <div
            style={{
              fontSize: '11px',
              color: 'var(--mave-v2-text-dim)',
              fontFamily: 'Consolas, monospace'
            }}
            data-testid="approval-directory"
          >
            Directory: <span style={{ color: 'var(--mave-v2-text-secondary)' }}>{data.directory}</span>
          </div>
        )}

        {/* Prototype boundary notice */}
        <div
          style={{
            fontSize: '10px',
            color: 'var(--mave-v2-text-dim)',
            borderTop: '1px solid rgba(255, 255, 255, 0.04)',
            paddingTop: '4px',
            fontStyle: 'italic'
          }}
          data-testid="approval-prototype-disclaimer"
        >
          [Prototype Notice]: Buttons trigger synthetic UI callbacks only. No system commands are executed.
        </div>
      </div>
    </CardShell>
  );
};

export interface ErrorCardProps {
  data: ErrorCardData;
  onRetry?: () => void;
}

/**
 * ErrorCard
 *
 * Human-readable error presentation with progressive disclosure for technical details.
 * Features:
 * - Clear human-readable error description
 * - Suggested recovery action affordance
 * - Progressive disclosure: technical details hidden by default behind toggle
 * - Safe rendering without vendor blaming
 */
export const ErrorCard: React.FC<ErrorCardProps> = ({ data, onRetry }) => {
  const [showTechnicalDetails, setShowTechnicalDetails] = useState<boolean>(false);

  return (
    <CardShell
      id={data.id}
      badge="ALERT"
      badgeColor="var(--mave-v2-accent-error)"
      title={data.title ?? 'Error Encountered'}
      intent={data.intent || 'warning'}
      density={data.density || 'standard'}
      actions={
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {data.technicalDetails && (
            <button
              onClick={() => setShowTechnicalDetails(!showTechnicalDetails)}
              style={{
                background: 'transparent',
                border: '1px solid var(--mave-v2-border-subtle)',
                borderRadius: '4px',
                color: 'var(--mave-v2-text-muted)',
                padding: '4px 8px',
                fontSize: '11px',
                cursor: 'pointer'
              }}
              data-testid="btn-toggle-error-details"
              aria-expanded={showTechnicalDetails}
            >
              {showTechnicalDetails ? '▲ Hide Details' : '▼ Technical Details'}
            </button>
          )}

          {data.recoverable && onRetry && (
            <button
              onClick={onRetry}
              style={{
                background: 'rgba(239, 68, 68, 0.15)',
                border: '1px solid rgba(239, 68, 68, 0.35)',
                borderRadius: '4px',
                color: '#fca5a5',
                padding: '4px 10px',
                fontSize: '11px',
                fontWeight: 600,
                cursor: 'pointer'
              }}
              data-testid="btn-retry-error"
            >
              ↻ {data.suggestedAction ?? 'Retry'}
            </button>
          )}
        </div>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }} data-testid="error-card">
        <div
          style={{
            color: 'var(--mave-v2-accent-error)',
            fontSize: '13px',
            lineHeight: 1.45,
            fontWeight: 500
          }}
          data-testid="error-message-text"
        >
          {data.errorMessage}
        </div>

        {/* Collapsible Technical Details (Progressive Disclosure) */}
        {showTechnicalDetails && data.technicalDetails && (
          <pre
            style={{
              margin: 0,
              padding: '8px 10px',
              background: 'rgba(0, 0, 0, 0.45)',
              borderRadius: '6px',
              fontSize: '11px',
              fontFamily: 'Consolas, Monaco, monospace',
              color: '#94a3b8',
              overflowX: 'auto',
              border: '1px solid rgba(239, 68, 68, 0.25)',
              lineHeight: 1.4
            }}
            data-testid="error-technical-details"
          >
            {data.technicalDetails}
          </pre>
        )}
      </div>
    </CardShell>
  );
};
