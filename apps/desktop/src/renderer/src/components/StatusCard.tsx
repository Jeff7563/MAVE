import React from 'react';
import type { AssistantStateSnapshot } from '@mave/contracts';

interface StatusCardProps {
  snapshot: AssistantStateSnapshot;
}

function formatStatus(text: string): string {
  if (!text) return '';
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function formatLastWake(timestamp?: number): string {
  if (!timestamp) return 'Never';
  const date = new Date(timestamp);
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

export const StatusCard: React.FC<StatusCardProps> = ({ snapshot }) => {
  const wakeEngineText =
    snapshot.wakeEngineStatus === 'not_configured'
      ? 'Not configured'
      : formatStatus(snapshot.wakeEngineStatus);

  const aiText =
    snapshot.aiStatus === 'offline' ? 'Offline' : formatStatus(snapshot.aiStatus);

  const dbText =
    snapshot.databaseStatus === 'ready' ? 'Ready' : formatStatus(snapshot.databaseStatus);

  const micText = snapshot.microphoneName || 'Default Microphone';
  const wakeWordText = snapshot.wakeWord || 'MAVE';
  const sensitivityText =
    snapshot.sensitivity !== undefined ? snapshot.sensitivity.toFixed(2) : '0.50';
  const lastWakeText = formatLastWake(snapshot.lastWakeAt);

  const isWakeDetectedActive = snapshot.state === 'waking';

  return (
    <div className="card">
      {isWakeDetectedActive && (
        <div className="wake-badge" data-testid="wake-detected-badge">
          ✨ MAVE detected
        </div>
      )}

      <div className="status-row">
        <span className="status-label">Status:</span>
        <span
          className={`status-value state-${snapshot.state}`}
          data-testid="assistant-status"
        >
          {formatStatus(snapshot.state)}
        </span>
      </div>

      <div className="status-row">
        <span className="status-label">Wake engine:</span>
        <span
          className={`status-value wake-${snapshot.wakeEngineStatus}`}
          data-testid="wake-status"
        >
          {wakeEngineText}
        </span>
      </div>

      <div className="status-row">
        <span className="status-label">Wake provider:</span>
        <span className="status-value" data-testid="wake-provider">
          {snapshot.wakeProvider || 'openWakeWord'}
        </span>
      </div>

      <div className="status-row">
        <span className="status-label">Microphone:</span>
        <span className="status-value" data-testid="mic-status">
          {micText}
        </span>
      </div>

      <div className="status-row">
        <span className="status-label">Wake word:</span>
        <span className="status-value" data-testid="wake-word">
          {wakeWordText}
        </span>
      </div>

      <div className="status-row">
        <span className="status-label">Threshold:</span>
        <span
          className="status-value"
          data-testid="threshold-status"
          id="sensitivity-status-val"
        >
          <span data-testid="sensitivity-status">{sensitivityText}</span>
        </span>
      </div>

      <div className="status-row">
        <span className="status-label">Last wake score:</span>
        <span className="status-value" data-testid="last-wake-score">
          {snapshot.lastWakeScore !== undefined ? snapshot.lastWakeScore.toFixed(2) : '—'}
        </span>
      </div>

      <div className="status-row">
        <span className="status-label">Recent peak score:</span>
        <span className="status-value" data-testid="peak-score">
          {snapshot.peakScore !== undefined ? snapshot.peakScore.toFixed(2) : '0.00'}
        </span>
      </div>

      <div className="status-row">
        <span className="status-label">Latest score:</span>
        <span className="status-value" data-testid="latest-score">
          {snapshot.latestScore !== undefined ? snapshot.latestScore.toFixed(2) : '0.00'}
        </span>
      </div>

      <div className="status-row">
        <span className="status-label">Last wake:</span>
        <span className="status-value" data-testid="last-wake-status">
          {lastWakeText}
        </span>
      </div>

      <div className="status-row">
        <span className="status-label">AI:</span>
        <span className="status-value" data-testid="ai-status">
          {aiText}
        </span>
      </div>

      <div className="status-row">
        <span className="status-label">Database:</span>
        <span className="status-value" data-testid="db-status">
          {dbText}
        </span>
      </div>

      {snapshot.errorMessage && (
        <div className="error-banner" data-testid="error-message">
          {snapshot.errorMessage}
        </div>
      )}
    </div>
  );
};
