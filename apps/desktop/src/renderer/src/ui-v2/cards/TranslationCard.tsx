import React, { useState } from 'react';
import type { TranslationCardData } from '../types';
import { CardShell } from '../primitives/CardShell';
import '../tokens.css';

export interface TranslationCardProps {
  data: TranslationCardData;
  onListen?: (text: string) => void;
  onCopy?: (text: string) => void;
}

export const TranslationCard: React.FC<TranslationCardProps> = ({
  data,
  onListen,
  onCopy
}) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    if (onCopy) {
      onCopy(data.translatedText);
    } else if (navigator.clipboard) {
      navigator.clipboard.writeText(data.translatedText);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const actionButtons = (
    <>
      <button
        onClick={() => onListen?.(data.translatedText)}
        style={{
          background: 'transparent',
          border: '1px solid var(--mave-v2-border-subtle)',
          borderRadius: '4px',
          color: 'var(--mave-v2-text-secondary)',
          padding: '4px 8px',
          fontSize: '11px',
          cursor: 'pointer'
        }}
        aria-label="Listen to translation pronunciation"
      >
        🔊 Listen
      </button>
      <button
        onClick={handleCopy}
        style={{
          background: 'transparent',
          border: '1px solid var(--mave-v2-border-subtle)',
          borderRadius: '4px',
          color: copied ? 'var(--mave-v2-accent-success)' : 'var(--mave-v2-text-secondary)',
          padding: '4px 8px',
          fontSize: '11px',
          cursor: 'pointer'
        }}
        aria-label="Copy translated text"
      >
        {copied ? '✓ Copied' : '📋 Copy'}
      </button>
    </>
  );

  return (
    <CardShell
      id={data.id}
      badge={`Translation • ${data.targetLanguage}`}
      badgeColor="var(--mave-v2-accent-listening)"
      timestamp={data.timestamp}
      actions={actionButtons}
      highlighted
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {/* Original Text */}
        <div style={{ color: 'var(--mave-v2-text-muted)', fontSize: '12px' }}>
          "{data.originalText}"
        </div>

        {/* Translation Output */}
        <div style={{ fontSize: '15px', fontWeight: 600, color: 'var(--mave-v2-text-primary)' }}>
          {data.translatedText}
        </div>

        {/* Natural Alternative */}
        {data.naturalAlternative && (
          <div
            style={{
              background: 'rgba(56, 189, 248, 0.08)',
              borderLeft: '2px solid var(--mave-v2-accent-listening)',
              padding: '6px 10px',
              borderRadius: '0 6px 6px 0',
              fontSize: '12px'
            }}
          >
            <span style={{ color: 'var(--mave-v2-accent-listening)', fontWeight: 600 }}>
              Natural Alternative:{' '}
            </span>
            <span style={{ color: 'var(--mave-v2-text-primary)' }}>
              {data.naturalAlternative}
            </span>
          </div>
        )}

        {/* Grammar Note */}
        {data.grammarNote && (
          <div style={{ fontSize: '11px', color: 'var(--mave-v2-text-secondary)' }}>
            💡 <span style={{ fontStyle: 'italic' }}>{data.grammarNote}</span>
          </div>
        )}

        {/* Vocabulary Pills */}
        {data.vocabulary && data.vocabulary.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '4px' }}>
            {data.vocabulary.map((v, i) => (
              <span
                key={i}
                style={{
                  background: 'rgba(255, 255, 255, 0.06)',
                  borderRadius: '12px',
                  padding: '2px 8px',
                  fontSize: '11px',
                  color: 'var(--mave-v2-text-secondary)'
                }}
              >
                <strong style={{ color: 'var(--mave-v2-text-primary)' }}>{v.term}</strong> = {v.meaning}
              </span>
            ))}
          </div>
        )}
      </div>
    </CardShell>
  );
};

