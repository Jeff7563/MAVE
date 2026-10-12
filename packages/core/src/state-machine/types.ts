import type {
  AssistantStateSnapshot,
  ConversationMode,
  WakeEngineStatus,
  AiStatus,
  DatabaseStatus
} from '@mave/contracts';

export interface MaveMachineContext {
  wakeEngineStatus: WakeEngineStatus;
  aiStatus: AiStatus;
  databaseStatus: DatabaseStatus;
  isMuted: boolean;
  mode: ConversationMode;
  errorMessage?: string;
  lastActiveAt: number;
  microphoneName?: string;
  microphoneIndex?: number;
  availableDevices?: string[];
  wakeWord?: string;
  sensitivity?: number;
  threshold?: number;
  wakeProvider?: string;
  lastWakeAt?: number;
  isWakeConfigured?: boolean;
  latestScore?: number;
  peakScore?: number;
  lastWakeScore?: number;
}

export type MaveMachineEvent =
  | { type: 'APP_READY' }
  | { type: 'WAKE_DETECTED' }
  | { type: 'WAKE_CANCELLED' }
  | { type: 'SLEEP_REQUESTED' }
  | { type: 'START_LISTENING' }
  | { type: 'USER_SPEECH_STARTED' }
  | { type: 'USER_SPEECH_ENDED' }
  | { type: 'ASSISTANT_SPEAKING' }
  | { type: 'ASSISTANT_FINISHED' }
  | { type: 'MUTE' }
  | { type: 'UNMUTE' }
  | { type: 'TOGGLE_MUTE' }
  | { type: 'SET_MODE'; mode: ConversationMode }
  | { type: 'SET_WAKE_ENGINE_STATUS'; status: WakeEngineStatus; error?: string }
  | {
      type: 'SET_WAKE_DIAGNOSTICS';
      diagnostics: {
        status?: WakeEngineStatus;
        wakeProvider?: string;
        microphoneName?: string;
        microphoneIndex?: number;
        availableDevices?: string[];
        wakeWord?: string;
        sensitivity?: number;
        threshold?: number;
        lastWakeAt?: number;
        isWakeConfigured?: boolean;
        errorMessage?: string;
        latestScore?: number;
        peakScore?: number;
        lastWakeScore?: number;
      };
    }
  | { type: 'DATABASE_READY' }
  | { type: 'DATABASE_ERROR'; error: string }
  | { type: 'ERROR'; error: string }
  | { type: 'SHUTDOWN' };

export interface MaveService {
  start(): void;
  stop(): void;
  send(event: MaveMachineEvent): void;
  getSnapshot(): AssistantStateSnapshot;
  subscribe(callback: (snapshot: AssistantStateSnapshot) => void): () => void;
}
