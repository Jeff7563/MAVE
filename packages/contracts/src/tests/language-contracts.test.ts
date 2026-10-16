import { describe, it, expect } from 'vitest';
import {
  LanguageLearningStageSchema,
  VocabularyObservationSchema,
  PronunciationGuidanceSchema,
  assertNoFakePronunciationScoring,
  ConversationalCorrectionSchema,
  LanguageRoleplayStateSchema,
  stepOutOfRoleplay,
  resumeRoleplay,
  LanguageExperienceContextSchema
} from '../language.js';

describe('MAVE Language Experience Contracts', () => {
  it('validates factual learning stages (seen -> practiced -> reviewed)', () => {
    expect(LanguageLearningStageSchema.parse('seen')).toBe('seen');
    expect(LanguageLearningStageSchema.parse('practiced')).toBe('practiced');
    expect(LanguageLearningStageSchema.parse('reviewed')).toBe('reviewed');

    expect(() => LanguageLearningStageSchema.parse('mastered')).toThrow();
    expect(() => LanguageLearningStageSchema.parse('fluent')).toThrow();
  });

  it('validates vocabulary observations', () => {
    const vocab = VocabularyObservationSchema.parse({
      id: 'vocab-1',
      term: 'awkward',
      translation: 'เคอะเขิน / อึดอัด',
      phonetic: '/ˈɔːkwəd/',
      partOfSpeech: 'adjective',
      example: 'There was an awkward silence.',
      stage: 'seen',
      observedAt: 1729000000,
      practicedCount: 0
    });
    expect(vocab.term).toBe('awkward');
    expect(vocab.stage).toBe('seen');
  });

  it('enforces guidance-only pronunciation without fake scores or CEFR', () => {
    const guidance = PronunciationGuidanceSchema.parse({
      wordOrPhrase: 'comfortable',
      phonetic: '/ˈkʌmftəbl/',
      syllables: ['com', 'for', 'ta', 'ble'],
      ipa: 'ˈkʌm.fɚ.tə.bəl',
      guidanceTip: 'Often pronounced with three syllables in natural speech: "comf-ter-ble".'
    });
    expect(guidance.wordOrPhrase).toBe('comfortable');

    expect(() => {
      assertNoFakePronunciationScoring({
        wordOrPhrase: 'comfortable',
        score: 85
      });
    }).toThrow();

    expect(() => {
      assertNoFakePronunciationScoring({
        wordOrPhrase: 'comfortable',
        cefrLevel: 'C1'
      });
    }).toThrow();
  });

  it('validates conversational corrections', () => {
    const correction = ConversationalCorrectionSchema.parse({
      originalText: 'I am agree with you.',
      correctedText: 'I agree with you.',
      explanation: '"agree" is a verb in English, not an adjective.',
      naturalAlternative: 'I completely agree.',
      grammarPoint: 'verb vs adjective predicate'
    });
    expect(correction.correctedText).toBe('I agree with you.');
  });

  it('handles roleplay step-out and resume transitions cleanly', () => {
    const roleplay = LanguageRoleplayStateSchema.parse({
      scenarioId: 'hotel-checkin',
      scenarioTitle: 'Checking into a Boutique Hotel',
      assistantRole: 'Front Desk Agent',
      userRole: 'Guest',
      targetLanguage: 'en',
      nativeLanguage: 'th'
    });

    expect(roleplay.isSteppedOut).toBe(false);

    const steppedOut = stepOutOfRoleplay(roleplay, 'grammar_clarification');
    expect(steppedOut.isSteppedOut).toBe(true);
    expect(steppedOut.steppedOutReason).toBe('grammar_clarification');

    const resumed = resumeRoleplay(steppedOut);
    expect(resumed.isSteppedOut).toBe(false);
    expect(resumed.steppedOutReason).toBeUndefined();
  });

  it('validates complete language experience context', () => {
    const context = LanguageExperienceContextSchema.parse({
      targetLanguage: 'en',
      nativeLanguage: 'th',
      experienceType: 'roleplay',
      roleplay: {
        scenarioId: 'interview-1',
        scenarioTitle: 'Job Interview',
        assistantRole: 'Interviewer',
        userRole: 'Candidate',
        targetLanguage: 'en',
        nativeLanguage: 'th',
        isSteppedOut: false
      },
      vocabularyObservations: [
        {
          id: 'v1',
          term: 'collaborative',
          translation: 'ทำงานร่วมกันได้ดี',
          observedAt: 1729000000
        }
      ]
    });
    expect(context.experienceType).toBe('roleplay');
    expect(context.vocabularyObservations.length).toBe(1);
  });
});

