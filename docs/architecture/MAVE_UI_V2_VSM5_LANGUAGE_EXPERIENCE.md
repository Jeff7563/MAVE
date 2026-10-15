# MAVE UI V2 — VSM5: Authentic Language Experience Visual Migration

## 1. Overview & Core Philosophy

The MAVE Language Experience migration into the authentic MAVE UI V2 visual system is built on one foundational principle:

> **Language is an EXPERIENCE CONTEXT inside MAVE, not MAVE's global identity.**
> MAVE is not an LMS, not Duolingo, not a separate language product, and not a permanently dedicated learning dashboard. MAVE remains one cohesive, context-aware companion across all tasks.

---

## 2. Contextual Surface Routing

Language assistance appears only when required by user intent and adapts seamlessly across the 3 canonical MAVE surface levels:

| Intent | Target Surface | Presentation Form |
| :--- | :--- | :--- |
| Quick meaning / definition ("What does actually mean?") | **Presence (Level 1)** | Compact quick response capsule; no workspace elevation |
| Inline writing feedback / polite rephrasing | **Conversation / Sidecar (Level 2)** | Supportive `InlineCorrectionCard` attached to MAVE turn |
| Sustained conversational practice / speaking session | **Workspace (Level 3)** | Dominant speaking practice canvas with progressive guidance |
| Scenario roleplay (e.g., ordering specialty coffee) | **Language Workspace (Level 3)** | Roleplay session with clear persona context and instant escape |

---

## 3. Preserved Semantic Invariants

All hardened U6 and VSM architectural contracts remain strictly intact:

1. **One MAVE Identity:**
   - Identity is context-aware (`MAVE / Language Practice` badge), never standalone AI brands such as "Your AI Language Assistant".
2. **Surface State != Task State:**
   - Closing, minimizing, or switching surfaces does not reset active session progress.
3. **Escapable Roleplay:**
   - Users can trigger *"Step out of role"* at any time to ask MAVE native-language questions or request explanations without losing scenario state.
4. **Language → General Task Continuity:**
   - Users can interrupt language practice with general assistant requests (e.g. *"เปิดโปรเจกต์ MAVE ให้หน่อย"*). MAVE pauses the session and handles the task seamlessly.
5. **Truthful Learning Progress:**
   - Strict `seen` → `practiced` → `reviewed` vocabulary lifecycle.
   - Zero fabricated "Mastered" claims, zero artificial XP, levels, or streaks.
6. **Zero Fake Pronunciation Scoring:**
   - Only observable linguistic guidance (IPA, phonetic respelling, syllable stress, mouth/articulation guidance).
   - Zero fake percentages (92%, 85%), zero fake phoneme match bars, zero unverified CEFR grade changes.

---

## 4. Visual Migration & Component Polish

### 4.1 InlineCorrectionCard
- **Eliminated 3-Level Card Nesting:** Removed nested dark cards and alternative boxes. The outer glass card presents the correction flow directly.
- **Supportive Hierarchy:**
  - `YOU SAID:` gentle, non-punitive muted strikethrough.
  - `MORE NATURAL:` elevated prominence with 15px font, clean cyan accent, and crisp typography.
  - `WHY:` concise editorial explanation.
  - `ALTERNATIVES:` typographic inline list rather than heavy nested boxes.
- **Subtle Intensity Controls:** Light, Balanced, and Detailed modes treated as user preference controls, not difficulty or grades.

### 4.2 LanguageComponents (RoleplayBanner, PronunciationGuideCard, VocabularyPanel, SessionSummaryCard)
- **Unified SVG Iconography:** Replaced all emojis (`🎤`, `🔊`) and foreign Unicode glyphs (`▲`, `▼`, `✓`, `✦`) with vector icons from `Icons.tsx` (`MicIcon`, `SpeakerIcon`, `ChevronUpIcon`, `ChevronDownIcon`, `CheckIcon`, `BookmarkIcon`).
- **Authentic Glass & Tokens:** Applied standard MAVE UI Kit tokens (`--mave-glass-gradient`, `--mave-edge`, `--mave-line`, `--mave-cyan`, `--mave-ink`, `--mave-dim`, `--mave-faint`, `--mave-shadow-glass`).
- **Truthful Metric Recap:** Session summary reflects only observed facts (phrases spoken, corrections reviewed, new terms, duration).

### 4.3 LanguageWorkspaceView
- **Practice Canvas Dominance:** Speaking prompt and interaction affordances dominate canvas.
- **Scroll Ownership:** Single vertical scroll container owns flow; eliminated nested independent scrollbars in sub-panels.
- **Responsive Narrow Adaptation:** Below 860px width, layout transitions from 2-column grid to responsive stacked composition. The primary practice area maintains 100% width, preventing cramped buttons or text wrapping.

---

## 5. Verification & Acceptance Screenshots

All 10 required acceptance screenshots were captured and verified outside the repository in `<appDataDir>/brain/<conversation-id>/scratch/screenshots/`:

1. `vsm5_01_quick_meaning_presence.png` — Presence Quick Response bubble
2. `vsm5_02_inline_correction_conversation.png` — Open Conversation inline correction
3. `vsm5_03_sidecar_correction.png` — Compact Sidecar companion mode
4. `vsm5_04_speaking_workspace.png` — Dominant conversational speaking workspace
5. `vsm5_05_roleplay_workspace.png` — Active roleplay with barista scenario
6. `vsm5_06_step_out_of_role.png` — Stepped out of role with MAVE direct coach
7. `vsm5_07_pronunciation_guidance.png` — Truthful phonetic guidance with zero fake scores
8. `vsm5_08_vocabulary_review.png` — Contextual vocabulary review bank
9. `vsm5_09_session_recap.png` — Observable factual session summary
10. `vsm5_10_narrow_language_workspace.png` — Responsive narrow layout with unclipped practice canvas

---

## 6. Remaining Closeout Work

- Final desktop transition polishing and motion choreography (VSM6 / U7 production closeout).
- Electron multi-monitor spatial anchoring verification.
