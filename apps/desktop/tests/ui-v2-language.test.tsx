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
      expect(html).toContain('Resume Roleplay');
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
      expect(html).toContain('Listen (Mock)');
      expect(html).toContain('Practice Speaking (Mock)');
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
      expect(html).toContain('Practice Again (Mock)');
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
});
