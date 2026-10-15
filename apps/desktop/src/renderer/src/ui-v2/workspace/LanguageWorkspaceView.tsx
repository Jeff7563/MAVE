import React, { useState, useEffect, useRef } from 'react';
import type {
  WorkspaceState,
  LanguageSessionState,
  CorrectionIntensity
} from '../types';
import { InlineCorrectionCard } from '../language/InlineCorrectionCard';
import {
  RoleplayBanner,
  PronunciationGuideCard,
  VocabularyPanel,
  SessionSummaryCard
} from '../language/LanguageComponents';
import { MicIcon, SpeakerIcon } from '../primitives';
import '../tokens.css';

export interface LanguageWorkspaceViewProps {
  state: WorkspaceState;
  onListenExample?: (phrase: string) => void;
  onStartSpeakingPractice?: (phrase: string) => void;
  onStopSpeakingPractice?: () => void;
  onSaveVocabularyMock?: (id: string) => void;
  onChangeCorrectionIntensity?: (intensity: CorrectionIntensity) => void;
  onToggleShowTranslation?: () => void;
  onStepOutOfRole?: () => void;
  onPracticeAgain?: () => void;
  officeMode?: boolean;
  className?: string;
}

/**
 * LanguageWorkspaceView (Canonical VSM5 Architecture)
 *
 * MAVE Level 3 Language Practice Workspace.
 *
 * CORE ARCHITECTURAL INVARIANTS:
 * 1. Language Is An Experience Context, NOT MAVE's Global Identity.
 *    - Header displays "MAVE / Language Practice", never "Your AI Language Assistant".
 * 2. Language Task != Workspace Requirement automatically.
 *    - Simple corrections remain Presence/Conversation eligible; Workspace is reserved
 *      for sustained multi-turn sessions, roleplays, or structured review.
 * 3. Language Session State != Global Conversation State.
 *    - Resetting or ending a language practice session does NOT purge general conversation history.
 * 4. Pronunciation Truthfulness:
 *    - No real audio analysis = NO pronunciation score. Zero fake percentages (92%).
 * 5. Learning Progress Truthfulness:
 *    - Shows observed session facts ("Practiced 6 phrases"), never "Mastered" or fake CEFR upgrades.
 * 6. Non-Modal Escape:
 *    - User can step out of roleplay anytime to ask general MAVE questions or request explanations.
 * 7. Adaptive Layout & Scroll Ownership:
 *    - Primary practice interaction is primary and owns vertical scroll.
 *    - At narrow widths (< 860px), contextual panels stack seamlessly below without shrinking the practice canvas.
 */
export const LanguageWorkspaceView: React.FC<LanguageWorkspaceViewProps> = ({
  state,
  onListenExample,
  onStartSpeakingPractice,
  onStopSpeakingPractice,
  onSaveVocabularyMock,
  onChangeCorrectionIntensity,
  onToggleShowTranslation,
  onStepOutOfRole,
  onPracticeAgain,
  officeMode = false,
  className = ''
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isNarrow, setIsNarrow] = useState<boolean>(false);

  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setIsNarrow(entry.contentRect.width < 860);
      }
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  // Extract or synthesize LanguageSessionState from either state.languageSession
  // or legacy state.languageContext for backward compatibility
  const session: LanguageSessionState = state.languageSession ?? {
    targetLanguage: state.languageContext?.targetLanguage ?? 'English',
    practiceType: (state.languageContext?.mode?.toLowerCase() === 'roleplay' ? 'roleplay' : 'free_conversation'),
    topic: state.currentObjective || state.title || 'Conversational Practice',
    sessionGoal: state.currentObjective || 'Speak naturally about your day',
    currentPrompt: state.outputSummary || 'Try expressing your thoughts using natural phrasing.',
    correctionIntensity: 'balanced',
    status: (state.status === 'completed' ? 'completed' : 'practicing'),
    vocabulary: state.languageContext?.vocabulary?.map((v, i) => ({
      id: `vocab-${i}`,
      term: v.term,
      meaning: v.meaning,
      status: 'seen' as const
    })),
    corrections: state.languageContext?.naturalPhrasing ? [
      {
        id: 'corr-0',
        originalText: 'Example phrase',
        correctedText: state.languageContext.naturalPhrasing,
        explanation: 'More natural native phrasing.',
        category: 'naturalness' as const
      }
    ] : undefined
  };

  const [localIntensity, setLocalIntensity] = useState<CorrectionIntensity>(
    session.correctionIntensity || 'balanced'
  );
  const [localShowTranslation, setLocalShowTranslation] = useState<boolean>(
    session.showTranslation ?? true
  );
  const [isSpeakingMockActive, setIsSpeakingMockActive] = useState<boolean>(false);

  const handleIntensityChange = (newIntensity: CorrectionIntensity) => {
    setLocalIntensity(newIntensity);
    onChangeCorrectionIntensity?.(newIntensity);
  };

  const handleToggleTranslation = () => {
    setLocalShowTranslation(!localShowTranslation);
    onToggleShowTranslation?.();
  };

  const handleSpeakClick = (phrase: string) => {
    if (isSpeakingMockActive) {
      setIsSpeakingMockActive(false);
      onStopSpeakingPractice?.();
    } else {
      setIsSpeakingMockActive(true);
      onStartSpeakingPractice?.(phrase);
    }
  };

  const isCompleted = session.status === 'completed' || state.status === 'completed';
  const hasRightPanel = Boolean(
    (session.vocabulary && session.vocabulary.length > 0) ||
    (state.steps && state.steps.length > 0)
  );

  return (
    <div
      ref={containerRef}
      className={`mave-v2-language-workspace-view mave-custom-scrollbar ${className}`.trim()}
      style={{
        display: isNarrow ? 'flex' : 'grid',
        flexDirection: isNarrow ? 'column' : undefined,
        gridTemplateColumns: !isNarrow && hasRightPanel ? 'minmax(0, 1fr) 280px' : '1fr',
        gap: '16px',
        height: '100%',
        minWidth: 0,
        minHeight: 0,
        overflowY: 'auto',
        overflowX: 'hidden',
        color: 'var(--mave-ink)',
        fontFamily: 'var(--mave-font-sans)'
      }}
      data-testid="language-workspace-view"
    >
      {/* =========================================================================
          PRIMARY PRACTICE AREA (Dominant Interaction Canvas)
         ========================================================================= */}
      <div
        className="mave-custom-scrollbar"
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '14px',
          minWidth: 0,
          minHeight: 0,
          overflowY: isNarrow ? 'visible' : 'auto',
          overflowX: 'hidden',
          paddingRight: isNarrow ? '0px' : '4px'
        }}
        data-testid="language-primary-practice-area"
      >
        {/* 1. Session Context & Goal Banner */}
        <div
          style={{
            background: 'var(--mave-glass-gradient)',
            border: '1px solid var(--mave-edge)',
            borderRadius: '16px',
            boxShadow: 'var(--mave-shadow-glass)',
            backdropFilter: 'var(--mave-backdrop-glass)',
            WebkitBackdropFilter: 'var(--mave-backdrop-glass)',
            padding: '16px 20px',
            display: 'flex',
            flexDirection: 'column',
            gap: '10px'
          }}
          data-testid="language-session-header"
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
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
                data-testid="language-practice-label"
              >
                Speaking Session • {session.targetLanguage}
              </span>
              <span
                style={{
                  fontSize: '10px',
                  color: 'var(--mave-faint)',
                  background: 'rgba(255, 255, 255, 0.04)',
                  border: '1px solid var(--mave-line)',
                  padding: '2px 6px',
                  borderRadius: '4px',
                  textTransform: 'capitalize',
                  fontFamily: 'var(--mave-font-mono)'
                }}
                data-testid="language-practice-type-badge"
              >
                {session.practiceType.replace('_', ' ')}
              </span>
              <span
                style={{
                  fontSize: '10px',
                  color: 'var(--mave-cyan)',
                  background: 'rgba(95, 210, 255, 0.08)',
                  border: '1px solid rgba(95, 210, 255, 0.2)',
                  padding: '2px 6px',
                  borderRadius: '4px',
                  fontFamily: 'var(--mave-font-mono)'
                }}
                data-testid="language-practice-identity-badge"
              >
                MAVE / Language Practice
              </span>
            </div>

            {/* In-Session Controls: Intensity & Translation */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', fontFamily: 'var(--mave-font-mono)' }}>
                <span style={{ color: 'var(--mave-faint)' }}>Corrections:</span>
                {(['light', 'balanced', 'detailed'] as CorrectionIntensity[]).map((lvl) => (
                  <button
                    key={lvl}
                    onClick={() => handleIntensityChange(lvl)}
                    style={{
                      background: localIntensity === lvl ? 'rgba(95, 210, 255, 0.15)' : 'var(--mave-raised)',
                      border: localIntensity === lvl ? '1px solid var(--mave-cyan)' : '1px solid var(--mave-line)',
                      borderRadius: '4px',
                      color: localIntensity === lvl ? 'var(--mave-cyan)' : 'var(--mave-dim)',
                      padding: '2px 8px',
                      fontSize: '10px',
                      cursor: 'pointer',
                      textTransform: 'capitalize',
                      fontFamily: 'var(--mave-font-mono)'
                    }}
                    data-testid={`btn-intensity-${lvl}`}
                  >
                    {lvl}
                  </button>
                ))}
              </div>

              <button
                onClick={handleToggleTranslation}
                style={{
                  background: localShowTranslation ? 'rgba(255, 255, 255, 0.08)' : 'transparent',
                  border: '1px solid var(--mave-line)',
                  borderRadius: '4px',
                  color: localShowTranslation ? 'var(--mave-ink)' : 'var(--mave-faint)',
                  padding: '2px 8px',
                  fontSize: '10px',
                  cursor: 'pointer',
                  fontFamily: 'var(--mave-font-mono)'
                }}
                data-testid="btn-toggle-translation"
                title="Toggle translation hints"
              >
                {localShowTranslation ? 'Translation: ON' : 'Translation: OFF'}
              </button>
            </div>
          </div>

          {/* Topic & Session Goal Description */}
          {session.topic && (
            <div style={{ fontSize: '16px', fontWeight: 600, color: 'var(--mave-ink)' }} data-testid="language-session-topic">
              {session.topic}
            </div>
          )}
          {session.sessionGoal && (
            <div style={{ fontSize: '13px', color: 'var(--mave-dim)', marginTop: '2px' }} data-testid="language-session-goal">
              <strong style={{ color: 'var(--mave-faint)', fontSize: '11px', fontFamily: 'var(--mave-font-mono)', textTransform: 'uppercase' }}>Goal: </strong>
              {session.sessionGoal}
            </div>
          )}
        </div>

        {/* 2. Roleplay Scenario (if active) */}
        {session.roleplayScenario && (
          <RoleplayBanner
            scenario={session.roleplayScenario}
            onStepOutOfRole={onStepOutOfRole}
          />
        )}

        {/* 3. Pronunciation Guide (if available) */}
        {session.pronunciationGuide && (
          <PronunciationGuideCard
            guide={session.pronunciationGuide}
            onListenExample={onListenExample}
            onStartSpeakingPractice={handleSpeakClick}
            officeMode={officeMode}
          />
        )}

        {/* 4. Active Practice Prompt / Dialogue Turn */}
        {session.currentPrompt && !isCompleted && (
          <div
            style={{
              background: 'var(--mave-glass-gradient)',
              border: '1px solid rgba(95, 210, 255, 0.3)',
              borderRadius: '16px',
              boxShadow: 'var(--mave-shadow-glass)',
              backdropFilter: 'var(--mave-backdrop-glass)',
              WebkitBackdropFilter: 'var(--mave-backdrop-glass)',
              padding: '20px 24px',
              display: 'flex',
              flexDirection: 'column',
              gap: '14px'
            }}
            data-testid="active-practice-card"
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--mave-cyan)', textTransform: 'uppercase', letterSpacing: '0.08em', fontFamily: 'var(--mave-font-mono)' }}>
                MAVE Coach Prompt
              </span>
              <span
                style={{
                  fontSize: '11px',
                  color: 'var(--mave-dim)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  fontFamily: 'var(--mave-font-mono)'
                }}
                data-testid="observable-session-state"
              >
                <span
                  style={{
                    width: '6px',
                    height: '6px',
                    borderRadius: '50%',
                    background: 'var(--mave-cyan)',
                    display: 'inline-block'
                  }}
                />
                {session.observableStateText ?? 'Waiting for your answer…'}
              </span>
            </div>

            <div style={{ fontSize: '18px', lineHeight: 1.55, fontWeight: 500, color: 'var(--mave-ink)' }} data-testid="practice-prompt-text">
              {session.currentPrompt}
            </div>

            {/* Practice Action Affordances */}
            {!officeMode && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
                <button
                  onClick={() => handleSpeakClick(session.currentPrompt!)}
                  style={{
                    background: isSpeakingMockActive ? 'rgba(95, 210, 255, 0.2)' : 'rgba(95, 210, 255, 0.1)',
                    border: isSpeakingMockActive ? '1px solid var(--mave-cyan)' : '1px solid rgba(95, 210, 255, 0.35)',
                    borderRadius: '8px',
                    color: 'var(--mave-cyan)',
                    padding: '8px 16px',
                    fontSize: '12px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    fontFamily: 'var(--mave-font-mono)',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    boxShadow: isSpeakingMockActive ? '0 0 16px rgba(95, 210, 255, 0.25)' : 'none'
                  }}
                  data-testid="btn-speaking-practice-toggle"
                >
                  <MicIcon size={13} color="currentColor" />
                  <span>{isSpeakingMockActive ? 'Stop Practice' : 'Speak Answer'}</span>
                </button>

                <button
                  onClick={() => onListenExample?.(session.currentPrompt!)}
                  style={{
                    background: 'var(--mave-raised)',
                    border: '1px solid var(--mave-line)',
                    borderRadius: '8px',
                    color: 'var(--mave-dim)',
                    padding: '8px 16px',
                    fontSize: '12px',
                    cursor: 'pointer',
                    fontFamily: 'var(--mave-font-mono)',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                  data-testid="btn-listen-prompt-mock"
                >
                  <SpeakerIcon size={13} color="currentColor" />
                  <span>Listen Example</span>
                </button>
              </div>
            )}
          </div>
        )}

        {/* 5. Corrections & Learning Feedback (if corrections exist for this turn) */}
        {session.corrections && session.corrections.length > 0 && (
          <InlineCorrectionCard
            corrections={session.corrections}
            intensity={localIntensity}
            targetLanguage={session.targetLanguage}
          />
        )}

        {/* 6. Completed State: Session Summary */}
        {isCompleted && session.sessionSummary && (
          <SessionSummaryCard
            summary={session.sessionSummary}
            onPracticeAgain={onPracticeAgain}
          />
        )}
      </div>

      {/* =========================================================================
          CONTEXT & RECAP REGION (Supporting Side Panel or Stacked in Narrow)
         ========================================================================= */}
      {hasRightPanel && (
        <div
          className="mave-custom-scrollbar"
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '14px',
            minWidth: 0,
            minHeight: 0,
            overflowY: isNarrow ? 'visible' : 'auto',
            overflowX: 'hidden'
          }}
          data-testid="language-context-panel"
        >
          {/* Vocabulary Panel */}
          {session.vocabulary && session.vocabulary.length > 0 && (
            <VocabularyPanel
              items={session.vocabulary}
              onSaveItem={onSaveVocabularyMock}
            />
          )}

          {/* Practice Queue / Steps Tracker (Truthful counts if known) */}
          {state.steps && state.steps.length > 0 && (
            <div
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
                gap: '10px'
              }}
              data-testid="practice-queue-container"
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--mave-faint)', textTransform: 'uppercase', letterSpacing: '0.08em', fontFamily: 'var(--mave-font-mono)' }}>
                  Practice Queue
                </span>
                <span style={{ fontSize: '11px', color: 'var(--mave-cyan)', fontWeight: 600, fontFamily: 'var(--mave-font-mono)' }}>
                  {state.steps.filter((s) => s.status === 'completed').length}/{state.steps.length}
                </span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {state.steps.map((step, idx) => {
                  const isStepCompleted = step.status === 'completed';
                  const isStepActive = step.status === 'active';
                  return (
                    <div
                      key={step.id || idx}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '8px 10px',
                        borderRadius: '6px',
                        fontSize: '12px',
                        background: isStepActive ? 'rgba(95, 210, 255, 0.08)' : 'var(--mave-raised)',
                        borderLeft: isStepActive ? '2px solid var(--mave-cyan)' : '2px solid transparent'
                      }}
                      data-testid={`queue-item-${step.id || idx}`}
                    >
                      <span style={{ color: isStepCompleted ? 'var(--mave-faint)' : 'var(--mave-ink)' }}>
                        {step.label}
                      </span>
                      <span
                        style={{
                          fontSize: '9px',
                          fontWeight: 600,
                          textTransform: 'uppercase',
                          fontFamily: 'var(--mave-font-mono)',
                          color: isStepCompleted ? 'var(--mave-ok)' : isStepActive ? 'var(--mave-cyan)' : 'var(--mave-faint)'
                        }}
                      >
                        {step.status}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
