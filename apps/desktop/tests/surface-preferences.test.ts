import { describe, it, expect, vi } from 'vitest';
import {
  SurfacePreferencesStore,
  InMemoryPersistenceAdapter,
  SqlitePersistenceAdapter,
  DEFAULT_SURFACE_PREFERENCES,
  SURFACE_PREFERENCES_KEY
} from '../src/main/surface/surface-preferences.js';

describe('SurfacePreferencesStore', () => {
  it('returns default preferences when persistence is empty', () => {
    const adapter = new InMemoryPersistenceAdapter();
    const store = new SurfacePreferencesStore({ adapter });

    expect(store.getPreferences()).toEqual(DEFAULT_SURFACE_PREFERENCES);
    expect(store.getPreferences().preferredDisplayId).toBeNull();
    expect(store.getPreferences().enabled).toBe(true);
    expect(store.getPreferences().reducedMotion).toBe(false);
  });

  it('persists and loads updated preferences', () => {
    const adapter = new InMemoryPersistenceAdapter();
    const store = new SurfacePreferencesStore({ adapter });

    store.updatePreferences({ preferredDisplayId: 2, reducedMotion: true });

    expect(store.getPreferences()).toEqual({
      preferredDisplayId: 2,
      enabled: true,
      reducedMotion: true
    });

    // Create a new store instance using the same adapter to verify persistence
    const restoredStore = new SurfacePreferencesStore({ adapter });
    expect(restoredStore.getPreferences()).toEqual({
      preferredDisplayId: 2,
      enabled: true,
      reducedMotion: true
    });
  });

  it('performs atomic partial updates without clobbering other fields', () => {
    const adapter = new InMemoryPersistenceAdapter();
    const store = new SurfacePreferencesStore({ adapter });

    store.updatePreferences({ preferredDisplayId: 42 });
    expect(store.getPreferences().preferredDisplayId).toBe(42);
    expect(store.getPreferences().enabled).toBe(true);

    store.updatePreferences({ enabled: false });
    expect(store.getPreferences().preferredDisplayId).toBe(42);
    expect(store.getPreferences().enabled).toBe(false);

    store.updatePreferences({ preferredDisplayId: null });
    expect(store.getPreferences().preferredDisplayId).toBeNull();
    expect(store.getPreferences().enabled).toBe(false);
  });

  it('supports individual setter methods', () => {
    const adapter = new InMemoryPersistenceAdapter();
    const store = new SurfacePreferencesStore({ adapter });

    store.setPreferredDisplayId(5);
    expect(store.getPreferences().preferredDisplayId).toBe(5);

    store.setEnabled(false);
    expect(store.getPreferences().enabled).toBe(false);

    store.setReducedMotion(true);
    expect(store.getPreferences().reducedMotion).toBe(true);
  });

  it('recovers gracefully from corrupted JSON in persistence storage without crashing', () => {
    const adapter = new InMemoryPersistenceAdapter();
    adapter.set(SURFACE_PREFERENCES_KEY, '{"invalid_json: true'); // Corrupted string

    const store = new SurfacePreferencesStore({ adapter });
    expect(store.getPreferences()).toEqual(DEFAULT_SURFACE_PREFERENCES);
  });

  it('recovers gracefully from non-object JSON payloads', () => {
    const adapter = new InMemoryPersistenceAdapter();
    adapter.set(SURFACE_PREFERENCES_KEY, '12345');

    const store = new SurfacePreferencesStore({ adapter });
    expect(store.getPreferences()).toEqual(DEFAULT_SURFACE_PREFERENCES);
  });

  it('can reset to default preferences', () => {
    const adapter = new InMemoryPersistenceAdapter();
    const store = new SurfacePreferencesStore({ adapter });

    store.updatePreferences({ preferredDisplayId: 99, reducedMotion: true });
    expect(store.getPreferences().preferredDisplayId).toBe(99);

    store.reset();
    expect(store.getPreferences()).toEqual(DEFAULT_SURFACE_PREFERENCES);
  });

  describe('SqlitePersistenceAdapter', () => {
    it('executes select and insert/replace queries against MaveDatabase sqlite', () => {
      const mockExec = vi.fn();
      const mockRun = vi.fn();
      const mockSave = vi.fn();
      const mockDb: any = {
        sqlite: {
          exec: mockExec,
          run: mockRun
        },
        save: mockSave
      };

      // Mock empty read
      mockExec.mockReturnValueOnce([]);
      const adapter = new SqlitePersistenceAdapter(mockDb);

      const loaded = adapter.get(SURFACE_PREFERENCES_KEY);
      expect(loaded).toBeNull();
      expect(mockExec).toHaveBeenCalledWith(expect.stringContaining("SELECT value FROM settings WHERE key = 'surface.preferences'"));

      // Set/Save
      adapter.set(SURFACE_PREFERENCES_KEY, JSON.stringify({ preferredDisplayId: 10 }));
      expect(mockRun).toHaveBeenCalledWith(expect.stringContaining("INSERT INTO settings (key, value, updated_at)"));
      expect(mockSave).toHaveBeenCalled();

      // Read populated
      mockExec.mockReturnValueOnce([
        {
          columns: ['value'],
          values: [[JSON.stringify({ preferredDisplayId: 10, enabled: true, reducedMotion: false })]]
        }
      ]);

      const reloaded = adapter.get(SURFACE_PREFERENCES_KEY);
      expect(JSON.parse(reloaded!)).toEqual({
        preferredDisplayId: 10,
        enabled: true,
        reducedMotion: false
      });
    });

    it('returns null on database read failure without throwing', () => {
      const mockDb: any = {
        sqlite: {
          exec: vi.fn(() => {
            throw new Error('Disk I/O error');
          })
        }
      };

      const adapter = new SqlitePersistenceAdapter(mockDb);
      expect(adapter.get(SURFACE_PREFERENCES_KEY)).toBeNull();
    });
  });
});

