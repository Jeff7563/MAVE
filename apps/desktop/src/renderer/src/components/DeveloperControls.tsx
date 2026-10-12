import React from 'react';
import type { MaveCommand } from '@mave/contracts';

interface DeveloperControlsProps {
  onSendCommand: (command: MaveCommand) => void;
  isMuted: boolean;
}

export const DeveloperControls: React.FC<DeveloperControlsProps> = ({
  onSendCommand,
  isMuted
}) => {
  return (
    <div className="card developer-controls">
      <h2>Developer Controls</h2>
      <div className="button-grid">
        <button
          type="button"
          onClick={() => onSendCommand('simulate-wake')}
          data-testid="btn-simulate-wake"
        >
          Simulate Wake
        </button>

        <button
          type="button"
          onClick={() => onSendCommand('return-to-sleep')}
          data-testid="btn-return-sleep"
        >
          Return to Sleep
        </button>

        <button
          type="button"
          onClick={() => onSendCommand('toggle-mute')}
          data-testid="btn-toggle-mute"
        >
          {isMuted ? 'Unmute' : 'Toggle Mute'}
        </button>

        <button
          type="button"
          onClick={() => onSendCommand('simulate-error')}
          data-testid="btn-simulate-error"
        >
          Simulate Error
        </button>
      </div>
    </div>
  );
};
