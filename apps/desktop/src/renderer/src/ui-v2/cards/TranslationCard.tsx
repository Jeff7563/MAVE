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
  const [showNotes, setShowNotes] = useState(data.density === 'expanded');

  const hasExtraNotes = Boolean(data.grammarNote || (data.vocabulary && data.vocabulary.length > 0));

  const handleCopy = () => {
    if (onCopy) {
      onCopy(data.translatedText);
    } else if (typeof navigator !== 'undefined' && navigator.clipboard) {
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
        data-testid="btn-listen-translation"
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
        data-testid="btn-copy-translation"
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
      intent={data.intent || 'elevated'}
      density={data.density || 'standard'}
      highlighted
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {/* Original Text */}
        <div
          style={{ color: 'var(--mave-v2-text-muted)', fontSize: '12px' }}
          data-testid="translation-original-text"
        >
          "{data.originalText}"
        </div>

        {/* Translation Output */}
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', flexWrap: 'wrap' }}>
          <span
            style={{ fontSize: '15px', fontWeight: 600, color: 'var(--mave-v2-text-primary)' }}
            data-testid="translation-translated-text"
          >
            {data.translatedText}
          </span>
          {data.pronunciation && (
            <span
              style={{ fontSize: '12px', color: 'var(--mave-v2-text-dim)', fontStyle: 'italic' }}
              data-testid="translation-pronunciation"
            >
              /{data.pronunciation}/
            </span>
          )}
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
            data-testid="translation-natural-alternative"
          >
            <span style={{ color: 'var(--mave-v2-accent-listening)', fontWeight: 600 }}>
              Natural Alternative:{' '}
            </span>
            <span style={{ color: 'var(--mave-v2-text-primary)' }}>
              {data.naturalAlternative}
            </span>
          </div>
        )}

        {/* Progressive Disclosure Toggle for Educational Notes */}
        {hasExtraNotes && data.density === 'compact' && (
          <button
            onClick={() => setShowNotes(!showNotes)}
            aria-label={showNotes ? 'Hide grammar and vocabulary notes' : 'Show grammar and vocabulary notes'}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--mave-v2-text-dim)',
              fontSize: '11px',
              cursor: 'pointer',
              textAlign: 'left',
              padding: 0
            }}
            data-testid="btn-toggle-translation-notes"
          >
            {showNotes ? '▲ Hide grammar & notes' : '▼ Show grammar & vocabulary'}
          </button>
        )}

        {/* Grammar Note & Vocabulary (Rendered if expanded or standard density) */}
        {(showNotes || data.density !== 'compact') && (
          <div
            style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '2px' }}
            data-testid="translation-expanded-notes"
          >
            {data.grammarNote && (
              <div
                style={{ fontSize: '11px', color: 'var(--mave-v2-text-secondary)' }}
                data-testid="translation-grammar-note"
              >
                💡 <span style={{ fontStyle: 'italic' }}>{data.grammarNote}</span>
              </div>
            )}

            {data.vocabulary && data.vocabulary.length > 0 && (
              <div
                style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '2px' }}
                data-testid="translation-vocabulary-list"
              >
                {data.vocabulary.map((v, i) => (
                  <span
                    key={i}
                    style={{
                      background: 'rgba(255, 255, 255, 0.06)',
                      borderRadius: '12px',
                      padding: '2px 8px',
                      fontSize: '10px',
                      color: 'var(--mave-v2-text-secondary)',
                      border: '1px solid var(--mave-v2-border-subtle)'
                    }}
                  >
                    <strong style={{ color: 'var(--mave-v2-text-primary)' }}>{v.term}</strong> = {v.meaning}
                  </span>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </CardShell>
  );
};
