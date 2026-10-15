import React, { useState } from 'react';
import type {
  RoleplayScenario,
  PronunciationGuideItem,
  LanguageVocabularyItem,
  LanguageSessionSummary
} from '../types';
import {
  SpeakerIcon,
  MicIcon,
  ChevronUpIcon,
  ChevronDownIcon,
  CheckIcon,
  BookmarkIcon
} from '../primitives';
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
  onResumeRoleplay: _onResumeRoleplay,
  className = ''
}) => {
  const isOutOfRole = Boolean(scenario.isOutOfRole);
  const assistantRole = scenario.assistantRole || scenario.role;
  const scenarioTitle = scenario.title || 'Roleplay Scenario';
  const location = scenario.location || scenario.setting;

  // Canonical state-derived situation vs pause reason
  const isPausedCopy = (text?: string) => Boolean(text && /^paused\b/i.test(text.trim()));

  const activeSituation =
    scenario.activeSituation ||
    (!isPausedCopy(scenario.situation) ? scenario.situation : undefined) ||
    (!isPausedCopy(scenario.goal) ? scenario.goal : undefined) ||
    scenario.setting ||
    'You just walked into a busy Tokyo specialty cafe. Order an iced oat milk latte with less sweetness.';

  const pauseReason =
    scenario.pauseReason ||
    (isPausedCopy(scenario.situation) ? scenario.situation : undefined) ||
    'Paused for vocabulary explanation: "substitution".';

  return (
    <div
      className={`mave-v2-roleplay-banner ${className}`.trim()}
      style={{
        background: isOutOfRole
          ? 'linear-gradient(135deg, rgba(95, 210, 255, 0.05) 0%, rgba(95, 210, 255, 0.02) 100%), var(--mave-glass-gradient)'
          : 'linear-gradient(135deg, rgba(95, 210, 255, 0.08) 0%, rgba(95, 210, 255, 0.02) 100%), var(--mave-glass-gradient)',
        border: isOutOfRole
          ? '1px solid rgba(95, 210, 255, 0.2)'
          : '1px solid rgba(95, 210, 255, 0.25)',
        borderRadius: '16px',
        boxShadow: 'var(--mave-shadow-glass)',
        backdropFilter: 'var(--mave-backdrop-glass)',
        WebkitBackdropFilter: 'var(--mave-backdrop-glass)',
        padding: '12px 16px',
        display: 'flex',
        flexDirection: 'column',
        gap: '6px',
        color: 'var(--mave-ink)',
        fontFamily: 'var(--mave-font-sans)'
      }}
      data-testid="roleplay-scenario-banner"
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span
            style={{
              fontSize: '11px',
              fontWeight: 700,
              color: isOutOfRole ? 'var(--mave-dim)' : 'var(--mave-cyan)',
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              fontFamily: 'var(--mave-font-mono)'
            }}
          >
            {isOutOfRole ? 'Roleplay Paused (MAVE Direct)' : 'Roleplay Active'}
          </span>
          {location && (
            <span style={{ fontSize: '11px', color: 'var(--mave-dim)' }}>
              • {location}
            </span>
          )}
        </div>

        <div>
          {!isOutOfRole && (
            <button
              onClick={onStepOutOfRole}
              style={{
                background: 'var(--mave-raised)',
                border: '1px solid var(--mave-line)',
                borderRadius: '6px',
                color: 'var(--mave-dim)',
                fontSize: '11px',
                padding: '4px 10px',
                cursor: 'pointer',
                fontFamily: 'var(--mave-font-mono)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px'
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
        <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--mave-ink)' }}>
          {scenarioTitle}
        </div>
      )}

      {isOutOfRole ? (
        <>
          <div style={{ fontSize: '12px', color: 'var(--mave-dim)', lineHeight: 1.4 }}>
            MAVE speaking directly as coach. You can ask for grammar explanations, vocabulary clarification, or strategy before resuming.
          </div>
          {pauseReason && (
            <div style={{ fontSize: '12px', color: 'var(--mave-dim)', lineHeight: 1.4 }} data-testid="roleplay-pause-reason">
              {pauseReason}
            </div>
          )}
        </>
      ) : (
        <>
          <div style={{ fontSize: '12px', fontWeight: 500, color: 'var(--mave-dim)' }}>
            MAVE as <span style={{ color: 'var(--mave-cyan)', fontWeight: 600 }}>{assistantRole}</span> (You: {scenario.userRole})
          </div>
          {activeSituation && (
            <div style={{ fontSize: '12px', color: 'var(--mave-dim)', lineHeight: 1.4 }} data-testid="roleplay-active-situation">
              {activeSituation}
            </div>
          )}
        </>
      )}

      <div style={{ fontSize: '11px', color: 'var(--mave-faint)', marginTop: '2px', fontFamily: 'var(--mave-font-mono)' }}>
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
        background: 'var(--mave-glass-gradient)',
        border: '1px solid var(--mave-edge)',
        borderRadius: '16px',
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
      data-testid="pronunciation-guide-card"
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
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
          Pronunciation Guidance (Truthful Reference)
        </span>
        <span
          style={{
            fontSize: '11px',
            color: 'var(--mave-faint)',
            fontFamily: 'var(--mave-font-mono)',
            fontWeight: 400
          }}
          data-testid="no-score-guarantee"
        >
          Guide only · no audio evaluation
        </span>
      </div>

      {/* Target Phrase & Phonetics */}
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px', flexWrap: 'wrap' }}>
        <span style={{ fontSize: '18px', fontWeight: 600, color: 'var(--mave-ink)' }} data-testid="pronunciation-phrase">
          {targetPhrase}
        </span>
        {formattedIpa && (
          <span style={{ fontSize: '13px', fontFamily: 'var(--mave-font-mono)', color: 'var(--mave-cyan)' }} data-testid="pronunciation-ipa">
            {formattedIpa}
          </span>
        )}
        {guide.phoneticSpelling && (
          <span style={{ fontSize: '12px', color: 'var(--mave-dim)', fontFamily: 'var(--mave-font-mono)' }} data-testid="pronunciation-phonetic">
            ({guide.phoneticSpelling})
          </span>
        )}
        {guide.practiceCount && (
          <span style={{ fontSize: '10px', color: 'var(--mave-faint)', background: 'var(--mave-raised)', border: '1px solid var(--mave-line)', padding: '2px 6px', borderRadius: '4px', fontFamily: 'var(--mave-font-mono)' }}>
            Practiced {guide.practiceCount} times
          </span>
        )}
      </div>

      {/* Stress & Mouth Guide */}
      {(guide.stressHint || guide.mouthGuide) && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '13px', color: 'var(--mave-dim)' }}>
          {guide.stressHint && (
            <div>
              <strong style={{ color: 'var(--mave-faint)', fontSize: '11px', fontFamily: 'var(--mave-font-mono)', textTransform: 'uppercase' }}>Stress: </strong>
              <span data-testid="pronunciation-stress">{guide.stressHint}</span>
            </div>
          )}
          {guide.mouthGuide && (
            <div>
              <strong style={{ color: 'var(--mave-faint)', fontSize: '11px', fontFamily: 'var(--mave-font-mono)', textTransform: 'uppercase' }}>Mouth / Sound: </strong>
              <span data-testid="pronunciation-mouth-guide">{guide.mouthGuide}</span>
            </div>
          )}
        </div>
      )}

      {/* Mock Actions (Audio presentation only) */}
      {!officeMode && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '2px' }}>
          <button
            onClick={() => onListenExample?.(targetPhrase)}
            style={{
              background: 'var(--mave-raised)',
              border: '1px solid var(--mave-line)',
              borderRadius: '8px',
              color: 'var(--mave-ink)',
              padding: '6px 12px',
              fontSize: '11px',
              fontWeight: 500,
              cursor: 'pointer',
              fontFamily: 'var(--mave-font-mono)',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px'
            }}
            data-testid="btn-listen-example-mock"
          >
            <SpeakerIcon size={12} color="currentColor" />
            <span>Listen Example</span>
          </button>
          <button
            onClick={() => onStartSpeakingPractice?.(targetPhrase)}
            style={{
              background: 'rgba(95, 210, 255, 0.1)',
              border: '1px solid rgba(95, 210, 255, 0.35)',
              borderRadius: '8px',
              color: 'var(--mave-cyan)',
              padding: '6px 12px',
              fontSize: '11px',
              fontWeight: 600,
              cursor: 'pointer',
              fontFamily: 'var(--mave-font-mono)',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px'
            }}
            data-testid="btn-speak-practice-mock"
          >
            <MicIcon size={12} color="currentColor" />
            <span>Practice Speaking</span>
          </button>
        </div>
      )}

      {officeMode && (
        <div style={{ fontSize: '11px', color: 'var(--mave-faint)', fontStyle: 'italic' }}>
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
        background: 'var(--mave-glass-gradient)',
        border: '1px solid var(--mave-edge)',
        borderRadius: '16px',
        boxShadow: 'var(--mave-shadow-glass)',
        backdropFilter: 'var(--mave-backdrop-glass)',
        WebkitBackdropFilter: 'var(--mave-backdrop-glass)',
        padding: '14px 16px',
        display: 'flex',
        flexDirection: 'column',
        gap: '10px',
        color: 'var(--mave-ink)',
        fontFamily: 'var(--mave-font-sans)'
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
            color: 'var(--mave-cyan)',
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
            fontFamily: 'var(--mave-font-mono)'
          }}
        >
          Session Vocabulary Recap · {items.length}
        </span>
        <span style={{ display: 'inline-flex', alignItems: 'center', color: 'var(--mave-dim)' }}>
          {isExpanded ? <ChevronUpIcon size={12} color="currentColor" /> : <ChevronDownIcon size={12} color="currentColor" />}
        </span>
      </div>

      {isExpanded && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {items.map((item) => {
            const isReviewed = item.status === 'reviewed';
            const isPracticed = item.status === 'practiced';
            const statusColor = isReviewed ? 'var(--mave-ok)' : isPracticed ? 'var(--mave-cyan)' : 'var(--mave-faint)';
            const statusBg = isReviewed ? 'rgba(74, 222, 128, 0.12)' : isPracticed ? 'rgba(95, 210, 255, 0.1)' : 'rgba(255, 255, 255, 0.04)';

            return (
              <div
                key={item.id}
                style={{
                  background: 'var(--mave-raised)',
                  border: '1px solid var(--mave-line)',
                  borderRadius: '10px',
                  padding: '10px 12px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '4px'
                }}
                data-testid={`vocabulary-item-${item.id}`}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ fontWeight: 600, fontSize: '13px', color: 'var(--mave-ink)' }}>
                      {item.term}
                    </span>
                    {item.partOfSpeech && (
                      <span style={{ fontSize: '10px', color: 'var(--mave-faint)', fontStyle: 'italic', fontFamily: 'var(--mave-font-mono)' }}>
                        ({item.partOfSpeech})
                      </span>
                    )}
                    {item.pronunciationHint && (
                      <span style={{ fontSize: '11px', color: 'var(--mave-dim)', fontFamily: 'var(--mave-font-mono)' }}>
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
                        background: statusBg,
                        color: statusColor,
                        fontFamily: 'var(--mave-font-mono)',
                        border: `1px solid ${isReviewed ? 'rgba(74, 222, 128, 0.25)' : isPracticed ? 'rgba(95, 210, 255, 0.2)' : 'var(--mave-line)'}`
                      }}
                      data-testid="vocabulary-status-badge"
                    >
                      {(item.status ?? 'seen').toUpperCase()}
                    </span>
                    {onSaveItem ? (
                      <button
                        onClick={() => onSaveItem(item.id)}
                        style={{
                          background: item.isSavedMock ? 'rgba(74, 222, 128, 0.15)' : 'var(--mave-raised)',
                          border: item.isSavedMock ? '1px solid rgba(74, 222, 128, 0.35)' : '1px solid var(--mave-line)',
                          borderRadius: '4px',
                          color: item.isSavedMock ? 'var(--mave-ok)' : 'var(--mave-dim)',
                          fontSize: '10px',
                          padding: '2px 6px',
                          cursor: 'pointer',
                          fontFamily: 'var(--mave-font-mono)',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '3px'
                        }}
                        data-testid={`btn-save-vocab-${item.id}`}
                        title="Save to session vocabulary (mock)"
                      >
                        {item.isSavedMock ? (
                          <>
                            <CheckIcon size={10} color="currentColor" />
                            <span>Saved</span>
                          </>
                        ) : (
                          <>
                            <BookmarkIcon size={10} color="currentColor" />
                            <span>+ Save</span>
                          </>
                        )}
                      </button>
                    ) : item.isSavedMock ? (
                      <span
                        style={{
                          fontSize: '9px',
                          color: 'var(--mave-ok)',
                          background: 'rgba(74, 222, 128, 0.15)',
                          border: '1px solid rgba(74, 222, 128, 0.25)',
                          padding: '2px 6px',
                          borderRadius: '4px',
                          fontWeight: 600,
                          fontFamily: 'var(--mave-font-mono)',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '3px'
                        }}
                        data-testid={`vocab-saved-${item.id}`}
                      >
                        <CheckIcon size={10} color="currentColor" />
                        <span>Saved</span>
                      </span>
                    ) : null}
                  </div>
                </div>

                <div style={{ fontSize: '12px', color: 'var(--mave-dim)', lineHeight: 1.4 }}>
                  {item.meaning}
                </div>

                {item.exampleSentence && (
                  <div style={{ fontSize: '11px', color: 'var(--mave-faint)', fontStyle: 'italic', marginTop: '2px' }}>
                    &ldquo;{item.exampleSentence}&rdquo;
                    {item.exampleTranslation && <span> — {item.exampleTranslation}</span>}
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
        background: 'var(--mave-glass-gradient)',
        border: '1px solid var(--mave-edge)',
        borderRadius: '16px',
        boxShadow: 'var(--mave-shadow-glass)',
        backdropFilter: 'var(--mave-backdrop-glass)',
        WebkitBackdropFilter: 'var(--mave-backdrop-glass)',
        padding: '18px 20px',
        display: 'flex',
        flexDirection: 'column',
        gap: '14px',
        color: 'var(--mave-ink)',
        fontFamily: 'var(--mave-font-sans)'
      }}
      data-testid="language-session-summary-card"
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--mave-ok)', textTransform: 'uppercase', letterSpacing: '0.08em', fontFamily: 'var(--mave-font-mono)' }}>
            Practice Session Complete
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '2px' }}>
            <span style={{ fontSize: '16px', fontWeight: 600, color: 'var(--mave-ink)' }}>
              Session Recap
            </span>
            {summary.durationMinutes && (
              <span
                style={{
                  fontSize: '11px',
                  background: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid var(--mave-line)',
                  padding: '2px 6px',
                  borderRadius: '4px',
                  color: 'var(--mave-dim)',
                  fontFamily: 'var(--mave-font-mono)'
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
              background: 'rgba(95, 210, 255, 0.1)',
              border: '1px solid var(--mave-cyan)',
              borderRadius: '6px',
              color: 'var(--mave-cyan)',
              padding: '6px 14px',
              fontSize: '11px',
              fontWeight: 600,
              cursor: 'pointer',
              fontFamily: 'var(--mave-font-mono)'
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
          border: '1px solid var(--mave-line)',
          padding: '12px',
          borderRadius: '10px'
        }}
        data-testid="session-metrics-grid"
      >
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '20px', fontWeight: 700, color: 'var(--mave-cyan)', fontFamily: 'var(--mave-font-mono)' }} data-testid="stat-phrases">
            {summary.phrasesPracticedCount ?? summary.phrasesSpokenCount ?? 0}
          </div>
          <div style={{ fontSize: '10px', color: 'var(--mave-faint)', textTransform: 'uppercase', letterSpacing: '0.04em', fontFamily: 'var(--mave-font-mono)' }}>
            Phrases Spoken
          </div>
        </div>

        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '20px', fontWeight: 700, color: 'var(--mave-warn)', fontFamily: 'var(--mave-font-mono)' }} data-testid="stat-corrections">
            {summary.correctionsCount ?? summary.correctionsReviewedCount ?? 0}
          </div>
          <div style={{ fontSize: '10px', color: 'var(--mave-faint)', textTransform: 'uppercase', letterSpacing: '0.04em', fontFamily: 'var(--mave-font-mono)' }}>
            Corrections
          </div>
        </div>

        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '20px', fontWeight: 700, color: 'var(--mave-ok)', fontFamily: 'var(--mave-font-mono)' }} data-testid="stat-vocabulary">
            {summary.vocabularyCount ?? summary.vocabularyEncounteredCount ?? 0}
          </div>
          <div style={{ fontSize: '10px', color: 'var(--mave-faint)', textTransform: 'uppercase', letterSpacing: '0.04em', fontFamily: 'var(--mave-font-mono)' }}>
            New Terms
          </div>
        </div>
      </div>

      {/* Topics Covered */}
      {summary.topicsPracticed.length > 0 && (
        <div style={{ fontSize: '12px', color: 'var(--mave-dim)', lineHeight: 1.4 }}>
          <span style={{ fontWeight: 600, color: 'var(--mave-ink)' }}>Topics Practiced: </span>
          <span data-testid="summary-topics">
            {summary.topicsPracticed.join(', ')}
          </span>
        </div>
      )}

      {/* Suggested Next Steps */}
      {((summary.suggestedNextSteps && summary.suggestedNextSteps.length > 0) || summary.nextPracticeSuggestion) && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--mave-faint)', textTransform: 'uppercase', letterSpacing: '0.04em', fontFamily: 'var(--mave-font-mono)' }}>
            Suggested Next Practice:
          </span>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {(summary.suggestedNextSteps || (summary.nextPracticeSuggestion ? [summary.nextPracticeSuggestion] : [])).map((step, idx) => (
              <div key={idx} style={{ fontSize: '12px', color: 'var(--mave-dim)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ width: '4px', height: '4px', borderRadius: '50%', background: 'var(--mave-cyan)', display: 'inline-block', flexShrink: 0 }} />
                <span>{step}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
