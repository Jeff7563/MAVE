import { createActor } from 'xstate';
import { maveMachine } from './machine.js';
import type { MaveMachineEvent, MaveService } from './types.js';
import type { AssistantStateSnapshot, MaveState } from '@mave/contracts';
import { createLogger } from '@mave/shared';

const logger = createLogger({ name: 'mave:core' });

export function createMaveService(options?: {
  initialState?: MaveState;
  onTransition?: (snapshot: AssistantStateSnapshot) => void;
}): MaveService {
  const actor = createActor(maveMachine);

  function getSnapshot(): AssistantStateSnapshot {
    const snap = actor.getSnapshot();
    const currentState = (
      typeof snap.value === 'string' ? snap.value : Object.keys(snap.value)[0]
    ) as MaveState;

    return {
      state: currentState,
      wakeEngineStatus: snap.context.wakeEngineStatus,
      aiStatus: snap.context.aiStatus,
      databaseStatus: snap.context.databaseStatus,
      isMuted: snap.context.isMuted,
      mode: snap.context.mode,
      errorMessage: snap.context.errorMessage,
      lastActiveAt: snap.context.lastActiveAt,
      microphoneName: snap.context.microphoneName,
      microphoneIndex: snap.context.microphoneIndex,
      availableDevices: snap.context.availableDevices,
      wakeWord: snap.context.wakeWord,
      sensitivity: snap.context.sensitivity,
      threshold: snap.context.threshold,
      wakeProvider: snap.context.wakeProvider,
      lastWakeAt: snap.context.lastWakeAt,
      isWakeConfigured: snap.context.isWakeConfigured,
      latestScore: snap.context.latestScore,
      peakScore: snap.context.peakScore,
      lastWakeScore: snap.context.lastWakeScore
    };
  }

  const subscribers = new Set<(snapshot: AssistantStateSnapshot) => void>();

  actor.subscribe({
    next: () => {
      const snapshot = getSnapshot();
      logger.info({ state: snapshot.state, isMuted: snapshot.isMuted }, 'state transition');
      options?.onTransition?.(snapshot);
      for (const cb of subscribers) {
        cb(snapshot);
      }
    }
  });

  return {
    start() {
      actor.start();
      logger.info('MAVE state machine started');
    },
    stop() {
      actor.stop();
      logger.info('MAVE state machine stopped');
    },
    send(event: MaveMachineEvent) {
      logger.info({ event: event.type }, 'processing event');
      actor.send(event);
    },
    getSnapshot,
    subscribe(callback: (snapshot: AssistantStateSnapshot) => void) {
      subscribers.add(callback);
      return () => {
        subscribers.delete(callback);
      };
    }
  };
}
