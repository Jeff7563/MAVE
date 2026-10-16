import { z } from 'zod';

/**
 * Factual learning state progression (Pre-M5 C4).
 * Invariant: Factual observations only ('seen' -> 'practiced' -> 'reviewed').
 * Fake mastery percentages, fake CEFR levels, and fabricated accuracy scores
 * are strictly prohibited without acoustic/assessment evidence.
 */
export const LanguageLearningStageSchema = z.enum([
  'seen',
  'practiced',
  'reviewed'
]);
export type LanguageLearningStage = z.infer<typeof LanguageLearningStageSchema>;

/**
 * Vocabulary observation contract.
 */
export const VocabularyObservationSchema = z.object({
  id: z.string().min(1),
  term: z.string().min(1),
  translation: z.string().min(1),
  phonetic: z.string().optional(),
  partOfSpeech: z.string().optional(),
  example: z.string().optional(),
  stage: LanguageLearningStageSchema.default('seen'),
  observedAt: z.number().nonnegative(),
  practicedCount: z.number().int().nonnegative().default(0)
});
export type VocabularyObservation = z.infer<typeof VocabularyObservationSchema>;

/**
 * Pronunciation guidance metadata.
 * Invariant: Guidance only (phonetic transcription, syllables, articulatory tips).
 * NO fake scoring, percentages, or acoustic grades without acoustic measurement evidence.
 */
export const PronunciationGuidanceSchema = z.object({
  wordOrPhrase: z.string().min(1),
  phonetic: z.string().optional(),
  syllables: z.array(z.string()).optional(),
  ipa: z.string().optional(),
  guidanceTip: z.string().optional()
}).strict();
export type PronunciationGuidance = z.infer<typeof PronunciationGuidanceSchema>;

/**
 * Assertion helper ensuring no fake pronunciation scoring properties are present.
 * Throws an error if any fabricated score, percentage, or CEFR property is detected.
 */
export function assertNoFakePronunciationScoring(data: Record<string, unknown>): void {
  const forbiddenKeys = [
    'score',
    'scorePercentage',
    'accuracyScore',
    'fluencyScore',
    'pronunciationScore',
    'cefrLevel',
    'masteryPercentage',
    'masteryLevel'
  ];
  for (const key of forbiddenKeys) {
    if (key in data && data[key] !== undefined) {
      throw new Error(
        `Fake pronunciation/mastery scoring property '${key}' is prohibited. Without acoustic evidence, MAVE allows factual guidance only (seen -> practiced -> reviewed).`
      );
    }
  }
}

/**
 * Conversational correction metadata.
 */
export const ConversationalCorrectionSchema = z.object({
  originalText: z.string().min(1),
  correctedText: z.string().min(1),
  explanation: z.string().optional(),
  naturalAlternative: z.string().optional(),
  grammarPoint: z.string().optional()
});
export type ConversationalCorrection = z.infer<typeof ConversationalCorrectionSchema>;

/**
 * Roleplay context state with step-out and resume semantics.
 */
export const LanguageRoleplayStateSchema = z.object({
  scenarioId: z.string().min(1),
  scenarioTitle: z.string().min(1),
  assistantRole: z.string().min(1),
  userRole: z.string().optional(),
  targetLanguage: z.string().default('en'),
  nativeLanguage: z.string().default('th'),
  /**
   * Whether the user has temporarily stepped out of roleplay into meta-conversation.
   * True: Stepped out (e.g. asking "how do I say this in English?").
   * False: Actively in roleplay character.
   */
  isSteppedOut: z.boolean().default(false),
  steppedOutReason: z.string().optional()
});
export type LanguageRoleplayState = z.infer<typeof LanguageRoleplayStateSchema>;

/**
 * Helper to step out of roleplay into companion meta-conversation.
 */
export function stepOutOfRoleplay(
  state: LanguageRoleplayState,
  reason?: string
): LanguageRoleplayState {
  return {
    ...state,
    isSteppedOut: true,
    steppedOutReason: reason ?? 'user_question'
  };
}

/**
 * Helper to resume active in-character roleplay.
 */
export function resumeRoleplay(state: LanguageRoleplayState): LanguageRoleplayState {
  return {
    ...state,
    isSteppedOut: false,
    steppedOutReason: undefined
  };
}

/**
 * High-level language experience context embedded in session/request metadata.
 */
export const LanguageExperienceContextSchema = z.object({
  targetLanguage: z.string().default('en'),
  nativeLanguage: z.string().default('th'),
  experienceType: z.enum([
    'quick_translation',
    'phrase_meaning',
    'conversational_correction',
    'speaking_practice',
    'roleplay'
  ]).default('speaking_practice'),
  roleplay: LanguageRoleplayStateSchema.optional(),
  vocabularyObservations: z.array(VocabularyObservationSchema).default([]),
  corrections: z.array(ConversationalCorrectionSchema).default([]),
  pronunciationGuidance: z.array(PronunciationGuidanceSchema).default([])
});
export type LanguageExperienceContext = z.infer<typeof LanguageExperienceContextSchema>;

