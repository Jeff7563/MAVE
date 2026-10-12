import React, { useEffect, useState } from 'react';
import type { AssistantStateSnapshot, MaveCommand } from '@mave/contracts';
import { StatusCard } from './components/StatusCard';
import { DeveloperControls } from './components/DeveloperControls';

declare global {
  interface Window {
    mave?: {
      getStatus: () => Promise<AssistantStateSnapshot>;
      sendCommand: (
        command: MaveCommand,
        payload?: Record<string, unknown>
      ) => Promise<{ success: boolean; error?: string }>;
      onStateChanged: (
        callback: (snapshot: AssistantStateSnapshot) => void
      ) => () => void;
    };
  }
}

const defaultSnapshot: AssistantStateSnapshot = {
  state: 'sleeping',
  wakeEngineStatus: 'not_configured',
  aiStatus: 'offline',
  databaseStatus: 'ready',
  isMuted: false,
  mode: 'conversation',
  lastActiveAt: Date.now()
};

export const App: React.FC = () => {
  const [snapshot, setSnapshot] = useState<AssistantStateSnapshot>(defaultSnapshot);

  useEffect(() => {
    if (window.mave?.getStatus) {
      window.mave.getStatus().then((initial) => {
        setSnapshot(initial);
      }).catch((err) => {
        console.error('Failed to get initial status:', err);
      });
    }

    if (window.mave?.onStateChanged) {
      const unsubscribe = window.mave.onStateChanged((updated) => {
        setSnapshot(updated);
      });
      return unsubscribe;
    }
    return undefined;
  }, []);

  const handleSendCommand = (command: MaveCommand, payload?: Record<string, unknown>) => {
    if (window.mave?.sendCommand) {
      window.mave.sendCommand(command, payload).catch((err) => {
        console.error('Failed to send command:', err);
      });
    } else {
      // Local fallback for standalone browser preview
      if (command === 'simulate-wake') {
        setSnapshot((prev) => ({
          ...prev,
          state: 'waking',
          lastWakeAt: Date.now()
        }));
      } else if (command === 'return-to-sleep') {
        setSnapshot((prev) => ({ ...prev, state: 'sleeping' }));
      } else if (command === 'toggle-mute') {
        setSnapshot((prev) => ({
          ...prev,
          state: prev.isMuted ? 'sleeping' : 'muted',
          isMuted: !prev.isMuted
        }));
      } else if (command === 'simulate-error') {
        setSnapshot((prev) => ({
          ...prev,
          state: 'error',
          errorMessage: 'Simulated developer error'
        }));
      } else if (command === 'set-microphone' && payload && typeof payload['index'] === 'number') {
        const idx = payload['index'];
        setSnapshot((prev) => ({
          ...prev,
          microphoneIndex: idx,
          microphoneName: prev.availableDevices?.[idx] || (idx === -1 ? 'Default Microphone' : prev.microphoneName)
        }));
      } else if (command === 'set-sensitivity' && payload && typeof payload['sensitivity'] === 'number') {
        setSnapshot((prev) => ({
          ...prev,
          sensitivity: payload['sensitivity'] as number
        }));
      }
    }
  };

  return (
    <div className="container">
      <header>
        <h1 data-testid="app-title">MAVE</h1>
      </header>

      <main>
        <StatusCard snapshot={snapshot} />
        <DeveloperControls
          onSendCommand={handleSendCommand}
          isMuted={snapshot.isMuted}
          availableDevices={snapshot.availableDevices}
          currentDeviceIndex={snapshot.microphoneIndex}
          currentSensitivity={snapshot.sensitivity}
        />
      </main>
    </div>
  );
};
