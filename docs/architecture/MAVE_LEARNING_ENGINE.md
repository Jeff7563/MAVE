# MAVE Learning Engine

## Goal

ทำให้ MAVE ไม่เพียงตอบคำถาม แต่ช่วยให้ผู้ใช้ “เก่งขึ้น” จากการใช้งานจริง

Priority แรก: **Language Learning**

## Core Flow

```text
Conversation / Work
↓
Learning Analyzer
↓
Learning Events
↓
Learning Memory
↓
Review / Practice / Feedback
↓
Progress
```

## Learning Events

- NEW_VOCABULARY
- GRAMMAR_MISTAKE
- AWKWARD_PHRASE
- PRONUNCIATION_ISSUE
- REPEATED_ERROR
- SUCCESSFUL_CORRECTION
- CONCEPT_LEARNED
- REVIEW_COMPLETED

## English Conversation Policy

MAVE ไม่ควรแก้ทุกประโยคจนบทสนทนาสะดุด

### Minor issue
ตอบ conversation ก่อน แล้วค่อยเสนอ:
> “By the way, a more natural way to say that is…”

### Important misunderstanding
แก้ทันทีอย่างสุภาพ

### Repeated mistake
เก็บเป็น learning event เพื่อ review ภายหลัง

## Translation Support

Floating UI แสดงได้:
- English
- Thai translation
- Natural alternative
- Vocabulary
- Grammar note

ผู้ใช้เปิด/ปิด translation overlay ได้

## Vocabulary Memory

```ts
interface VocabularyRecord {
  term: string;
  language: string;
  meaning: string;
  examples: string[];
  firstSeenAt: string;
  lastReviewedAt?: string;
  familiarity: number;
}
```

## Mistake Tracking

ควร normalize pattern ไม่ใช่เก็บแค่ประโยคผิด

```text
Mistake: "I am agree"
Pattern: incorrect use of "agree" as adjective
Correct: "I agree."
```

## Review Queue

สร้างจาก:
- new vocabulary
- repeated errors
- old vocabulary due for review
- important phrases

## Daily Recap

```text
Today you learned:
- awkward
- reliable
- figure out

Repeated issue:
- past tense after "did"

Recommended practice:
3 short sentences using "figure out"
```

## Modes

- Conversation Mode
- Tutor Mode
- Pronunciation Mode
- Review Mode
- Challenge Mode

## Core Principle

> **Learning should enhance conversation, not destroy it.**

## Beyond Language

อนาคตรองรับ coding, project management, troubleshooting, productivity และ writing โดยใช้ concept เดิม: observed behavior → learning event → pattern → review/suggestion

## Learning Profile

อาจมี:
- current goals
- skill areas
- weaknesses
- recent learning events
- review backlog
- preferred teaching style

## Privacy

Learning data local by default, editable, deletable และไม่ส่ง external provider หากไม่จำเป็นต่อ interaction ปัจจุบัน

## v1 Scope

1. English ↔ Thai translation card
2. vocabulary extraction
3. save vocabulary
4. recurring mistake tracking
5. natural phrase suggestions
6. simple daily recap

Pronunciation scoring และ advanced spaced repetition ค่อยเพิ่มภายหลัง
