export interface VoiceProvider {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  interrupt(): Promise<void>;
}

export interface WakeWordProvider {
  start(): Promise<void>;
  stop(): Promise<void>;
}
