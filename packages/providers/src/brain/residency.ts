import { randomUUID } from 'node:crypto';
import { createLogger } from '@mave/shared';
import { assertLoopbackEndpoint, sanitizeOllamaErrorMessage } from './ollama.js';

const logger = createLogger({ name: 'mave:providers:ollama-residency' });

/**
 * Canonical lifecycle states for local model residency (Pre-M5 F1.5-C3).
 */
export type LocalModelResidencyState =
  | 'unloaded'
  | 'loading'
  | 'warm'
  | 'in_use'
  | 'unloading'
  | 'unavailable';

export interface ModelResidencyStatus {
  readonly modelTag: string;
  readonly state: LocalModelResidencyState;
  readonly activeLeases: number;
  readonly residentVramBytes?: number;
  readonly expiresAt?: string;
  readonly lastActiveAt?: number;
}

export interface ModelLease {
  readonly leaseId: string;
  readonly modelTag: string;
  release(): void;
}

/**
 * Canonical residency policy configuration for local Fast Brain execution.
 * Represents a configurable operational policy (current default: keepAlive = '5m'),
 * NOT an immutable architecture constant.
 */
export interface LocalBrainResidencyPolicy {
  readonly keepAlive: string | number;
}

export const DEFAULT_LOCAL_BRAIN_RESIDENCY_POLICY: LocalBrainResidencyPolicy = {
  keepAlive: '5m'
};

export interface OllamaResidencyManagerOptions {
  readonly baseUrl?: string;
  readonly fetchFn?: typeof fetch;
  readonly timeoutMs?: number;
  /**
   * Configurable residency policy (current default: keepAlive = '5m').
   */
  readonly policy?: LocalBrainResidencyPolicy;
  /**
   * Keep-alive duration passed to Ollama daemon (e.g. '5m', '10m', or seconds).
   * Used as fallback if policy is not provided.
   */
  readonly defaultKeepAlive?: string | number;
  /**
   * Optional client-side idle unloader timeout in ms.
   * If unset or <= 0, relies entirely on daemon keep_alive.
   */
  readonly idleTimeoutMs?: number;
}

interface OllamaPsResponse {
  models?: Array<{
    name: string;
    model?: string;
    size?: number;
    digest?: string;
    expires_at?: string;
    size_vram?: number;
  }>;
}

/**
 * Local Model Residency Manager (Pre-M5 F1.5-C3).
 *
 * Implements authoritative runtime lifecycle for local models hosted in Ollama:
 * - Canonical states: unloaded, loading, warm, in_use, unloading, unavailable
 * - Single-flight model loading (coalesces concurrent requests into one load promise)
 * - Active request lease / ref-count protection (never unloads while a lease is active)
 * - Safe load/unload race handling
 * - Conservative reconciliation against official Ollama daemon endpoints (GET /api/version, GET /api/ps)
 * - Safe idle unload without rapid load/unload thrashing
 * - Offline-safe fail-closed error handling
 * - Pure local loopback execution with ZERO paid/subscription dependencies
 */
export class OllamaResidencyManager {
  private readonly baseUrl: string;
  private readonly fetchFn: typeof fetch;
  private readonly timeoutMs: number;
  private readonly policy: LocalBrainResidencyPolicy;
  private readonly defaultKeepAlive: string | number;
  private readonly idleTimeoutMs?: number;

  private currentState: LocalModelResidencyState = 'unloaded';
  private currentModelTag: string = '';
  private activeLeases = 0;
  private residentVramBytes?: number;
  private expiresAt?: string;
  private lastActiveAt?: number;

  private pendingUnload = false;
  private loadPromise: Promise<void> | null = null;
  private unloadPromise: Promise<void> | null = null;
  private idleTimer: NodeJS.Timeout | null = null;

  constructor(options?: OllamaResidencyManagerOptions) {
    const rawUrl = (options?.baseUrl ?? 'http://127.0.0.1:11434').replace(/\/+$/, '');
    assertLoopbackEndpoint(rawUrl);
    this.baseUrl = rawUrl;
    this.fetchFn = options?.fetchFn ?? globalThis.fetch;
    this.timeoutMs = options?.timeoutMs ?? 30000;
    this.policy = options?.policy ?? {
      keepAlive: options?.defaultKeepAlive ?? DEFAULT_LOCAL_BRAIN_RESIDENCY_POLICY.keepAlive
    };
    this.defaultKeepAlive = this.policy.keepAlive;
    this.idleTimeoutMs = options?.idleTimeoutMs;
  }

  getPolicy(): LocalBrainResidencyPolicy {
    return this.policy;
  }

  getState(): LocalModelResidencyState {
    return this.currentState;
  }

  getActiveLeases(): number {
    return this.activeLeases;
  }

  getStatus(modelTag?: string): ModelResidencyStatus {
    return {
      modelTag: modelTag ?? this.currentModelTag,
      state: this.currentState,
      activeLeases: this.activeLeases,
      residentVramBytes: this.residentVramBytes,
      expiresAt: this.expiresAt,
      lastActiveAt: this.lastActiveAt
    };
  }

  /**
   * Single-flight model load / prewarm using official Ollama POST /api/generate with keep_alive.
   * Produces ZERO tokens, zero conversation turns, and zero telemetry.
   */
  async load(modelTag: string, options?: { signal?: AbortSignal; keepAlive?: string | number }): Promise<void> {
    if (options?.signal?.aborted) {
      throw new Error('Model load aborted by caller');
    }

    this.currentModelTag = modelTag;

    // 1. If currently unloading, wait for unload to finish before loading
    if (this.unloadPromise) {
      try {
        await this.unloadPromise;
      } catch {
        // proceed
      }
    }

    // 2. If already warm or in-use with the same model, no-op
    if ((this.currentState === 'warm' || this.currentState === 'in_use') && this.currentModelTag === modelTag) {
      return;
    }

    // 3. Single-flight coalescing: reuse in-flight load promise
    if (this.loadPromise) {
      return this.loadPromise;
    }

    this.currentState = 'loading';
    this.clearIdleTimer();

    this.loadPromise = (async () => {
      try {
        const keepAlive = options?.keepAlive ?? this.defaultKeepAlive;
        const controller = new AbortController();
        const timeoutHandle = setTimeout(() => controller.abort(), this.timeoutMs);

        const onAbort = () => controller.abort();
        if (options?.signal) {
          options.signal.addEventListener('abort', onAbort, { once: true });
        }

        try {
          const res = await this.fetchFn(`${this.baseUrl}/api/generate`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'User-Agent': 'MAVE-Desktop/1.0'
            },
            body: JSON.stringify({
              model: modelTag,
              keep_alive: keepAlive
            }),
            signal: controller.signal
          });

          if (!res.ok) {
            if (res.status === 404) {
              logger.warn({ modelTag }, 'Ollama /api/generate returned 404; continuing with runtime on-the-fly loading');
            } else {
              let errText = '';
              try {
                errText = await res.text();
              } catch {}
              throw new Error(`Ollama load failed (HTTP ${res.status}): ${sanitizeOllamaErrorMessage(errText)}`);
            }
          }

          // Successfully resident in VRAM
          this.currentState = this.activeLeases > 0 ? 'in_use' : 'warm';
          this.lastActiveAt = Date.now();
          logger.info({ modelTag, state: this.currentState }, 'Model loaded into local VRAM');
        } finally {
          clearTimeout(timeoutHandle);
          if (options?.signal) {
            options.signal.removeEventListener('abort', onAbort);
          }
        }
      } catch (err) {
        this.currentState = 'unavailable';
        const msg = sanitizeOllamaErrorMessage(err instanceof Error ? err.message : String(err));
        logger.error({ modelTag, err: msg }, 'Failed to load model into local residency');
        throw err;
      } finally {
        this.loadPromise = null;
      }
    })();

    return this.loadPromise;
  }

  /**
   * Prewarms a model into VRAM when a voice / conversation session is anticipated.
   * Pure lifecycle operation: does not mutate conversation or emit inference telemetry.
   */
  async prewarm(modelTag: string, options?: { keepAlive?: string | number }): Promise<void> {
    if (this.currentState === 'warm' || this.currentState === 'in_use') {
      return;
    }
    await this.load(modelTag, options);
  }

  /**
   * Acquires an active execution lease on the model.
   * Increments active lease ref-count and transitions state to 'in_use'.
   * Guards model against eviction/unload while lease is retained.
   */
  async acquireLease(
    modelTag: string,
    options?: { signal?: AbortSignal; keepAlive?: string | number }
  ): Promise<ModelLease> {
    if (options?.signal?.aborted) {
      throw new Error('Lease acquisition aborted');
    }

    // Ensure model is loaded first
    await this.load(modelTag, options);

    this.activeLeases++;
    this.currentState = 'in_use';
    this.clearIdleTimer();

    const leaseId = randomUUID();
    let released = false;

    const lease: ModelLease = {
      leaseId,
      modelTag,
      release: () => {
        if (released) return;
        released = true;
        this.activeLeases = Math.max(0, this.activeLeases - 1);
        this.lastActiveAt = Date.now();

        if (this.activeLeases === 0) {
          if (this.currentState === 'in_use') {
            this.currentState = 'warm';
          }

          if (this.pendingUnload) {
            this.pendingUnload = false;
            this.unload(modelTag).catch((err) => {
              logger.warn({ err }, 'Deferred unload after lease release failed');
            });
          } else {
            this.scheduleIdleUnload(modelTag);
          }
        }
      }
    };

    return lease;
  }

  /**
   * Safely unloads a resident model using official Ollama POST /api/generate with keep_alive: 0.
   * Invariant: Never unloads while an active request lease is owned.
   */
  async unload(modelTag: string, options?: { force?: boolean }): Promise<void> {
    // 1. Check active lease protection
    if (this.activeLeases > 0 && !options?.force) {
      logger.info({ modelTag, activeLeases: this.activeLeases }, 'Model in-use; deferring unload until leases release');
      this.pendingUnload = true;
      return;
    }

    // 2. If already unloaded, no-op
    if (this.currentState === 'unloaded') {
      return;
    }

    // 3. If loading in progress, wait for load to complete before unloading
    if (this.loadPromise) {
      try {
        await this.loadPromise;
      } catch {
        // proceed
      }
    }

    // 4. Coalesce concurrent unloads
    if (this.unloadPromise) {
      return this.unloadPromise;
    }

    this.currentState = 'unloading';
    this.clearIdleTimer();

    this.unloadPromise = (async () => {
      try {
        const controller = new AbortController();
        const timeoutHandle = setTimeout(() => controller.abort(), Math.min(this.timeoutMs, 10000));

        try {
          const res = await this.fetchFn(`${this.baseUrl}/api/generate`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'User-Agent': 'MAVE-Desktop/1.0'
            },
            body: JSON.stringify({
              model: modelTag,
              keep_alive: 0
            }),
            signal: controller.signal
          });

          if (!res.ok) {
            logger.warn({ status: res.status, modelTag }, 'Ollama unload returned non-200');
          }
        } finally {
          clearTimeout(timeoutHandle);
        }

        this.currentState = 'unloaded';
        this.residentVramBytes = 0;
        this.expiresAt = undefined;
        logger.info({ modelTag }, 'Model unloaded from local residency');
      } catch (err) {
        const msg = sanitizeOllamaErrorMessage(err instanceof Error ? err.message : String(err));
        logger.warn({ modelTag, err: msg }, 'Error executing model unload');
        this.currentState = 'unloaded';
      } finally {
        this.unloadPromise = null;
      }
    })();

    return this.unloadPromise;
  }

  /**
   * Reconciles authoritative local runtime residency using official Ollama endpoints:
   * 1. GET /api/version (health/availability check)
   * 2. GET /api/ps (introspects actual loaded models in GPU memory)
   */
  async reconcile(modelTag?: string): Promise<ModelResidencyStatus> {
    const targetTag = modelTag ?? this.currentModelTag;

    // 1. Health check via GET /api/version
    try {
      const vRes = await this.fetchFn(`${this.baseUrl}/api/version`, {
        method: 'GET',
        headers: { 'User-Agent': 'MAVE-Desktop/1.0' }
      });
      if (!vRes.ok) {
        this.currentState = 'unavailable';
        return this.getStatus(targetTag);
      }
    } catch {
      this.currentState = 'unavailable';
      return this.getStatus(targetTag);
    }

    // 2. Process check via GET /api/ps
    try {
      const psRes = await this.fetchFn(`${this.baseUrl}/api/ps`, {
        method: 'GET',
        headers: { 'User-Agent': 'MAVE-Desktop/1.0' }
      });

      if (!psRes.ok) {
        this.currentState = 'unavailable';
        return this.getStatus(targetTag);
      }

      const body = (await psRes.json()) as OllamaPsResponse;
      const loadedModels = body?.models ?? [];

      if (!targetTag) {
        if (loadedModels.length > 0) {
          const first = loadedModels[0]!;
          this.currentModelTag = first.name || first.model || '';
          this.residentVramBytes = first.size_vram;
          this.expiresAt = first.expires_at;
          this.currentState = this.activeLeases > 0 ? 'in_use' : 'warm';
        } else {
          this.currentState = 'unloaded';
        }
        return this.getStatus();
      }

      const matched = loadedModels.find(
        (m) =>
          m.name.toLowerCase() === targetTag.toLowerCase() ||
          (m.model && m.model.toLowerCase() === targetTag.toLowerCase())
      );

      if (matched) {
        this.residentVramBytes = matched.size_vram;
        this.expiresAt = matched.expires_at;
        this.currentState = this.activeLeases > 0 ? 'in_use' : 'warm';
      } else {
        // Conservative check: if not in loading or unloading transient state, it is unloaded
        if (this.currentState !== 'loading' && this.currentState !== 'unloading') {
          this.currentState = 'unloaded';
          this.residentVramBytes = 0;
          this.expiresAt = undefined;
        }
      }

      return this.getStatus(targetTag);
    } catch (err) {
      const safeMsg = sanitizeOllamaErrorMessage(err instanceof Error ? err.message : String(err));
      logger.warn({ err: safeMsg }, 'Failed to reconcile Ollama residency state');
      this.currentState = 'unavailable';
      return this.getStatus(targetTag);
    }
  }

  private scheduleIdleUnload(modelTag: string): void {
    if (!this.idleTimeoutMs || this.idleTimeoutMs <= 0) {
      return;
    }
    this.clearIdleTimer();
    this.idleTimer = setTimeout(() => {
      if (this.activeLeases === 0 && this.currentState === 'warm') {
        logger.info({ modelTag, idleTimeoutMs: this.idleTimeoutMs }, 'Idle residency expired; unloading model');
        this.unload(modelTag).catch((err) => {
          logger.warn({ err }, 'Idle unload failed');
        });
      }
    }, this.idleTimeoutMs);
  }

  private clearIdleTimer(): void {
    if (this.idleTimer) {
      clearTimeout(this.idleTimer);
      this.idleTimer = null;
    }
  }

  dispose(): void {
    this.clearIdleTimer();
  }
}
