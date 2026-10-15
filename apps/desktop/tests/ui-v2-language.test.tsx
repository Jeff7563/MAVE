import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { WorkspaceShell } from '../src/renderer/src/ui-v2/workspace/WorkspaceShell';
import { LanguageWorkspaceView } from '../src/renderer/src/ui-v2/workspace/LanguageWorkspaceView';
import { AgentWorkspaceView } from '../src/renderer/src/ui-v2/workspace/AgentWorkspaceView';
import { InlineCorrectionCard } from '../src/renderer/src/ui-v2/language/InlineCorrectionCard';
import {
  RoleplayBanner,
  PronunciationGuideCard,
  VocabularyPanel,
  SessionSummaryCard
} from '../src/renderer/src/ui-v2/language/LanguageComponents';
import { CardRenderer } from '../src/renderer/src/ui-v2/cards/CardRenderer';
import { ConversationShell } from '../src/renderer/src/ui-v2/conversation/ConversationShell';
import { U6_LANGUAGE_SCENARIOS } from '../src/renderer/src/ui-v2/mocks/mock-scenarios';
import type {
  WorkspaceState,
  LanguageSessionState,
  CorrectionCardData,
  LanguageCorrection,
  PronunciationGuideItem,
  RoleplayScenario,
  LanguageVocabularyItem,
  LanguageSessionSummary
} from '../src/renderer/src/ui-v2/types';

describe('MAVE UI V2 — U6 Language Experience & Conversational Learning System Tests', () => {
  // -------------------------------------------------------------------------
  // 1. Language Is An Experience Context, Not MAVE's Global Identity
  // -------------------------------------------------------------------------
  describe('1. Language Is An Experience Context, Not MAVE Global Identity', () => {
    it('Headers display MAVE / Language Practice rather than claiming global AI Language Assistant identity', () => {
      const state: LanguageSessionState = {
        sessionId: 'sess-identity',
        targetLanguage: 'English',
        practiceType: 'speaking',
        topic: 'Engineering Standup',
        sessionGoal: 'Practice concise technical updates',
        status: 'practicing'
      };

      const html = renderToStaticMarkup(
        <LanguageWorkspaceView
          state={{
            type: 'language',
            title: 'Language Practice',
            status: 'running',
            languageSession: state
          }}
        />
      );

      // Must display MAVE with contextual language subtitle/badge
      expect(html).toContain('MAVE');
      expect(html).toContain('Language Practice');
      expect(html).toContain('Engineering Standup');

      // Invariant: Never globally branded as a standalone language assistant
      expect(html).not.toContain('Your AI Language Assistant');
      expect(html).not.toContain('Duolingo');
    });

    it('WorkspaceShell with language session renders canonical Level 3 workspace structure', () => {
      const wsState: WorkspaceState = {
        id: 'ws-lang-test',
        type: 'language',
        title: 'Interview Preparation',
        status: 'running',
        userFacingState: 'Speaking Practice Active',
        languageSession: {
          sessionId: 'sess-ws',
          targetLanguage: 'English',
          practiceType: 'roleplay',
          topic: 'Technical Interview',
          sessionGoal: 'Answer behavioral system design questions',
          status: 'practicing'
        }
      };

      const html = renderToStaticMarkup(
        <WorkspaceShell state={wsState} />
      );

      expect(html).toContain('Interview Preparation');
      expect(html).toContain('Technical Interview');
      expect(html).toContain('MAVE');
      expect(html).toContain('Language Practice');
    });
  });

  // -------------------------------------------------------------------------
  // 2. Language Across Surface Levels
  // -------------------------------------------------------------------------
  describe('2. Language Across Surface Levels', () => {
    it('Quick translation renders compactly as a card without forcing workspace elevation', () => {
      const html = renderToStaticMarkup(
        <CardRenderer
          card={{
            id: 'trans-compact-test',
            type: 'translation',
            originalText: 'actually',
            translatedText: 'จริงๆ แล้ว / ที่จริงแล้ว',
            targetLanguage: 'Thai',
            pronunciation: 'ak-choo-uh-lee',
            density: 'compact'
          }}
        />
      );

      expect(html).toContain('actually');
      expect(html).toContain('จริงๆ แล้ว / ที่จริงแล้ว');
      expect(html).not.toContain('Session Summary');
      expect(html).not.toContain('Roleplay');
    });

    it('Sentence correction renders inline inside conversation without opening workspace', () => {
      const corrData: CorrectionCardData = {
        id: 'card-corr-conv',
        type: 'correction',
        correction: {
          id: 'c-test-1',
          originalText: 'I am agree with your opinion.',
          correctedText: 'I agree with your opinion.',
          explanation: 'Agree is already a verb; do not use with am.',
          alternativePhrasings: ['I share your view.', 'I agree completely.'],
          category: 'grammar',
          intensity: 'light'
        }
      };

      const html = renderToStaticMarkup(
        <CardRenderer card={corrData} />
      );

      expect(html).toContain('I am agree with your opinion.');
      expect(html).toContain('I agree with your opinion.');
      expect(html).toContain('Agree is already a verb');
      expect(html).toContain('I share your view.');
    });

    it('Sustained session runs in full Workspace surface Level 3', () => {
      const wsState: WorkspaceState = {
        id: 'ws-sustained',
        type: 'language',
        title: 'Deep Business Negotiation',
        status: 'running',
        languageSession: {
          sessionId: 'sess-sustained',
          targetLanguage: 'English',
          practiceType: 'roleplay',
          topic: 'Contract Negotiation',
          sessionGoal: 'Negotiate SLA terms calmly',
          status: 'practicing',
          currentPrompt: 'Could you clarify the clause regarding warranty liability?',
          corrections: [
            {
              id: 'c-sustained-1',
              originalText: 'We can accept if the term is more low.',
              correctedText: 'We can accept if the term is lower.',
              explanation: 'Comparative of low is lower, not more low.',
              category: 'grammar'
            }
          ]
        }
      };

      const html = renderToStaticMarkup(
        <WorkspaceShell state={wsState} />
      );

      expect(html).toContain('Deep Business Negotiation');
      expect(html).toContain('Contract Negotiation');
      expect(html).toContain('We can accept if the term is lower.');
    });
  });

  // -------------------------------------------------------------------------
  // 3. Inline Correction Card Semantics & Tone
  // -------------------------------------------------------------------------
  describe('3. Inline Correction Card Semantics & Tone', () => {
    it('Renders calm contrast: You said -> More natural -> Why -> Alternative', () => {
      const correction: LanguageCorrection = {
        id: 'c-tone-1',
        originalText: 'She don’t like the design proposal.',
        correctedText: 'She doesn’t like the design proposal.',
        explanation: 'Third person singular takes doesn’t in standard English.',
        alternativePhrasings: [
          'She isn’t fond of the design proposal.',
          'She has reservations about the design.'
        ],
        category: 'grammar',
        intensity: 'balanced'
      };

      const html = renderToStaticMarkup(
        <InlineCorrectionCard correction={correction} />
      );

      // Verify tone labels
      expect(html).toContain('You said');
      expect(html).toContain('She don’t like the design proposal.');
      expect(html).toContain('More natural');
      expect(html).toContain('She doesn’t like the design proposal.');
      expect(html).toContain('Why:');
      expect(html).toContain('Third person singular takes doesn’t');
      expect(html).toContain('Alternatives:');
      expect(html).toContain('She isn’t fond of the design proposal.');

      // Invariant: Non-punitive tone, no harsh red score or failure label
      expect(html).not.toContain('WRONG');
      expect(html).not.toContain('FAILED');
      expect(html).not.toContain('Score: 0/100');
    });

    it('Renders intensity badges accurately (light, balanced, detailed)', () => {
      const intensities: ('light' | 'balanced' | 'detailed')[] = ['light', 'balanced', 'detailed'];

      for (const intensity of intensities) {
        const html = renderToStaticMarkup(
          <InlineCorrectionCard
            correction={{
              id: `c-${intensity}`,
              originalText: 'Test text',
              correctedText: 'Corrected text',
              intensity
            }}
          />
        );
        expect(html).toContain(intensity.toUpperCase());
      }
    });

    it('Renders list of multiple corrections with progressive disclosure header', () => {
      const corrections: LanguageCorrection[] = [
        {
          id: 'c1',
          originalText: 'I go to store yesterday.',
          correctedText: 'I went to the store yesterday.'
        },
        {
          id: 'c2',
          originalText: 'He don’t know.',
          correctedText: 'He doesn’t know.'
        }
      ];

      const html = renderToStaticMarkup(
        <InlineCorrectionCard corrections={corrections} />
      );

      expect(html).toContain('Corrections · 2');
      expect(html).toContain('I went to the store yesterday.');
      expect(html).toContain('He doesn’t know.');
    });
  });

  // -------------------------------------------------------------------------
  // 4. Roleplay Banner & Escapability
  // -------------------------------------------------------------------------
  describe('4. Roleplay Banner & Escapability', () => {
    it('Renders roleplay context with user and assistant roles and escape hint', () => {
      const scenario: RoleplayScenario = {
        id: 'rp-cafe',
        title: 'Ordering Specialty Coffee in Melbourne',
        userRole: 'Customer ordering a flat white with oat milk',
        assistantRole: 'Friendly Barista at a busy café',
        setting: 'Busy morning café on Flinders Lane',
        goal: 'Order coffee and customize milk and sugar politely',
        isOutOfRole: false
      };

      const html = renderToStaticMarkup(
        <RoleplayBanner scenario={scenario} />
      );

      expect(html).toContain('Ordering Specialty Coffee in Melbourne');
      expect(html).toContain('Roleplay Active');
      expect(html).toContain('Customer ordering a flat white with oat milk');
      expect(html).toContain('Friendly Barista at a busy café');
      expect(html).toContain('Ask MAVE to explain or step out of role anytime');
      expect(html).toContain('Step out of role');
    });

    it('Reflects stepped out of role state cleanly when user pauses or asks for explanation', () => {
      const scenario: RoleplayScenario = {
        id: 'rp-interview',
        title: 'Job Interview',
        userRole: 'Candidate',
        assistantRole: 'Hiring Manager',
        setting: 'Conference room',
        goal: 'Answer interview questions',
        isOutOfRole: true
      };

      const html = renderToStaticMarkup(
        <RoleplayBanner scenario={scenario} />
      );

      expect(html).toContain('Roleplay Paused (MAVE Direct)');
      expect(html).toContain('MAVE speaking directly as coach');
      expect(html).not.toContain('Step out of role');
    });
  });

  // -------------------------------------------------------------------------
  // 5. Pronunciation Guide & Truthfulness Invariant
  // -------------------------------------------------------------------------
  describe('5. Pronunciation Guide & Truthfulness Invariant', () => {
    it('Renders IPA, phonetic spelling, stress hints, mouth guide, and mock audio actions', () => {
      const guide: PronunciationGuideItem = {
        id: 'pron-1',
        wordOrPhrase: 'Particularly',
        ipa: '/pərˈtɪkjələrli/',
        phoneticSpelling: 'par-TIK-yuh-ler-lee',
        stressHint: 'Stress falls firmly on the second syllable: TIK.',
        mouthGuide: 'Keep lips neutral on "par-", lift tongue tip behind upper teeth for "tik", relax on "-yuh-ler-lee".',
        practiceCount: 3
      };

      const html = renderToStaticMarkup(
        <PronunciationGuideCard guide={guide} />
      );

      expect(html).toContain('Particularly');
      expect(html).toContain('/pərˈtɪkjələrli/');
      expect(html).toContain('par-TIK-yuh-ler-lee');
      expect(html).toContain('Stress falls firmly on the second syllable');
      expect(html).toContain('Keep lips neutral');
      expect(html).toContain('Listen Example');
      expect(html).toContain('Practice Speaking');
      expect(html).toContain('Practiced 3 times');
    });

    it('Truthfulness Invariant: Strictly NO fake score, fake percentage, or fake phoneme accuracy bar', () => {
      const guide: PronunciationGuideItem = {
        id: 'pron-truth',
        wordOrPhrase: 'Ephemeral',
        ipa: '/ɪˈfemərəl/',
        phoneticSpelling: 'ih-FEM-er-uhl',
        stressHint: 'Stress on FEM.'
      };

      const html = renderToStaticMarkup(
        <PronunciationGuideCard guide={guide} />
      );

      // Invariant: Without real local/hardware audio scoring models, no fake accuracy
      expect(html).not.toContain('92%');
      expect(html).not.toContain('Score:');
      expect(html).not.toContain('Accuracy:');
      expect(html).not.toContain('Phoneme match:');
      expect(html).not.toContain('CEFR:');
    });
  });

  // -------------------------------------------------------------------------
  // 6. Vocabulary Panel & Status Progression
  // -------------------------------------------------------------------------
  describe('6. Vocabulary Panel & Status Progression', () => {
    it('Renders vocabulary items with strictly valid statuses (seen, practiced, reviewed)', () => {
      const items: LanguageVocabularyItem[] = [
        {
          id: 'v1',
          term: 'Serendipity',
          meaning: 'The occurrence of events by chance in a happy or beneficial way',
          partOfSpeech: 'noun',
          exampleSentence: 'Finding this book was pure serendipity.',
          status: 'seen'
        },
        {
          id: 'v2',
          term: 'Pragmatic',
          meaning: 'Dealing with things sensibly and realistically',
          partOfSpeech: 'adj',
          exampleSentence: 'We need a pragmatic solution to this bug.',
          status: 'practiced',
          isSavedMock: true
        },
        {
          id: 'v3',
          term: 'Concise',
          meaning: 'Giving a lot of information clearly and in a few words',
          partOfSpeech: 'adj',
          status: 'reviewed'
        }
      ];

      const html = renderToStaticMarkup(
        <VocabularyPanel items={items} />
      );

      expect(html).toContain('Session Vocabulary Recap · 3');
      expect(html).toContain('Serendipity');
      expect(html).toContain('Pragmatic');
      expect(html).toContain('Concise');
      expect(html).toContain('SEEN');
      expect(html).toContain('PRACTICED');
      expect(html).toContain('REVIEWED');
      expect(html).toContain('Saved');
    });

    it('Truthfulness Invariant: Strictly NO "mastered" status without validated persistent memory', () => {
      const items: LanguageVocabularyItem[] = [
        {
          id: 'v-truth',
          term: 'Resilience',
          meaning: 'Capacity to recover quickly',
          status: 'reviewed'
        }
      ];

      const html = renderToStaticMarkup(
        <VocabularyPanel items={items} />
      );

      expect(html).not.toContain('MASTERED');
      expect(html).not.toContain('Mastered');
      expect(html).not.toContain('Fluent');
    });
  });

  // -------------------------------------------------------------------------
  // 7. Session Summary & Metric Truthfulness
  // -------------------------------------------------------------------------
  describe('7. Session Summary & Metric Truthfulness', () => {
    it('Renders observed session facts: topics, phrases count, corrections count, vocabulary count, next step', () => {
      const summary: LanguageSessionSummary = {
        sessionId: 'sess-sum-1',
        targetLanguage: 'English',
        durationMinutes: 14,
        phrasesSpokenCount: 18,
        correctionsReviewedCount: 3,
        vocabularyEncounteredCount: 6,
        topicsPracticed: ['System Architecture Discussion', 'Edge Case Handling'],
        nextPracticeSuggestion: 'Practice past tense irregular verbs in quick incident response dialogue.'
      };

      const html = renderToStaticMarkup(
        <SessionSummaryCard summary={summary} onPracticeAgain={() => {}} />
      );

      expect(html).toContain('Session Recap');
      expect(html).toContain('14m');
      expect(html).toContain('18');
      expect(html).toContain('Phrases Spoken');
      expect(html).toContain('3');
      expect(html).toContain('Corrections');
      expect(html).toContain('6');
      expect(html).toContain('New Terms');
      expect(html).toContain('System Architecture Discussion');
      expect(html).toContain('Edge Case Handling');
      expect(html).toContain('Practice past tense irregular verbs');
      expect(html).toContain('Practice Again');
    });

    it('Truthfulness Invariant: Strictly NO gamification XP, fake CEFR score, or fake improvement percentages', () => {
      const summary: LanguageSessionSummary = {
        sessionId: 'sess-sum-truth',
        targetLanguage: 'English',
        durationMinutes: 10,
        phrasesSpokenCount: 12,
        correctionsReviewedCount: 2,
        vocabularyEncounteredCount: 4,
        topicsPracticed: ['Casual Chat']
      };

      const html = renderToStaticMarkup(
        <SessionSummaryCard summary={summary} />
      );

      expect(html).not.toContain('+50 XP');
      expect(html).not.toContain('XP');
      expect(html).not.toContain('English improved by');
      expect(html).not.toContain('Level: B2');
      expect(html).not.toContain('Streak:');
    });
  });

  // -------------------------------------------------------------------------
  // 8. U5 Preflight Hardening Invariant: Agent Workspace Execution Logs
  // -------------------------------------------------------------------------
  describe('8. U5 Preflight Hardening Invariant: Observable Execution Logs', () => {
    it('AgentWorkspaceView renders execution logs with data-testid="agent-execution-logs" and observable tool events', () => {
      const agentState: WorkspaceState = {
        type: 'agent',
        status: 'running',
        userFacingState: 'Building Workspace Prototype',
        observableProgressText: 'Compiling TypeScript bundle…',
        targetFiles: [
          { path: 'src/renderer/src/ui-v2/workspace/AgentWorkspaceView.tsx', status: 'modified' }
        ],
        steps: [
          {
            id: 's1',
            label: 'Run typecheck',
            status: 'completed',
            command: 'pnpm --filter @mave/desktop typecheck',
            outputSummary: 'Found 0 errors in 124 files'
          },
          {
            id: 's2',
            label: 'Compile renderer bundle',
            status: 'running',
            command: 'pnpm --filter @mave/desktop build:renderer'
          }
        ]
      };

      const html = renderToStaticMarkup(
        <AgentWorkspaceView state={agentState} />
      );

      // Verify execution logs container
      expect(html).toContain('data-testid="agent-execution-logs"');
      expect(html).toContain('pnpm --filter @mave/desktop typecheck');
      expect(html).toContain('Found 0 errors in 124 files');
      expect(html).toContain('Compile renderer bundle');

      // Invariant: NEVER hidden model reasoning, internal scratchpad, or private CoT
      expect(html).not.toContain('hidden reasoning');
      expect(html).not.toContain('private scratchpad');
      expect(html).not.toContain('internal chain of thought');
    });
  });

  // -------------------------------------------------------------------------
  // 9. All 18 U6 Scenarios Render Without Error
  // -------------------------------------------------------------------------
  describe('9. All 18 U6 Scenarios Render Without Error', () => {
    it(`Contains exactly 18 U6 scenarios`, () => {
      expect(U6_LANGUAGE_SCENARIOS.length).toBe(18);
    });

    U6_LANGUAGE_SCENARIOS.forEach((scenario) => {
      it(`Renders scenario [${scenario.id}]: ${scenario.name} cleanly`, () => {
        let html = '';

        if (scenario.snapshot.level === 'workspace') {
          html = renderToStaticMarkup(
            <WorkspaceShell
              state={scenario.snapshot.workspace}
              conversationState={scenario.snapshot.conversation}
            />
          );
        } else if (scenario.snapshot.level === 'conversation') {
          html = renderToStaticMarkup(
            <ConversationShell
              state={scenario.snapshot.conversation}
            />
          );
        } else {
          // Presence level
          html = scenario.snapshot.presence.quickResponse?.text || '';
        }

        // Verify HTML generated and contains expected text
        expect(html.length).toBeGreaterThan(0);
      });
    });
  });

  // -------------------------------------------------------------------------
  // 10. VSM5 Visual Migration & Architectural Invariants
  // -------------------------------------------------------------------------
  describe('10. VSM5 Visual Migration & Architectural Invariants', () => {
    it('Invariant 1: Language context does not replace MAVE global identity', () => {
      const html = renderToStaticMarkup(
        <LanguageWorkspaceView
          state={{
            type: 'language',
            status: 'running',
            languageSession: {
              targetLanguage: 'English',
              practiceType: 'speaking',
              topic: 'Daily Conversation',
              status: 'practicing'
            }
          }}
        />
      );

      expect(html).toContain('data-testid="language-practice-identity-badge"');
      expect(html).toContain('MAVE / Language Practice');
      expect(html).not.toContain('Your AI Language Assistant');
      expect(html).not.toContain('Duolingo');
    });

    it('Invariant 2: Quick language request stays Presence or Conversation without workspace elevation', () => {
      const pScenario = U6_LANGUAGE_SCENARIOS.find((s) => s.id === 'u6_01_quick_translation_presence');
      expect(pScenario).toBeDefined();
      expect(pScenario!.snapshot.level).toBe('presence');
      expect(pScenario!.snapshot.presence.quickResponse?.text).toContain('actually');

      const cScenario = U6_LANGUAGE_SCENARIOS.find((s) => s.id === 'u6_02_short_correction_conversation');
      expect(cScenario).toBeDefined();
      expect(cScenario!.snapshot.level).toBe('conversation');
      expect(cScenario!.snapshot.conversation?.cards?.[0]?.type).toBe('correction');
    });

    it('Invariant 3: Workspace is reserved for sustained practice or roleplay sessions', () => {
      const freeConv = U6_LANGUAGE_SCENARIOS.find((s) => s.id === 'u6_04_free_conversation_workspace');
      expect(freeConv).toBeDefined();
      expect(freeConv!.snapshot.level).toBe('workspace');
      expect(freeConv!.snapshot.workspace.languageSession?.practiceType).toBe('free_conversation');

      const roleplay = U6_LANGUAGE_SCENARIOS.find((s) => s.id === 'u6_05_roleplay_coffee_shop');
      expect(roleplay).toBeDefined();
      expect(roleplay!.snapshot.level).toBe('workspace');
      expect(roleplay!.snapshot.workspace.languageSession?.practiceType).toBe('roleplay');
    });

    it('Invariant 4: Truthfulness — strictly ZERO fake score in pronunciation guidance', () => {
      const html = renderToStaticMarkup(
        <PronunciationGuideCard
          guide={{
            phrase: 'Sophisticated pronunciation',
            ipa: '/səˈfɪs.tɪ.keɪ.tɪd/',
            phoneticSpelling: 'suh-FIS-tih-kay-tid',
            stressHint: 'Stress on the second syllable (FIS).',
            mouthGuide: 'Round lips slightly for the initial vowel.'
          }}
        />
      );

      expect(html).toContain('data-testid="no-score-guarantee"');
      expect(html).toContain('Guide only · no audio evaluation');
      expect(html).not.toContain('92%');
      expect(html).not.toContain('85%');
      expect(html).not.toContain('Score:');
      expect(html).not.toContain('Fluency:');
      expect(html).not.toContain('CEFR:');
    });

    it('Invariant 5: Roleplay is escapable — stepping out leaves MAVE responding directly as MAVE', () => {
      const html = renderToStaticMarkup(
        <RoleplayBanner
          scenario={{
            title: 'Hotel Check-in',
            userRole: 'Guest',
            assistantRole: 'Receptionist',
            isOutOfRole: true
          }}
        />
      );

      expect(html).toContain('Roleplay Paused (MAVE Direct)');
      expect(html).toContain('MAVE speaking directly as coach');
      expect(html).not.toContain('btn-step-out-of-role');
    });

    it('Invariant 6: Language to general task continuity without trapping the user', () => {
      const transitionScenario = U6_LANGUAGE_SCENARIOS.find((s) => s.id === 'u6_17_general_mave_transition');
      expect(transitionScenario).toBeDefined();
      expect(transitionScenario!.snapshot.workspace.status).toBe('paused');
      expect(transitionScenario!.snapshot.workspace.userFacingState).toContain('Session Paused');
      expect(transitionScenario?.snapshot.conversation?.messages?.some((m) => m.content.includes('เปิดโปรเจกต์ MAVE'))).toBe(true);
    });

    it('Invariant 7: Responsive narrow layout preserves practice artifact without clipping', () => {
      const narrowScenario = U6_LANGUAGE_SCENARIOS.find((s) => s.id === 'u6_18_narrow_workspace_adaptation');
      expect(narrowScenario).toBeDefined();
      expect(narrowScenario!.snapshot.workspace.type).toBe('language');

      const html = renderToStaticMarkup(
        <LanguageWorkspaceView state={narrowScenario!.snapshot.workspace} />
      );

      expect(html).toContain('data-testid="language-primary-practice-area"');
      expect(html).toContain('data-testid="active-practice-card"');
      expect(html).toContain('Can you describe your favorite hobby');
    });
  });

  // -------------------------------------------------------------------------
  // 11. VSM5.1 Language Workspace De-Dashboard & Roleplay Hardening
  // -------------------------------------------------------------------------
  describe('11. VSM5.1 Language Workspace De-Dashboard & Roleplay Hardening', () => {
    it('vocabulary is not permanent in default speaking workspace', () => {
      const html = renderToStaticMarkup(
        <LanguageWorkspaceView
          state={{
            type: 'language',
            status: 'running',
            languageSession: {
              targetLanguage: 'English',
              practiceType: 'free_conversation',
              topic: 'Daily Engineering Work',
              currentPrompt: 'What feature did you deploy today?',
              vocabulary: [
                { id: 'v1', term: 'Deploy', meaning: 'Release software to environment', status: 'seen' },
                { id: 'v2', term: 'Rollback', meaning: 'Revert to previous version', status: 'seen' }
              ],
              status: 'practicing'
            }
          }}
        />
      );

      // In default speaking, vocabulary panel is NOT rendered permanently
      expect(html).not.toContain('data-testid="language-context-panel"');
      // Instead, a contextual drawer toggle button is presented
      expect(html).toContain('data-testid="btn-toggle-vocab-drawer"');
      expect(html).toContain('Vocabulary · 2');
      // Dominant primary interaction is visible
      expect(html).toContain('data-testid="language-primary-practice-area"');
      expect(html).toContain('What feature did you deploy today?');
    });

    it('roleplay paused semantic state removes ROLEPLAY ACTIVE and Step out of role action', () => {
      const html = renderToStaticMarkup(
        <RoleplayBanner
          scenario={{
            title: 'Coffee Shop Roleplay',
            role: 'Barista',
            userRole: 'Customer',
            situation: 'Paused for vocabulary explanation: substitution.',
            location: 'Shibuya Coffee Roasters',
            isOutOfRole: true
          }}
        />
      );

      // Must NOT claim active roleplay
      expect(html).not.toContain('Roleplay Active');
      expect(html).not.toContain('ROLEPLAY ACTIVE');
      // Must NOT display redundant step out action
      expect(html).not.toContain('btn-step-out-of-role');
      expect(html).not.toContain('Step out of role');
      // Must clearly display paused state
      expect(html).toContain('Roleplay Paused');
      // Scenario strip remains quiet contextual information only
      expect(html).not.toContain('btn-resume-roleplay');
      expect(html).not.toContain('Resume Roleplay');
      // Must NOT use warning/amber color tokens
      expect(html).not.toContain('var(--mave-warn)');
    });

    it('Resume roleplay appears when paused and MAVE responds directly as coach', () => {
      const pauseScenario = U6_LANGUAGE_SCENARIOS.find((s) => s.id === 'u6_06_roleplay_explanation_break');
      expect(pauseScenario).toBeDefined();

      const html = renderToStaticMarkup(
        <LanguageWorkspaceView state={pauseScenario!.snapshot.workspace} />
      );

      // Direct MAVE Coach card dominates with single primary resume action
      expect(html).toContain('data-testid="roleplay-stepout-coach-card"');
      expect(html).toContain('MAVE (Direct Coach)');
      expect(html).toContain('substitution');
      expect(html).toContain('data-testid="btn-resume-roleplay"');
      expect(html).toContain('Resume Roleplay');
      // In-role prompt and step out action are NOT active
      expect(html).not.toContain('data-testid="btn-step-out-of-role"');
      expect(html).not.toContain('Roleplay Active');
    });

    it('correction preferences are secondary and not required primary chrome', () => {
      const html = renderToStaticMarkup(
        <LanguageWorkspaceView
          state={{
            type: 'language',
            status: 'running',
            languageSession: {
              targetLanguage: 'English',
              practiceType: 'free_conversation',
              topic: 'Lightweight Conversation',
              currentPrompt: 'How was your morning?',
              status: 'practicing'
            }
          }}
        />
      );

      // Options button is available
      expect(html).toContain('data-testid="btn-toggle-language-settings"');
      expect(html).toContain('Options');
      // Cluttering intensity level buttons are NOT present in default collapsed chrome
      expect(html).not.toContain('data-testid="btn-intensity-light"');
      expect(html).not.toContain('data-testid="btn-intensity-detailed"');
      expect(html).not.toContain('data-testid="btn-toggle-translation"');
    });

    it('pronunciation disclosure is quiet metadata while truthfulness remains strictly intact', () => {
      const html = renderToStaticMarkup(
        <PronunciationGuideCard
          guide={{
            phrase: 'Phenomenal phrasing',
            ipa: '/fəˈnɒm.ɪ.nəl/',
            phoneticSpelling: 'fuh-NOM-ih-nuhl',
            stressHint: 'Stress on the second syllable: NOM.',
            mouthGuide: 'Start with teeth on lower lip for /f/.'
          }}
        />
      );

      // Truthful disclosure is quiet metadata
      expect(html).toContain('data-testid="no-score-guarantee"');
      expect(html).toContain('Guide only · no audio evaluation');
      // No fake scores
      expect(html).not.toContain('92%');
      expect(html).not.toContain('Score:');
      expect(html).not.toContain('Accuracy:');
      // Pronunciation content dominates
      expect(html).toContain('Phenomenal phrasing');
      expect(html).toContain('/fəˈnɒm.ɪ.nəl/');
    });
  });

  // -------------------------------------------------------------------------
  // 12. VSM5.2 Language State Sync & Final Visual Micro-Hardening
  // -------------------------------------------------------------------------
  describe('12. VSM5.2 Language State Sync & Final Visual Micro-Hardening', () => {
    it('resume clears paused presentation metadata across workspace and roleplay surfaces', () => {
      const activeRoleplayScenario = U6_LANGUAGE_SCENARIOS.find((s) => s.id === 'u6_05_roleplay_coffee_shop');
      expect(activeRoleplayScenario).toBeDefined();

      const html = renderToStaticMarkup(
        <WorkspaceShell state={activeRoleplayScenario!.snapshot.workspace} />
      );

      // Workspace header badge updates to active-context status
      expect(html).toContain('Roleplay: Coffee Shop');
      expect(html).not.toContain('ROLEPLAY PAUSED');
      expect(html).not.toContain('EXPLANATION');

      // Inner roleplay body is consistently active
      expect(html).toContain('Roleplay Active');
      expect(html).toContain('Step out of role');
      expect(html).not.toContain('Resume Roleplay');
    });

    it('paused state exposes exactly one primary resume action', () => {
      const pauseScenario = U6_LANGUAGE_SCENARIOS.find((s) => s.id === 'u6_06_roleplay_explanation_break');
      expect(pauseScenario).toBeDefined();

      const html = renderToStaticMarkup(
        <LanguageWorkspaceView state={pauseScenario!.snapshot.workspace} />
      );

      // Scenario strip does NOT render a button
      expect(html).toContain('Roleplay Paused (MAVE Direct)');
      expect(html).not.toContain('btn-step-out-of-role');

      // Direct MAVE Coach card exposes the single primary resume action
      expect(html).toContain('data-testid="roleplay-stepout-coach-card"');
      expect(html).toContain('data-testid="btn-resume-roleplay"');

      // Total count of 'Resume Roleplay' in the entire markup is exactly 1
      const matches = html.match(/Resume Roleplay/g);
      expect(matches).not.toBeNull();
      expect(matches!.length).toBe(1);
    });

    it('narrow viewport does not leak presentation or debug terminology into canonical surface', () => {
      const narrowScenario = U6_LANGUAGE_SCENARIOS.find((s) => s.id === 'u6_18_narrow_workspace_adaptation');
      expect(narrowScenario).toBeDefined();

      const html = renderToStaticMarkup(
        <WorkspaceShell state={narrowScenario!.snapshot.workspace} />
      );

      // Zero implementation / viewport debug terminology in canonical MAVE UI
      expect(html).not.toContain('NARROW VIEWPORT');
      expect(html).not.toContain('ADAPTATION');
      expect(html).not.toContain('Adaptive Language Workspace');

      // Canonical title and status badge
      expect(html).toContain('title="Free Conversation"');
      expect(html).toContain('Conversing in English');
    });
  });

  // -------------------------------------------------------------------------
  // 13. VSM5.3 Language Final State Consistency & Narrow Header Polish
  // -------------------------------------------------------------------------
  describe('13. VSM5.3 Language Final State Consistency & Narrow Header Polish', () => {
    it('A. active roleplay contains no paused-state contextual copy', () => {
      const activeRoleplay = U6_LANGUAGE_SCENARIOS.find((s) => s.id === 'u6_05_roleplay_coffee_shop');
      expect(activeRoleplay).toBeDefined();

      const html = renderToStaticMarkup(
        <WorkspaceShell state={activeRoleplay!.snapshot.workspace} />
      );

      expect(html).toContain('Roleplay Active');
      expect(html).toContain('You just walked into a busy Tokyo specialty cafe');
      expect(html).toContain('Step out of role');
      // Must contain zero paused-state copy
      expect(html).not.toContain('Paused for');
      expect(html).not.toContain('Roleplay Paused');
      expect(html).not.toContain('substitution');
    });

    it('B. paused roleplay contains pause reason', () => {
      const pausedRoleplay = U6_LANGUAGE_SCENARIOS.find((s) => s.id === 'u6_06_roleplay_explanation_break');
      expect(pausedRoleplay).toBeDefined();

      const html = renderToStaticMarkup(
        <WorkspaceShell state={pausedRoleplay!.snapshot.workspace} />
      );

      expect(html).toContain('Roleplay Paused (MAVE Direct)');
      expect(html).toContain('Paused for vocabulary explanation');
      expect(html).toContain('substitution');
      expect(html).toContain('Resume Roleplay');
      expect(html).not.toContain('Step out of role');
    });

    it('C. resumed roleplay restores active scenario context', () => {
      const pausedRoleplay = U6_LANGUAGE_SCENARIOS.find((s) => s.id === 'u6_06_roleplay_explanation_break');
      expect(pausedRoleplay).toBeDefined();

      // Simulate resumed state
      const resumedState = {
        ...pausedRoleplay!.snapshot.workspace,
        status: 'running' as const,
        userFacingState: 'Roleplay: Coffee Shop',
        languageSession: {
          ...pausedRoleplay!.snapshot.workspace.languageSession!,
          status: 'practicing' as const,
          roleplayScenario: {
            ...pausedRoleplay!.snapshot.workspace.languageSession!.roleplayScenario!,
            isOutOfRole: false
          }
        }
      };

      const html = renderToStaticMarkup(
        <WorkspaceShell state={resumedState} />
      );

      expect(html).toContain('Roleplay: Coffee Shop');
      expect(html).toContain('Roleplay Active');
      expect(html).toContain('You just walked into a busy Tokyo specialty cafe');
      expect(html).toContain('Step out of role');
      // Must contain ZERO paused or explanation copy
      expect(html).not.toContain('Paused for');
      expect(html).not.toContain('substitution');
      expect(html).not.toContain('Resume Roleplay');
    });

    it('D. narrow workspace header exposes no horizontal overflow', () => {
      const narrowScenario = U6_LANGUAGE_SCENARIOS.find((s) => s.id === 'u6_18_narrow_workspace_adaptation');
      expect(narrowScenario).toBeDefined();

      const html = renderToStaticMarkup(
        <WorkspaceShell state={narrowScenario!.snapshot.workspace} isNarrow={true} />
      );

      // Non-essential toggles collapsed to eliminate horizontal overflow
      expect(html).not.toContain('data-testid="btn-workspace-focus"');
      expect(html).not.toContain('data-testid="btn-workspace-toggle-chat"');
      expect(html).not.toContain('data-testid="btn-workspace-toggle-context"');

      // Critical surface controls remain available
      expect(html).toContain('data-testid="btn-workspace-minimize-conversation"');
      expect(html).toContain('data-testid="btn-workspace-collapse-presence"');
      expect(html).toContain('data-testid="btn-workspace-close"');
    });

    it('E. narrow header does not clip/overlap product identity', () => {
      const narrowScenario = U6_LANGUAGE_SCENARIOS.find((s) => s.id === 'u6_18_narrow_workspace_adaptation');
      expect(narrowScenario).toBeDefined();

      const html = renderToStaticMarkup(
        <WorkspaceShell state={narrowScenario!.snapshot.workspace} isNarrow={true} />
      );

      // Clean unclipped product identity in header
      expect(html).toContain('MAVE');
      expect(html).toContain('Language Practice');
      expect(html).toContain('title="Free Conversation"');

      // Secondary status badge does NOT crowd the narrow header
      expect(html).not.toContain('data-testid="workspace-status-badge"');

      // Secondary status moves into the dominant practice canvas metadata
      expect(html).toContain('data-testid="language-practice-metadata"');
      expect(html).toContain('Conversing in English');
    });
  });
});
