// ============================================================================
// Cancellation & F1.4 Streaming Invariant Check (C3.1 / C4-B)
//
// Invariant: Once provider.chat() begins, cancellation immediately aborts.
// NO hidden fallback retry is permitted.
// routeAttempts is NEVER incremented by hidden retry on cancel.
// Safe when Ollama is offline.
// ============================================================================

import type { RouteTelemetry } from '@mave/contracts';
import {
  BrainProviderRegistry,
  BrainRouter,
  ContextManager,
  ConversationRuntime,
  InMemoryConversationStore,
  SessionManager
} from '@mave/core';
import { OllamaBrainProvider } from '@mave/providers';

export interface CancellationCheckResult {
  readonly available: boolean;
  readonly requestId?: string;
  readonly cancellationTriggered: boolean;
  readonly cancelMethodReturnedTrue: boolean;
  readonly streamStoppedEarly: boolean;
  readonly receivedDeltasBeforeCancel: number;
  readonly receivedDeltasAfterCancel: number;
  readonly terminalEventType?: string;
  readonly fallbackUsed: boolean;
  readonly routeAttempts: number;
  readonly attemptedProviderIds: readonly string[];
  readonly attemptedModelIds: readonly string[];
  readonly invariantPassed: boolean;
  readonly executionTelemetry?: RouteTelemetry;
  readonly failedErrorCode?: string;
  readonly failedErrorMessage?: string;
  readonly error?: string;
}

export async function runCancellationVerification(
  baseUrl = 'http://127.0.0.1:11434'
): Promise<CancellationCheckResult> {
  // Check if Ollama daemon is reachable
  try {
    const res = await fetch(`${baseUrl}/api/tags`);
    if (!res.ok) {
      return {
        available: false,
        cancellationTriggered: false,
        cancelMethodReturnedTrue: false,
        streamStoppedEarly: false,
        receivedDeltasBeforeCancel: 0,
        receivedDeltasAfterCancel: 0,
        fallbackUsed: false,
        routeAttempts: 0,
        attemptedProviderIds: [],
        attemptedModelIds: [],
        invariantPassed: false,
        error: `Ollama returned HTTP ${res.status}: ${res.statusText}`
      };
    }
  } catch (err) {
    return {
      available: false,
      cancellationTriggered: false,
      cancelMethodReturnedTrue: false,
      streamStoppedEarly: false,
      receivedDeltasBeforeCancel: 0,
      receivedDeltasAfterCancel: 0,
      fallbackUsed: false,
      routeAttempts: 0,
      attemptedProviderIds: [],
      attemptedModelIds: [],
      invariantPassed: false,
      error: `Ollama daemon not reachable at ${baseUrl}: ${err instanceof Error ? err.message : String(err)}`
    };
  }

  const registry = new BrainProviderRegistry();
  const ollama = new OllamaBrainProvider({ baseUrl });
  registry.register(ollama, {
    kind: 'model_provider',
    accessPath: 'local_runtime',
    accessClass: 'local',
    displayName: 'Ollama Fast Brain'
  });

  const router = new BrainRouter({ registry, defaultProvider: 'ollama' });
  const sessionManager = new SessionManager();
  const contextManager = new ContextManager();
  const store = new InMemoryConversationStore();

  const runtime = new ConversationRuntime({
    sessionManager,
    contextManager,
    router,
    store
  });

  const requestId = `cert-cancel-${Date.now()}`;
  let receivedDeltasBeforeCancel = 0;
  let receivedDeltasAfterCancel = 0;
  let cancellationTriggered = false;
  let cancelMethodReturnedTrue = false;
  let terminalEventType: string | undefined;
  let failedErrorCode: string | undefined;
  let failedErrorMessage: string | undefined;

  try {
    for await (const event of runtime.send({
      requestId,
      message: 'Write a very long story about a space explorer traveling across ten distant galaxies in elaborate detail.',
      taskIntent: 'quick_chat'
    })) {
      if (event.type === 'response_delta') {
        if (!cancellationTriggered) {
          if (event.text && event.text.length > 0) {
            receivedDeltasBeforeCancel++;
            cancellationTriggered = true;
            cancelMethodReturnedTrue = await runtime.cancel(requestId);
          }
        } else {
          receivedDeltasAfterCancel++;
        }
      } else if (event.type === 'request_cancelled') {
        terminalEventType = event.type;
      } else if (event.type === 'request_failed') {
        terminalEventType = event.type;
        failedErrorCode = event.error.code;
        failedErrorMessage = event.error.message;
      }
    }

    const executionTelemetry = runtime.getExecutionTelemetry(requestId);
    const fallbackUsed = executionTelemetry?.fallbackUsed ?? false;
    const routeAttempts = executionTelemetry?.routeAttempts ?? 0;
    const attemptedProviderIds = executionTelemetry?.attemptedProviderIds ?? [];
    const attemptedModelIds = executionTelemetry?.attemptedModelIds ?? [];

    const invariantPassed =
      cancellationTriggered &&
      cancelMethodReturnedTrue &&
      terminalEventType === 'request_cancelled' &&
      receivedDeltasAfterCancel <= 1 &&
      fallbackUsed === false &&
      routeAttempts === 1;

    return {
      available: true,
      requestId,
      cancellationTriggered,
      cancelMethodReturnedTrue,
      streamStoppedEarly: true,
      receivedDeltasBeforeCancel,
      receivedDeltasAfterCancel,
      terminalEventType,
      fallbackUsed,
      routeAttempts,
      attemptedProviderIds,
      attemptedModelIds,
      invariantPassed,
      executionTelemetry,
      failedErrorCode,
      failedErrorMessage
    };
  } catch (err) {
    const executionTelemetry = runtime.getExecutionTelemetry(requestId);
    return {
      available: true,
      requestId,
      cancellationTriggered,
      cancelMethodReturnedTrue,
      streamStoppedEarly: true,
      receivedDeltasBeforeCancel,
      receivedDeltasAfterCancel,
      terminalEventType: terminalEventType ?? 'exception',
      fallbackUsed: executionTelemetry?.fallbackUsed ?? false,
      routeAttempts: executionTelemetry?.routeAttempts ?? 0,
      attemptedProviderIds: executionTelemetry?.attemptedProviderIds ?? [],
      attemptedModelIds: executionTelemetry?.attemptedModelIds ?? [],
      invariantPassed: false,
      executionTelemetry,
      failedErrorCode,
      failedErrorMessage,
      error: `Caught error on cancel: ${err instanceof Error ? err.message : String(err)}`
    };
  }
}

// Allow direct execution via tsx
if (import.meta.url === `file:///${process.argv[1].replace(/\\/g, '/')}`) {
  console.log('=== MAVE C4-B: Safe Cancellation Live Check ===\n');
  runCancellationVerification().then((result) => {
    if (!result.available) {
      console.log(`[SKIPPED — HOME PC REQUIRED] ${result.error}`);
      return;
    }

    console.log(`Request ID:                  ${result.requestId}`);
    console.log(`Cancellation Triggered:      ${result.cancellationTriggered}`);
    console.log(`runtime.cancel() Returned:   ${result.cancelMethodReturnedTrue}`);
    console.log(`Deltas Before Cancel:        ${result.receivedDeltasBeforeCancel}`);
    console.log(`Deltas After Cancel:         ${result.receivedDeltasAfterCancel}`);
    console.log(`Terminal Event:              ${result.terminalEventType}`);
    if (result.failedErrorCode || result.failedErrorMessage) {
      console.log(`Failure Details:             [${result.failedErrorCode}] ${result.failedErrorMessage}`);
    }
    console.log(`Fallback Used:               ${result.fallbackUsed} (must remain false)`);
    console.log(`Route Attempts:              ${result.routeAttempts} (no hidden retry)`);
    console.log(`Attempted Providers:         [${result.attemptedProviderIds.join(', ')}]`);
    console.log(`Attempted Models:            [${result.attemptedModelIds.join(', ')}]`);
    console.log(`Invariant Passed:            ${result.invariantPassed ? 'PASSED' : 'FAILED'}`);
  });
}
