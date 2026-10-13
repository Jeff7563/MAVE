import React, { useEffect, useState } from 'react';
import type {
  VoiceRuntimeEvent,
  VoiceStatusSnapshot
} from '@mave/contracts';

const defaultVoiceSnapshot: VoiceStatusSnapshot = {
  enabled: true,
  state: 'sleeping',
  micOwnership: 'wake',
  wake: {
    provider: 'openwakeword',
    listening: true
  },
  audioInput: {
    provider: 'sounddevice-audio-input'
  },
  stt: {
    provider: 'faster-whisper-local',
    status: 'idle',
    model: 'large-v3-turbo'
  },
  tts: {
    provider: 'EdgeTTS',
    status: 'idle',
    voiceId: 'th-TH-PremwadeeNeural'
  },
  output: {
    provider: 'sounddevice-audio-output',
    state: 'idle'
  },
  inputLevel: 0,
  outputLevel: 0
};

export const DeveloperVoice: React.FC = () => {
  const [snapshot, setSnapshot] = useState<VoiceStatusSnapshot>(defaultVoiceSnapshot);
  const [actionError, setActionError] = useState<string | null>(null);

  // 1. Hydrate snapshot on mount and subscribe to voice runtime event stream
  useEffect(() => {
    if (window.mave?.voice?.getStatus) {
      window.mave.voice
        .getStatus()
        .then((initial) => {
          if (initial) {
            setSnapshot(initial);
          }
        })
        .catch((err) => {
          console.error('Failed to get voice status snapshot:', err);
        });
    }

    if (window.mave?.voice?.subscribe) {
      const unsubscribe = window.mave.voice.subscribe((event: VoiceRuntimeEvent) => {
        setSnapshot((prev) => {
          const next = { ...prev };

          if (event.type === 'audio_level') {
            if (event.inputLevel !== undefined) next.inputLevel = event.inputLevel;
            if (event.outputLevel !== undefined) next.outputLevel = event.outputLevel;
            return next;
          }

          if (event.type === 'listening_started') {
            next.state = 'listening';
            next.sessionId = event.sessionId;
            next.lastError = undefined;
            return next;
          }

          if (event.type === 'partial_transcript') {
            next.lastTranscript = {
              text: event.text,
              isFinal: false,
              confidence: event.confidence
            };
            return next;
          }

          if (event.type === 'final_transcript') {
            next.state = 'transcribing';
            next.lastTranscript = {
              text: event.text,
              isFinal: true,
              confidence: event.confidence,
              language: event.language
            };
            return next;
          }

          if (event.type === 'assistant_chunk') {
            next.assistantText = (next.assistantText ?? '') + event.text;
            return next;
          }

          if (event.type === 'thinking_started') {
            next.state = 'thinking';
            return next;
          }

          if (event.type === 'speaking_started') {
            next.state = 'speaking';
            return next;
          }

          if (event.type === 'speaking_finished') {
            return next;
          }

          if (event.type === 'interrupted') {
            next.state = 'interrupted';
            next.assistantText = undefined;
            return next;
          }

          if (event.type === 'voice_session_completed') {
            next.state = 'sleeping';
            next.inputLevel = 0;
            next.outputLevel = 0;
            return next;
          }

          if (event.type === 'voice_session_cancelled') {
            next.state = 'sleeping';
            next.inputLevel = 0;
            next.outputLevel = 0;
            return next;
          }

          if (event.type === 'voice_session_failed') {
            next.state = 'error';
            next.inputLevel = 0;
            next.outputLevel = 0;
            next.lastError = { code: event.errorCode, message: event.errorMessage };
            return next;
          }

          return next;
        });
      });

      return () => {
        unsubscribe();
      };
    }

    return undefined;
  }, []);

  // Handlers for controls
  const handleInterrupt = async () => {
    setActionError(null);
    if (window.mave?.voice?.interrupt) {
      try {
        const res = await window.mave.voice.interrupt('developer_button_interrupt');
        if (!res.success && res.error) {
          setActionError(res.error);
        }
      } catch (err: any) {
        setActionError(err.message);
      }
    } else {
      setSnapshot((prev) => ({ ...prev, state: 'interrupted' }));
    }
  };

  const handleCancel = async () => {
    setActionError(null);
    if (window.mave?.voice?.cancel) {
      try {
        const res = await window.mave.voice.cancel('developer_button_cancel');
        if (!res.success && res.error) {
          setActionError(res.error);
        }
      } catch (err: any) {
        setActionError(err.message);
      }
    } else {
      setSnapshot((prev) => ({ ...prev, state: 'sleeping', inputLevel: 0, outputLevel: 0 }));
    }
  };

  const handleStartDiagnosticTurn = async () => {
    setActionError(null);
    if (window.mave?.voice?.startDiagnosticSession) {
      try {
        const res = await window.mave.voice.startDiagnosticSession();
        if (!res.success && res.error) {
          setActionError(res.error);
        }
      } catch (err: any) {
        setActionError(err.message);
      }
    } else {
      setSnapshot((prev) => ({
        ...prev,
        state: 'listening',
        sessionId: 'simulated-diagnostic-session'
      }));
    }
  };

  const stateClass = `state-${snapshot.state}`;
  const inputPercent = Math.round(Math.min(1.0, Math.max(0.0, snapshot.inputLevel ?? 0)) * 100);
  const outputPercent = Math.round(Math.min(1.0, Math.max(0.0, snapshot.outputLevel ?? 0)) * 100);
  const isSpeakingOrThinking = snapshot.state === 'speaking' || snapshot.state === 'thinking';
  const isVoiceActive =
    snapshot.state !== 'sleeping' && snapshot.state !== 'error';

  return (
    <section className="card developer-voice" data-testid="developer-voice">
      <div className="section-header">
        <h2>VOICE RUNTIME (M3)</h2>
        <span
          className={`status-pill ${stateClass}`}
          data-testid="voice-state-pill"
        >
          {snapshot.state}
        </span>
      </div>

      {/* Session / Mic info */}
      <div className="voice-info-grid">
        <div className="voice-info-item">
          <span className="info-label">Session ID:</span>
          <span className="info-value mono" data-testid="voice-session-id">
            {snapshot.sessionId ? snapshot.sessionId.slice(0, 8) + '...' : 'none'}
          </span>
        </div>
        <div className="voice-info-item">
          <span className="info-label">Mic Ownership:</span>
          <span className="info-value" data-testid="voice-mic-ownership">
            {snapshot.micOwnership}
          </span>
        </div>
      </div>

      {/* Audio Level Telemetry Meters */}
      <div className="voice-meters-container">
        <div className="meter-row">
          <div className="meter-label-row">
            <span className="meter-label">Input (Mic):</span>
            <span className="meter-value" data-testid="voice-input-level-value">
              {inputPercent}%
            </span>
          </div>
          <div className="meter-bar-track">
            <div
              className="meter-bar-fill input"
              data-testid="voice-input-level-bar"
              style={{ width: `${inputPercent}%` }}
            />
          </div>
        </div>

        <div className="meter-row">
          <div className="meter-label-row">
            <span className="meter-label">Output (Spk):</span>
            <span className="meter-value" data-testid="voice-output-level-value">
              {outputPercent}%
            </span>
          </div>
          <div className="meter-bar-track">
            <div
              className="meter-bar-fill output"
              data-testid="voice-output-level-bar"
              style={{ width: `${outputPercent}%` }}
            />
          </div>
        </div>
      </div>

      {/* User Transcript */}
      <div className="voice-transcript-box" data-testid="voice-transcript-box">
        <div className="box-title">
          User Transcript
          {snapshot.lastTranscript && snapshot.lastTranscript.isFinal && (
            <span className="transcript-meta">
              {snapshot.lastTranscript.language && `[${snapshot.lastTranscript.language}]`}
              {snapshot.lastTranscript.confidence !== undefined &&
                ` ${(snapshot.lastTranscript.confidence * 100).toFixed(0)}%`}
            </span>
          )}
        </div>
        <div className="box-content">
          {snapshot.lastTranscript ? (
            <span
              className={snapshot.lastTranscript.isFinal ? 'final-transcript' : 'partial-transcript'}
              data-testid="voice-transcript-text"
            >
              {snapshot.lastTranscript.isFinal ? '[Final] ' : '[Partial] '}
              {snapshot.lastTranscript.text}
            </span>
          ) : (
            <span className="placeholder-text">(no transcript yet)</span>
          )}
        </div>
      </div>

      {/* Assistant Spoken Response */}
      <div className="voice-assistant-box" data-testid="voice-assistant-box">
        <div className="box-title">Assistant Spoken Response</div>
        <div className="box-content" data-testid="voice-assistant-text">
          {snapshot.assistantText ? (
            snapshot.assistantText
          ) : (
            <span className="placeholder-text">(no response generated yet)</span>
          )}
        </div>
      </div>

      {/* Latency Instrumentation */}
      {snapshot.latency && (
        <div className="voice-latency-box" data-testid="voice-latency-box">
          <div className="box-title">Latency Diagnostics</div>
          <div className="latency-grid">
            {snapshot.latency.wakeToCaptureMs !== undefined && (
              <div className="latency-item">
                <span>Wake → Capture:</span>
                <strong>{snapshot.latency.wakeToCaptureMs} ms</strong>
              </div>
            )}
            {snapshot.latency.speechEndToSttMs !== undefined && (
              <div className="latency-item">
                <span>Speech → STT:</span>
                <strong>{snapshot.latency.speechEndToSttMs} ms</strong>
              </div>
            )}
            {snapshot.latency.sttToBrainTtftMs !== undefined && (
              <div className="latency-item">
                <span>STT → Brain TTFT:</span>
                <strong>{snapshot.latency.sttToBrainTtftMs} ms</strong>
              </div>
            )}
            {snapshot.latency.ttsTtfaMs !== undefined && (
              <div className="latency-item">
                <span>TTS TTFA:</span>
                <strong>{snapshot.latency.ttsTtfaMs} ms</strong>
              </div>
            )}
            {snapshot.latency.speechEndToSpokenResponseMs !== undefined && (
              <div className="latency-item">
                <span>Speech → Speech:</span>
                <strong>{snapshot.latency.speechEndToSpokenResponseMs} ms</strong>
              </div>
            )}
            {snapshot.latency.turnDurationMs !== undefined && (
              <div className="latency-item">
                <span>Turn Duration:</span>
                <strong>{snapshot.latency.turnDurationMs} ms</strong>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Active Providers Information */}
      <div className="voice-providers-summary">
        <div className="provider-badge">
          <span>Wake:</span> {snapshot.wake.provider}
        </div>
        <div className="provider-badge">
          <span>Mic:</span> {snapshot.audioInput.provider}
        </div>
        <div className="provider-badge">
          <span>STT:</span> {snapshot.stt.provider}
        </div>
        <div className="provider-badge">
          <span>TTS:</span> {snapshot.tts.provider}
        </div>
        <div className="provider-badge">
          <span>Output:</span> {snapshot.output.provider}
        </div>
      </div>

      {/* Error alert */}
      {(snapshot.lastError || actionError) && (
        <div className="voice-error-banner" data-testid="voice-error-banner">
          <strong>Error: </strong>
          {actionError || `${snapshot.lastError?.code}: ${snapshot.lastError?.message}`}
        </div>
      )}

      {/* Diagnostic Controls */}
      <div className="button-grid voice-controls-grid">
        <button
          type="button"
          className="btn"
          onClick={handleStartDiagnosticTurn}
          disabled={isVoiceActive}
          data-testid="voice-start-btn"
        >
          Start Diagnostic Turn
        </button>

        <button
          type="button"
          className="btn btn-warning"
          onClick={handleInterrupt}
          disabled={!isSpeakingOrThinking}
          data-testid="voice-interrupt-btn"
        >
          Interrupt
        </button>

        <button
          type="button"
          className="btn btn-danger"
          onClick={handleCancel}
          disabled={!isVoiceActive}
          data-testid="voice-cancel-btn"
        >
          Cancel Session
        </button>
      </div>
    </section>
  );
};
