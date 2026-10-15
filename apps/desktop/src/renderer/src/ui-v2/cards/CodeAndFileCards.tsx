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
  const extension = data.fileType || filename.split('.').pop() || 'FILE';

  return (
    <CardShell
      id={data.id}
      badge={extension.toUpperCase()}
      badgeColor="var(--mave-cyan)"
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
              border: '1px solid var(--mave-line)',
              borderRadius: '8px',
              color: 'var(--mave-cyan)',
              padding: '4px 10px',
              fontSize: '11px',
              cursor: 'pointer',
              fontFamily: 'var(--mave-font-mono)',
              fontWeight: 500
            }}
            aria-label={`Inspect file ${filename}`}
            data-testid="btn-inspect-file"
          >
            Inspect File
          </button>
        ) : undefined
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }} data-testid="file-card">
        {/* UI Kit File Row */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            padding: '10px 12px',
            borderRadius: '12px',
            background: 'var(--mave-raised)',
            border: '1px solid var(--mave-line)'
          }}
        >
          {/* Mini Format Badge */}
          <div
            style={{
              width: '32px',
              height: '40px',
              borderRadius: '6px',
              border: '1px solid rgba(255, 255, 255, 0.15)',
              display: 'flex',
              alignItems: 'flex-end',
              justifyContent: 'center',
              paddingBottom: '4px',
              boxSizing: 'border-box',
              fontFamily: 'var(--mave-font-mono)',
              fontSize: '8px',
              color: 'var(--mave-dim)',
              textTransform: 'uppercase'
            }}
          >
            {extension.slice(0, 4)}
          </div>

          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '2px', minWidth: 0 }}>
            <span style={{ fontWeight: 600, fontSize: '14px', color: 'var(--mave-ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {filename}
            </span>
            <span
              style={{
                color: 'var(--mave-faint)',
                fontSize: '11px',
                fontFamily: 'var(--mave-font-mono)',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap'
              }}
              data-testid="file-path-breadcrumb"
            >
              {data.path}
            </span>
          </div>

          <div
            style={{
              fontFamily: 'var(--mave-font-mono)',
              fontSize: '11px',
              letterSpacing: '0.12em',
              color: 'var(--mave-cyan)',
              flexShrink: 0
            }}
          >
            {data.linesModified ? `${data.linesModified} lines modified` : 'LATEST'}
          </div>
        </div>

        {data.previewSnippet && (
          <pre
            style={{
              margin: 0,
              padding: '10px 12px',
              background: '#0a0c18',
              borderRadius: '10px',
              fontSize: '12px',
              color: 'var(--mave-dim)',
              overflowX: 'auto',
              fontFamily: 'var(--mave-font-mono)',
              lineHeight: 1.5,
              border: '1px solid var(--mave-line)'
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
      badgeColor="var(--mave-cyan)"
      title={data.filename}
      intent={data.intent || 'default'}
      density={data.density || 'standard'}
      actions={
        <button
          onClick={handleCopy}
          style={{
            background: 'transparent',
            border: '1px solid var(--mave-line)',
            borderRadius: '8px',
            color: copied ? 'var(--mave-ok)' : 'var(--mave-dim)',
            padding: '4px 10px',
            fontSize: '11px',
            cursor: 'pointer',
            fontFamily: 'var(--mave-font-mono)',
            transition: 'color 150ms ease, border-color 150ms ease'
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
              fontSize: '13px',
              color: 'var(--mave-dim)',
              lineHeight: 1.45
            }}
            data-testid="code-explanation"
          >
            {data.explanation}
          </div>
        )}

        <div
          style={{
            background: '#0a0c18',
            borderRadius: '12px',
            overflowX: 'auto',
            border: '1px solid var(--mave-line)',
            padding: '10px 0'
          }}
        >
          <pre
            style={{
              margin: 0,
              fontSize: '13px',
              fontFamily: 'var(--mave-font-mono)',
              lineHeight: 1.55,
              color: '#c9cde8'
            }}
          >
            {data.lineNumbers ? (
              <table style={{ borderCollapse: 'collapse', width: '100%' }} data-testid="code-table-with-lines">
                <tbody>
                  {codeLines.map((line, idx) => (
                    <tr key={idx} style={{ height: '24px' }}>
                      <td
                        style={{
                          width: '36px',
                          color: 'var(--mave-faint)',
                          userSelect: 'none',
                          textAlign: 'right',
                          paddingRight: '14px',
                          fontSize: '12px'
                        }}
                        data-testid="line-number"
                      >
                        {idx + 1}
                      </td>
                      <td style={{ whiteSpace: 'pre', color: '#c9cde8', paddingRight: '14px' }}>
                        <code>{line}</code>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div style={{ padding: '0 14px' }}>
                <code>{data.code}</code>
              </div>
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
          fontFamily: 'var(--mave-font-mono)',
          fontSize: '12px',
          lineHeight: 1.55,
          background: '#0a0c18',
          borderRadius: '12px',
          overflowX: 'auto',
          border: '1px solid var(--mave-line)'
        }}
        data-testid="diff-lines-container"
      >
        {lines.map((line, idx) => {
          let lineBg = 'transparent';
          let textColor = 'var(--mave-dim)';
          let prefix = ' ';

          if (line.type === 'add') {
            lineBg = 'rgba(95, 224, 168, 0.09)';
            textColor = '#5fe0a8';
            prefix = '+';
          } else if (line.type === 'remove') {
            lineBg = 'rgba(255, 122, 133, 0.08)';
            textColor = '#ff7a85';
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
                padding: '3px 12px',
                borderBottom: '1px solid rgba(255, 255, 255, 0.02)'
              }}
            >
              <div
                style={{
                  display: 'flex',
                  gap: '8px',
                  width: '60px',
                  color: 'var(--mave-faint)',
                  userSelect: 'none',
                  fontSize: '11px'
                }}
              >
                <span style={{ width: '26px', textAlign: 'right' }}>
                  {line.oldLineNumber ?? ''}
                </span>
                <span style={{ width: '26px', textAlign: 'right' }}>
                  {line.newLineNumber ?? ''}
                </span>
              </div>
              <span
                style={{
                  width: '16px',
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
      badgeColor="var(--mave-cyan)"
      title={data.filename}
      intent={data.intent || 'default'}
      density={data.density || 'standard'}
      actions={
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {isLargeDiff && onOpenWorkspace && (
            <button
              onClick={onOpenWorkspace}
              style={{
                background: 'rgba(91, 132, 255, 0.14)',
                border: '1px solid rgba(91, 132, 255, 0.35)',
                borderRadius: '8px',
                color: 'var(--mave-cyan)',
                padding: '4px 12px',
                fontSize: '11px',
                cursor: 'pointer',
                fontFamily: 'var(--mave-font-mono)',
                fontWeight: 500
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
                border: '1px solid var(--mave-line)',
                borderRadius: '8px',
                color: 'var(--mave-dim)',
                padding: '4px 10px',
                fontSize: '11px',
                cursor: 'pointer',
                fontFamily: 'var(--mave-font-mono)'
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
                border: '1px solid var(--mave-line)',
                borderRadius: '8px',
                color: 'var(--mave-dim)',
                padding: '4px 10px',
                fontSize: '11px',
                cursor: 'pointer',
                fontFamily: 'var(--mave-font-mono)'
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
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '13px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontWeight: 600, color: 'var(--mave-ink)' }}>
              {data.filename}
            </span>
            {data.path && (
              <span style={{ color: 'var(--mave-faint)', fontSize: '11px', fontFamily: 'var(--mave-font-mono)' }}>
                ({data.path})
              </span>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 600, fontSize: '11px', fontFamily: 'var(--mave-font-mono)' }}>
            <span
              style={{
                color: '#5fe0a8',
                background: 'rgba(95, 224, 168, 0.12)',
                padding: '2px 8px',
                borderRadius: '6px'
              }}
              data-testid="diff-additions-badge"
            >
              +{data.additions}
            </span>
            <span
              style={{
                color: '#ff7a85',
                background: 'rgba(255, 122, 133, 0.12)',
                padding: '2px 8px',
                borderRadius: '6px'
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
              padding: '8px 12px',
              background: '#0a0c18',
              borderRadius: '10px',
              fontSize: '12px',
              fontFamily: 'var(--mave-font-mono)',
              color: 'var(--mave-dim)',
              border: '1px solid var(--mave-line)'
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
