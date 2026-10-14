import type { MaveDatabase } from '@mave/database';
import { createLogger, type Logger } from '@mave/shared';

export interface SurfacePreferences {
  preferredDisplayId: number | null;
  enabled: boolean;
  reducedMotion: boolean;
}

export const DEFAULT_SURFACE_PREFERENCES: SurfacePreferences = {
  preferredDisplayId: null,
  enabled: true,
  reducedMotion: false
};

export const SURFACE_PREFERENCES_KEY = 'surface.preferences';

export interface PersistenceAdapter {
  get(key: string): string | null;
  set(key: string, value: string): void;
}

/**
 * SQLite persistence adapter backed by MaveDatabase `settings` table.
 */
export class SqlitePersistenceAdapter implements PersistenceAdapter {
  constructor(private readonly database: MaveDatabase) {}

  public get(key: string): string | null {
    try {
      const result = this.database.sqlite.exec(
        `SELECT value FROM settings WHERE key = '${key}' LIMIT 1;`
      );
      if (result.length > 0 && result[0]?.values.length && result[0].values[0]?.[0] !== undefined) {
        return String(result[0].values[0][0]);
      }
    } catch {
      // Ignored for resilience
    }
    return null;
  }

  public set(key: string, value: string): void {
    try {
      const now = Date.now();
      // Sanitize single quotes in value
      const escapedValue = value.replace(/'/g, "''");
      this.database.sqlite.run(
        `INSERT INTO settings (key, value, updated_at) VALUES ('${key}', '${escapedValue}', ${now})
         ON CONFLICT(key) DO UPDATE SET value = '${escapedValue}', updated_at = ${now};`
      );
      this.database.save();
    } catch {
      // Ignored for resilience
    }
  }
}

/**
 * In-memory persistence adapter for unit testing and fallback operation.
 */
export class InMemoryPersistenceAdapter implements PersistenceAdapter {
  private readonly store = new Map<string, string>();

  public get(key: string): string | null {
    return this.store.get(key) ?? null;
  }

  public set(key: string, value: string): void {
    this.store.set(key, value);
  }

  public clear(): void {
    this.store.clear();
  }
}

export interface SurfacePreferencesStoreOptions {
  adapter?: PersistenceAdapter;
  database?: MaveDatabase;
  logger?: Logger;
}

/**
 * Production-hardened settings store for MAVE Surface user preferences.
 *
 * Resilience Invariants:
 * - Falls back to DEFAULT_SURFACE_PREFERENCES on missing or corrupted database values.
 * - Never persists ephemeral runtime states (voice states, transcripts, pin across restart, timers).
 * - Safe atomic writes on explicit user setting changes only.
 */
export class SurfacePreferencesStore {
  private readonly adapter: PersistenceAdapter;
  private readonly logger: Logger;
  private cachedPreferences: SurfacePreferences;

  constructor(options: SurfacePreferencesStoreOptions = {}) {
    this.logger = options.logger ?? createLogger({ name: 'mave:surface-preferences' });
    if (options.adapter) {
      this.adapter = options.adapter;
    } else if (options.database) {
      this.adapter = new SqlitePersistenceAdapter(options.database);
    } else {
      this.adapter = new InMemoryPersistenceAdapter();
    }
    this.cachedPreferences = this.loadPreferences();
  }

  /**
   * Retrieves an immutable copy of current Surface preferences.
   */
  public getPreferences(): SurfacePreferences {
    return { ...this.cachedPreferences };
  }

  /**
   * Updates preferred display identifier (or null to clear / follow cursor).
   */
  public setPreferredDisplayId(displayId: number | null): void {
    this.cachedPreferences.preferredDisplayId = typeof displayId === 'number' ? displayId : null;
    this.savePreferences();
  }

  /**
   * Toggles Surface active enablement.
   */
  public setEnabled(enabled: boolean): void {
    this.cachedPreferences.enabled = Boolean(enabled);
    this.savePreferences();
  }

  /**
   * Toggles reduced motion preference.
   */
  public setReducedMotion(reducedMotion: boolean): void {
    this.cachedPreferences.reducedMotion = Boolean(reducedMotion);
    this.savePreferences();
  }

  /**
   * Updates partial preferences atomically.
   */
  public updatePreferences(partial: Partial<SurfacePreferences>): void {
    if (typeof partial.preferredDisplayId !== 'undefined') {
      this.cachedPreferences.preferredDisplayId =
        typeof partial.preferredDisplayId === 'number' ? partial.preferredDisplayId : null;
    }
    if (typeof partial.enabled === 'boolean') {
      this.cachedPreferences.enabled = partial.enabled;
    }
    if (typeof partial.reducedMotion === 'boolean') {
      this.cachedPreferences.reducedMotion = partial.reducedMotion;
    }
    this.savePreferences();
  }

  /**
   * Resets all preferences to canonical factory defaults.
   */
  public resetToDefaults(): void {
    this.cachedPreferences = { ...DEFAULT_SURFACE_PREFERENCES };
    this.savePreferences();
  }

  public reset(): void {
    this.resetToDefaults();
  }

  private loadPreferences(): SurfacePreferences {
    try {
      const raw = this.adapter.get(SURFACE_PREFERENCES_KEY);
      if (!raw) {
        return { ...DEFAULT_SURFACE_PREFERENCES };
      }

      const parsed = JSON.parse(raw);
      if (typeof parsed !== 'object' || parsed === null) {
        this.logger.warn('parsed surface preferences is not an object; falling back to defaults');
        return { ...DEFAULT_SURFACE_PREFERENCES };
      }

      const preferredDisplayId =
        typeof parsed.preferredDisplayId === 'number'
          ? parsed.preferredDisplayId
          : parsed.preferredDisplayId === null
          ? null
          : DEFAULT_SURFACE_PREFERENCES.preferredDisplayId;

      const enabled =
        typeof parsed.enabled === 'boolean'
          ? parsed.enabled
          : DEFAULT_SURFACE_PREFERENCES.enabled;

      const reducedMotion =
        typeof parsed.reducedMotion === 'boolean'
          ? parsed.reducedMotion
          : DEFAULT_SURFACE_PREFERENCES.reducedMotion;

      return {
        preferredDisplayId,
        enabled,
        reducedMotion
      };
    } catch (err) {
      this.logger.warn({ err }, 'failed to parse persisted surface preferences; falling back to defaults');
      return { ...DEFAULT_SURFACE_PREFERENCES };
    }
  }

  private savePreferences(): void {
    try {
      const payload = JSON.stringify(this.cachedPreferences);
      this.adapter.set(SURFACE_PREFERENCES_KEY, payload);
      this.logger.debug({ preferences: this.cachedPreferences }, 'persisted surface preferences');
    } catch (err) {
      this.logger.error({ err }, 'failed to save surface preferences');
    }
  }
}
