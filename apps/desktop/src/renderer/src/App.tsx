import React, { useEffect, useState } from 'react';
import type {
  AssistantStateSnapshot,
  ChatCancelResponse,
  ChatLoadSessionResponse,
  ChatSendRequest,
  ChatSendResponse,
  ConversationRuntimeEvent,
  MaveCommand
} from '@mave/contracts';
import { StatusCard } from './components/StatusCard';
import { DeveloperControls } from './components/DeveloperControls';
import { DeveloperChat } from './components/DeveloperChat';

declare global {
  interface Window {
    mave?: {
      getStatus: () => Promise<AssistantStateSnapshot>;
      sendCommand: (
        command: MaveCommand,
        payload?: Record<string, unknown>
      ) => Promise<{ success: boolean; data?: unknown; error?: string }>;
      onStateChanged: (
        callback: (snapshot: AssistantStateSnapshot) => void
      ) => () => void;
      chat?: {
        send: (request: ChatSendRequest) => Promise<ChatSendResponse>;
        cancel: (requestId: string) => Promise<ChatCancelResponse>;
        onEvent: (callback: (event: ConversationRuntimeEvent) => void) => () => void;
        loadSession?: (sessionId: string) => Promise<ChatLoadSessionResponse>;
      };
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

  const handleSendCommand = async (
    command: MaveCommand,
    payload?: Record<string, unknown>
  ): Promise<{ success: boolean; data?: unknown; error?: string }> => {
    if (window.mave?.sendCommand) {
      try {
        return await window.mave.sendCommand(command, payload);
      } catch (err: any) {
        console.error('Failed to send command:', err);
        return { success: false, error: err.message };
      }
    } else {
      // Local fallback for standalone browser preview
      if (command === 'simulate-wake') {
        setSnapshot((prev) => ({
          ...prev,
          state: 'waking',
          lastWakeAt: Date.now(),
          lastWakeScore: 0.88,
          peakScore: 0.88,
          latestScore: 0.88
        }));
      } else if (command === 'return-to-sleep') {
        setSnapshot((prev) => ({ ...prev, state: 'sleeping', latestScore: 0.0 }));
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
      } else if (command === 'set-sensitivity' && payload) {
        const val = (payload['threshold'] ?? payload['sensitivity']) as number;
        if (typeof val === 'number') {
          setSnapshot((prev) => ({
            ...prev,
            sensitivity: val,
            threshold: val
          }));
        }
      } else if (command === 'test-audio-file' && payload && typeof payload['path'] === 'string') {
        return {
          success: true,
          data: {
            path: payload['path'],
            maxScore: 0.88,
            wakeDetected: true,
            framesProcessed: 12
          }
        };
      }
      return { success: true };
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
          lastWakeScore={snapshot.lastWakeScore}
          peakScore={snapshot.peakScore}
          latestScore={snapshot.latestScore}
        />
        <DeveloperChat />
      </main>
    </div>
  );
};
