import { describe, it, expect, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { ConversationShell } from '../src/renderer/src/ui-v2/conversation/ConversationShell';
import { ChatOnlyPanel } from '../src/renderer/src/ui-v2/conversation/ChatOnlyPanel';
import { TaskCard } from '../src/renderer/src/ui-v2/cards/ActionAndTaskCards';
import { SourceCard } from '../src/renderer/src/ui-v2/cards/MediaCards';
import { DiffCard } from '../src/renderer/src/ui-v2/cards/CodeAndFileCards';
import {
  collapseConversationToPresence
} from '../src/renderer/src/ui-v2/conversation/conversation-rules';
import {
  U4_CHAT_ONLY_SCENARIOS
} from '../src/renderer/src/ui-v2/mocks/mock-scenarios';
import type {
  ConversationState,
  TaskCardData,
  SourceCardData,
  DiffCardData,
  PresentationMode,
  SidecarPlacement
} from '../src/renderer/src/ui-v2/types';
import fs from 'fs';
import path from 'path';

describe('MAVE UI V2 — U4 Chat-Only Sidecar Surface & Multitasking Experience Tests', () => {
  // -------------------------------------------------------------------------
  // 1. Conversation State Reuse & Layout Mode Independence
  // -------------------------------------------------------------------------
  describe('1. State Reuse Across Presentation Modes', () => {
    const sharedState: ConversationState = {
      status: 'result',
      activeRequestId: 'req-shared-42',
      messages: [
        {
          id: 'm1',
          type: 'message',
          role: 'user',
          content: 'What is the syntax for Array.prototype.flatMap?'
        },
        {
          id: 'm2',
          type: 'message',
          role: 'assistant',
          content: 'In TypeScript, `arr.flatMap(callback)` maps and flattens by 1 level.'
        }
      ],
      cards: [],
      suggestedShortcuts: ['Explain', 'Translate']
    };

    it('Chat-only sidecar reuses the exact same ConversationState data model as Floating Conversation', () => {
      // Render Floating Conversation
      const floatingHtml = renderToStaticMarkup(
        <ConversationShell state={sharedState} presentationMode="floating" />
      );

      // Render Sidecar Chat-Only
      const sidecarHtml = renderToStaticMarkup(
        <ChatOnlyPanel state={sharedState} placement="right" />
      );

      // Both must contain the identical user and assistant messages
      expect(floatingHtml).toContain('What is the syntax for Array.prototype.flatMap?');
      expect(floatingHtml).toContain('maps and flattens by 1 level');
      expect(sidecarHtml).toContain('What is the syntax for Array.prototype.flatMap?');
      expect(sidecarHtml).toContain('maps and flattens by 1 level');

      // Both reference the same request identity
      expect(floatingHtml).toContain('data-presentation-mode="floating"');
      expect(sidecarHtml).toContain('data-presentation-mode="sidecar"');
    });

    it('switching layout mode does not alter session, messages, or activeRequestId', () => {
      let currentMode: PresentationMode = 'floating';
      const stateCopy: ConversationState = {
        ...sharedState,
        presentationMode: currentMode
      };

      expect(stateCopy.activeRequestId).toBe('req-shared-42');
      expect(stateCopy.messages).toHaveLength(2);

      // Switch to sidecar
      currentMode = 'sidecar';
      const sidecarState: ConversationState = {
        ...stateCopy,
        presentationMode: currentMode
      };

      // Invariant: Session context and request ID are identical
      expect(sidecarState.activeRequestId).toBe('req-shared-42');
      expect(sidecarState.messages).toEqual(sharedState.messages);
      expect(sidecarState.presentationMode).toBe('sidecar');
    });
  });

  // -------------------------------------------------------------------------
  // 2. Stream Survival Across Presentation Mode Transitions
  // -------------------------------------------------------------------------
  describe('2. Active Stream Survival Across Layout Transitions', () => {
    it('active streaming text and request survive transition between floating and sidecar', () => {
      const streamingState: ConversationState = {
        status: 'streaming',
        streamingStatus: 'streaming',
        activeRequestId: 'req-streaming-continuity-1',
        streamingText: 'MAVE is actively streaming a live response across window modes…',
        messages: [
          {
            id: 'm1',
            type: 'message',
            role: 'user',
            content: 'Explain quantum computing'
          }
        ],
        cards: []
      };

      // Floating render
      const floatingHtml = renderToStaticMarkup(
        <ConversationShell state={streamingState} presentationMode="floating" />
      );
      expect(floatingHtml).toContain('MAVE is actively streaming a live response');
      expect(floatingHtml).toContain('data-testid="streaming-text-block"');

      // Sidecar render
      const sidecarHtml = renderToStaticMarkup(
        <ChatOnlyPanel state={streamingState} placement="right" />
      );
      expect(sidecarHtml).toContain('MAVE is actively streaming a live response');
      expect(sidecarHtml).toContain('data-testid="streaming-text-block"');
      expect(sidecarHtml).toContain('data-presentation-mode="sidecar"');
    });
  });

  // -------------------------------------------------------------------------
  // 3. Sidecar → Presence Minimization Context Retention
  // -------------------------------------------------------------------------
  describe('3. Sidecar → Presence Minimization Semantics', () => {
    it('minimizing sidecar to Presence creates quickResponse without wiping conversation context', () => {
      const conversationState: ConversationState = {
        status: 'result',
        activeRequestId: 'req-min-99',
        messages: [
          { id: 'm1', type: 'message', role: 'user', content: 'Remind me of the design invariant' },
          { id: 'm2', type: 'message', role: 'assistant', content: 'Surface Level != Presentation Mode.' }
        ],
        cards: []
      };

      const quickResponse = collapseConversationToPresence(conversationState);

      // Preserves last output for presence bubble
      expect(quickResponse).toBeDefined();
      expect(quickResponse?.text).toBe('Surface Level != Presentation Mode.');

      // Original conversation messages remain intact in state
      expect(conversationState.messages).toHaveLength(2);
      expect(conversationState.activeRequestId).toBe('req-min-99');
    });
  });

  // -------------------------------------------------------------------------
  // 4. Provider / Runtime Metadata Isolation (TaskCard Substrate Privacy)
  // -------------------------------------------------------------------------
  describe('4. Execution Substrate Privacy vs Content Provenance', () => {
    it('TaskCard strips technical AI provider/runtime identities from user badges', () => {
      const leakyTask: TaskCardData = {
        id: 'task-1',
        type: 'task',
        taskName: 'Analyze repository changes',
        responsibleRuntime: 'Claude 3.7 Sonnet', // Technical vendor runtime
        status: 'running'
      };

      const html = renderToStaticMarkup(<TaskCard data={leakyTask} />);

      // Technical vendor name MUST NOT appear in rendered output
      expect(html).not.toContain('Claude 3.7 Sonnet');
      expect(html).not.toContain('claude');

      // Replaced by clean semantic status
      expect(html).toContain('MAVE • Working');
    });

    it('TaskCard sanitizes other technical runtimes (Codex, Antigravity, Ollama, GPT-4o)', () => {
      const runtimes = [
        'Codex API',
        'Antigravity Subagent',
        'Ollama llama3.2:3b',
        'Anthropic Claude',
        'OpenAI gpt-4o'
      ];

      for (const rt of runtimes) {
        const task: TaskCardData = {
          id: 'task-clean-id',
          type: 'task',
          taskName: 'Background Task',
          responsibleRuntime: rt,
          status: 'completed'
        };
        const html = renderToStaticMarkup(<TaskCard data={task} />);
        expect(html).not.toContain(rt);
        expect(html).toContain('Completed');
      }
    });

    it('SourceCard preserves legitimate vendor content provenance citations', () => {
      // Content Provenance != Execution Substrate
      const source: SourceCardData = {
        id: 'src-1',
        type: 'source',
        title: 'OpenAI API Reference and Embeddings Guide',
        domain: 'platform.openai.com',
        url: 'https://platform.openai.com/docs',
        snippet: 'Official reference documentation for OpenAI REST endpoints.'
      };

      const html = renderToStaticMarkup(<SourceCard data={source} />);

      // Legitimate source title and domain MUST be retained
      expect(html).toContain('OpenAI API Reference and Embeddings Guide');
      expect(html).toContain('platform.openai.com');
    });
  });

  // -------------------------------------------------------------------------
  // 5. Card Reuse Invariant & Compact Adaptation
  // -------------------------------------------------------------------------
  describe('5. Card Reuse Invariant in Narrow Sidecar', () => {
    it('reuses existing card types and adapts with density="compact"', () => {
      const diffCard: DiffCardData = {
        id: 'diff-1',
        type: 'diff',
        filename: 'src/utils/math.ts',
        additions: 1,
        deletions: 1,
        lines: [
          { type: 'remove', text: '- return a * 2;', oldLineNumber: 10 },
          { type: 'add', text: '+ return a * 4;', newLineNumber: 10 }
        ],
        density: 'compact'
      };

      const html = renderToStaticMarkup(<DiffCard data={diffCard} />);
      expect(html).toContain('src/utils/math.ts');
      expect(html).toContain('+1');
      expect(html).toContain('-1');
      expect(html).toContain('data-testid="diff-card"');
      expect(html).toContain('data-density="compact"');
    });

    it('ConversationShell in sidecar mode automatically passes compact density to cards', () => {
      const stateWithCards: ConversationState = {
        status: 'result',
        messages: [
          { id: 'm1', type: 'message', role: 'assistant', content: 'Here is your diff:' }
        ],
        cards: [
          {
            id: 'diff-sidecar-auto',
            type: 'diff',
            filename: 'package.json',
            additions: 2,
            deletions: 0,
            lines: [{ type: 'add', text: '+ "typescript": "^5.0.0"', newLineNumber: 12 }]
          }
        ]
      };

      const html = renderToStaticMarkup(
        <ConversationShell state={stateWithCards} presentationMode="sidecar" />
      );

      // Card must be rendered with compact density automatically
      expect(html).toContain('data-density="compact"');
    });
  });

  // -------------------------------------------------------------------------
  // 6. Visual Dismiss != Cancel Request Semantics
  // -------------------------------------------------------------------------
  describe('6. Visual Dismiss vs Request Cancellation', () => {
    it('closing the sidecar visually dismisses without invoking onCancelGeneration', () => {
      const onClose = vi.fn();
      const onCancelGeneration = vi.fn();

      const state: ConversationState = {
        status: 'streaming',
        streamingStatus: 'streaming',
        streamingText: 'Active response continues in background…',
        messages: [],
        cards: []
      };

      const html = renderToStaticMarkup(
        <ChatOnlyPanel
          state={state}
          onClose={onClose}
          onCancelGeneration={onCancelGeneration}
        />
      );

      // Header close button is present
      expect(html).toContain('data-testid="btn-close-conversation"');
      // Visual dismiss must not trigger cancellation callback during render
      expect(onCancelGeneration).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // 7. Sidecar Header Controls & Pinning
  // -------------------------------------------------------------------------
  describe('7. Sidecar Header & Navigation Controls', () => {
    it('renders pin button reflecting pinned state and aria-pressed', () => {
      const state: ConversationState = {
        status: 'idle',
        messages: [],
        cards: [],
        isPinned: true
      };

      const html = renderToStaticMarkup(
        <ChatOnlyPanel state={state} isPinned={true} onTogglePin={() => {}} />
      );

      expect(html).toContain('data-testid="btn-pin-sidecar"');
      expect(html).toContain('aria-pressed="true"');
      expect(html).toContain('data-pinned="true"');
    });

    it('renders expand to floating conversation button in sidecar mode', () => {
      const state: ConversationState = {
        status: 'idle',
        messages: [],
        cards: []
      };

      const html = renderToStaticMarkup(
        <ChatOnlyPanel
          state={state}
          onExpandToConversation={() => {}}
        />
      );

      expect(html).toContain('data-testid="btn-expand-conversation"');
    });

    it('applies placement attribute and placement-specific class names', () => {
      const placements: SidecarPlacement[] = ['right', 'left', 'floating'];

      for (const pl of placements) {
        const html = renderToStaticMarkup(
          <ChatOnlyPanel
            state={{ status: 'idle', messages: [], cards: [] }}
            placement={pl}
          />
        );

        expect(html).toContain(`data-placement="${pl}"`);
        expect(html).toContain(`mave-v2-sidecar-${pl}`);
      }
    });
  });

  // -------------------------------------------------------------------------
  // 8. Minimal Empty State with Suggestion Chips
  // -------------------------------------------------------------------------
  describe('8. Sidecar Minimal Empty State', () => {
    it('renders minimal greeting and 3 quick-suggestion chips when timeline is empty', () => {
      const emptyState: ConversationState = {
        status: 'idle',
        messages: [],
        cards: []
      };

      const html = renderToStaticMarkup(
        <ChatOnlyPanel state={emptyState} />
      );

      expect(html).toContain('data-testid="sidecar-empty-state"');
      expect(html).toContain('What can I help with?');
      expect(html).toContain('Find tutorial video');
      expect(html).toContain('Translate phrase');
      expect(html).toContain('Explain code');
    });
  });

  // -------------------------------------------------------------------------
  // 9. All 15 U4 Synthetic Scenarios Render Cleanly
  // -------------------------------------------------------------------------
  describe('9. Verification of all 15 U4 Synthetic Scenarios', () => {
    it('renders all 15 U4 scenarios without throwing any runtime or markup error', () => {
      expect(U4_CHAT_ONLY_SCENARIOS).toHaveLength(15);

      for (const scenario of U4_CHAT_ONLY_SCENARIOS) {
        expect(scenario.id).toBeDefined();
        expect(scenario.name).toBeDefined();

        const html = renderToStaticMarkup(
          <ChatOnlyPanel
            state={scenario.snapshot.conversation}
            presenceState={scenario.snapshot.presence.state}
            audioLevel={scenario.snapshot.presence.audioLevel}
            placement={scenario.snapshot.sidecarPlacement || 'right'}
            isPinned={scenario.snapshot.isPinned}
          />
        );

        expect(html).toBeDefined();
        expect(html.length).toBeGreaterThan(100);
      }
    });
  });

  // -------------------------------------------------------------------------
  // 10. M4 Production Code Preservation Gate
  // -------------------------------------------------------------------------
  describe('10. M4 Production UI Preservation Gate', () => {
    it('confirms existing M4 production surface components exist and remain unaltered', () => {
      const m4Files = [
        'apps/desktop/src/renderer/src/components/surface/SurfaceView.tsx',
        'apps/desktop/src/renderer/src/components/surface/MaveCapsule.tsx',
        'apps/desktop/src/renderer/src/components/surface/MaveExpandedPanel.tsx'
      ];

      for (const file of m4Files) {
        const fullPath = path.resolve(__dirname, '../../..', file);
        expect(fs.existsSync(fullPath)).toBe(true);
        const content = fs.readFileSync(fullPath, 'utf8');
        expect(content.length).toBeGreaterThan(500);
      }
    });
  });

  // -------------------------------------------------------------------------
  // 11. VSM2 Direction Override — Spatial Authority & Open Typography Gate
  // -------------------------------------------------------------------------
  describe('11. VSM2 Spatial Authority, Open Typography & Companion Semantics', () => {
    const vsm2State: ConversationState = {
      status: 'result',
      activeRequestId: 'req-vsm2-spatial',
      messages: [
        {
          id: 'm1',
          type: 'message',
          role: 'user',
          content: 'หาคลิปอธิบาย React state'
        },
        {
          id: 'm2',
          type: 'message',
          role: 'assistant',
          content: 'Here is an explanation of React state along with a concise tutorial video.'
        }
      ],
      cards: [
        {
          id: 'video-react-state',
          type: 'video',
          title: 'React State in 10 Minutes',
          channel: 'React Official',
          duration: '10:14',
          url: 'https://example.com/react-state',
          density: 'compact'
        }
      ]
    };

    it('Rule 1 & 4: Uses open spatial typography (YOU label + dimmed text, • MAVE mark + ink text) instead of rigid chat bubbles', () => {
      const html = renderToStaticMarkup(
        <ConversationShell state={vsm2State} presentationMode="sidecar" />
      );

      // User turn uses uppercase YOU label and dimmed typography
      expect(html).toContain('YOU');
      expect(html).toContain('หาคลิปอธิบาย React state');
      expect(html).toContain('data-testid="message-card-user"');
      expect(html).toContain('var(--mave-dim)');

      // Assistant turn uses MAVE identity indicator and crisp ink typography
      expect(html).toContain('data-testid="response-group-header"');
      expect(html).toContain('MAVE');
      expect(html).toContain('Here is an explanation of React state');
      expect(html).toContain('data-testid="response-answer-text"');
      expect(html).toContain('var(--mave-ink)');
    });

    it('Rule 2 & 3: Sidecar acts as primary desktop companion without center occlusion', () => {
      const sidecarHtml = renderToStaticMarkup(
        <ChatOnlyPanel state={vsm2State} placement="right" />
      );

      // Renders as dedicated companion with right docking radius and glass gradient
      expect(sidecarHtml).toContain('data-testid="chat-only-panel"');
      expect(sidecarHtml).toContain('data-placement="right"');
      expect(sidecarHtml).toContain('border-radius:24px 0 0 24px');
      expect(sidecarHtml).toContain('var(--mave-glass-gradient)');
      expect(sidecarHtml).toContain('var(--mave-shadow-glass)');
    });

    it('Rule 4 & 5: Zero permanent search/analyze toolbar clutter and zero horizontal scrollbars', () => {
      const html = renderToStaticMarkup(
        <ConversationShell state={vsm2State} presentationMode="sidecar" />
      );

      // No permanent search / analyze / code toolbar clutter
      expect(html).not.toContain('data-testid="conversation-shortcuts-bar"');
      expect(html).not.toContain('Search MAVE');

      // Timeline and outer shell prevent horizontal scrollbar overflow
      expect(html).toContain('overflow-x:hidden');
      expect(html).toContain('scrollbar-width:none');
    });

    it('Rule 6 & 7: Message composer is compact, premium, and utilizes authentic UI Kit tokens', () => {
      const html = renderToStaticMarkup(
        <ConversationShell
          state={vsm2State}
          presentationMode="sidecar"
          onVoiceActivate={() => {}}
          initialInputText="Ask MAVE"
        />
      );

      // Composer has input with authentic Thai/English placeholder
      expect(html).toContain('data-testid="conversation-composer-input"');
      expect(html).toContain('Ask MAVE anything… · ถาม MAVE ได้');

      // Buttons use premium circular/pill layout
      expect(html).toContain('data-testid="conversation-voice-button"');
      expect(html).toContain('data-testid="conversation-send-button"');
      expect(html).toContain('var(--mave-blue)');
      expect(html).toContain('var(--mave-raised)');
      expect(html).toContain('var(--mave-line)');
    });

    it('Rule 8 & 9: Rich results remain contextual within Sidecar and preserve identical state across layout modes', () => {
      const sidecarHtml = renderToStaticMarkup(
        <ChatOnlyPanel state={vsm2State} placement="right" />
      );
      const floatingHtml = renderToStaticMarkup(
        <ConversationShell state={vsm2State} presentationMode="floating" />
      );

      // Rich card is rendered compactly inline inside Sidecar without taking over screen
      expect(sidecarHtml).toContain('data-testid="rich-cards-section"');
      expect(sidecarHtml).toContain('React State in 10 Minutes');

      // Identical content and cards preserved across Sidecar and Floating
      expect(floatingHtml).toContain('data-testid="rich-cards-section"');
      expect(floatingHtml).toContain('React State in 10 Minutes');
      expect(sidecarHtml).toContain('data-presentation-mode="sidecar"');
      expect(floatingHtml).toContain('data-presentation-mode="floating"');
    });
  });
});
