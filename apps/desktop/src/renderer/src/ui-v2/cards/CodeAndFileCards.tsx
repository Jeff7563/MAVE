import React, { useState } from 'react';
import type { FileCardData, CodeCardData, DiffCardData, DiffLine } from '../types';
import { CardShell } from '../primitives/CardShell';
import '../tokens.css';

export interface FileCardProps {
  data: FileCardData;
  onInspect?: (path: string) => void;
}

/**
 * FileCard
 *
 * Represents an artifact, file reference, or modified file.
 * Features:
 * - Clean synthetic breadcrumb path display without leaking machine-specific paths
 * - File type badge
 * - Modification metrics if present
 * - Safe preview snippet
 * - Inspect file action
 */
export const FileCard: React.FC<FileCardProps> = ({ data, onInspect }) => {
  const filename = data.path.split(/[\\/]/).pop() || data.path;

  return (
    <CardShell
      id={data.id}
      badge={data.fileType.toUpperCase()}
      badgeColor="var(--mave-v2-accent-listening)"
      title={filename}
      timestamp={data.linesModified ? `${data.linesModified} lines modified` : undefined}
      intent={data.intent || 'default'}
      density={data.density || 'standard'}
      actions={
        onInspect ? (
          <button
            onClick={() => onInspect(data.path)}
            style={{
              background: 'transparent',
              border: '1px solid var(--mave-v2-border-subtle)',
              borderRadius: '4px',
              color: 'var(--mave-v2-accent-listening)',
              padding: '3px 8px',
              fontSize: '11px',
              cursor: 'pointer'
            }}
            aria-label={`Inspect file ${filename}`}
            data-testid="btn-inspect-file"
          >
            Inspect File
          </button>
        ) : undefined
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }} data-testid="file-card">
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px' }}>
          <span aria-hidden="true">📄</span>
          <span style={{ fontWeight: 600, color: 'var(--mave-v2-text-primary)' }}>
            {filename}
          </span>
          <span
            style={{
              color: 'var(--mave-v2-text-dim)',
              fontSize: '11px',
              fontFamily: 'Consolas, monospace'
            }}
            data-testid="file-path-breadcrumb"
          >
            {data.path}
          </span>
        </div>

        {data.previewSnippet && (
          <pre
            style={{
              margin: 0,
              padding: '8px 10px',
              background: 'rgba(0, 0, 0, 0.4)',
              borderRadius: '6px',
              fontSize: '11px',
              color: 'var(--mave-v2-text-secondary)',
              overflowX: 'auto',
              fontFamily: 'Consolas, Monaco, monospace',
              lineHeight: 1.45,
              border: '1px solid var(--mave-v2-border-subtle)'
            }}
            data-testid="file-preview-snippet"
          >
            {data.previewSnippet}
          </pre>
        )}
      </div>
    </CardShell>
  );
};

export interface CodeCardProps {
  data: CodeCardData;
  onCopy?: (code: string) => void;
}

/**
 * CodeCard
 *
 * Syntax-oriented code snippet presentation.
 * Features:
 * - Language badge
 * - Safe clipboard copy with feedback
 * - Optional line numbers
 * - Optional explanation note
 * - Escaped safe code display (never raw HTML)
 */
export const CodeCard: React.FC<CodeCardProps> = ({ data, onCopy }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    if (onCopy) {
      onCopy(data.code);
    } else if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(data.code).catch(() => {});
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const codeLines = data.code.split('\n');

  return (
    <CardShell
      id={data.id}
      badge={data.language}
      badgeColor="var(--mave-v2-accent-thinking)"
      title={data.filename}
      intent={data.intent || 'default'}
      density={data.density || 'standard'}
      actions={
        <button
          onClick={handleCopy}
          style={{
            background: 'transparent',
            border: '1px solid var(--mave-v2-border-subtle)',
            borderRadius: '4px',
            color: copied ? 'var(--mave-v2-accent-success)' : 'var(--mave-v2-text-secondary)',
            padding: '3px 8px',
            fontSize: '11px',
            cursor: 'pointer',
            transition: 'color var(--mave-v2-motion-fast)'
          }}
          aria-label="Copy code to clipboard"
          data-testid="btn-copy-code"
        >
          {copied ? '✓ Copied' : '📋 Copy Code'}
        </button>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }} data-testid="code-card">
        {data.explanation && (
          <div
            style={{
              fontSize: '12px',
              color: 'var(--mave-v2-text-secondary)',
              lineHeight: 1.45
            }}
            data-testid="code-explanation"
          >
            {data.explanation}
          </div>
        )}

        <div
          style={{
            background: 'rgba(0, 0, 0, 0.45)',
            borderRadius: '6px',
            overflowX: 'auto',
            border: '1px solid var(--mave-v2-border-subtle)',
            padding: '8px 10px'
          }}
        >
          <pre
            style={{
              margin: 0,
              fontSize: '12px',
              fontFamily: 'Consolas, Monaco, "Courier New", monospace',
              lineHeight: 1.5,
              color: '#e2e8f0'
            }}
          >
            {data.lineNumbers ? (
              <table style={{ borderCollapse: 'collapse', width: '100%' }} data-testid="code-table-with-lines">
                <tbody>
                  {codeLines.map((line, idx) => (
                    <tr key={idx}>
                      <td
                        style={{
                          width: '32px',
                          color: 'var(--mave-v2-text-dim)',
                          userSelect: 'none',
                          textAlign: 'right',
                          paddingRight: '12px',
                          fontSize: '11px'
                        }}
                        data-testid="line-number"
                      >
                        {idx + 1}
                      </td>
                      <td style={{ whiteSpace: 'pre', color: '#e2e8f0' }}>
                        <code>{line}</code>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <code>{data.code}</code>
            )}
          </pre>
        </div>
      </div>
    </CardShell>
  );
};

export interface DiffCardProps {
  data: DiffCardData;
  onInspect?: (path: string) => void;
  onOpenWorkspace?: () => void;
}

/**
 * DiffCard
 *
 * Structured file modification diff presentation.
 * Features:
 * - Additions/deletions badge (+N in green, -N in red)
 * - Compact summary preview with progressive disclosure toggle
 * - Accessible diff line semantics (data-type="add" | "remove" | "context")
 * - Large diff escalation affordance (Workspace eligibility)
 * - Safe text rendering (no unescaped markup)
 */
export const DiffCard: React.FC<DiffCardProps> = ({ data, onInspect, onOpenWorkspace }) => {
  const [isExpanded, setIsExpanded] = useState<boolean>(data.defaultExpanded ?? false);
  // U3/U4 Architectural Clarification: Large Diff Threshold
  // The threshold (>40 modifications) is an implementation-local prototype heuristic fallback.
  // Canonical rule: Diff inspection that requires sustained structured interaction is Workspace-eligible;
  // small/medium inspectable diffs remain directly inside Conversation or Chat-only.
  const DEFAULT_LARGE_DIFF_FALLBACK = 40;
  const totalModifications = data.additions + data.deletions;
  const isLargeDiff = totalModifications > DEFAULT_LARGE_DIFF_FALLBACK;

  // Render diff lines safely
  const renderLines = (lines: DiffLine[]) => {
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          fontFamily: 'Consolas, Monaco, "Courier New", monospace',
          fontSize: '11px',
          lineHeight: 1.5,
          background: 'rgba(0, 0, 0, 0.45)',
          borderRadius: '6px',
          overflowX: 'auto',
          border: '1px solid var(--mave-v2-border-subtle)'
        }}
        data-testid="diff-lines-container"
      >
        {lines.map((line, idx) => {
          let lineBg = 'transparent';
          let textColor = 'var(--mave-v2-text-secondary)';
          let prefix = ' ';

          if (line.type === 'add') {
            lineBg = 'rgba(34, 197, 94, 0.12)';
            textColor = '#4ade80';
            prefix = '+';
          } else if (line.type === 'remove') {
            lineBg = 'rgba(239, 68, 68, 0.12)';
            textColor = '#f87171';
            prefix = '-';
          }

          return (
            <div
              key={idx}
              data-type={line.type}
              data-testid={`diff-line-${line.type}`}
              style={{
                display: 'flex',
                alignItems: 'center',
                background: lineBg,
                padding: '2px 8px',
                borderBottom: '1px solid rgba(255, 255, 255, 0.02)'
              }}
            >
              <div
                style={{
                  display: 'flex',
                  gap: '6px',
                  width: '56px',
                  color: 'var(--mave-v2-text-dim)',
                  userSelect: 'none',
                  fontSize: '10px'
                }}
              >
                <span style={{ width: '24px', textAlign: 'right' }}>
                  {line.oldLineNumber ?? ''}
                </span>
                <span style={{ width: '24px', textAlign: 'right' }}>
                  {line.newLineNumber ?? ''}
                </span>
              </div>
              <span
                style={{
                  width: '14px',
                  textAlign: 'center',
                  color: textColor,
                  fontWeight: 700,
                  userSelect: 'none'
                }}
              >
                {prefix}
              </span>
              <span style={{ color: textColor, whiteSpace: 'pre' }}>
                {line.text}
              </span>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <CardShell
      id={data.id}
      badge="DIFF"
      badgeColor="var(--mave-v2-accent-thinking)"
      title={data.filename}
      intent={data.intent || 'default'}
      density={data.density || 'standard'}
      actions={
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {isLargeDiff && onOpenWorkspace && (
            <button
              onClick={onOpenWorkspace}
              style={{
                background: 'rgba(56, 189, 248, 0.12)',
                border: '1px solid rgba(56, 189, 248, 0.3)',
                borderRadius: '4px',
                color: 'var(--mave-v2-accent-listening)',
                padding: '3px 8px',
                fontSize: '11px',
                cursor: 'pointer'
              }}
              data-testid="btn-open-diff-workspace"
              aria-label="Inspect large diff in Workspace"
            >
              Open in Workspace ⤢
            </button>
          )}

          {data.path && onInspect && (
            <button
              onClick={() => onInspect(data.path!)}
              style={{
                background: 'transparent',
                border: '1px solid var(--mave-v2-border-subtle)',
                borderRadius: '4px',
                color: 'var(--mave-v2-text-secondary)',
                padding: '3px 8px',
                fontSize: '11px',
                cursor: 'pointer'
              }}
              data-testid="btn-inspect-diff-file"
            >
              Inspect File
            </button>
          )}

          {(data.lines || data.compactPreview) && (
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              style={{
                background: 'transparent',
                border: '1px solid var(--mave-v2-border-subtle)',
                borderRadius: '4px',
                color: 'var(--mave-v2-text-secondary)',
                padding: '3px 8px',
                fontSize: '11px',
                cursor: 'pointer'
              }}
              data-testid="btn-toggle-diff-expand"
              aria-expanded={isExpanded}
            >
              {isExpanded ? '▲ Hide Diff' : '▼ Show Full Diff'}
            </button>
          )}
        </div>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }} data-testid="diff-card">
        {/* Metric summary header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontWeight: 600, color: 'var(--mave-v2-text-primary)' }}>
              {data.filename}
            </span>
            {data.path && (
              <span style={{ color: 'var(--mave-v2-text-dim)', fontSize: '11px' }}>
                ({data.path})
              </span>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 600, fontSize: '11px' }}>
            <span
              style={{
                color: '#4ade80',
                background: 'rgba(34, 197, 94, 0.1)',
                padding: '1px 6px',
                borderRadius: '4px'
              }}
              data-testid="diff-additions-badge"
            >
              +{data.additions}
            </span>
            <span
              style={{
                color: '#f87171',
                background: 'rgba(239, 68, 68, 0.1)',
                padding: '1px 6px',
                borderRadius: '4px'
              }}
              data-testid="diff-deletions-badge"
            >
              -{data.deletions}
            </span>
          </div>
        </div>

        {/* Compact preview (rendered when collapsed) */}
        {!isExpanded && data.compactPreview && data.compactPreview.length > 0 && (
          <div
            style={{
              padding: '6px 10px',
              background: 'rgba(0, 0, 0, 0.3)',
              borderRadius: '6px',
              fontSize: '11px',
              fontFamily: 'Consolas, Monaco, monospace',
              color: 'var(--mave-v2-text-secondary)',
              border: '1px solid rgba(255, 255, 255, 0.04)'
            }}
            data-testid="diff-compact-preview"
          >
            {data.compactPreview.map((line, idx) => (
              <div key={idx} style={{ whiteSpace: 'pre' }}>
                {line}
              </div>
            ))}
          </div>
        )}

        {/* Full diff lines (rendered when expanded) */}
        {isExpanded && data.lines && data.lines.length > 0 && renderLines(data.lines)}
      </div>
    </CardShell>
  );
};
