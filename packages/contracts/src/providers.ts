import type { WakeEngineStatus } from './state.js';
export type {
  BrainProvider,
  ModelCatalogProvider,
  ProviderDescriptor,
  ModelDescriptor,
  ModelCatalogSnapshot
} from './brain.js';
export { isModelCatalogProvider } from './brain.js';

export interface VoiceProvider {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  interrupt(): Promise<void>;
}

export interface WakeDiagnostics {
  status: WakeEngineStatus;
  wakeProvider?: string;
  microphoneName: string;
  microphoneIndex: number;
  availableDevices: string[];
  wakeWord: string;
  sensitivity?: number;
  threshold?: number;
  lastWakeAt?: number;
  isConfigured: boolean;
  errorMessage?: string;
  latestScore?: number;
  peakScore?: number;
  lastWakeScore?: number;
}

export interface OfflineWavTestResult {
  path: string;
  maxScore: number;
  wakeDetected: boolean;
  framesProcessed: number;
  scores?: number[];
  error?: string;
}

export interface WakeWordProvider {
  start(): Promise<void>;
  stop(): Promise<void>;
  dispose(): Promise<void>;
  onWake(callback: () => void): () => void;
  onError?(callback: (error: Error) => void): () => void;
  onTelemetry?(
    callback: (telemetry: {
      latestScore: number;
      peakScore: number;
      lastWakeScore?: number;
      threshold: number;
    }) => void
  ): () => void;
  getStatus(): WakeEngineStatus;
  getDiagnostics?(): WakeDiagnostics;
  testAudioFile?(wavPath: string): Promise<OfflineWavTestResult>;
}
