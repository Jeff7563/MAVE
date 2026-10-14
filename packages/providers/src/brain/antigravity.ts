import type { ChildProcess, SpawnOptions } from 'node:child_process';
import { spawn } from 'node:child_process';
import type {
  BrainCapabilities,
  BrainEvent,
  BrainProvider,
  BrainRequest,
  BrainRequestOptions,
  ProviderHealth
} from '@mave/contracts';
import { BrainCapabilitiesSchema, ProviderHealthSchema } from '@mave/contracts';
import { createLogger } from '@mave/shared';
import { buildAntigravityPrompt } from './antigravity/prompt.js';
import {
  classifyAntigravityError,
  mapAntigravityUsage,
  redactDiagnosticText,
  type AntigravityCliEvent,
  type AntigravityStepUpdateEvent,
  type AntigravityResultEvent
} from './antigravity/parser.js';
import {
  ANTIGRAVITY_PROVIDER_ID,
  discoverAntigravityRuntimeModels
} from './antigravity/models.js';
import type { RuntimeModelDescriptor } from './models/types.js';

const logger = createLogger({ name: 'mave:provider:antigravity' });

export type SpawnFactory = (
  command: string,
  args: string[],
  options: SpawnOptions
) => ChildProcess;

export interface AntigravityBrainProviderOptions {
  /** Executable name or path. Defaults to 'agy'. */
  executable?: string;
  /** Dedicated isolated workspace directory. Must not be repository or home root. */
  cwd?: string;
  workingDirectory?: string;
  /** Optional model identifier override. If omitted, uses CLI default model. */
  model?: string;
  /** Optional reasoning effort for the session. */
  effort?: 'low' | 'medium' | 'high' | 'xhigh' | 'max';
  /** Factory for spawning child processes (used for testing and dependency injection). */
  spawnFactory?: SpawnFactory;
}

export class AntigravityBrainProvider implements BrainProvider {
  readonly id = ANTIGRAVITY_PROVIDER_ID;

  private readonly executable: string;
  private readonly cwd: string;
  private readonly model?: string;
  private readonly effort?: 'low' | 'medium' | 'high' | 'xhigh' | 'max';
  private readonly spawnFactory: SpawnFactory;

  private readonly activeProcesses = new Map<string, ChildProcess>();

  constructor(options: AntigravityBrainProviderOptions) {
    this.executable = options.executable || 'agy';
    this.cwd = options.cwd || options.workingDirectory || process.cwd();
    this.model = options.model;
    this.effort = options.effort;
    this.spawnFactory = options.spawnFactory || spawn;
  }

  /**
   * Returns discovered or default runtime model descriptors for Antigravity.
   */
  async getRuntimeModels(): Promise<RuntimeModelDescriptor[]> {
    return discoverAntigravityRuntimeModels({
      executable: this.executable,
      spawnFactory: this.spawnFactory
    });
  }

  getCapabilities(): BrainCapabilities {
    return BrainCapabilitiesSchema.parse({
      streaming: true,
      fastChat: false, // agent_runtime_provider cannot fake model_provider for fast_conversation
      reasoning: true,
      coding: true,
      toolUse: false, // Pre-M5 invariant: tool execution strictly blocked
      multimodal: false,
      vision: false,
      webResearch: false,
      longContext: true,
      local: false,
      cancellation: true
    });
  }

  /**
   * Performs a lightweight presence and health check without consuming AI subscription quota.
   * Runs `agy --version` to verify that the CLI is installed and accessible.
   */
  async health(): Promise<ProviderHealth> {
    const startTime = Date.now();
    try {
      const versionResult = await new Promise<{ ok: boolean; version?: string; error?: string }>(
        (resolve) => {
          let stdout = '';
          let stderr = '';
          let settled = false;

          const child = this.spawnFactory(this.executable, ['--version'], {
            shell: false,
            stdio: ['ignore', 'pipe', 'pipe']
          });

          const timer = setTimeout(() => {
            if (!settled) {
              settled = true;
              child.kill();
              resolve({ ok: false, error: 'Health check timed out after 3000ms' });
            }
          }, 3000);

          child.stdout?.on('data', (d) => {
            stdout += d.toString();
          });
          child.stderr?.on('data', (d) => {
            stderr += d.toString();
          });

          child.on('error', (err) => {
            if (!settled) {
              settled = true;
              clearTimeout(timer);
              resolve({ ok: false, error: err.message });
            }
          });

          child.on('close', (code) => {
            if (!settled) {
              settled = true;
              clearTimeout(timer);
              if (code === 0) {
                resolve({ ok: true, version: stdout.trim() });
              } else {
                resolve({
                  ok: false,
                  error: stderr.trim() || `CLI exited with code ${code}`
                });
              }
            }
          });
        }
      );

      const latencyMs = Date.now() - startTime;

      if (!versionResult.ok) {
        return ProviderHealthSchema.parse({
          status: 'unconfigured',
          message: `Google Antigravity CLI (${this.executable}) is unavailable: ${versionResult.error}`,
          latencyMs,
          checkedAt: Date.now()
        });
      }

      return ProviderHealthSchema.parse({
        status: 'healthy',
        message: `Google Antigravity CLI is ready (v${versionResult.version || 'unknown'})`,
        latencyMs,
        checkedAt: Date.now()
      });
    } catch (err) {
      return ProviderHealthSchema.parse({
        status: 'unconfigured',
        message: `Failed to inspect Google Antigravity CLI: ${err instanceof Error ? err.message : String(err)}`,
        latencyMs: Date.now() - startTime,
        checkedAt: Date.now()
      });
    }
  }

  /**
   * Cancels an active in-flight request by terminating its dedicated Antigravity CLI child process.
   */
  async cancel(requestId: string): Promise<void> {
    if (!requestId) return;
    const child = this.activeProcesses.get(requestId);
    if (child) {
      try {
        child.kill();
      } catch {
        // Safe disposal
      }
      this.activeProcesses.delete(requestId);
    }
  }

  /**
   * Orchestrates a single text conversation request through the Antigravity CLI.
   * Spawns one isolated `agy` process, pipes the constructed prompt through stdin NDJSON,
   * streams text deltas from stdout, and terminates the process upon completion or cancellation.
   */
  async *chat(
    request: BrainRequest,
    options?: BrainRequestOptions
  ): AsyncIterable<BrainEvent> {
    const requestId = request.requestId;

    // 1. Pre-flight cancellation check
    if (options?.signal?.aborted) {
      yield {
        type: 'cancelled',
        requestId,
        reason: String(options.signal.reason || 'Cancelled before execution')
      };
      return;
    }

    // 2. Build isolated arguments
    const args: string[] = [
      '--input-format',
      'stream-json',
      '--output-format',
      'stream-json',
      '--sandbox',
      '--disable-slash-commands'
    ];
    // 2. Resolve execution model: options.modelId > this.model
    // INVARIANT: Provider execution must NOT directly consume request.overrides.preferredModelId.
    // Only the routing/selection layer resolves caller preference into options.modelId.
    const effectiveModel = options?.modelId || this.model;
    if (effectiveModel) {
      args.push('--model', effectiveModel);
    }
    if (this.effort) {
      args.push('--effort', this.effort);
    }

    // 3. Billing & credential safety: sanitize environment to prevent API key billing
    const cleanEnv: NodeJS.ProcessEnv = { ...process.env };
    delete cleanEnv['GEMINI_API_KEY'];
    delete cleanEnv['GOOGLE_GEMINI_BASE_URL'];

    // 4. Construct prompt strictly from BrainRequest
    const prompt = buildAntigravityPrompt(request);

    // 5. Spawn dedicated child process with shell: false and isolated cwd
    let child: ChildProcess;
    try {
      child = this.spawnFactory(this.executable, args, {
        cwd: this.cwd,
        shell: false,
        env: cleanEnv,
        stdio: ['pipe', 'pipe', 'pipe']
      });
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      logger.error({ err, requestId }, 'failed to spawn Antigravity CLI process');
      yield {
        type: 'error',
        requestId,
        error: {
          code: 'provider_unavailable',
          message: `Failed to spawn Antigravity CLI (${this.executable}): ${errorMsg}`,
          retryable: false
        }
      };
      return;
    }

    this.activeProcesses.set(requestId, child);

    // 6. Connect AbortSignal listener for cancellation
    const onAbort = () => {
      try {
        child.kill();
      } catch {
        // Safe disposal
      }
    };

    if (options?.signal) {
      options.signal.addEventListener('abort', onAbort, { once: true });
    }

    // 7. Async event channel for streaming
    type QueueItem =
      | { type: 'event'; event: AntigravityCliEvent }
      | { type: 'tool_blocked' }
      | { type: 'parse_error'; message: string }
      | { type: 'spawn_error'; message: string }
      | { type: 'closed'; code: number | null; signal: NodeJS.Signals | null };

    const queue: QueueItem[] = [];
    let resolveWait: (() => void) | null = null;

    const pushItem = (item: QueueItem) => {
      queue.push(item);
      if (resolveWait) {
        const r = resolveWait;
        resolveWait = null;
        r();
      }
    };

    let stderrBuffer = '';
    let stdoutRemainder = '';

    child.stderr?.on('data', (chunk) => {
      stderrBuffer += chunk.toString();
    });

    child.stdout?.on('data', (chunk) => {
      stdoutRemainder += chunk.toString();
      const lines = stdoutRemainder.split('\n');
      // The last element is the uncompleted remainder
      stdoutRemainder = lines.pop() ?? '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;

        try {
          const parsed = JSON.parse(trimmed) as AntigravityCliEvent;

          // SECURITY CHECK: Tool step execution is strictly blocked during M2 conversation mode
          if (parsed.event === 'step_update' && 'step_update' in parsed) {
            const stepUpdate = (parsed as AntigravityStepUpdateEvent).step_update;
            if (stepUpdate.step_type === 'tool') {
              logger.warn({ requestId }, 'Antigravity attempted tool execution; terminating process');
              try {
                child.kill();
              } catch {
                // Safe disposal
              }
              pushItem({ type: 'tool_blocked' });
              return;
            }
          }

          pushItem({ type: 'event', event: parsed });
        } catch (parseErr) {
          logger.warn({ parseErr, line: trimmed }, 'malformed NDJSON line received from Antigravity CLI');
          pushItem({
            type: 'parse_error',
            message: `Malformed NDJSON output: ${trimmed.slice(0, 80)}`
          });
        }
      }
    });

    child.on('error', (err) => {
      pushItem({ type: 'spawn_error', message: err.message });
    });

    child.on('close', (code, signal) => {
      // Process remaining buffered stdout if any
      if (stdoutRemainder.trim()) {
        try {
          const parsed = JSON.parse(stdoutRemainder.trim()) as AntigravityCliEvent;
          pushItem({ type: 'event', event: parsed });
        } catch {
          // Ignore trailing newline artifacts
        }
        stdoutRemainder = '';
      }
      pushItem({ type: 'closed', code, signal });
    });

    // 8. Submit input NDJSON to stdin and close stdin
    try {
      const inputPayload = JSON.stringify({
        event: 'user',
        message: { content: prompt }
      }) + '\n';

      child.stdin?.write(inputPayload, 'utf-8', (err) => {
        if (err) {
          logger.warn({ err, requestId }, 'error writing to Antigravity CLI stdin');
        }
        child.stdin?.end();
      });
    } catch (writeErr) {
      logger.warn({ writeErr, requestId }, 'failed to submit prompt to Antigravity stdin');
    }

    // 9. Emit canonical started event
    yield {
      type: 'started',
      requestId,
      providerId: this.id,
      timestamp: Date.now()
    };

    let accumulatedText = '';
    let isTerminated = false;

    try {
      while (!isTerminated) {
        if (options?.signal?.aborted) {
          try {
            child.kill();
          } catch {
            // Safe disposal
          }
          yield {
            type: 'cancelled',
            requestId,
            reason: String(options.signal.reason || 'Request was cancelled')
          };
          return;
        }

        if (queue.length === 0) {
          await new Promise<void>((resolve) => {
            resolveWait = resolve;
          });
          continue;
        }

        const item = queue.shift()!;

        if (item.type === 'tool_blocked') {
          isTerminated = true;
          yield {
            type: 'error',
            requestId,
            error: {
              code: 'provider_invalid_response',
              message: 'Antigravity attempted tool use during conversation-only mode.',
              retryable: false
            }
          };
          return;
        }

        if (item.type === 'parse_error') {
          isTerminated = true;
          try {
            child.kill();
          } catch {
            // Safe disposal
          }
          yield {
            type: 'error',
            requestId,
            error: {
              code: 'provider_invalid_response',
              message: item.message,
              retryable: false
            }
          };
          return;
        }

        if (item.type === 'spawn_error') {
          isTerminated = true;
          yield {
            type: 'error',
            requestId,
            error: {
              code: 'provider_unavailable',
              message: `Antigravity CLI process error: ${item.message}`,
              retryable: false
            }
          };
          return;
        }

        if (item.type === 'event') {
          const cliEvent = item.event;

          if (cliEvent.event === 'step_update' && 'step_update' in cliEvent) {
            const step = (cliEvent as AntigravityStepUpdateEvent).step_update;
            if (step.step_type === 'agent_response' && step.text_delta) {
              accumulatedText += step.text_delta;
              yield {
                type: 'delta',
                requestId,
                text: step.text_delta
              };
            }
          } else if (cliEvent.event === 'result' && 'result' in cliEvent) {
            isTerminated = true;
            const res = (cliEvent as AntigravityResultEvent).result;

            if (res.status === 'SUCCESS') {
              const finalText =
                accumulatedText.length > 0 ? accumulatedText : (res.response ?? '');
              const usage = mapAntigravityUsage(res.usage);

              yield {
                type: 'completed',
                requestId,
                text: finalText,
                finishReason: 'stop',
                usage
              };
              return;
            } else if (res.status === 'CANCELED' || res.status === 'INTERRUPTED') {
              yield {
                type: 'cancelled',
                requestId,
                reason: res.status
              };
              return;
            } else if (res.status === 'ERROR') {
              const rawMsg =
                typeof res.error === 'string'
                  ? res.error
                  : res.error?.message || 'Antigravity model execution failed';
              const code = classifyAntigravityError(rawMsg);

              yield {
                type: 'error',
                requestId,
                error: {
                  code,
                  message: redactDiagnosticText(rawMsg),
                  retryable: code === 'quota_limited' || code === 'rate_limited' || code === 'provider_limit' || code === 'provider_unavailable'
                }
              };
              return;
            } else {
              // Status INVALID, WAITING, RUNNING or unknown
              yield {
                type: 'error',
                requestId,
                error: {
                  code: 'provider_invalid_response',
                  message: `Unexpected Antigravity execution status: ${res.status}`,
                  retryable: false
                }
              };
              return;
            }
          }
        } else if (item.type === 'closed') {
          isTerminated = true;

          // Process exited without terminal result event
          if (options?.signal?.aborted) {
            yield {
              type: 'cancelled',
              requestId,
              reason: 'Request was cancelled'
            };
            return;
          }

          if (item.code !== 0 && item.code !== null) {
            const redactedStderr = redactDiagnosticText(stderrBuffer.trim());
            const code = classifyAntigravityError(redactedStderr || `Exit code ${item.code}`);

            yield {
              type: 'error',
              requestId,
              error: {
                code,
                message: redactedStderr || `Antigravity CLI exited with non-zero code ${item.code}`,
                retryable: code === 'quota_limited' || code === 'rate_limited' || code === 'provider_limit' || code === 'provider_unavailable'
              }
            };
            return;
          }

          // Exit code 0
          if (accumulatedText.length > 0) {
            yield {
              type: 'completed',
              requestId,
              text: accumulatedText,
              finishReason: 'stop'
            };
            return;
          }

          yield {
            type: 'error',
            requestId,
            error: {
              code: 'provider_invalid_response',
              message: 'Antigravity CLI terminated without generating a response.',
              retryable: false
            }
          };
          return;
        }
      }
    } finally {
      this.activeProcesses.delete(requestId);
      if (options?.signal) {
        options.signal.removeEventListener('abort', onAbort);
      }

      // Guarantee no orphaned process
      try {
        if (!child.killed) {
          child.kill();
        }
      } catch {
        // Safe disposal
      }
    }
  }
}
