import React from 'react';
import type { AssistantStateSnapshot } from '@mave/contracts';

interface StatusCardProps {
  snapshot: AssistantStateSnapshot;
}

function formatStatus(text: string): string {
  if (!text) return '';
  return text.charAt(0).toUpperCase() + text.slice(1);
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

  return (
    <div className="card">
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
        <span className="status-value" data-testid="wake-status">
          {wakeEngineText}
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
