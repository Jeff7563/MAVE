import React, { useState, useEffect } from 'react';
import type { MaveCommand } from '@mave/contracts';

interface DeveloperControlsProps {
  onSendCommand: (
    command: MaveCommand,
    payload?: Record<string, unknown>
  ) => Promise<{ success: boolean; data?: unknown; error?: string }> | void;
  isMuted: boolean;
  availableDevices?: string[];
  currentDeviceIndex?: number;
  currentSensitivity?: number;
  lastWakeScore?: number;
  peakScore?: number;
  latestScore?: number;
}

export const DeveloperControls: React.FC<DeveloperControlsProps> = ({
  onSendCommand,
  isMuted,
  availableDevices = [],
  currentDeviceIndex = -1,
  currentSensitivity = 0.5,
  lastWakeScore,
  peakScore = 0,
  latestScore = 0
}) => {
  const [selectedDevice, setSelectedDevice] = useState<number>(currentDeviceIndex);
  const [sensitivity, setSensitivity] = useState<number>(currentSensitivity);
  const [wavPath, setWavPath] = useState<string>('');
  const [isTestingWav, setIsTestingWav] = useState<boolean>(false);
  const [wavResult, setWavResult] = useState<{
    path: string;
    maxScore: number;
    wakeDetected: boolean;
    framesProcessed: number;
    error?: string;
  } | null>(null);

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
    onSendCommand('set-sensitivity', { threshold: val, sensitivity: val });
  };

  const handleTestWav = async () => {
    if (!wavPath.trim()) return;
    setIsTestingWav(true);
    setWavResult(null);
    try {
      const res = await onSendCommand('test-audio-file', { path: wavPath.trim() });
      if (res && res.data) {
        setWavResult(res.data as any);
      } else if (res && res.error) {
        setWavResult({ path: wavPath, maxScore: 0, wakeDetected: false, framesProcessed: 0, error: res.error });
      }
    } catch (err: any) {
      setWavResult({ path: wavPath, maxScore: 0, wakeDetected: false, framesProcessed: 0, error: err.message });
    } finally {
      setIsTestingWav(false);
    }
  };

  return (
    <div className="card developer-controls">
      <h2>Controls & Diagnostics</h2>

      <div
        className="telemetry-bar"
        data-testid="dev-telemetry-bar"
        style={{
          display: 'flex',
          gap: '12px',
          padding: '8px 12px',
          marginBottom: '16px',
          background: 'rgba(255, 255, 255, 0.04)',
          borderRadius: '6px',
          fontSize: '0.85rem'
        }}
      >
        <div>
          Last Wake:{' '}
          <strong data-testid="dev-last-wake-score">
            {lastWakeScore !== undefined ? lastWakeScore.toFixed(2) : '—'}
          </strong>
        </div>
        <div>
          Recent Peak:{' '}
          <strong data-testid="dev-peak-score">{peakScore.toFixed(2)}</strong>
        </div>
        <div>
          Latest:{' '}
          <strong data-testid="dev-latest-score">{latestScore.toFixed(2)}</strong>
        </div>
      </div>

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
            Threshold:
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

      <div className="control-group" style={{ marginTop: '12px' }}>
        <label htmlFor="wav-path-input" className="control-label">
          Diagnostic Offline Audio (WAV):
        </label>
        <div style={{ display: 'flex', gap: '8px', marginTop: '6px' }}>
          <input
            id="wav-path-input"
            type="text"
            placeholder="path/to/diagnostic.wav"
            value={wavPath}
            onChange={(e) => setWavPath(e.target.value)}
            className="control-select"
            data-testid="input-wav-path"
            style={{ flex: 1 }}
          />
          <button
            type="button"
            onClick={handleTestWav}
            disabled={!wavPath.trim() || isTestingWav}
            data-testid="btn-test-wav"
          >
            {isTestingWav ? 'Testing...' : 'Test WAV'}
          </button>
        </div>
        {wavResult && (
          <div
            className="card"
            data-testid="wav-test-result"
            style={{ marginTop: '8px', padding: '10px', fontSize: '0.85rem' }}
          >
            <div><strong>File:</strong> {wavResult.path}</div>
            <div><strong>Max Score:</strong> {wavResult.maxScore.toFixed(3)}</div>
            <div>
              <strong>Wake Detected:</strong>{' '}
              <span style={{ color: wavResult.wakeDetected ? '#22c55e' : '#ef4444', fontWeight: 'bold' }}>
                {wavResult.wakeDetected ? 'YES' : 'NO'}
              </span>
            </div>
            <div><strong>Frames:</strong> {wavResult.framesProcessed}</div>
            {wavResult.error && (
              <div style={{ color: '#ef4444' }}><strong>Error:</strong> {wavResult.error}</div>
            )}
          </div>
        )}
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
