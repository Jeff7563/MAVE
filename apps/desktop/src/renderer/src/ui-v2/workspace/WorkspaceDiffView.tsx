import React, { useState } from 'react';
import type { DiffCardData, WorkspaceFile } from '../types';
import { CheckIcon, CloseIcon } from '../primitives/Icons';
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
        minWidth: 0,
        minHeight: 0,
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
            scrollbarWidth: 'none',
            paddingBottom: '4px',
            borderBottom: '1px solid var(--mave-v2-border-subtle)',
            flexShrink: 0
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
          padding: '10px 16px',
          background: 'rgba(18, 22, 38, 0.75)',
          backdropFilter: 'blur(16px)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          borderRadius: '12px',
          minWidth: 0,
          gap: '12px',
          flexWrap: 'wrap'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0, flex: '1 1 auto', overflow: 'hidden' }}>
          <span
            style={{
              fontWeight: 600,
              fontSize: '13px',
              fontFamily: 'monospace',
              color: '#f8fafc',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              minWidth: 0
            }}
            data-testid="diff-file-path"
            title={activeFile}
          >
            {activeFile}
          </span>
          <span style={{ fontSize: '11px', color: '#4ade80', fontWeight: 600, flexShrink: 0 }}>
            +{additions}
          </span>
          <span style={{ fontSize: '11px', color: '#f87171', fontWeight: 600, flexShrink: 0 }}>
            -{deletions}
          </span>
          <span
            style={{
              fontSize: '11px',
              color: '#38bdf8',
              background: 'rgba(56, 189, 248, 0.1)',
              border: '1px solid rgba(56, 189, 248, 0.25)',
              borderRadius: '9999px',
              padding: '2px 8px',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              flexShrink: 0
            }}
            data-testid="diff-tests-passing"
          >
            <CheckIcon size={11} color="#38bdf8" strokeWidth={2.5} /> 12 / 12 passed
          </span>
        </div>

        {/* Review Action Intents (Prototype Mock Actions only) */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0, minWidth: 0 }}>
          <button
            onClick={() => onRequestRevision?.()}
            style={{
              background: 'rgba(255, 255, 255, 0.04)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: '6px',
              padding: '5px 12px',
              fontSize: '11px',
              color: 'rgba(226, 232, 240, 0.85)',
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
              border: '1px solid rgba(34, 197, 94, 0.4)',
              borderRadius: '6px',
              padding: '5px 14px',
              fontSize: '11px',
              fontWeight: 600,
              color: '#4ade80',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '5px'
            }}
            data-testid="btn-approve-diff"
          >
            <CheckIcon size={12} color="#4ade80" strokeWidth={2.5} />
            <span>Approve Diff</span>
          </button>
        </div>
      </div>

      {/* Inline Diagnostic Error Callout (Showcase v3 • CODE) */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: 'rgba(239, 68, 68, 0.08)',
          border: '1px solid rgba(239, 68, 68, 0.3)',
          borderRadius: '8px',
          padding: '8px 14px',
          fontSize: '12px',
          color: '#fca5a5',
          minWidth: 0,
          gap: '8px',
          flexWrap: 'wrap'
        }}
        data-testid="workspace-code-diagnostic"
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0, flex: '1 1 auto' }}>
          <CloseIcon size={12} color="#ef4444" strokeWidth={2.5} style={{ flexShrink: 0 }} />
          <span style={{ fontFamily: 'monospace', fontWeight: 600, flexShrink: 0 }}>TS2322:</span>
          <span style={{ minWidth: 0, overflowWrap: 'anywhere' }}>Type &apos;string&apos; is not assignable to type &apos;number&apos;.</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
          <span
            style={{
              background: 'rgba(56, 189, 248, 0.15)',
              border: '1px solid rgba(56, 189, 248, 0.3)',
              color: '#38bdf8',
              borderRadius: '9999px',
              padding: '2px 8px',
              fontSize: '11px',
              fontWeight: 500,
              cursor: 'pointer'
            }}
          >
            ✦ Fix with MAVE
          </span>
          <span
            style={{
              background: 'rgba(255, 255, 255, 0.05)',
              color: 'rgba(148, 163, 184, 0.8)',
              borderRadius: '9999px',
              padding: '2px 8px',
              fontSize: '11px',
              cursor: 'pointer'
            }}
          >
            Ignore
          </span>
        </div>
      </div>

      {/* 3. Line-by-Line Diff Viewer */}
      <div
        className="mave-custom-scrollbar"
        style={{
          flex: 1,
          minHeight: 0,
          minWidth: 0,
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

