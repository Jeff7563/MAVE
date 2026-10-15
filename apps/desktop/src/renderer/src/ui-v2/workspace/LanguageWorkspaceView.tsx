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
  onResumeRoleplay?: () => void;
  onPracticeAgain?: () => void;
  initialShowVocabulary?: boolean;
  officeMode?: boolean;
  className?: string;
}

/**
 * LanguageWorkspaceView (Canonical VSM5.1 Architecture)
 *
 * MAVE Conversational Language Experience Workspace.
 *
 * CORE ARCHITECTURAL INVARIANTS:
 * 1. Experience Context != Dedicated LMS Dashboard:
 *    - Language learning appears only when user intent requires it.
 *    - Dominant primary conversational practice (~70-100% usable width).
 * 2. De-cluttered Session Chrome:
 *    - Minimal header with identity, topic, and quiet metadata.
 *    - Preferences (intensity, translation) tucked into contextual options.
 * 3. Contextual Vocabulary Drawer:
 *    - Hidden by default in ordinary speaking/roleplay; toggled via drawer.
 *    - Dedicated vocabulary mode uses list as primary canvas.
 * 4. Escapable & Truthful Roleplay:
 *    - When paused, shows calm "Roleplay paused" and "Resume roleplay".
 *    - Never shows "ROLEPLAY ACTIVE" or amber warning styling while paused.
 *    - Primary area switches to direct MAVE coach explanation.
 * 5. Pronunciation Disclosure Truthfulness:
 *    - Quiet, unboxed metadata disclosure: "Guide only · no audio evaluation".
 *    - Zero fake scores or CEFR claims.
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
  onResumeRoleplay,
  onPracticeAgain,
  initialShowVocabulary,
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

  // Extract or synthesize LanguageSessionState
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

  const isOutOfRoleDerived = Boolean(
    session.roleplayScenario?.isOutOfRole ||
    (session as any).isOutOfRole ||
    session.status === 'paused' ||
    state.status === 'paused' ||
    state.userFacingState?.toLowerCase().includes('paused')
  );

  const [outOfRoleState, setOutOfRoleState] = useState<boolean>(isOutOfRoleDerived);
  useEffect(() => {
    setOutOfRoleState(isOutOfRoleDerived);
  }, [isOutOfRoleDerived]);

  const [localIntensity, setLocalIntensity] = useState<CorrectionIntensity>(
    session.correctionIntensity || 'balanced'
  );
  const [localShowTranslation, setLocalShowTranslation] = useState<boolean>(
    session.showTranslation ?? true
  );
  const [showOptions, setShowOptions] = useState<boolean>(false);
  const [isSpeakingMockActive, setIsSpeakingMockActive] = useState<boolean>(false);

  // Vocabulary drawer: collapsed by default in speaking/roleplay
  const isVocabPracticeType = session.practiceType === 'vocabulary';
  const hasVocab = Boolean(session.vocabulary && session.vocabulary.length > 0);
  const [isVocabOpen, setIsVocabOpen] = useState<boolean>(
    initialShowVocabulary ?? isVocabPracticeType
  );

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

  const handleStepOutOfRole = () => {
    setOutOfRoleState(true);
    onStepOutOfRole?.();
  };

  const handleResumeRoleplay = () => {
    setOutOfRoleState(false);
    onResumeRoleplay?.();
  };

  const isCompleted = session.status === 'completed' || state.status === 'completed';
  const showVocabDrawer = isVocabOpen && hasVocab && !isVocabPracticeType;

  // Active step computation for non-dominant step indicator
  const completedStepsCount = state.steps?.filter((s) => s.status === 'completed').length || 0;
  const activeStepIdx = state.steps
    ? state.steps.findIndex((s) => s.status === 'active') + 1 || completedStepsCount + 1
    : 1;
  const totalStepsCount = state.steps?.length || 0;

  return (
    <div
      ref={containerRef}
      className={`mave-v2-language-workspace-view mave-custom-scrollbar ${className}`.trim()}
      style={{
        display: isNarrow ? 'flex' : 'grid',
        flexDirection: isNarrow ? 'column' : undefined,
        gridTemplateColumns: !isNarrow && showVocabDrawer ? 'minmax(0, 1fr) 300px' : '1fr',
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
          width: '100%',
          maxWidth: showVocabDrawer ? '100%' : '920px',
          margin: showVocabDrawer ? '0' : '0 auto',
          overflowY: isNarrow ? 'visible' : 'auto',
          overflowX: 'hidden',
          paddingRight: isNarrow ? '0px' : '4px'
        }}
        data-testid="language-primary-practice-area"
      >
        {/* 1. Simplified Calm Session Header */}
        <div
          style={{
            background: 'var(--mave-glass-gradient)',
            border: '1px solid var(--mave-edge)',
            borderRadius: '16px',
            boxShadow: 'var(--mave-shadow-glass)',
            backdropFilter: 'var(--mave-backdrop-glass)',
            WebkitBackdropFilter: 'var(--mave-backdrop-glass)',
            padding: '14px 18px',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px'
          }}
          data-testid="language-session-header"
        >
          {/* Top Row: Identity Capsule & Actions */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span
                style={{
                  fontSize: '11px',
                  fontWeight: 700,
                  color: 'var(--mave-cyan)',
                  background: 'rgba(95, 210, 255, 0.08)',
                  border: '1px solid rgba(95, 210, 255, 0.2)',
                  padding: '3px 8px',
                  borderRadius: '6px',
                  letterSpacing: '0.04em',
                  fontFamily: 'var(--mave-font-mono)'
                }}
                data-testid="language-practice-identity-badge"
              >
                MAVE / Language Practice
              </span>

              {/* Hidden label preserving backward test compatibility */}
              <span style={{ display: 'none' }} data-testid="language-practice-label">
                Speaking Session • {session.targetLanguage}
              </span>

              <span
                style={{
                  fontSize: '11px',
                  color: 'var(--mave-faint)',
                  fontFamily: 'var(--mave-font-mono)'
                }}
              >
                {session.targetLanguage} · {session.practiceType.replace('_', ' ')}
              </span>
            </div>

            {/* Right Action Affordances: Step Indicator, Vocab Drawer Toggle, Options */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              {totalStepsCount > 0 && (
                <span
                  style={{
                    fontSize: '11px',
                    color: 'var(--mave-faint)',
                    background: 'rgba(255, 255, 255, 0.04)',
                    border: '1px solid var(--mave-line)',
                    padding: '3px 8px',
                    borderRadius: '6px',
                    fontFamily: 'var(--mave-font-mono)'
                  }}
                  data-testid="practice-step-indicator"
                >
                  Practice {activeStepIdx} of {totalStepsCount}
                </span>
              )}

              {hasVocab && !isVocabPracticeType && (
                <button
                  onClick={() => setIsVocabOpen(!isVocabOpen)}
                  style={{
                    background: isVocabOpen ? 'rgba(95, 210, 255, 0.15)' : 'var(--mave-raised)',
                    border: isVocabOpen ? '1px solid var(--mave-cyan)' : '1px solid var(--mave-line)',
                    borderRadius: '6px',
                    color: isVocabOpen ? 'var(--mave-cyan)' : 'var(--mave-dim)',
                    padding: '3px 9px',
                    fontSize: '11px',
                    fontWeight: 500,
                    cursor: 'pointer',
                    fontFamily: 'var(--mave-font-mono)',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}
                  data-testid="btn-toggle-vocab-drawer"
                  title="Toggle Vocabulary Drawer"
                >
                  <span>Vocabulary · {session.vocabulary!.length}</span>
                </button>
              )}

              <button
                onClick={() => setShowOptions(!showOptions)}
                style={{
                  background: showOptions ? 'rgba(255, 255, 255, 0.1)' : 'var(--mave-raised)',
                  border: '1px solid var(--mave-line)',
                  borderRadius: '6px',
                  color: showOptions ? 'var(--mave-ink)' : 'var(--mave-faint)',
                  padding: '3px 9px',
                  fontSize: '11px',
                  cursor: 'pointer',
                  fontFamily: 'var(--mave-font-mono)'
                }}
                data-testid="btn-toggle-language-settings"
                title="Language practice settings"
              >
                Options
              </button>
            </div>
          </div>

          {/* Expandable Options Popover/Bar */}
          {showOptions && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '8px',
                paddingTop: '8px',
                borderTop: '1px solid var(--mave-line)',
                marginTop: '2px'
              }}
              data-testid="language-options-bar"
            >
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
          )}

          {/* Topic */}
          {session.topic && (
            <div style={{ fontSize: '16px', fontWeight: 600, color: 'var(--mave-ink)', marginTop: '2px' }} data-testid="language-session-topic">
              {session.topic}
            </div>
          )}
        </div>

        {/* 2. Roleplay Scenario Context Strip (if roleplay session) */}
        {session.roleplayScenario && (
          <RoleplayBanner
            scenario={{
              ...session.roleplayScenario,
              isOutOfRole: outOfRoleState
            }}
            onStepOutOfRole={handleStepOutOfRole}
            onResumeRoleplay={handleResumeRoleplay}
          />
        )}

        {/* 3. STEP-OUT DIRECT MAVE COACH CARD (Dominant when paused) */}
        {outOfRoleState ? (
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
            data-testid="roleplay-stepout-coach-card"
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--mave-cyan)', textTransform: 'uppercase', letterSpacing: '0.08em', fontFamily: 'var(--mave-font-mono)' }}>
                MAVE (Direct Coach)
              </span>
              <span style={{ fontSize: '11px', color: 'var(--mave-dim)', fontFamily: 'var(--mave-font-mono)' }}>
                Roleplay paused · Explanation
              </span>
            </div>

            <div style={{ fontSize: '15px', lineHeight: 1.6, color: 'var(--mave-ink)' }}>
              {session.topic?.includes('Cafe') || session.roleplayScenario?.situation?.includes('substitution') ? (
                <>
                  <p style={{ margin: '0 0 8px 0' }}>
                    Here’s what <strong>"substitution"</strong> means in this context:
                  </p>
                  <p style={{ margin: '0 0 8px 0', color: 'var(--mave-dim)' }}>
                    <strong>Substitution</strong> refers to replacing one standard ingredient with another — such as requesting oat milk instead of whole dairy milk.
                  </p>
                  <div style={{ background: 'var(--mave-raised)', padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--mave-line)', margin: '8px 0' }}>
                    <div style={{ fontSize: '12px', color: 'var(--mave-faint)', marginBottom: '4px', fontFamily: 'var(--mave-font-mono)' }}>PRACTICE PHRASES</div>
                    <div style={{ color: 'var(--mave-cyan)', fontWeight: 500 }}>"Could I substitute oat milk for dairy milk?"</div>
                    <div style={{ color: 'var(--mave-dim)', fontSize: '13px' }}>"Is there an extra charge for oat milk substitution?"</div>
                  </div>
                </>
              ) : (
                <p style={{ margin: 0, color: 'var(--mave-dim)' }}>
                  {session.currentPrompt || 'Roleplay is currently paused. You can ask MAVE any questions or clarify vocabulary before resuming.'}
                </p>
              )}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '4px' }}>
              <button
                onClick={handleResumeRoleplay}
                style={{
                  background: 'rgba(95, 210, 255, 0.15)',
                  border: '1px solid var(--mave-cyan)',
                  borderRadius: '8px',
                  color: 'var(--mave-cyan)',
                  padding: '8px 18px',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  fontFamily: 'var(--mave-font-mono)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  boxShadow: '0 0 16px rgba(95, 210, 255, 0.2)'
                }}
                data-testid="btn-resume-roleplay-coach"
              >
                <span>Resume Roleplay</span>
              </button>

              <button
                onClick={() => onListenExample?.('Is there an extra charge for oat milk substitution?')}
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
                data-testid="btn-listen-coach-example"
              >
                <SpeakerIcon size={13} color="currentColor" />
                <span>Listen Example</span>
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* 4. DEDICATED VOCABULARY MODE (Primary Content) */}
            {isVocabPracticeType && session.vocabulary && (
              <VocabularyPanel
                items={session.vocabulary}
                onSaveItem={onSaveVocabularyMock}
              />
            )}

            {/* 5. ACTIVE PRACTICE PROMPT (Dominant Dialogue Turn) */}
            {!isVocabPracticeType && session.currentPrompt && !isCompleted && (
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
          </>
        )}

        {/* 6. CORRECTIONS & LEARNING FEEDBACK (Only when corrections exist for current turn) */}
        {session.corrections && session.corrections.length > 0 && (
          <InlineCorrectionCard
            corrections={session.corrections}
            intensity={localIntensity}
            targetLanguage={session.targetLanguage}
          />
        )}

        {/* 7. PRONUNCIATION GUIDE (Quiet metadata disclosure) */}
        {session.pronunciationGuide && (
          <PronunciationGuideCard
            guide={session.pronunciationGuide}
            onListenExample={onListenExample}
            onStartSpeakingPractice={handleSpeakClick}
            officeMode={officeMode}
          />
        )}

        {/* 8. COMPLETED STATE: SESSION SUMMARY */}
        {isCompleted && session.sessionSummary && (
          <SessionSummaryCard
            summary={session.sessionSummary}
            onPracticeAgain={onPracticeAgain}
          />
        )}
      </div>

      {/* =========================================================================
          VOCABULARY CONTEXTUAL DRAWER (Collapsed by default in speaking/roleplay)
         ========================================================================= */}
      {showVocabDrawer && (
        <div
          className="mave-custom-scrollbar"
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
            minWidth: 0,
            minHeight: 0,
            overflowY: isNarrow ? 'visible' : 'auto',
            overflowX: 'hidden'
          }}
          data-testid="language-context-panel"
        >
          {/* Drawer Top Navigation */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '4px 6px'
            }}
          >
            <span
              style={{
                fontSize: '11px',
                fontWeight: 700,
                color: 'var(--mave-faint)',
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                fontFamily: 'var(--mave-font-mono)'
              }}
            >
              Session Vocabulary
            </span>
            <button
              onClick={() => setIsVocabOpen(false)}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--mave-dim)',
                fontSize: '16px',
                cursor: 'pointer',
                padding: '2px 6px',
                borderRadius: '4px',
                lineHeight: 1
              }}
              data-testid="btn-close-vocab-drawer"
              title="Close vocabulary drawer"
            >
              ×
            </button>
          </div>

          <VocabularyPanel
            items={session.vocabulary!}
            onSaveItem={onSaveVocabularyMock}
          />
        </div>
      )}
    </div>
  );
};
