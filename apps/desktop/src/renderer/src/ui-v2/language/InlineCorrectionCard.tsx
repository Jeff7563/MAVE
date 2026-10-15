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
        background: 'var(--mave-v2-surface-elevated)',
        border: '1px solid var(--mave-v2-border-subtle)',
        borderRadius: 'var(--mave-v2-radius-card)',
        padding: '12px 14px',
        display: 'flex',
        flexDirection: 'column',
        gap: '10px',
        color: 'var(--mave-v2-text-primary)'
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
              color: 'var(--mave-v2-accent-listening)',
              textTransform: 'uppercase',
              letterSpacing: '0.4px'
            }}
          >
            {isMultiple ? `Corrections · ${items.length}` : 'Learning Feedback'}
          </span>
          {targetLanguage && (
            <span
              style={{
                fontSize: '10px',
                color: 'var(--mave-v2-text-dim)',
                background: 'rgba(255, 255, 255, 0.04)',
                padding: '2px 6px',
                borderRadius: '4px'
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
              color: 'var(--mave-v2-text-muted)',
              textTransform: 'uppercase'
            }}
            data-testid="correction-intensity-badge"
          >
            {effectiveIntensity.toUpperCase()} GUIDANCE
          </span>
          {isMultiple && (
            <span style={{ fontSize: '11px', color: 'var(--mave-v2-text-dim)' }}>
              {isExpanded ? '▲' : '▼'}
            </span>
          )}
        </div>
      </div>

      {/* Body: List of corrections */}
      {isExpanded && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
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
                  background: 'rgba(0, 0, 0, 0.25)',
                  border: '1px solid rgba(255, 255, 255, 0.05)',
                  borderRadius: '6px',
                  padding: '10px 12px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '6px'
                }}
                data-testid={`correction-item-${item.id || idx}`}
              >
                {/* Category tag */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span
                    style={{
                      fontSize: '10px',
                      fontWeight: 600,
                      color: isGrammarError ? 'var(--mave-v2-accent-warning)' : 'var(--mave-v2-accent-listening)',
                      textTransform: 'uppercase'
                    }}
                    data-testid="correction-category"
                  >
                    {categoryLabel}
                  </span>
                </div>

                {/* What you said */}
                <div style={{ fontSize: '12px', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                  <span style={{ fontSize: '10px', color: 'var(--mave-v2-text-dim)', textTransform: 'uppercase' }}>
                    You said:
                  </span>
                  <span
                    style={{
                      color: 'var(--mave-v2-text-muted)',
                      textDecoration: 'line-through',
                      fontStyle: 'italic'
                    }}
                    data-testid="correction-original-text"
                  >
                    {item.originalText}
                  </span>
                </div>

                {/* More Natural / Correction */}
                <div style={{ fontSize: '13px', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                  <span style={{ fontSize: '10px', color: 'var(--mave-v2-accent-listening)', fontWeight: 600, textTransform: 'uppercase' }}>
                    More natural:
                  </span>
                  <span
                    style={{
                      fontWeight: 600,
                      color: 'var(--mave-v2-accent-listening)'
                    }}
                    data-testid="correction-improved-text"
                  >
                    {item.correctedText}
                  </span>
                </div>

                {/* Explanation ("Why") */}
                {item.explanation && (
                  <div style={{ fontSize: '12px', color: 'var(--mave-v2-text-secondary)', marginTop: '2px', lineHeight: 1.4 }}>
                    <strong style={{ color: 'var(--mave-v2-text-dim)', fontSize: '11px' }}>Why: </strong>
                    <span data-testid="correction-explanation">{item.explanation}</span>
                  </div>
                )}

                {/* Casual / Contextual Alternative */}
                {(item.naturalAlternative || (item.alternativePhrasings && item.alternativePhrasings.length > 0)) && (
                  <div
                    style={{
                      marginTop: '4px',
                      padding: '6px 8px',
                      background: 'rgba(255, 255, 255, 0.03)',
                      borderRadius: '4px',
                      fontSize: '11px',
                      color: 'var(--mave-v2-text-dim)'
                    }}
                  >
                    <span style={{ fontWeight: 600, color: 'var(--mave-v2-text-secondary)' }}>Alternatives: </span>
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
