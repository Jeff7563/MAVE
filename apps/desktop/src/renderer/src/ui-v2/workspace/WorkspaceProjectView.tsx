import React from 'react';
import type { WorkspaceStep } from '../types';
import '../tokens.css';

export interface WorkspaceProjectViewProps {
  title?: string;
  objective?: string;
  artifactTitle?: string;
  artifactContent?: string;
  artifactLanguage?: string;
  steps?: WorkspaceStep[];
  currentStepNumber?: number;
  totalStepsCount?: number;
  status?: string;
  determinate?: boolean;
  progressPercent?: number;
  outputSummary?: string;
  onAction?: (action: string) => void;
  className?: string;
}

/**
 * WorkspaceProjectView
 *
 * Dedicated Level 3 Project & Generic Workspace View.
 * Displays primary artifacts (code, document, plan, architecture spec) alongside
 * truthful step execution and observable activity.
 */
export const WorkspaceProjectView: React.FC<WorkspaceProjectViewProps> = ({
  title,
  objective,
  artifactTitle,
  artifactContent,
  artifactLanguage = 'markdown',
  steps = [],
  currentStepNumber,
  totalStepsCount,
  status = 'idle',
  determinate,
  progressPercent,
  outputSummary,
  onAction,
  className = ''
}) => {
  const isCompleted = status === 'completed';
  const isRunning = status === 'running';

  const completedSteps = steps.filter((s) => s.status === 'completed').length;
  const totalCount = totalStepsCount ?? steps.length;
  const currentCount =
    currentStepNumber ?? (completedSteps + (steps.some((s) => s.status === 'active') ? 1 : 0));
  const isDeterminate =
    determinate !== undefined
      ? determinate
      : progressPercent !== undefined || (completedSteps > 0 && steps.length > 0) || currentStepNumber !== undefined;
  const calculatedPercent =
    progressPercent !== undefined
      ? progressPercent
      : isDeterminate && totalCount > 0
      ? Math.round((currentCount / totalCount) * 100)
      : undefined;

  return (
    <div
      className={`mave-v2-workspace-project-view ${className}`.trim()}
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        gap: '14px',
        overflowY: 'auto',
        color: 'var(--mave-v2-text-primary)'
      }}
      data-testid="workspace-project-view"
    >
      {/* 1. Project Objective Banner */}
      {objective && (
        <div
          style={{
            background: 'var(--mave-v2-surface-elevated)',
            border: '1px solid var(--mave-v2-border-subtle)',
            borderRadius: 'var(--mave-v2-radius-card)',
            padding: '12px 16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px'
          }}
          data-testid="project-objective-card"
        >
          <div>
            <div style={{ fontSize: '11px', color: 'var(--mave-v2-accent-listening)', fontWeight: 600, textTransform: 'uppercase' }}>
              Project Objective
            </div>
            <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--mave-v2-text-primary)', marginTop: '2px' }}>
              {objective}
            </div>
          </div>
          {onAction && (
            <button
              onClick={() => onAction('export_artifact')}
              style={{
                background: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid var(--mave-v2-border-subtle)',
                borderRadius: '6px',
                padding: '6px 12px',
                fontSize: '11px',
                color: 'var(--mave-v2-text-secondary)',
                cursor: 'pointer'
              }}
              data-testid="btn-project-export"
            >
              Export Artifact
            </button>
          )}
        </div>
      )}

      {/* 2. Primary Artifact Inspection Canvas */}
      {artifactContent && (
        <div
          style={{
            flex: 1,
            background: 'var(--mave-v2-surface-elevated)',
            border: '1px solid var(--mave-v2-border-subtle)',
            borderRadius: 'var(--mave-v2-radius-card)',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            minHeight: '260px'
          }}
          data-testid="project-primary-artifact"
        >
          <div
            style={{
              padding: '10px 16px',
              borderBottom: '1px solid var(--mave-v2-border-subtle)',
              background: 'rgba(255, 255, 255, 0.02)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--mave-v2-text-primary)' }}>
                {artifactTitle || title}
              </span>
              <span style={{ fontSize: '10px', color: 'var(--mave-v2-text-dim)', textTransform: 'uppercase' }}>
                ({artifactLanguage})
              </span>
            </div>
            <button
              onClick={() => navigator?.clipboard?.writeText?.(artifactContent)}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--mave-v2-text-muted)',
                fontSize: '11px',
                cursor: 'pointer'
              }}
              data-testid="btn-copy-artifact"
            >
              Copy
            </button>
          </div>
          <div
            style={{
              flex: 1,
              padding: '16px',
              overflowY: 'auto',
              fontFamily: artifactLanguage === 'markdown' ? 'inherit' : 'Consolas, monospace',
              fontSize: '13px',
              lineHeight: '1.6',
              whiteSpace: 'pre-wrap',
              color: 'var(--mave-v2-text-primary)'
            }}
            data-testid="artifact-content-view"
          >
            {artifactContent}
          </div>
        </div>
      )}

      {/* 3. Execution Plan / Progress Tracker (if steps exist) */}
      {steps.length > 0 && (
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
          data-testid="project-plan-tracker"
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--mave-v2-text-secondary)' }}>
              Execution Plan
            </span>
            {isDeterminate && calculatedPercent !== undefined ? (
              <span style={{ fontSize: '11px', color: 'var(--mave-v2-accent-listening)', fontWeight: 600 }} data-testid="determinate-progress-label">
                {currentCount} / {totalCount} steps • {calculatedPercent}%
              </span>
            ) : isRunning ? (
              <span style={{ fontSize: '11px', color: 'var(--mave-v2-accent-thinking)', fontWeight: 500 }} data-testid="indeterminate-progress-label">
                Working…
              </span>
            ) : null}
          </div>

          {/* Progress Bar (Determinate only) */}
          {isDeterminate && calculatedPercent !== undefined && (
            <div
              style={{
                width: '100%',
                height: '4px',
                background: 'rgba(255, 255, 255, 0.08)',
                borderRadius: '2px',
                overflow: 'hidden'
              }}
              data-testid="determinate-progress-bar"
            >
              <div
                style={{
                  width: `${calculatedPercent}%`,
                  height: '100%',
                  background: isCompleted ? 'var(--mave-v2-accent-success)' : 'var(--mave-v2-accent-listening)',
                  transition: 'width 250ms ease'
                }}
              />
            </div>
          )}

          {/* Step items */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {steps.map((step, idx) => {
              const isStepCompleted = step.status === 'completed';
              const isStepActive = step.status === 'active';
              return (
                <div
                  key={step.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    fontSize: '12px',
                    color: isStepCompleted
                      ? 'var(--mave-v2-text-muted)'
                      : isStepActive
                      ? 'var(--mave-v2-text-primary)'
                      : 'var(--mave-v2-text-dim)',
                    background: isStepActive ? 'rgba(56, 189, 248, 0.08)' : 'transparent',
                    padding: '6px 10px',
                    borderRadius: '6px',
                    borderLeft: isStepActive ? '3px solid var(--mave-v2-accent-listening)' : '3px solid transparent'
                  }}
                  data-testid={`project-step-${step.id}`}
                >
                  <span style={{ fontWeight: 700, width: '16px' }}>{idx + 1}.</span>
                  <span style={{ flex: 1 }}>{step.label}</span>
                  <span
                    style={{
                      fontSize: '10px',
                      padding: '2px 6px',
                      borderRadius: '4px',
                      background: isStepCompleted ? 'rgba(34, 197, 94, 0.15)' : isStepActive ? 'rgba(56, 189, 248, 0.15)' : 'rgba(255, 255, 255, 0.04)',
                      color: isStepCompleted ? 'var(--mave-v2-accent-success)' : isStepActive ? 'var(--mave-v2-accent-listening)' : 'var(--mave-v2-text-dim)',
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

      {/* 4. Output Summary / Logs */}
      {outputSummary && (
        <div
          style={{
            background: 'rgba(0, 0, 0, 0.4)',
            border: '1px solid var(--mave-v2-border-subtle)',
            borderRadius: 'var(--mave-v2-radius-card)',
            padding: '12px 14px',
            fontFamily: 'Consolas, monospace',
            fontSize: '11px',
            color: '#38bdf8',
            lineHeight: '1.5',
            whiteSpace: 'pre-wrap'
          }}
          data-testid="project-output-summary"
        >
          {outputSummary}
        </div>
      )}
    </div>
  );
};
