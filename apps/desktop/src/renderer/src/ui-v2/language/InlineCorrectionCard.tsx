import React, { useState } from 'react';
import type { LanguageCorrection, CorrectionIntensity } from '../types';
import '../tokens.css';

export interface InlineCorrectionCardProps {
  correction?: LanguageCorrection;
  corrections?: LanguageCorrection[];
  intensity?: CorrectionIntensity;
  targetLanguage?: string;
  defaultExpanded?: boolean;
  className?: string;
}

/**
 * InlineCorrectionCard
 *
 * Supportive, contextual learning correction presentation.
 *
 * Core Philosophy (U6):
 * - Corrections should be supportive and educational, never punitive.
 * - Avoid covering the interface in red error text, score penalties, or constant warnings.
 * - "You said" -> "More natural" -> "Why" -> optional "Alternative".
 * - Distinguishes grammatically incorrect from grammatically valid but unnatural.
 * - Supports grouped display ("Corrections · 3") with progressive disclosure.
 */
export const InlineCorrectionCard: React.FC<InlineCorrectionCardProps> = ({
  correction,
  corrections,
  intensity: propsIntensity,
  targetLanguage,
  defaultExpanded = true,
  className = ''
}) => {
  const [isExpanded, setIsExpanded] = useState<boolean>(defaultExpanded);

  // Normalize single vs multiple corrections
  const items: LanguageCorrection[] = corrections && corrections.length > 0
    ? corrections
    : correction
    ? [correction]
    : [];

  if (items.length === 0) return null;

  const isMultiple = items.length > 1;
  const effectiveIntensity: CorrectionIntensity =
    propsIntensity ||
    correction?.intensity ||
    corrections?.[0]?.intensity ||
    'balanced';

  return (
    <div
      className={`mave-v2-inline-correction-card ${className}`.trim()}
      style={{
        background: 'var(--mave-glass-gradient)',
        border: '1px solid var(--mave-edge)',
        borderRadius: '20px',
        boxShadow: 'var(--mave-shadow-glass)',
        backdropFilter: 'var(--mave-backdrop-glass)',
        WebkitBackdropFilter: 'var(--mave-backdrop-glass)',
        padding: '16px 18px',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        color: 'var(--mave-ink)',
        fontFamily: 'var(--mave-font-sans)'
      }}
      data-testid="inline-correction-card"
    >
      {/* Header / Group Accordion Bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          cursor: isMultiple ? 'pointer' : 'default',
          userSelect: 'none'
        }}
        onClick={() => {
          if (isMultiple) setIsExpanded(!isExpanded);
        }}
        data-testid="correction-card-header"
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span
            style={{
              fontSize: '11px',
              fontWeight: 700,
              color: 'var(--mave-cyan)',
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              fontFamily: 'var(--mave-font-mono)'
            }}
          >
            {isMultiple ? `Corrections · ${items.length}` : 'Learning Feedback'}
          </span>
          {targetLanguage && (
            <span
              style={{
                fontSize: '10px',
                color: 'var(--mave-faint)',
                background: 'rgba(255, 255, 255, 0.04)',
                border: '1px solid var(--mave-line)',
                padding: '2px 6px',
                borderRadius: '4px',
                fontFamily: 'var(--mave-font-mono)'
              }}
            >
              {targetLanguage}
            </span>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span
            style={{
              fontSize: '10px',
              color: 'var(--mave-faint)',
              textTransform: 'uppercase',
              fontFamily: 'var(--mave-font-mono)'
            }}
            data-testid="correction-intensity-badge"
          >
            {effectiveIntensity.toUpperCase()} GUIDANCE
          </span>
          {isMultiple && (
            <span style={{ fontSize: '11px', color: 'var(--mave-dim)', fontFamily: 'var(--mave-font-mono)' }}>
              {isExpanded ? '▲' : '▼'}
            </span>
          )}
        </div>
      </div>

      {/* Body: List of corrections */}
      {isExpanded && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {items.map((item, idx) => {
            const isGrammarError = item.category === 'grammar';
            const categoryLabel = item.category === 'naturalness'
              ? 'Natural Suggestion'
              : item.category === 'vocabulary'
              ? 'Vocabulary Choice'
              : item.category === 'spelling'
              ? 'Spelling'
              : 'Grammar';

            return (
              <div
                key={item.id || idx}
                style={{
                  background: '#0a0c18',
                  border: '1px solid var(--mave-line)',
                  borderRadius: '12px',
                  padding: '12px 14px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px'
                }}
                data-testid={`correction-item-${item.id || idx}`}
              >
                {/* Category tag */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span
                    style={{
                      fontSize: '11px',
                      fontWeight: 600,
                      color: isGrammarError ? 'var(--mave-warn)' : 'var(--mave-cyan)',
                      textTransform: 'uppercase',
                      fontFamily: 'var(--mave-font-mono)'
                    }}
                    data-testid="correction-category"
                  >
                    {categoryLabel}
                  </span>
                </div>

                {/* What you said */}
                <div style={{ fontSize: '13px', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                  <span style={{ fontSize: '10px', color: 'var(--mave-faint)', textTransform: 'uppercase', fontFamily: 'var(--mave-font-mono)' }}>
                    You said:
                  </span>
                  <span
                    style={{
                      color: 'var(--mave-faint)',
                      textDecoration: 'line-through',
                      fontStyle: 'italic'
                    }}
                    data-testid="correction-original-text"
                  >
                    {item.originalText}
                  </span>
                </div>

                {/* More Natural / Correction */}
                <div style={{ fontSize: '14px', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                  <span style={{ fontSize: '10px', color: 'var(--mave-cyan)', fontWeight: 600, textTransform: 'uppercase', fontFamily: 'var(--mave-font-mono)' }}>
                    More natural:
                  </span>
                  <span
                    style={{
                      fontWeight: 600,
                      color: 'var(--mave-cyan)'
                    }}
                    data-testid="correction-improved-text"
                  >
                    {item.correctedText}
                  </span>
                </div>

                {/* Explanation ("Why") */}
                {item.explanation && (
                  <div style={{ fontSize: '13px', color: 'var(--mave-dim)', marginTop: '2px', lineHeight: 1.45 }}>
                    <strong style={{ color: 'var(--mave-faint)', fontSize: '12px' }}>Why: </strong>
                    <span data-testid="correction-explanation">{item.explanation}</span>
                  </div>
                )}

                {/* Casual / Contextual Alternative */}
                {(item.naturalAlternative || (item.alternativePhrasings && item.alternativePhrasings.length > 0)) && (
                  <div
                    style={{
                      marginTop: '4px',
                      padding: '8px 10px',
                      background: 'var(--mave-raised)',
                      border: '1px solid var(--mave-line)',
                      borderRadius: '8px',
                      fontSize: '12px',
                      color: 'var(--mave-dim)'
                    }}
                  >
                    <span style={{ fontWeight: 600, color: 'var(--mave-ink)' }}>Alternatives: </span>
                    <span data-testid="correction-alternative-text">
                      {item.naturalAlternative || item.alternativePhrasings?.join(', ')}
                    </span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
