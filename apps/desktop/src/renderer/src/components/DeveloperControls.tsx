import React, { useState, useEffect } from 'react';
import type { MaveCommand } from '@mave/contracts';

interface DeveloperControlsProps {
  onSendCommand: (command: MaveCommand, payload?: Record<string, unknown>) => void;
  isMuted: boolean;
  availableDevices?: string[];
  currentDeviceIndex?: number;
  currentSensitivity?: number;
}

export const DeveloperControls: React.FC<DeveloperControlsProps> = ({
  onSendCommand,
  isMuted,
  availableDevices = [],
  currentDeviceIndex = -1,
  currentSensitivity = 0.5
}) => {
  const [selectedDevice, setSelectedDevice] = useState<number>(currentDeviceIndex);
  const [sensitivity, setSensitivity] = useState<number>(currentSensitivity);

  useEffect(() => {
    setSelectedDevice(currentDeviceIndex);
  }, [currentDeviceIndex]);

  useEffect(() => {
    setSensitivity(currentSensitivity);
  }, [currentSensitivity]);

  const handleDeviceChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const idx = parseInt(e.target.value, 10);
    setSelectedDevice(idx);
    onSendCommand('set-microphone', { index: idx });
  };

  const handleSensitivityChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    setSensitivity(val);
    onSendCommand('set-sensitivity', { sensitivity: val });
  };

  return (
    <div className="card developer-controls">
      <h2>Controls & Diagnostics</h2>

      <div className="control-group">
        <label htmlFor="microphone-select" className="control-label">
          Microphone:
        </label>
        <select
          id="microphone-select"
          className="control-select"
          data-testid="select-microphone"
          value={selectedDevice}
          onChange={handleDeviceChange}
        >
          <option value={-1}>Default Microphone (-1)</option>
          {availableDevices.map((device, index) => (
            <option key={`${device}-${index}`} value={index}>
              [{index}] {device}
            </option>
          ))}
        </select>
      </div>

      <div className="control-group">
        <div className="slider-header">
          <label htmlFor="sensitivity-input" className="control-label">
            Sensitivity:
          </label>
          <span className="slider-value" data-testid="slider-value">
            {sensitivity.toFixed(2)}
          </span>
        </div>
        <input
          id="sensitivity-input"
          type="range"
          min="0"
          max="1"
          step="0.05"
          className="control-slider"
          data-testid="input-sensitivity"
          value={sensitivity}
          onChange={handleSensitivityChange}
        />
      </div>

      <div className="button-grid">
        <button
          type="button"
          onClick={() => onSendCommand('restart-wake-engine')}
          data-testid="btn-restart-wake"
        >
          Restart Wake Engine
        </button>

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
