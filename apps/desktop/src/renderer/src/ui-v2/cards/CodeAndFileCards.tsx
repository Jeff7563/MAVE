import React, { useState } from 'react';
import type { FileCardData, CodeCardData } from '../types';
import { CardShell } from '../primitives/CardShell';
import '../tokens.css';

export interface FileCardProps {
  data: FileCardData;
}

export const FileCard: React.FC<FileCardProps> = ({ data }) => {
  return (
    <CardShell
      id={data.id}
      badge={data.fileType.toUpperCase()}
      badgeColor="var(--mave-v2-accent-listening)"
      title={data.path}
      timestamp={data.linesModified ? `${data.linesModified} lines modified` : undefined}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px' }}>
          <span>📄</span>
          <span style={{ fontWeight: 600, color: 'var(--mave-v2-text-primary)' }}>
            {data.path.split(/[\\/]/).pop()}
          </span>
          <span style={{ color: 'var(--mave-v2-text-dim)', fontSize: '11px' }}>
            ({data.path})
          </span>
        </div>
        {data.previewSnippet && (
          <pre
            style={{
              margin: 0,
              padding: '8px',
              background: 'rgba(0, 0, 0, 0.35)',
              borderRadius: '6px',
              fontSize: '11px',
              color: 'var(--mave-v2-text-secondary)',
              overflowX: 'auto',
              fontFamily: 'Consolas, monospace'
            }}
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
}

export const CodeCard: React.FC<CodeCardProps> = ({ data }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(data.code);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <CardShell
      id={data.id}
      badge={data.language}
      badgeColor="var(--mave-v2-accent-thinking)"
      title={data.filename}
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
            cursor: 'pointer'
          }}
          aria-label="Copy code block"
        >
          {copied ? '✓ Copied' : '📋 Copy Code'}
        </button>
      }
    >
      <pre
        style={{
          margin: 0,
          padding: '10px',
          background: 'rgba(0, 0, 0, 0.45)',
          borderRadius: '6px',
          fontSize: '12px',
          color: '#e2e8f0',
          overflowX: 'auto',
          fontFamily: 'Consolas, Monaco, monospace',
          lineHeight: 1.45
        }}
      >
        <code>{data.code}</code>
      </pre>
    </CardShell>
  );
};

