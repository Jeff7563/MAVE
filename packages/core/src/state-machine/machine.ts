import { setup, assign } from 'xstate';
import type { MaveMachineContext, MaveMachineEvent } from './types.js';

export const initialContext: MaveMachineContext = {
  wakeEngineStatus: 'not_configured',
  aiStatus: 'offline',
  databaseStatus: 'ready',
  isMuted: false,
  mode: 'conversation',
  errorMessage: undefined,
  lastActiveAt: Date.now(),
  microphoneName: 'Default Microphone',
  microphoneIndex: -1,
  availableDevices: [],
  wakeWord: 'MAVE',
  sensitivity: 0.5,
  threshold: 0.5,
  wakeProvider: 'openWakeWord',
  lastWakeAt: undefined,
  isWakeConfigured: false,
  latestScore: 0,
  peakScore: 0,
  lastWakeScore: undefined
};

export const maveMachine = setup({
  types: {
    context: {} as MaveMachineContext,
    events: {} as MaveMachineEvent
  },
  actions: {
    setMuted: assign({
      isMuted: () => true
    }),
    setUnmuted: assign({
      isMuted: () => false
    }),
    toggleMute: assign({
      isMuted: ({ context }) => !context.isMuted
    }),
    setError: assign({
      errorMessage: ({ event }) =>
        'error' in event ? (event.error as string) : 'An unknown error occurred'
    }),
    clearError: assign({
      errorMessage: () => undefined
    }),
    updateActiveTime: assign({
      lastActiveAt: () => Date.now()
    }),
    recordLastWake: assign({
      lastWakeAt: () => Date.now(),
      lastActiveAt: () => Date.now()
    }),
    setWakeEngineStatus: assign(({ context, event }) => {
      if (event.type !== 'SET_WAKE_ENGINE_STATUS') return context;
      return {
        ...context,
        wakeEngineStatus: event.status,
        errorMessage: event.error ?? context.errorMessage
      };
    }),
    setWakeDiagnostics: assign(({ context, event }) => {
      if (event.type !== 'SET_WAKE_DIAGNOSTICS') return context;
      return {
        ...context,
        ...event.diagnostics,
        wakeEngineStatus: event.diagnostics.status ?? context.wakeEngineStatus,
        errorMessage: event.diagnostics.errorMessage ?? context.errorMessage
      };
    }),
    setDatabaseReady: assign({
      databaseStatus: () => 'ready' as const
    }),
    setDatabaseError: assign({
      databaseStatus: () => 'error' as const,
      errorMessage: ({ event }) =>
        'error' in event ? (event.error as string) : 'Database error'
    })
  }
}).createMachine({
  id: 'mave',
  initial: 'starting',
  context: initialContext,
  on: {
    SHUTDOWN: {
      target: '.shuttingDown'
    },
    ERROR: {
      target: '.error',
      actions: ['setError', 'updateActiveTime']
    },
    DATABASE_READY: {
      actions: ['setDatabaseReady']
    },
    DATABASE_ERROR: {
      actions: ['setDatabaseError']
    },
    SET_WAKE_ENGINE_STATUS: {
      actions: ['setWakeEngineStatus']
    },
    SET_WAKE_DIAGNOSTICS: {
      actions: ['setWakeDiagnostics']
    }
  },
  states: {
    starting: {
      on: {
        APP_READY: {
          target: 'sleeping',
          actions: ['clearError', 'updateActiveTime']
        }
      }
    },
    sleeping: {
      on: {
        WAKE_DETECTED: {
          target: 'waking',
          actions: ['clearError', 'recordLastWake']
        },
        MUTE: {
          target: 'muted',
          actions: ['setMuted', 'updateActiveTime']
        },
        TOGGLE_MUTE: {
          target: 'muted',
          actions: ['setMuted', 'updateActiveTime']
        }
      }
    },
    waking: {
      on: {
        WAKE_CANCELLED: {
          target: 'sleeping',
          actions: ['updateActiveTime']
        },
        SLEEP_REQUESTED: {
          target: 'sleeping',
          actions: ['updateActiveTime']
        },
        START_LISTENING: {
          target: 'listening',
          actions: ['updateActiveTime']
        }
      }
    },
    listening: {
      on: {
        USER_SPEECH_ENDED: {
          target: 'thinking',
          actions: ['updateActiveTime']
        },
        SLEEP_REQUESTED: {
          target: 'sleeping',
          actions: ['updateActiveTime']
        },
        MUTE: {
          target: 'muted',
          actions: ['setMuted', 'updateActiveTime']
        }
      }
    },
    thinking: {
      on: {
        ASSISTANT_SPEAKING: {
          target: 'speaking',
          actions: ['updateActiveTime']
        },
        SLEEP_REQUESTED: {
          target: 'sleeping',
          actions: ['updateActiveTime']
        }
      }
    },
    speaking: {
      on: {
        USER_SPEECH_STARTED: {
          target: 'listening',
          actions: ['updateActiveTime']
        },
        ASSISTANT_FINISHED: {
          target: 'listening',
          actions: ['updateActiveTime']
        },
        SLEEP_REQUESTED: {
          target: 'sleeping',
          actions: ['updateActiveTime']
        }
      }
    },
    reconnecting: {
      on: {
        START_LISTENING: {
          target: 'listening',
          actions: ['updateActiveTime']
        },
        SLEEP_REQUESTED: {
          target: 'sleeping',
          actions: ['updateActiveTime']
        }
      }
    },
    muted: {
      on: {
        UNMUTE: {
          target: 'sleeping',
          actions: ['setUnmuted', 'updateActiveTime']
        },
        TOGGLE_MUTE: {
          target: 'sleeping',
          actions: ['setUnmuted', 'updateActiveTime']
        }
      }
    },
    error: {
      on: {
        SLEEP_REQUESTED: {
          target: 'sleeping',
          actions: ['clearError', 'updateActiveTime']
        },
        APP_READY: {
          target: 'sleeping',
          actions: ['clearError', 'updateActiveTime']
        }
      }
    },
    shuttingDown: {
      type: 'final'
    }
  }
});
