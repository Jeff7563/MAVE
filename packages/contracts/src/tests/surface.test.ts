import { describe, it, expect } from 'vitest';
import {
  SurfaceModeSchema,
  SurfaceSizeClassSchema,
  SurfaceInteractionModeSchema,
  SurfaceFocusIntentSchema,
  SurfaceSnapshotSchema,
  SurfaceContentBlockSchema,
  SurfaceActionSchema,
  SurfacePresentationIntentSchema,
  SurfaceEventSchema,
  SURFACE_IPC_CHANNELS,
  SURFACE_PRIORITY_WEIGHTS,
  type SurfaceSnapshot,
  type SurfaceContentBlock
} from '../surface.js';

describe('Surface Contracts & Schemas', () => {
  describe('Enums & Primitives', () => {
    it('validates all SurfaceMode values', () => {
      const validModes = [
        'hidden',
        'ambient',
        'listening',
        'thinking',
        'speaking',
        'compact_response',
        'expanded_response',
        'confirmation',
        'progress',
        'error'
      ];
      for (const mode of validModes) {
        expect(SurfaceModeSchema.parse(mode)).toBe(mode);
      }
      expect(() => SurfaceModeSchema.parse('invalid_mode')).toThrow();
    });

    it('validates SurfaceSizeClass values', () => {
      const validSizes = ['ambient', 'compact', 'card', 'expanded'];
      for (const size of validSizes) {
        expect(SurfaceSizeClassSchema.parse(size)).toBe(size);
      }
      expect(() => SurfaceSizeClassSchema.parse('fullscreen')).toThrow();
    });

    it('validates SurfaceInteractionMode values', () => {
      expect(SurfaceInteractionModeSchema.parse('passive')).toBe('passive');
      expect(SurfaceInteractionModeSchema.parse('interactive')).toBe('interactive');
      expect(SurfaceInteractionModeSchema.parse('click_through')).toBe('click_through');
      expect(() => SurfaceInteractionModeSchema.parse('unknown')).toThrow();
    });

    it('validates SurfaceFocusIntent values', () => {
      expect(SurfaceFocusIntentSchema.parse('preserve')).toBe('preserve');
      expect(SurfaceFocusIntentSchema.parse('request')).toBe('request');
      expect(SurfaceFocusIntentSchema.parse('release')).toBe('release');
      expect(() => SurfaceFocusIntentSchema.parse('force')).toThrow();
    });

    it('defines monotonic priority weights', () => {
      expect(SURFACE_PRIORITY_WEIGHTS.low).toBeLessThan(SURFACE_PRIORITY_WEIGHTS.normal);
      expect(SURFACE_PRIORITY_WEIGHTS.normal).toBeLessThan(SURFACE_PRIORITY_WEIGHTS.high);
      expect(SURFACE_PRIORITY_WEIGHTS.high).toBeLessThan(SURFACE_PRIORITY_WEIGHTS.critical);
    });

    it('defines IPC channel constants', () => {
      expect(SURFACE_IPC_CHANNELS.GET_SNAPSHOT).toBe('mave:surface:get-snapshot');
      expect(SURFACE_IPC_CHANNELS.EVENT).toBe('mave:surface:event');
      expect(SURFACE_IPC_CHANNELS.DISPATCH_ACTION).toBe('mave:surface:dispatch-action');
    });
  });

  describe('Content Blocks (Discriminated Union)', () => {
    it('parses text block', () => {
      const block: SurfaceContentBlock = {
        id: 'tb-1',
        type: 'text',
        text: 'Hello world'
      };
      const parsed = SurfaceContentBlockSchema.parse(block);
      expect(parsed).toEqual(block);
    });

    it('parses markdown block', () => {
      const block: SurfaceContentBlock = {
        id: 'mb-1',
        type: 'markdown',
        markdown: '# Title\n- Item 1\n- Item 2'
      };
      const parsed = SurfaceContentBlockSchema.parse(block);
      expect(parsed).toEqual(block);
    });

    it('parses code block', () => {
      const block: SurfaceContentBlock = {
        id: 'cb-1',
        type: 'code',
        language: 'typescript',
        code: 'const x = 42;',
        filename: 'index.ts'
      };
      const parsed = SurfaceContentBlockSchema.parse(block);
      expect(parsed).toEqual(block);
    });

    it('parses vocabulary block', () => {
      const block: SurfaceContentBlock = {
        id: 'vb-1',
        type: 'vocabulary',
        word: 'สวัสดี',
        phonetic: 'sà-wàt-dii',
        translation: 'hello / goodbye',
        partOfSpeech: 'greeting',
        examples: ['สวัสดีครับ']
      };
      const parsed = SurfaceContentBlockSchema.parse(block);
      expect(parsed).toEqual(block);
    });

    it('parses confirmation block with defaults', () => {
      const block = {
        id: 'conf-1',
        type: 'confirmation' as const,
        actionId: 'act-123',
        title: 'Delete file?',
        description: 'Permanently remove target file.'
      };
      const parsed = SurfaceContentBlockSchema.parse(block);
      expect(parsed.type).toBe('confirmation');
      if (parsed.type === 'confirmation') {
        expect(parsed.risk).toBe('medium');
        expect(parsed.confirmLabel).toBe('Approve');
        expect(parsed.rejectLabel).toBe('Deny');
      }
    });

    it('parses progress block', () => {
      const block: SurfaceContentBlock = {
        id: 'prog-1',
        type: 'progress',
        taskId: 'task-99',
        label: 'Indexing repository',
        percentage: 65,
        step: 3,
        totalSteps: 5,
        status: 'running'
      };
      const parsed = SurfaceContentBlockSchema.parse(block);
      expect(parsed).toEqual(block);
    });

    it('parses source citation block', () => {
      const block: SurfaceContentBlock = {
        id: 'src-1',
        type: 'source',
        title: 'Official Documentation',
        url: 'https://example.com/docs',
        snippet: 'Relevant excerpt',
        domain: 'example.com'
      };
      const parsed = SurfaceContentBlockSchema.parse(block);
      expect(parsed).toEqual(block);
    });

    it('parses status block', () => {
      const block: SurfaceContentBlock = {
        id: 'st-1',
        type: 'status',
        label: 'Wake word active',
        status: 'success'
      };
      const parsed = SurfaceContentBlockSchema.parse(block);
      expect(parsed).toEqual(block);
    });

    it('rejects unknown content block type', () => {
      const invalid = {
        id: 'inv-1',
        type: 'unknown_block',
        foo: 'bar'
      };
      expect(() => SurfaceContentBlockSchema.parse(invalid)).toThrow();
    });
  });

  describe('SurfaceSnapshotSchema', () => {
    it('applies schema defaults correctly', () => {
      const minimal = {
        mode: 'ambient' as const,
        sizeClass: 'ambient' as const,
        updatedAt: 1000
      };
      const snapshot = SurfaceSnapshotSchema.parse(minimal);
      expect(snapshot.version).toBe(1);
      expect(snapshot.visibility).toBe('visible');
      expect(snapshot.interactionMode).toBe('passive');
      expect(snapshot.focusIntent).toBe('preserve');
      expect(snapshot.pinned).toBe(false);
      expect(snapshot.activity).toBe('idle');
      expect(snapshot.source).toBe('voice');
      expect(snapshot.priority).toBe('normal');
      expect(snapshot.inputLevel).toBe(0);
      expect(snapshot.outputLevel).toBe(0);
    });

    it('enforces audio level bounds [0.0, 1.0]', () => {
      expect(() =>
        SurfaceSnapshotSchema.parse({
          mode: 'listening',
          sizeClass: 'compact',
          inputLevel: 1.5,
          updatedAt: 1000
        })
      ).toThrow();

      expect(() =>
        SurfaceSnapshotSchema.parse({
          mode: 'listening',
          sizeClass: 'compact',
          outputLevel: -0.1,
          updatedAt: 1000
        })
      ).toThrow();
    });

    it('round-trips through JSON serialization without data loss', () => {
      const fullSnapshot: SurfaceSnapshot = {
        version: 1,
        mode: 'expanded_response',
        visibility: 'visible',
        sizeClass: 'expanded',
        interactionMode: 'interactive',
        focusIntent: 'preserve',
        pinned: true,
        activity: 'idle',
        source: 'conversation',
        priority: 'high',
        inputLevel: 0,
        outputLevel: 0,
        transcript: {
          text: 'Show me the code',
          isFinal: true,
          confidence: 0.98,
          language: 'en'
        },
        assistantText: 'Here is the implementation:',
        content: [
          {
            id: 'c-1',
            type: 'code',
            language: 'typescript',
            code: 'console.log("hello");'
          }
        ],
        autoCollapse: {
          enabled: false,
          afterMs: 120000,
          targetMode: 'ambient'
        },
        sessionId: 'sess-abc',
        updatedAt: Date.now()
      };

      const serialized = JSON.stringify(fullSnapshot);
      const deserialized = JSON.parse(serialized);
      const validated = SurfaceSnapshotSchema.parse(deserialized);

      expect(validated).toEqual(fullSnapshot);
    });
  });

  describe('SurfaceActionSchema & PresentationIntents', () => {
    it('parses expand, collapse, toggle_pin, and dismiss actions', () => {
      expect(SurfaceActionSchema.parse({ type: 'expand' })).toEqual({
        type: 'expand',
        origin: 'user'
      });
      expect(SurfaceActionSchema.parse({ type: 'collapse' })).toEqual({
        type: 'collapse',
        origin: 'user'
      });
      expect(
        SurfaceActionSchema.parse({ type: 'toggle_pin', pinned: true, origin: 'user' })
      ).toEqual({
        type: 'toggle_pin',
        origin: 'user',
        pinned: true
      });
      expect(SurfaceActionSchema.parse({ type: 'dismiss' })).toEqual({
        type: 'dismiss',
        origin: 'user'
      });
    });

    it('parses confirmation action', () => {
      const act = SurfaceActionSchema.parse({
        type: 'confirm_action',
        actionId: 'act-1',
        approved: true
      });
      expect(act.type).toBe('confirm_action');
    });

    it('parses voice_activity presentation intent', () => {
      const intent = SurfacePresentationIntentSchema.parse({
        type: 'voice_activity',
        voiceState: 'listening',
        inputLevel: 0.42,
        sessionId: 'sess-1'
      });
      expect(intent.type).toBe('voice_activity');
    });

    it('parses show_response presentation intent', () => {
      const intent = SurfacePresentationIntentSchema.parse({
        type: 'show_response',
        text: 'Quick answer',
        autoCollapseMs: 30000
      });
      expect(intent.type).toBe('show_response');
    });

    it('parses SurfaceEventSchema', () => {
      const snapshot = SurfaceSnapshotSchema.parse({
        mode: 'ambient',
        sizeClass: 'ambient',
        updatedAt: 123
      });
      const event = SurfaceEventSchema.parse({
        type: 'snapshot_updated',
        snapshot,
        timestamp: 123
      });
      expect(event.type).toBe('snapshot_updated');
    });
  });
});

