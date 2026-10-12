import type { WakeEngineStatus } from './state.js';

export interface VoiceProvider {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  interrupt(): Promise<void>;
}

export interface WakeDiagnostics {
  status: WakeEngineStatus;
  microphoneName: string;
  microphoneIndex: number;
  availableDevices: string[];
  wakeWord: string;
  sensitivity: number;
  lastWakeAt?: number;
  isConfigured: boolean;
  errorMessage?: string;
}

export interface WakeWordProvider {
  start(): Promise<void>;
  stop(): Promise<void>;
  dispose(): Promise<void>;
  onWake(callback: () => void): () => void;
  onError?(callback: (error: Error) => void): () => void;
  getStatus(): WakeEngineStatus;
  getDiagnostics?(): WakeDiagnostics;
}
