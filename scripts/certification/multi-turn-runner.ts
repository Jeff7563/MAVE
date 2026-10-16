// ============================================================================
// Deterministic Multi-Turn Verification Script (C3.1 / C4-B)
//
// Invariant: Non-destructive multi-turn session continuity test.
// Turn 1: "My favorite programming language is TypeScript."
// Turn 2: "Why do people like it?"
// Turn 3: "What language did I say I liked?"
// Records session ID, profile, provider/model, response text, context continuity.
// NEVER assigns a fake quality score.
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

export interface MultiTurnTurnResult {
  readonly turnIndex: number;
  readonly prompt: string;
  readonly requestId: string;
  readonly profileId?: string;
  readonly selectedProviderId?: string;
  readonly selectedModelId?: string;
  readonly responseText: string;
  readonly durationMs: number;
  readonly responseCompletedObserved: boolean;
  readonly requestFailedObserved: boolean;
  readonly requestCancelledObserved: boolean;
  readonly executionTelemetry?: RouteTelemetry;
  readonly error?: string;
}

export interface MultiTurnBenchmarkResult {
  readonly available: boolean;
  readonly sessionId?: string;
  readonly turns: readonly MultiTurnTurnResult[];
  readonly contextContinuityPassed: boolean;
  readonly continuityEvidence: string;
  readonly error?: string;
}

export async function runMultiTurnVerification(
  baseUrl = 'http://127.0.0.1:11434'
): Promise<MultiTurnBenchmarkResult> {
  // Check if Ollama daemon is reachable
  try {
    const res = await fetch(`${baseUrl}/api/tags`);
    if (!res.ok) {
      return {
        available: false,
        turns: [],
        contextContinuityPassed: false,
        continuityEvidence: 'N/A',
        error: `Ollama returned HTTP ${res.status}: ${res.statusText}`
      };
    }
  } catch (err) {
    return {
      available: false,
      turns: [],
      contextContinuityPassed: false,
      continuityEvidence: 'N/A',
      error: `Ollama daemon not reachable at ${baseUrl}: ${err instanceof Error ? err.message : String(err)}`
    };
  }

  // Setup runtime topology with real OllamaBrainProvider
  const registry = new BrainProviderRegistry();
  const ollama = new OllamaBrainProvider({ baseUrl });
  registry.register(ollama, {
    kind: 'model_provider',
    accessPath: 'local_runtime',
    accessClass: 'local',
    displayName: 'Ollama Fast Brain'
  });

  const router = new BrainRouter({
    registry,
    defaultProvider: 'ollama'
  });

  const sessionManager = new SessionManager();
  const contextManager = new ContextManager();
  const store = new InMemoryConversationStore();

  const runtime = new ConversationRuntime({
    sessionManager,
    contextManager,
    router,
    store
  });

  const session = sessionManager.createSession({ title: 'C4-B Multi-Turn Verification' });
  await store.createSession(session);
  const sessionId = session.id;

  const prompts = [
    'My favorite programming language is TypeScript.',
    'Why do people like it?',
    'What language did I say I liked?'
  ];

  const turnResults: MultiTurnTurnResult[] = [];

  for (let i = 0; i < prompts.length; i++) {
    const prompt = prompts[i];
    const requestId = `cert-multi-${i + 1}-${Date.now()}`;
    const startTime = Date.now();
    let responseText = '';
    let selectedModelId: string | undefined;
    let responseCompletedObserved = false;
    let requestFailedObserved = false;
    let requestCancelledObserved = false;
    let turnError: string | undefined;

    try {
      for await (const event of runtime.send({
        sessionId,
        requestId,
        message: prompt,
        taskIntent: 'quick_chat'
      })) {
        if (event.type === 'response_delta') {
          responseText += event.text;
        } else if (event.type === 'response_completed') {
          responseCompletedObserved = true;
          selectedModelId = event.modelId;
        } else if (event.type === 'request_failed') {
          requestFailedObserved = true;
          turnError = `[${event.error.code}] ${event.error.message}`;
        } else if (event.type === 'request_cancelled') {
          requestCancelledObserved = true;
          turnError = `cancelled: ${event.reason}`;
        }
      }

      const executionTelemetry = runtime.getExecutionTelemetry(requestId);
      const trimmedResponse = responseText.trim();
      const selectedProviderId = executionTelemetry?.selectedProviderId ?? 'ollama';
      selectedModelId = selectedModelId ?? executionTelemetry?.selectedModelId;

      turnResults.push({
        turnIndex: i + 1,
        prompt,
        requestId,
        profileId: executionTelemetry?.profileId ?? 'fast_conversation',
        selectedProviderId,
        selectedModelId,
        responseText: trimmedResponse,
        durationMs: Date.now() - startTime,
        responseCompletedObserved,
        requestFailedObserved,
        requestCancelledObserved,
        executionTelemetry,
        error: turnError
      });

      // Do not silently mark a turn successful if empty, failed, or missing completion
      if (!responseCompletedObserved || requestFailedObserved || requestCancelledObserved || trimmedResponse.length === 0) {
        return {
          available: true,
          sessionId,
          turns: turnResults,
          contextContinuityPassed: false,
          continuityEvidence: `Turn ${i + 1} failed: ${turnError ?? (trimmedResponse.length === 0 ? 'empty response' : 'response_completed not observed')}`,
          error: `Turn ${i + 1} did not produce completed response`
        };
      }
    } catch (err) {
      turnResults.push({
        turnIndex: i + 1,
        prompt,
        requestId,
        profileId: 'fast_conversation',
        selectedProviderId: 'ollama',
        selectedModelId,
        responseText: responseText.trim(),
        durationMs: Date.now() - startTime,
        responseCompletedObserved,
        requestFailedObserved: true,
        requestCancelledObserved,
        error: err instanceof Error ? err.message : String(err)
      });
      return {
        available: true,
        sessionId,
        turns: turnResults,
        contextContinuityPassed: false,
        continuityEvidence: `Turn ${i + 1} threw exception: ${err instanceof Error ? err.message : String(err)}`,
        error: `Turn ${i + 1} failed: ${err instanceof Error ? err.message : String(err)}`
      };
    }
  }

  // Evaluate Turn 3 response for context continuity (mentions TypeScript)
  const turn3Response = turnResults[2]?.responseText ?? '';
  const mentionsTypeScript = /typescript/i.test(turn3Response);

  return {
    available: true,
    sessionId,
    turns: turnResults,
    contextContinuityPassed: mentionsTypeScript,
    continuityEvidence: mentionsTypeScript
      ? `Turn 3 response correctly recalled previous context: "${turn3Response.slice(0, 80)}..."`
      : `Turn 3 response did not mention TypeScript: "${turn3Response.slice(0, 80)}..."`
  };
}

// Allow direct execution via tsx
if (import.meta.url === `file:///${process.argv[1].replace(/\\/g, '/')}`) {
  console.log('=== MAVE C4-B: Deterministic Multi-Turn Check ===\n');
  runMultiTurnVerification().then((result) => {
    if (!result.available) {
      console.log(`[SKIPPED — HOME PC REQUIRED] ${result.error}`);
      return;
    }

    console.log(`Session ID: ${result.sessionId}\n`);
    for (const t of result.turns) {
      console.log(`[Turn ${t.turnIndex}] Prompt:   "${t.prompt}"`);
      console.log(`         Req ID:   ${t.requestId}`);
      console.log(`         Response: "${t.responseText}"`);
      console.log(`         Observed: completed=${t.responseCompletedObserved}, failed=${t.requestFailedObserved}, cancelled=${t.requestCancelledObserved}`);
      console.log(`         Time:     ${t.durationMs}ms (model: ${t.selectedModelId})\n`);
    }

    console.log(`Context Continuity: ${result.contextContinuityPassed ? 'PASSED' : 'FAILED'}`);
    console.log(`Evidence:           ${result.continuityEvidence}`);
  });
}
