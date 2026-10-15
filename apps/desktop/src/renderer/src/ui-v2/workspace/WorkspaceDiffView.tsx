import React, { useState } from 'react';
import type { DiffCardData, WorkspaceFile } from '../types';
import '../tokens.css';

export interface WorkspaceDiffViewProps {
  diffData?: DiffCardData;
  files?: WorkspaceFile[];
  selectedFilePath?: string;
  onSelectFile?: (filePath: string) => void;
  onApproveReview?: () => void;
  onRequestRevision?: () => void;
  className?: string;
}

/**
 * WorkspaceDiffView
 *
 * Dedicated Level 3 Diff Review Workspace View.
 * Provides sustained, multi-file unified diff inspection without requiring
 * autonomous agent execution or filesystem mutation.
 */
export const WorkspaceDiffView: React.FC<WorkspaceDiffViewProps> = ({
  diffData,
  files = [],
  selectedFilePath,
  onSelectFile,
  onApproveReview,
  onRequestRevision,
  className = ''
}) => {
  const [internalSelectedFile, setInternalSelectedFile] = useState<string>(
    selectedFilePath || (files[0]?.path ?? diffData?.filename ?? 'diff.patch')
  );

  const activeFile = selectedFilePath || internalSelectedFile;

  const handleSelect = (path: string) => {
    setInternalSelectedFile(path);
    onSelectFile?.(path);
  };

  // Fallback demo lines if diffData.lines is omitted
  const lines = diffData?.lines ?? [
    { type: 'context', text: 'import { describe, it, expect } from "vitest";', oldLineNumber: 1, newLineNumber: 1 },
    { type: 'remove', text: '- const timeout = 5000;', oldLineNumber: 2 },
    { type: 'add', text: '+ const timeout = 15000;', newLineNumber: 2 },
    { type: 'add', text: '+ const retries = 3;', newLineNumber: 3 },
    { type: 'context', text: 'export function executeTask() {', oldLineNumber: 3, newLineNumber: 4 }
  ];

  const additions = diffData?.additions ?? lines.filter((l) => l.type === 'add').length;
  const deletions = diffData?.deletions ?? lines.filter((l) => l.type === 'remove').length;

  return (
    <div
      className={`mave-v2-workspace-diff-view ${className}`.trim()}
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        gap: '12px',
        overflow: 'hidden',
        color: 'var(--mave-v2-text-primary)'
      }}
      data-testid="workspace-diff-view"
    >
      {/* 1. Multi-file Tab Selector (if multiple files exist) */}
      {files.length > 1 && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            overflowX: 'auto',
            paddingBottom: '4px',
            borderBottom: '1px solid var(--mave-v2-border-subtle)'
          }}
          data-testid="diff-file-selector"
        >
          {files.map((file) => {
            const isSelected = file.path === activeFile;
            const filename = file.path.split(/[\\/]/).pop() || file.path;
            return (
              <button
                key={file.path}
                onClick={() => handleSelect(file.path)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '6px 12px',
                  borderRadius: '6px',
                  border: isSelected
                    ? '1px solid var(--mave-v2-accent-listening)'
                    : '1px solid var(--mave-v2-border-subtle)',
                  background: isSelected ? 'rgba(56, 189, 248, 0.12)' : 'rgba(255, 255, 255, 0.03)',
                  color: isSelected ? 'var(--mave-v2-accent-listening)' : 'var(--mave-v2-text-secondary)',
                  fontSize: '12px',
                  fontWeight: isSelected ? 600 : 500,
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  transition: 'all var(--mave-v2-motion-fast)'
                }}
                data-testid={`diff-tab-${filename}`}
              >
                <span>{filename}</span>
                <span
                  style={{
                    fontSize: '10px',
                    color: file.status === 'modified' ? 'var(--mave-v2-accent-warning)' : 'var(--mave-v2-accent-listening)',
                    textTransform: 'uppercase'
                  }}
                >
                  {file.status}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {/* 2. File Header: Path, Additions, Deletions, Review Affordances */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '10px 14px',
          background: 'var(--mave-v2-surface-elevated)',
          border: '1px solid var(--mave-v2-border-subtle)',
          borderRadius: 'var(--mave-v2-radius-card)'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ fontWeight: 600, fontSize: '13px', fontFamily: 'monospace' }} data-testid="diff-file-path">
            {activeFile}
          </span>
          <span style={{ fontSize: '11px', color: 'var(--mave-v2-accent-success)', fontWeight: 600 }}>
            +{additions}
          </span>
          <span style={{ fontSize: '11px', color: 'var(--mave-v2-accent-error)', fontWeight: 600 }}>
            -{deletions}
          </span>
        </div>

        {/* Review Action Intents (Prototype Mock Actions only) */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            onClick={() => onRequestRevision?.()}
            style={{
              background: 'transparent',
              border: '1px solid var(--mave-v2-border-subtle)',
              borderRadius: '6px',
              padding: '4px 10px',
              fontSize: '11px',
              color: 'var(--mave-v2-text-secondary)',
              cursor: 'pointer'
            }}
            data-testid="btn-request-revision"
          >
            Request Revision
          </button>
          <button
            onClick={() => onApproveReview?.()}
            style={{
              background: 'rgba(34, 197, 94, 0.15)',
              border: '1px solid var(--mave-v2-accent-success)',
              borderRadius: '6px',
              padding: '4px 12px',
              fontSize: '11px',
              fontWeight: 600,
              color: 'var(--mave-v2-accent-success)',
              cursor: 'pointer'
            }}
            data-testid="btn-approve-diff"
          >
            ✓ Approve Diff
          </button>
        </div>
      </div>

      {/* 3. Line-by-Line Diff Viewer */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          overflowX: 'auto',
          background: 'rgba(0, 0, 0, 0.35)',
          border: '1px solid var(--mave-v2-border-subtle)',
          borderRadius: 'var(--mave-v2-radius-card)',
          fontFamily: 'Consolas, "Fira Code", monospace',
          fontSize: '12px',
          lineHeight: '1.6'
        }}
        data-testid="diff-lines-container"
      >
        {lines.map((line, idx) => {
          const isAdd = line.type === 'add';
          const isRemove = line.type === 'remove';

          const bgColor = isAdd
            ? 'rgba(34, 197, 94, 0.12)'
            : isRemove
            ? 'rgba(239, 68, 68, 0.12)'
            : 'transparent';

          const textColor = isAdd
            ? '#86efac'
            : isRemove
            ? '#fca5a5'
            : 'var(--mave-v2-text-primary)';

          const prefix = isAdd ? '+' : isRemove ? '-' : ' ';

          return (
            <div
              key={idx}
              style={{
                display: 'flex',
                background: bgColor,
                padding: '1px 8px',
                borderLeft: isAdd
                  ? '3px solid var(--mave-v2-accent-success)'
                  : isRemove
                  ? '3px solid var(--mave-v2-accent-error)'
                  : '3px solid transparent'
              }}
              data-testid={`diff-line-${idx}`}
            >
              {/* Old Line Number */}
              <span
                style={{
                  width: '36px',
                  color: 'var(--mave-v2-text-dim)',
                  textAlign: 'right',
                  paddingRight: '8px',
                  userSelect: 'none'
                }}
              >
                {line.oldLineNumber ?? ''}
              </span>
              {/* New Line Number */}
              <span
                style={{
                  width: '36px',
                  color: 'var(--mave-v2-text-dim)',
                  textAlign: 'right',
                  paddingRight: '12px',
                  userSelect: 'none'
                }}
              >
                {line.newLineNumber ?? ''}
              </span>
              {/* Sign */}
              <span
                style={{
                  width: '16px',
                  color: textColor,
                  fontWeight: 700,
                  userSelect: 'none'
                }}
              >
                {prefix}
              </span>
              {/* Content */}
              <span style={{ color: textColor, whiteSpace: 'pre', flex: 1 }}>
                {line.text.startsWith('+') || line.text.startsWith('-')
                  ? line.text.slice(1).trimStart()
                  : line.text}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

