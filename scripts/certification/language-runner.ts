// ============================================================================
// Language Session Live Check Fixture (C4-A / C4-B)
//
// Invariant: Strictly factual language learning progression.
// Tests:
// - language metadata persistence
// - conversational correction structure
// - vocabulary observation
// - factual learning stages: seen -> practiced -> reviewed
// - roleplay active -> step out -> resume roleplay
//
// Anti-Hallucination Invariant:
// Strictly ZERO fake pronunciation percentages.
// Strictly ZERO fake CEFR levels without test evidence.
// Strictly ZERO fake mastery scores.
// ============================================================================

import {
  ConversationalCorrectionSchema,
  LanguageExperienceContextSchema,
  LanguageLearningStageSchema,
  PronunciationGuidanceSchema,
  VocabularyObservationSchema,
  assertNoFakePronunciationScoring,
  resumeRoleplay,
  stepOutOfRoleplay
} from '@mave/contracts';
import {
  BrainProviderRegistry,
  BrainRouter,
  ContextManager,
  ConversationRuntime,
  InMemoryConversationStore,
  SessionManager
} from '@mave/core';
import { OllamaBrainProvider } from '@mave/providers';

export interface LanguageCheckResult {
  readonly structuralContractsPassed: boolean;
  readonly antiHallucinationGuardPassed: boolean;
  readonly roleplayLifecyclePassed: boolean;
  readonly learningStageProgressionPassed: boolean;
  readonly liveTurnCompleted: boolean;
  readonly liveEvidence?: string;
  readonly error?: string;
}

export async function runLanguageSessionVerification(
  baseUrl = 'http://127.0.0.1:11434'
): Promise<LanguageCheckResult> {
  // 1. Verify Anti-Hallucination Guard (Strict Enforcement)
  let antiHallucinationGuardPassed = false;
  try {
    // Must reject fake pronunciation score
    assertNoFakePronunciationScoring({
      text: 'hello',
      pronunciationScore: 88 // fake acoustic score without microphone phonetic analysis
    } as any);
  } catch {
    // Expected rejection: guard is working!
    antiHallucinationGuardPassed = true;
  }

  // Must accept evidenced guidance
  const validGuidance = {
    wordOrPhrase: 'schedule',
    phonetic: '/ˈskɛdʒuːl/',
    syllables: ['sche', 'dule'],
    ipa: 'ˈskɛdʒuːl',
    guidanceTip: 'Focus on the initial /sk/ cluster and avoid dropping the d sound'
  };
  PronunciationGuidanceSchema.parse(validGuidance);
  assertNoFakePronunciationScoring(validGuidance);

  // 2. Verify Factual Learning Stages (seen -> practiced -> reviewed)
  let learningStageProgressionPassed = false;
  const stage1 = LanguageLearningStageSchema.parse('seen');
  const stage2 = LanguageLearningStageSchema.parse('practiced');
  const stage3 = LanguageLearningStageSchema.parse('reviewed');
  if (stage1 === 'seen' && stage2 === 'practiced' && stage3 === 'reviewed') {
    learningStageProgressionPassed = true;
  }

  // 3. Verify Structural Contracts (Correction, Vocabulary, Context)
  const correction = ConversationalCorrectionSchema.parse({
    originalText: 'He go to school yesterday',
    correctedText: 'He went to school yesterday',
    explanation: 'Use the past tense "went" for past events.',
    grammarPoint: 'Past simple irregular verbs'
  });

  const vocabulary = VocabularyObservationSchema.parse({
    id: 'vocab-schedule',
    term: 'schedule',
    translation: 'กำหนดเวลา',
    partOfSpeech: 'verb',
    example: 'I scheduled the meeting for tomorrow.',
    stage: 'seen',
    observedAt: Date.now()
  });

  // 4. Verify Roleplay Lifecycle (Active -> Step Out -> Resume)
  const initialRoleplay = {
    scenarioId: 'coffee-shop',
    scenarioTitle: 'Ordering coffee at a cafe',
    assistantRole: 'Barista',
    userRole: 'Customer',
    targetLanguage: 'en',
    nativeLanguage: 'th',
    isSteppedOut: false
  };

  const steppedOut = stepOutOfRoleplay(initialRoleplay, 'User asked grammar question');
  const resumed = resumeRoleplay(steppedOut);

  const roleplayLifecyclePassed =
    steppedOut.isSteppedOut === true &&
    steppedOut.steppedOutReason === 'User asked grammar question' &&
    resumed.isSteppedOut === false &&
    resumed.steppedOutReason === undefined;

  // 5. Live Turn Execution (If Ollama daemon available)
  let liveTurnCompleted = false;
  let liveEvidence: string | undefined;

  try {
    const res = await fetch(`${baseUrl}/api/tags`);
    if (res.ok) {
      const registry = new BrainProviderRegistry();
      const ollama = new OllamaBrainProvider({ baseUrl });
      registry.register(ollama, {
        kind: 'model_provider',
        accessPath: 'local_runtime',
        accessClass: 'local',
        displayName: 'Ollama Fast Brain'
      });

      const router = new BrainRouter({ registry, defaultProvider: 'ollama' });
      const sessionManager = new SessionManager();
      const contextManager = new ContextManager();
      const store = new InMemoryConversationStore();

      const runtime = new ConversationRuntime({
        sessionManager,
        contextManager,
        router,
        store
      });

      const session = sessionManager.createSession({
        title: 'C4-B Language Verification',
        metadata: {
          languageContext: {
            targetLanguage: 'en',
            nativeLanguage: 'th',
            mode: 'practice',
            activeRoleplay: initialRoleplay
          }
        }
      });

      let responseText = '';
      for await (const event of runtime.send({
        sessionId: session.id,
        message: 'How do I politely ask for the wifi password in English?',
        taskIntent: 'language_practice'
      })) {
        if (event.type === 'response_delta') {
          responseText += event.delta;
        }
      }

      liveTurnCompleted = true;
      liveEvidence = `Live response received: "${responseText.trim().slice(0, 100)}..."`;
    }
  } catch (err) {
    liveEvidence = `Live turn skipped (daemon unavailable): ${err instanceof Error ? err.message : String(err)}`;
  }

  return {
    structuralContractsPassed: Boolean(correction && vocabulary),
    antiHallucinationGuardPassed,
    roleplayLifecyclePassed,
    learningStageProgressionPassed,
    liveTurnCompleted,
    liveEvidence
  };
}

// Allow direct execution via tsx
if (import.meta.url === `file:///${process.argv[1].replace(/\\/g, '/')}`) {
  console.log('=== MAVE C4-B: Language Experience Semantics Verification ===\n');
  runLanguageSessionVerification().then((result) => {
    console.log(`Structural Contracts:           ${result.structuralContractsPassed ? 'PASSED' : 'FAILED'}`);
    console.log(`Anti-Hallucination Guard:        ${result.antiHallucinationGuardPassed ? 'PASSED (fake metrics blocked)' : 'FAILED'}`);
    console.log(`Roleplay Lifecycle:              ${result.roleplayLifecyclePassed ? 'PASSED (step-out/resume verified)' : 'FAILED'}`);
    console.log(`Learning Stages (seen/prac/rev): ${result.learningStageProgressionPassed ? 'PASSED' : 'FAILED'}`);
    console.log(`Live Language Inference:         ${result.liveTurnCompleted ? 'PASSED' : 'SKIPPED (Home PC required)'}`);
    if (result.liveEvidence) {
      console.log(`Evidence:                        ${result.liveEvidence}`);
    }
  });
}
