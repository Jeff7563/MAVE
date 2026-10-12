# MAVE Wake Model V2 Training Guide & Architecture

## 1. Background & Objective

MAVE Wake Model V1 established the functional baseline:
- **Engine**: openWakeWord (ONNX runtime)
- **Wake phrase**: "Hey MAVE"
- **Threshold**: 0.50
- **Verified Metrics**:
  - Live First-Attempt Recall: 14/20 (70.0%)
  - Ghost Wakes: 0
  - Sleep Recovery (One-Click Return to Sleep): 20/20 (100.0%)

### Root Cause of V1 Utterance Misses
Analysis of live test scores showed:
- Utterances with clearly voiced final consonant `[m eɪ v]` passed reliably (scores: `0.65`, `0.75`, `0.82`, `0.89`).
- Utterances with reduced or softer final consonant voicing failed far below threshold (scores: `0.19`, `0.24`, `0.26`, `0.01`, `0.38`).

This is **not** a threshold tuning issue; lowering the threshold to ~0.20 would trigger false activations on ambient room speech.
Instead, V1 was trained purely on synthetic Piper TTS with a single spelling (`"hey maeve"`), which models only canonical, heavily voiced American English pronunciation.

**Goal for V2**: Achieve $\ge 90\%$ (18/20+) real-world wake recall without sacrificing 0-ghost-wake precision or forcing the user to change natural speaking habits.

---

## 2. Phonetic Analysis & Spelling Investigation

### Phoneme Representations
Using `espeak-ng` (IPA) and the CMU Pronouncing Dictionary (Arpabet):

| Phrase | Engine | Transcription | Notes |
| :--- | :--- | :--- | :--- |
| **"hey"** | `espeak-ng` | `h ˈeɪ` | Aspirated voiceless glottal + diphthong /eɪ/ |
| | CMUDict | `HH EY1` | Canonical English |
| **"maeve"** | `espeak-ng` | `m ˈeɪ v` | Voiced labiodental fricative ending |
| | CMUDict | `M AH0 EH1 V` or `M EY1 V` | Two variants in CMU (Irish vs Anglicized) |
| **"mave"** | `espeak-ng` | `m ˈeɪ v` | Standard English pronunciation rule (silent-e) |
| | CMUDict | `M EY1 V` | Single syllable, rhymes with Dave, cave, wave |

### Critical Design Decision on Spelling & Negatives
1. **Canonical Wake Identity**: Remained strictly `"Hey MAVE"`.
2. **Dual Synthetic Spelling**: Using both `"hey maeve"` and `"hey mave"` across Piper voices provides broader acoustic diversity while preserving identical IPA phonemes (`h ˈeɪ m ˈeɪ v`).
3. **Prohibited Positive Variants**:
   - Phrases like `"Hey May"` (`h ˈeɪ m ˈeɪ` — no final consonant) must **NEVER** be added to the positive set.
   - `"Hey May"` is explicitly one of the most critical **near-miss negative distractors**.
4. **Natural Consonant Devoicing**: Rather than hacking text spellings to mimic unvoiced endings, natural variations in the final consonant are learned directly from the **user's real voice dataset**.

---

## 3. Dataset Collection (Local-Only)

Use the developer recording tool:
```powershell
.\services\wake\.venv\Scripts\python.exe services/wake/tools/record_dataset.py
```
Or view available microphones:
```powershell
.\services\wake\.venv\Scripts\python.exe services/wake/tools/record_dataset.py --list-devices
```

### Dataset Targets (`data/wake/mave-v2/`):
- `positive/natural`: 30 clips (conversational volume, ~1 ft from FIFINE K690)
- `positive/fast`: 10 clips (fast / brisk cadence)
- `positive/soft`: 10 clips (quiet / tired tone)
- `positive/far`: 10 clips (2-3 meters away)
- `positive/difficult-ending`: 10 clips (natural relaxed/softer final consonant)
- **Total Positive Target**: ~70 clips

- `negative/near-miss`: $\ge 20$ clips (e.g. "Hey maybe", "Hey Dave", "Hey wave", "Hey save", "Hey cave", "Hey babe", "Hey mate", "Hey May")
- `negative/normal-speech`: $\ge 20$ clips (general conversational sentences)

All clips are recorded as 16 kHz mono 16-bit PCM WAV files and stored locally. **No audio is ever uploaded.**

---

## 4. V1 Baseline Benchmark

Before training V2, evaluate V1 against the newly recorded dataset:
```powershell
.\services\wake\.venv\Scripts\python.exe services/wake/tools/benchmark_model.py `
  --model assets/wake/mave.onnx `
  --dataset-dir data/wake/mave-v2 `
  --threshold 0.50 `
  --output data/wake/mave-v2/results/v1-benchmark.json
```
This runs the exact same streaming inference path as live MAVE and generates both a machine-readable JSON summary and a detailed markdown table.

---

## 5. V2 Training Pipeline & Colab Notebook

The training pipeline is configured in [`mave-v2.yaml`](./mave-v2.yaml) and executed via the Colab notebook in [`colab/train_mave_v2.ipynb`](./colab/train_mave_v2.ipynb).

### Real Audio Integration Strategy:
1. **Avoid Overfitting**: 70 raw clips alone would overfit.
2. **Audiomentations Multiplier**: Real recordings undergo 30x augmentation:
   - Pitch shift: $\pm 1.5$ semitones
   - Time stretch: $0.90 \times - 1.10 \times$
   - Additive background noise: $10 - 25$ dB SNR
   - Room impulse response (reverb simulation)
3. **Mixed Batching**: Positive batches in `mmap_batch_generator` combine:
   - 70% synthetic Piper TTS clips (from 8+ diverse voices)
   - 20% augmented real-voice clips
   - 10% held-out real clips for continuous validation (`positive_test_clips`)
4. **Adversarial & Ambient Negatives**:
   - Near-miss phrases + openWakeWord standard noise sets (FMA, AudioSet).

---

## 6. Quality Gates for V2 Deployment

MAVE V2 must satisfy **all** gates before replacing V1:

| Gate | Requirement | Target |
| :--- | :--- | :--- |
| **Live First-Attempt Recall** | $\ge 18/20$ ($90\%$) | $19-20/20$ ($95-100\%$) |
| **Return to Sleep** | $20/20$ ($100\%$) one click | $20/20$ |
| **Ghost Wakes** | $0$ | $0$ |
| **Real Dataset Benchmark** | Outperform V1 ($> 70\%$) | $\ge 95\%$ |
| **Near-Miss Rejection** | $\le 5\%$ False Activations | $0\%$ |

If any gate fails, V1 remains active and deployed.

