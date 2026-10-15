import React, { useState } from 'react';
import type { TranslationCardData } from '../types';
import { CardShell } from '../primitives/CardShell';
import { SpeakerIcon, CopyIcon, CheckIcon, ChevronUpIcon, ChevronDownIcon, DocumentIcon } from '../primitives';
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
          border: '1px solid var(--mave-line)',
          borderRadius: '8px',
          color: 'var(--mave-dim)',
          padding: '4px 10px',
          fontSize: '11px',
          cursor: 'pointer',
          fontFamily: 'var(--mave-font-mono)',
          display: 'inline-flex',
          alignItems: 'center',
          gap: '5px'
        }}
        aria-label="Listen to translation pronunciation"
        data-testid="btn-listen-translation"
      >
        <SpeakerIcon size={12} color="currentColor" />
        <span>Listen</span>
      </button>
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
          transition: 'color 150ms ease, border-color 150ms ease',
          display: 'inline-flex',
          alignItems: 'center',
          gap: '5px'
        }}
        aria-label="Copy translated text"
        data-testid="btn-copy-translation"
      >
        {copied ? (
          <>
            <CheckIcon size={12} color="currentColor" />
            <span>Copied</span>
          </>
        ) : (
          <>
            <CopyIcon size={12} color="currentColor" />
            <span>Copy</span>
          </>
        )}
      </button>
    </>
  );

  return (
    <CardShell
      id={data.id}
      badge={`Translation • ${data.targetLanguage}`}
      badgeColor="var(--mave-cyan)"
      timestamp={data.timestamp}
      actions={actionButtons}
      intent={data.intent || 'elevated'}
      density={data.density || 'standard'}
      highlighted
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {/* Original Text */}
        <div
          style={{ color: 'var(--mave-faint)', fontSize: '13px', fontStyle: 'italic' }}
          data-testid="translation-original-text"
        >
          "{data.originalText}"
        </div>

        {/* Translation Output */}
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px', flexWrap: 'wrap' }}>
          <span
            style={{ fontSize: '17px', fontWeight: 600, color: 'var(--mave-ink)', lineHeight: 1.4 }}
            data-testid="translation-translated-text"
          >
            {data.translatedText}
          </span>
          {data.pronunciation && (
            <span
              style={{ fontSize: '13px', color: 'var(--mave-dim)', fontStyle: 'italic', fontFamily: 'var(--mave-font-mono)' }}
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
              background: 'rgba(95, 210, 255, 0.08)',
              borderLeft: '2px solid var(--mave-cyan)',
              padding: '8px 12px',
              borderRadius: '0 8px 8px 0',
              fontSize: '13px'
            }}
            data-testid="translation-natural-alternative"
          >
            <span style={{ color: 'var(--mave-cyan)', fontWeight: 600, fontFamily: 'var(--mave-font-mono)', fontSize: '12px' }}>
              Natural Alternative:{' '}
            </span>
            <span style={{ color: 'var(--mave-ink)' }}>
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
              color: 'var(--mave-faint)',
              fontSize: '11px',
              cursor: 'pointer',
              textAlign: 'left',
              padding: 0,
              fontFamily: 'var(--mave-font-mono)',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px'
            }}
            data-testid="btn-toggle-translation-notes"
          >
            {showNotes ? (
              <>
                <ChevronUpIcon size={11} color="currentColor" />
                <span>Hide grammar & notes</span>
              </>
            ) : (
              <>
                <ChevronDownIcon size={11} color="currentColor" />
                <span>Show grammar & vocabulary</span>
              </>
            )}
          </button>
        )}

        {/* Grammar Note & Vocabulary (Rendered if expanded or standard density) */}
        {(showNotes || data.density !== 'compact') && (
          <div
            style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '4px' }}
            data-testid="translation-expanded-notes"
          >
            {data.grammarNote && (
              <div
                style={{
                  fontSize: '12px',
                  color: 'var(--mave-dim)',
                  background: 'rgba(0, 0, 0, 0.25)',
                  border: '1px solid var(--mave-line)',
                  borderRadius: '8px',
                  padding: '8px 12px'
                }}
                data-testid="translation-grammar-note"
              >
                <DocumentIcon size={12} color="var(--mave-cyan)" style={{ display: 'inline-block', verticalAlign: '-1px', marginRight: '6px' }} />
                <span style={{ fontStyle: 'italic' }}>{data.grammarNote}</span>
              </div>
            )}

            {data.vocabulary && data.vocabulary.length > 0 && (
              <div
                style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '2px' }}
                data-testid="translation-vocabulary-list"
              >
                {data.vocabulary.map((v, i) => (
                  <span
                    key={i}
                    style={{
                      background: 'var(--mave-raised)',
                      border: '1px solid var(--mave-line)',
                      borderRadius: '6px',
                      padding: '3px 8px',
                      fontSize: '11px',
                      color: 'var(--mave-ink)',
                      display: 'inline-flex',
                      gap: '4px',
                      fontFamily: 'var(--mave-font-mono)'
                    }}
                  >
                    <strong style={{ color: 'var(--mave-cyan)' }}>{v.term}</strong> = {v.meaning}
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
