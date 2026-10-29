import { z } from 'zod';

/**
 * M4 — MAVE Ambient Adaptive Surface contracts
 * (docs/architecture/MAVE_AMBIENT_ADAPTIVE_SURFACE.md).
 *
 * The renderer's Surface Policy decides the mode. The main process owns the
 * BrowserWindow and only applies validated sizes/positions — an LLM never
 * touches the window directly.
 */
export const SurfaceModeSchema = z.enum([
  /** Level 0: minimal presence dot. */
  'orb',
  /** Level 1: voice capsule (listening / thinking / speaking). */
  'capsule',
  /** Level 2: quick information card. */
  'card',
  /** Level 3: conversation / context panel. */
  'panel',
  /** Level 4: task workspace (agent progress, approvals). */
  'workspace'
]);
export type SurfaceMode = z.infer<typeof SurfaceModeSchema>;

export const SurfaceSetModeRequestSchema = z
  .object({
    mode: SurfaceModeSchema,
    /** Interactive = focusable, accepts keyboard. Passive = never steals focus. */
    interactive: z.boolean().default(false)
  })
  .strict();
export type SurfaceSetModeRequest = z.infer<typeof SurfaceSetModeRequestSchema>;

/** Window sizes per mode (DIP). Anchored bottom-right of the active display. */
export const SURFACE_SIZES: Record<SurfaceMode, { width: number; height: number }> = {
  orb: { width: 76, height: 76 },
  capsule: { width: 340, height: 88 },
  card: { width: 380, height: 260 },
  panel: { width: 420, height: 620 },
  workspace: { width: 460, height: 680 }
};

export const SURFACE_IPC_CHANNELS = {
  SET_MODE: 'mave:surface:set-mode',
  /** main → renderer: global hotkey / tray asked to open the panel. */
  TOGGLE: 'mave:surface:toggle',
  OPEN_CONSOLE: 'mave:surface:open-console'
} as const;
