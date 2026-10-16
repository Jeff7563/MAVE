// ============================================================================
// Voice Loop Boundary Checklist & Timestamp Collector (C4-B)
//
// Invariant: Non-destructive verification.
// Traces timestamps across architectural handoff boundaries:
// Wake -> STT -> ConversationRuntime -> BrainRouter -> Local Fast Brain -> TTS -> Presence
//
// Explicit Limitation:
// Acoustic barge-in without DSP AEC remains constrained.
// Manual programmatic interruption (IPC / UI) is deterministic.
// ============================================================================

export interface VoiceBoundaryTimestamps {
  wakeDetectedAt?: number;
  listenStartedAt?: number;
  speechEndedAt?: number;
  sttTranscriptReadyAt?: number;
  runtimeStartedAt?: number;
  routerResolvedAt?: number;
  brainFirstDeltaAt?: number; // TTFT
  brainCompletedAt?: number;
  ttsFirstAudioChunkAt?: number; // TTFA
  audioPlaybackStartedAt?: number;
  turnCompletedAt?: number;
}

export interface VoiceLoopExecutionEvidence {
  readonly testId: string;
  readonly mode: 'automated_pipeline' | 'manual_microphone';
  readonly timestamps: VoiceBoundaryTimestamps;
  readonly latencies: {
    readonly sttLatencyMs?: number;
    readonly brainTtftMs?: number;
    readonly brainGenerationDurationMs?: number;
    readonly ttsTtfaMs?: number;
    readonly timeToFirstAudibleAudioMs?: number;
    readonly totalTurnDurationMs?: number;
  };
  readonly presenceTransitions: readonly string[];
  readonly manualAudioChecklist: {
    readonly acousticWakeRecall: boolean | 'NOT_RUN_HOME_PC_REQUIRED';
    readonly microphoneAudioLevelSensing: boolean | 'NOT_RUN_HOME_PC_REQUIRED';
    readonly ttsAudioPlaybackAudible: boolean | 'NOT_RUN_HOME_PC_REQUIRED';
    readonly presenceMarkColorSync: boolean | 'NOT_RUN_HOME_PC_REQUIRED';
    readonly softwareVadAcousticEchoObserved: boolean | 'NOT_RUN_HOME_PC_REQUIRED';
  };
}

export function computeBoundaryLatencies(ts: VoiceBoundaryTimestamps) {
  const sttLatencyMs =
    ts.sttTranscriptReadyAt && ts.speechEndedAt ? ts.sttTranscriptReadyAt - ts.speechEndedAt : undefined;

  const brainTtftMs =
    ts.brainFirstDeltaAt && ts.sttTranscriptReadyAt ? ts.brainFirstDeltaAt - ts.sttTranscriptReadyAt : undefined;

  const brainGenerationDurationMs =
    ts.brainCompletedAt && ts.brainFirstDeltaAt ? ts.brainCompletedAt - ts.brainFirstDeltaAt : undefined;

  const ttsTtfaMs =
    ts.ttsFirstAudioChunkAt && ts.brainFirstDeltaAt ? ts.ttsFirstAudioChunkAt - ts.brainFirstDeltaAt : undefined;

  const timeToFirstAudibleAudioMs =
    ts.audioPlaybackStartedAt && ts.speechEndedAt ? ts.audioPlaybackStartedAt - ts.speechEndedAt : undefined;

  const totalTurnDurationMs =
    ts.turnCompletedAt && ts.speechEndedAt ? ts.turnCompletedAt - ts.speechEndedAt : undefined;

  return {
    sttLatencyMs,
    brainTtftMs,
    brainGenerationDurationMs,
    ttsTtfaMs,
    timeToFirstAudibleAudioMs,
    totalTurnDurationMs
  };
}

export function formatVoiceLoopChecklist(evidence: VoiceLoopExecutionEvidence): string {
  const l = evidence.latencies;
  const m = evidence.manualAudioChecklist;

  return [
    `=== MAVE C4-B Voice Loop Boundary Measurement ===`,
    `Mode:                        ${evidence.mode}`,
    `STT Latency:                 ${l.sttLatencyMs !== undefined ? `${l.sttLatencyMs}ms` : 'NOT RUN — HOME PC REQUIRED'}`,
    `Brain TTFT:                  ${l.brainTtftMs !== undefined ? `${l.brainTtftMs}ms` : 'NOT RUN — HOME PC REQUIRED'}`,
    `Brain Generation Duration:   ${l.brainGenerationDurationMs !== undefined ? `${l.brainGenerationDurationMs}ms` : 'NOT RUN — HOME PC REQUIRED'}`,
    `TTS TTFA:                    ${l.ttsTtfaMs !== undefined ? `${l.ttsTtfaMs}ms` : 'NOT RUN — HOME PC REQUIRED'}`,
    `Time to First Audible Audio: ${l.timeToFirstAudibleAudioMs !== undefined ? `${l.timeToFirstAudibleAudioMs}ms` : 'NOT RUN — HOME PC REQUIRED'}`,
    `Total Turn Duration:         ${l.totalTurnDurationMs !== undefined ? `${l.totalTurnDurationMs}ms` : 'NOT RUN — HOME PC REQUIRED'}`,
    ``,
    `--- Manual Hardware Verification Status ---`,
    `Acoustic Wake Recall:        ${m.acousticWakeRecall} (Wake phrase: "Hey MAVE")`,
    `Mic Audio Level Sensing:     ${m.microphoneAudioLevelSensing}`,
    `TTS Audio Playback Audible:  ${m.ttsAudioPlaybackAudible}`,
    `Presence State Sync:         ${m.presenceMarkColorSync} (Semantic states: idle -> waking -> listening -> thinking -> speaking)`,
    `Acoustic Echo Limitation:    ${m.softwareVadAcousticEchoObserved} (Expected: Software VAD captures speaker without DSP AEC)`,
    `Presence Transitions:        [${evidence.presenceTransitions.join(' -> ')}]`
  ].join('\n');
}

// Allow direct execution via tsx
if (import.meta.url === `file:///${process.argv[1].replace(/\\/g, '/')}`) {
  const sampleEvidence: VoiceLoopExecutionEvidence = {
    testId: 'voice-loop-baseline',
    mode: 'manual_microphone',
    timestamps: {},
    latencies: {},
    presenceTransitions: ['idle', 'waking', 'listening', 'thinking', 'speaking', 'idle'],
    manualAudioChecklist: {
      acousticWakeRecall: 'NOT_RUN_HOME_PC_REQUIRED',
      microphoneAudioLevelSensing: 'NOT_RUN_HOME_PC_REQUIRED',
      ttsAudioPlaybackAudible: 'NOT_RUN_HOME_PC_REQUIRED',
      presenceMarkColorSync: 'NOT_RUN_HOME_PC_REQUIRED',
      softwareVadAcousticEchoObserved: 'NOT_RUN_HOME_PC_REQUIRED'
    }
  };
  console.log(formatVoiceLoopChecklist(sampleEvidence));
}
