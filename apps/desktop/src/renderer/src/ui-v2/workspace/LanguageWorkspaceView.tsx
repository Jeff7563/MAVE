import React, { useState } from 'react';
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
 * LanguageWorkspaceView (Canonical U6 Architecture)
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

  return (
    <div
      className={`mave-v2-language-workspace-view ${className}`.trim()}
      style={{
        display: 'grid',
        gridTemplateColumns: 'minmax(0, 1fr) 300px',
        gap: '16px',
        height: '100%',
        overflow: 'hidden',
        color: 'var(--mave-v2-text-primary)'
      }}
      data-testid="language-workspace-view"
    >
      {/* =========================================================================
          PRIMARY PRACTICE AREA (Left Column, Flex 1)
         ========================================================================= */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '14px',
          overflowY: 'auto',
          paddingRight: '4px'
        }}
        data-testid="language-primary-practice-area"
      >
        {/* 1. Session Context & Goal Banner */}
        <div
          style={{
            background: 'var(--mave-v2-surface-elevated)',
            border: '1px solid var(--mave-v2-border-subtle)',
            borderRadius: 'var(--mave-v2-radius-card)',
            padding: '14px 16px',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px'
          }}
          data-testid="language-session-header"
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span
                style={{
                  fontSize: '12px',
                  fontWeight: 700,
                  color: 'var(--mave-v2-accent-listening)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.4px'
                }}
                data-testid="language-practice-label"
              >
                Speaking Session • {session.targetLanguage}
              </span>
              <span
                style={{
                  fontSize: '10px',
                  color: 'var(--mave-v2-text-dim)',
                  background: 'rgba(255, 255, 255, 0.05)',
                  padding: '2px 6px',
                  borderRadius: '4px',
                  textTransform: 'capitalize'
                }}
                data-testid="language-practice-type-badge"
              >
                {session.practiceType.replace('_', ' ')}
              </span>
              <span
                style={{
                  fontSize: '10px',
                  color: 'var(--mave-v2-text-muted)',
                  background: 'rgba(56, 189, 248, 0.08)',
                  padding: '2px 6px',
                  borderRadius: '4px'
                }}
                data-testid="language-practice-identity-badge"
              >
                MAVE / Language Practice
              </span>
            </div>

            {/* In-Session Controls: Intensity & Translation */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px' }}>
                <span style={{ color: 'var(--mave-v2-text-dim)' }}>Corrections:</span>
                {(['light', 'balanced', 'detailed'] as CorrectionIntensity[]).map((lvl) => (
                  <button
                    key={lvl}
                    onClick={() => handleIntensityChange(lvl)}
                    style={{
                      background: localIntensity === lvl ? 'rgba(56, 189, 248, 0.15)' : 'rgba(255, 255, 255, 0.03)',
                      border: localIntensity === lvl ? '1px solid var(--mave-v2-accent-listening)' : '1px solid var(--mave-v2-border-subtle)',
                      borderRadius: '4px',
                      color: localIntensity === lvl ? 'var(--mave-v2-accent-listening)' : 'var(--mave-v2-text-muted)',
                      padding: '2px 6px',
                      fontSize: '10px',
                      cursor: 'pointer',
                      textTransform: 'capitalize'
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
                  border: '1px solid var(--mave-v2-border-subtle)',
                  borderRadius: '4px',
                  color: localShowTranslation ? 'var(--mave-v2-text-primary)' : 'var(--mave-v2-text-dim)',
                  padding: '2px 8px',
                  fontSize: '10px',
                  cursor: 'pointer'
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
            <div style={{ fontSize: '15px', fontWeight: 700, color: 'var(--mave-v2-text-primary)' }} data-testid="language-session-topic">
              {session.topic}
            </div>
          )}
          {session.sessionGoal && (
            <div style={{ fontSize: '13px', color: 'var(--mave-v2-text-secondary)', marginTop: '2px' }} data-testid="language-session-goal">
              <strong style={{ color: 'var(--mave-v2-text-primary)' }}>Goal: </strong>
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
              background: 'var(--mave-v2-surface-elevated)',
              border: '1px solid var(--mave-v2-border-subtle)',
              borderRadius: 'var(--mave-v2-radius-card)',
              padding: '16px',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px'
            }}
            data-testid="active-practice-card"
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--mave-v2-accent-listening)', textTransform: 'uppercase' }}>
                MAVE Coach Prompt
              </span>
              <span
                style={{
                  fontSize: '11px',
                  color: 'var(--mave-v2-accent-thinking)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
                data-testid="observable-session-state"
              >
                <span
                  style={{
                    width: '6px',
                    height: '6px',
                    borderRadius: '50%',
                    background: 'var(--mave-v2-accent-thinking)',
                    display: 'inline-block'
                  }}
                />
                {session.observableStateText ?? 'Waiting for your answer…'}
              </span>
            </div>

            <div style={{ fontSize: '15px', lineHeight: 1.5, color: 'var(--mave-v2-text-primary)' }} data-testid="practice-prompt-text">
              {session.currentPrompt}
            </div>

            {/* Practice Action Affordances */}
            {!officeMode && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
                <button
                  onClick={() => handleSpeakClick(session.currentPrompt!)}
                  style={{
                    background: isSpeakingMockActive ? 'rgba(239, 68, 68, 0.15)' : 'rgba(56, 189, 248, 0.12)',
                    border: isSpeakingMockActive ? '1px solid var(--mave-v2-accent-error)' : '1px solid var(--mave-v2-accent-listening)',
                    borderRadius: '6px',
                    color: isSpeakingMockActive ? '#fca5a5' : 'var(--mave-v2-accent-listening)',
                    padding: '8px 14px',
                    fontSize: '12px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                  data-testid="btn-speaking-practice-toggle"
                >
                  <span>🎤</span>
                  <span>{isSpeakingMockActive ? 'Stop Practice (Mock)' : 'Speak Answer (Mock)'}</span>
                </button>

                <button
                  onClick={() => onListenExample?.(session.currentPrompt!)}
                  style={{
                    background: 'rgba(255, 255, 255, 0.04)',
                    border: '1px solid var(--mave-v2-border-subtle)',
                    borderRadius: '6px',
                    color: 'var(--mave-v2-text-secondary)',
                    padding: '8px 14px',
                    fontSize: '12px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                  data-testid="btn-listen-prompt-mock"
                >
                  <span>🔊</span>
                  <span>Listen Example (Mock)</span>
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
          CONTEXT & RECAP REGION (Right Column, 300px)
         ========================================================================= */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '14px',
          overflowY: 'auto'
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
              background: 'var(--mave-v2-surface-elevated)',
              border: '1px solid var(--mave-v2-border-subtle)',
              borderRadius: 'var(--mave-v2-radius-card)',
              padding: '12px 14px',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px'
            }}
            data-testid="practice-queue-container"
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--mave-v2-text-secondary)', textTransform: 'uppercase' }}>
                Practice Queue
              </span>
              <span style={{ fontSize: '10px', color: 'var(--mave-v2-accent-listening)', fontWeight: 600 }}>
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
                      padding: '6px 8px',
                      borderRadius: '4px',
                      fontSize: '11px',
                      background: isStepActive ? 'rgba(56, 189, 248, 0.08)' : 'rgba(255, 255, 255, 0.02)',
                      borderLeft: isStepActive ? '2px solid var(--mave-v2-accent-listening)' : '2px solid transparent'
                    }}
                    data-testid={`queue-item-${step.id || idx}`}
                  >
                    <span style={{ color: isStepCompleted ? 'var(--mave-v2-text-muted)' : 'var(--mave-v2-text-primary)' }}>
                      {step.label}
                    </span>
                    <span
                      style={{
                        fontSize: '9px',
                        fontWeight: 600,
                        textTransform: 'uppercase',
                        color: isStepCompleted ? 'var(--mave-v2-accent-success)' : isStepActive ? 'var(--mave-v2-accent-listening)' : 'var(--mave-v2-text-dim)'
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
    </div>
  );
};
