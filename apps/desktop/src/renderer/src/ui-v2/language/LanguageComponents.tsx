import React, { useState } from 'react';
import type {
  RoleplayScenario,
  PronunciationGuideItem,
  LanguageVocabularyItem,
  LanguageSessionSummary
} from '../types';
import '../tokens.css';

/**
 * RoleplayBanner
 *
 * Clearly marks that MAVE is speaking as an in-scenario persona (e.g. Barista)
 * while ensuring MAVE remains MAVE and roleplay remains fully escapable.
 */
export interface RoleplayBannerProps {
  scenario: RoleplayScenario;
  onStepOutOfRole?: () => void;
  onResumeRoleplay?: () => void;
  className?: string;
}

export const RoleplayBanner: React.FC<RoleplayBannerProps> = ({
  scenario,
  onStepOutOfRole,
  onResumeRoleplay,
  className = ''
}) => {
  const isOutOfRole = Boolean(scenario.isOutOfRole);
  const assistantRole = scenario.assistantRole || scenario.role;
  const scenarioTitle = scenario.title || 'Roleplay Scenario';
  const situation = scenario.situation || scenario.goal || scenario.setting;
  const location = scenario.location || scenario.setting;

  return (
    <div
      className={`mave-v2-roleplay-banner ${className}`.trim()}
      style={{
        background: isOutOfRole
          ? 'linear-gradient(135deg, rgba(245, 158, 11, 0.12) 0%, rgba(245, 158, 11, 0.05) 100%)'
          : 'linear-gradient(135deg, rgba(2, 132, 199, 0.12) 0%, rgba(56, 189, 248, 0.05) 100%)',
        border: isOutOfRole
          ? '1px solid rgba(245, 158, 11, 0.3)'
          : '1px solid rgba(56, 189, 248, 0.25)',
        borderRadius: 'var(--mave-v2-radius-card)',
        padding: '12px 16px',
        display: 'flex',
        flexDirection: 'column',
        gap: '6px'
      }}
      data-testid="roleplay-scenario-banner"
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span
            style={{
              fontSize: '10px',
              fontWeight: 700,
              color: isOutOfRole ? 'var(--mave-v2-accent-warning)' : 'var(--mave-v2-accent-listening)',
              textTransform: 'uppercase',
              letterSpacing: '0.5px'
            }}
          >
            {isOutOfRole ? 'Roleplay Paused (MAVE Direct)' : 'Roleplay Active'}
          </span>
          {location && (
            <span style={{ fontSize: '11px', color: 'var(--mave-v2-text-dim)' }}>
              • {location}
            </span>
          )}
        </div>

        <div>
          {isOutOfRole ? (
            <button
              onClick={onResumeRoleplay}
              style={{
                background: 'rgba(56, 189, 248, 0.15)',
                border: '1px solid var(--mave-v2-accent-listening)',
                borderRadius: '4px',
                color: 'var(--mave-v2-accent-listening)',
                fontSize: '11px',
                padding: '3px 8px',
                cursor: 'pointer',
                fontWeight: 600
              }}
              data-testid="btn-resume-roleplay"
            >
              Resume Roleplay
            </button>
          ) : (
            <button
              onClick={onStepOutOfRole}
              style={{
                background: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid var(--mave-v2-border-subtle)',
                borderRadius: '4px',
                color: 'var(--mave-v2-text-secondary)',
                fontSize: '11px',
                padding: '3px 8px',
                cursor: 'pointer'
              }}
              data-testid="btn-step-out-of-role"
              title="Ask MAVE to explain or step out of role anytime"
            >
              Step out of role
            </button>
          )}
        </div>
      </div>

      {scenarioTitle && (
        <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--mave-v2-text-primary)' }}>
          {scenarioTitle}
        </div>
      )}

      {isOutOfRole ? (
        <div style={{ fontSize: '12px', color: 'var(--mave-v2-accent-warning)', lineHeight: 1.4 }}>
          MAVE speaking directly as coach. You can ask for grammar explanations, vocabulary clarification, or strategy before resuming.
        </div>
      ) : (
        <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--mave-v2-text-primary)' }}>
          MAVE as <span style={{ color: 'var(--mave-v2-accent-listening)' }}>{assistantRole}</span> (You: {scenario.userRole})
        </div>
      )}

      {situation && (
        <div style={{ fontSize: '12px', color: 'var(--mave-v2-text-secondary)', lineHeight: 1.4 }}>
          {situation}
        </div>
      )}

      <div style={{ fontSize: '10px', color: 'var(--mave-v2-text-dim)', marginTop: '2px' }}>
        Ask MAVE to explain or step out of role anytime by asking in your native language.
      </div>
    </div>
  );
};

/**
 * PronunciationGuideCard
 *
 * TRUTHFULNESS INVARIANT (U6):
 * - No real audio analysis = NO pronunciation score.
 * - Never display fake "92%", "phoneme accuracy", or "native score".
 * - Presents truthful guidance: IPA, phonetic spelling, stress hints, mouth/sound explanation.
 * - Listen and speak controls are mock intent buttons marked clearly with (Mock).
 */
export interface PronunciationGuideCardProps {
  guide: PronunciationGuideItem;
  onListenExample?: (phrase: string) => void;
  onStartSpeakingPractice?: (phrase: string) => void;
  officeMode?: boolean;
  className?: string;
}

export const PronunciationGuideCard: React.FC<PronunciationGuideCardProps> = ({
  guide,
  onListenExample,
  onStartSpeakingPractice,
  officeMode = false,
  className = ''
}) => {
  const targetPhrase = guide.phrase || guide.wordOrPhrase || '';
  const formattedIpa = guide.ipa ? (guide.ipa.startsWith('/') ? guide.ipa : `/${guide.ipa}/`) : undefined;

  return (
    <div
      className={`mave-v2-pronunciation-guide-card ${className}`.trim()}
      style={{
        background: 'var(--mave-v2-surface-elevated)',
        border: '1px solid var(--mave-v2-border-subtle)',
        borderRadius: 'var(--mave-v2-radius-card)',
        padding: '14px 16px',
        display: 'flex',
        flexDirection: 'column',
        gap: '10px',
        color: 'var(--mave-v2-text-primary)'
      }}
      data-testid="pronunciation-guide-card"
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span
          style={{
            fontSize: '11px',
            fontWeight: 700,
            color: 'var(--mave-v2-accent-listening)',
            textTransform: 'uppercase',
            letterSpacing: '0.4px'
          }}
        >
          Pronunciation Guidance (Truthful Reference)
        </span>
        <span
          style={{
            fontSize: '10px',
            color: 'var(--mave-v2-text-muted)',
            background: 'rgba(255, 255, 255, 0.04)',
            padding: '2px 6px',
            borderRadius: '4px'
          }}
          data-testid="no-score-guarantee"
        >
          No Audio Evaluation • Guide Only
        </span>
      </div>

      {/* Target Phrase & Phonetics */}
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px', flexWrap: 'wrap' }}>
        <span style={{ fontSize: '16px', fontWeight: 700, color: 'var(--mave-v2-text-primary)' }} data-testid="pronunciation-phrase">
          {targetPhrase}
        </span>
        {formattedIpa && (
          <span style={{ fontSize: '13px', fontFamily: 'monospace', color: 'var(--mave-v2-accent-listening)' }} data-testid="pronunciation-ipa">
            {formattedIpa}
          </span>
        )}
        {guide.phoneticSpelling && (
          <span style={{ fontSize: '12px', color: 'var(--mave-v2-text-dim)' }} data-testid="pronunciation-phonetic">
            ({guide.phoneticSpelling})
          </span>
        )}
        {guide.practiceCount && (
          <span style={{ fontSize: '11px', color: 'var(--mave-v2-text-dim)', background: 'rgba(255, 255, 255, 0.05)', padding: '1px 6px', borderRadius: '4px' }}>
            Practiced {guide.practiceCount} times
          </span>
        )}
      </div>

      {/* Stress & Mouth Guide */}
      {(guide.stressHint || guide.mouthGuide) && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '12px', color: 'var(--mave-v2-text-secondary)' }}>
          {guide.stressHint && (
            <div>
              <strong style={{ color: 'var(--mave-v2-text-primary)' }}>Stress: </strong>
              <span data-testid="pronunciation-stress">{guide.stressHint}</span>
            </div>
          )}
          {guide.mouthGuide && (
            <div>
              <strong style={{ color: 'var(--mave-v2-text-primary)' }}>Mouth / Sound: </strong>
              <span data-testid="pronunciation-mouth-guide">{guide.mouthGuide}</span>
            </div>
          )}
        </div>
      )}

      {/* Mock Actions (Audio presentation only) */}
      {!officeMode && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
          <button
            onClick={() => onListenExample?.(targetPhrase)}
            style={{
              background: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid var(--mave-v2-border-subtle)',
              borderRadius: '6px',
              color: 'var(--mave-v2-text-primary)',
              padding: '6px 12px',
              fontSize: '11px',
              fontWeight: 500,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
            data-testid="btn-listen-example-mock"
          >
            <span>🔊</span> Listen Example
          </button>
          <button
            onClick={() => onStartSpeakingPractice?.(targetPhrase)}
            style={{
              background: 'rgba(56, 189, 248, 0.1)',
              border: '1px solid var(--mave-v2-accent-listening)',
              borderRadius: '6px',
              color: 'var(--mave-v2-accent-listening)',
              padding: '6px 12px',
              fontSize: '11px',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
            data-testid="btn-speak-practice-mock"
          >
            <span>🎤</span> Practice Speaking
          </button>
        </div>
      )}

      {officeMode && (
        <div style={{ fontSize: '11px', color: 'var(--mave-v2-text-dim)', fontStyle: 'italic' }}>
          Audio controls are disabled in Office Mode. Focus on reading and phonetic structure.
        </div>
      )}
    </div>
  );
};

/**
 * VocabularyPanel
 *
 * Compact vocabulary list with progressive disclosure and mock save intent.
 * Status values: 'seen' | 'practiced' | 'reviewed' (strictly no "Mastered").
 */
export interface VocabularyPanelProps {
  items: LanguageVocabularyItem[];
  onSaveItem?: (id: string) => void;
  defaultExpanded?: boolean;
  className?: string;
}

export const VocabularyPanel: React.FC<VocabularyPanelProps> = ({
  items,
  onSaveItem,
  defaultExpanded = true,
  className = ''
}) => {
  const [isExpanded, setIsExpanded] = useState<boolean>(defaultExpanded);

  if (items.length === 0) return null;

  return (
    <div
      className={`mave-v2-vocabulary-panel ${className}`.trim()}
      style={{
        background: 'var(--mave-v2-surface-elevated)',
        border: '1px solid var(--mave-v2-border-subtle)',
        borderRadius: 'var(--mave-v2-radius-card)',
        padding: '12px 14px',
        display: 'flex',
        flexDirection: 'column',
        gap: '8px'
      }}
      data-testid="vocabulary-panel"
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          cursor: 'pointer',
          userSelect: 'none'
        }}
        onClick={() => setIsExpanded(!isExpanded)}
        data-testid="vocabulary-header"
      >
        <span
          style={{
            fontSize: '11px',
            fontWeight: 700,
            color: 'var(--mave-v2-accent-listening)',
            textTransform: 'uppercase',
            letterSpacing: '0.4px'
          }}
        >
          Session Vocabulary Recap · {items.length}
        </span>
        <span style={{ fontSize: '11px', color: 'var(--mave-v2-text-dim)' }}>
          {isExpanded ? '▲' : '▼'}
        </span>
      </div>

      {isExpanded && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {items.map((item) => (
            <div
              key={item.id}
              style={{
                background: 'rgba(0, 0, 0, 0.25)',
                border: '1px solid rgba(255, 255, 255, 0.05)',
                borderRadius: '6px',
                padding: '8px 10px',
                display: 'flex',
                flexDirection: 'column',
                gap: '4px'
              }}
              data-testid={`vocabulary-item-${item.id}`}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ fontWeight: 700, fontSize: '13px', color: 'var(--mave-v2-text-primary)' }}>
                    {item.term}
                  </span>
                  {item.partOfSpeech && (
                    <span style={{ fontSize: '10px', color: 'var(--mave-v2-text-dim)', fontStyle: 'italic' }}>
                      ({item.partOfSpeech})
                    </span>
                  )}
                  {item.pronunciationHint && (
                    <span style={{ fontSize: '11px', color: 'var(--mave-v2-text-dim)' }}>
                      {item.pronunciationHint}
                    </span>
                  )}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span
                    style={{
                      fontSize: '9px',
                      textTransform: 'uppercase',
                      padding: '1px 6px',
                      borderRadius: '4px',
                      fontWeight: 600,
                      background: item.status === 'reviewed' ? 'rgba(34, 197, 94, 0.15)' : 'rgba(56, 189, 248, 0.12)',
                      color: item.status === 'reviewed' ? 'var(--mave-v2-accent-success)' : 'var(--mave-v2-accent-listening)'
                    }}
                    data-testid="vocabulary-status-badge"
                  >
                    {(item.status ?? 'seen').toUpperCase()}
                  </span>
                  {onSaveItem ? (
                    <button
                      onClick={() => onSaveItem(item.id)}
                      style={{
                        background: item.isSavedMock ? 'rgba(34, 197, 94, 0.2)' : 'rgba(255, 255, 255, 0.05)',
                        border: '1px solid var(--mave-v2-border-subtle)',
                        borderRadius: '4px',
                        color: item.isSavedMock ? 'var(--mave-v2-accent-success)' : 'var(--mave-v2-text-muted)',
                        fontSize: '10px',
                        padding: '2px 6px',
                        cursor: 'pointer'
                      }}
                      data-testid={`btn-save-vocab-${item.id}`}
                      title="Save to session vocabulary (mock)"
                    >
                      {item.isSavedMock ? '✓ Saved' : '+ Save'}
                    </button>
                  ) : item.isSavedMock ? (
                    <span
                      style={{
                        fontSize: '9px',
                        color: 'var(--mave-v2-accent-success)',
                        background: 'rgba(34, 197, 94, 0.15)',
                        padding: '1px 6px',
                        borderRadius: '4px',
                        fontWeight: 600
                      }}
                      data-testid={`vocab-saved-${item.id}`}
                    >
                      ✓ Saved
                    </span>
                  ) : null}
                </div>
              </div>

              <div style={{ fontSize: '12px', color: 'var(--mave-v2-text-secondary)' }}>
                {item.meaning}
              </div>

              {item.exampleSentence && (
                <div style={{ fontSize: '11px', color: 'var(--mave-v2-text-dim)', fontStyle: 'italic', marginTop: '2px' }}>
                  &ldquo;{item.exampleSentence}&rdquo;
                  {item.exampleTranslation && <span> — {item.exampleTranslation}</span>}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

/**
 * SessionSummaryCard
 *
 * TRUTHFULNESS INVARIANT (U6):
 * - Renders only observed facts from current session state.
 * - Strictly no "English improved by 12%", "Mastered 5 words", or "CEFR B2 achieved".
 * - Shows: Topics practiced, phrases count, corrections count, vocabulary count, next steps.
 */
export interface SessionSummaryCardProps {
  summary: LanguageSessionSummary;
  onPracticeAgain?: () => void;
  className?: string;
}

export const SessionSummaryCard: React.FC<SessionSummaryCardProps> = ({
  summary,
  onPracticeAgain,
  className = ''
}) => {
  return (
    <div
      className={`mave-v2-session-summary-card ${className}`.trim()}
      style={{
        background: 'var(--mave-v2-surface-elevated)',
        border: '1px solid var(--mave-v2-border-subtle)',
        borderRadius: 'var(--mave-v2-radius-card)',
        padding: '16px',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        color: 'var(--mave-v2-text-primary)'
      }}
      data-testid="language-session-summary-card"
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--mave-v2-accent-success)', textTransform: 'uppercase' }}>
            Practice Session Complete
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '2px' }}>
            <span style={{ fontSize: '15px', fontWeight: 700 }}>
              Session Recap
            </span>
            {summary.durationMinutes && (
              <span
                style={{
                  fontSize: '11px',
                  background: 'rgba(255, 255, 255, 0.06)',
                  padding: '2px 6px',
                  borderRadius: '4px',
                  color: 'var(--mave-v2-text-secondary)'
                }}
                data-testid="session-duration"
              >
                {summary.durationMinutes}m
              </span>
            )}
          </div>
        </div>
        {onPracticeAgain && (
          <button
            onClick={onPracticeAgain}
            style={{
              background: 'rgba(56, 189, 248, 0.1)',
              border: '1px solid var(--mave-v2-accent-listening)',
              borderRadius: '6px',
              color: 'var(--mave-v2-accent-listening)',
              padding: '6px 12px',
              fontSize: '11px',
              fontWeight: 600,
              cursor: 'pointer'
            }}
            data-testid="btn-practice-again"
          >
            Practice Again
          </button>
        )}
      </div>

      {/* Truthful Metrics (Current Session Facts Only) */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr 1fr',
          gap: '8px',
          background: 'rgba(0, 0, 0, 0.25)',
          padding: '12px',
          borderRadius: '6px'
        }}
        data-testid="session-metrics-grid"
      >
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '18px', fontWeight: 700, color: 'var(--mave-v2-accent-listening)' }} data-testid="stat-phrases">
            {summary.phrasesPracticedCount ?? summary.phrasesSpokenCount ?? 0}
          </div>
          <div style={{ fontSize: '10px', color: 'var(--mave-v2-text-dim)', textTransform: 'uppercase' }}>
            Phrases Spoken
          </div>
        </div>

        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '18px', fontWeight: 700, color: 'var(--mave-v2-accent-warning)' }} data-testid="stat-corrections">
            {summary.correctionsCount ?? summary.correctionsReviewedCount ?? 0}
          </div>
          <div style={{ fontSize: '10px', color: 'var(--mave-v2-text-dim)', textTransform: 'uppercase' }}>
            Corrections
          </div>
        </div>

        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '18px', fontWeight: 700, color: 'var(--mave-v2-accent-success)' }} data-testid="stat-vocabulary">
            {summary.vocabularyCount ?? summary.vocabularyEncounteredCount ?? 0}
          </div>
          <div style={{ fontSize: '10px', color: 'var(--mave-v2-text-dim)', textTransform: 'uppercase' }}>
            New Terms
          </div>
        </div>
      </div>

      {/* Topics Covered */}
      {summary.topicsPracticed.length > 0 && (
        <div style={{ fontSize: '12px' }}>
          <span style={{ fontWeight: 600, color: 'var(--mave-v2-text-secondary)' }}>Topics Practiced: </span>
          <span style={{ color: 'var(--mave-v2-text-primary)' }} data-testid="summary-topics">
            {summary.topicsPracticed.join(', ')}
          </span>
        </div>
      )}

      {/* Suggested Next Steps */}
      {((summary.suggestedNextSteps && summary.suggestedNextSteps.length > 0) || summary.nextPracticeSuggestion) && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--mave-v2-text-dim)', textTransform: 'uppercase' }}>
            Suggested Next Practice:
          </span>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {(summary.suggestedNextSteps || (summary.nextPracticeSuggestion ? [summary.nextPracticeSuggestion] : [])).map((step, idx) => (
              <div key={idx} style={{ fontSize: '12px', color: 'var(--mave-v2-text-secondary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ color: 'var(--mave-v2-accent-listening)' }}>✦</span>
                <span>{step}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
