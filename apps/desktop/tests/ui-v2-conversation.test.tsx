import { describe, it, expect, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { ConversationShell } from '../src/renderer/src/ui-v2/conversation/ConversationShell';
import { ChatOnlyPanel } from '../src/renderer/src/ui-v2/conversation/ChatOnlyPanel';
import {
  handoffPresenceToConversation,
  collapseConversationToPresence,
  groupConversationTimeline,
  filterContentProvenance,
  isExecutionSubstrateIsolated
} from '../src/renderer/src/ui-v2/conversation/conversation-rules';
import {
  U2_CONVERSATION_SCENARIOS
} from '../src/renderer/src/ui-v2/mocks/mock-scenarios';
import type { ConversationState, ExecutionSubstrate } from '../src/renderer/src/ui-v2/types';

describe('MAVE UI V2 — U2 Conversation Surface Dialogue & Composition Foundation Tests', () => {
  describe('1. Presence → Conversation Continuity (Deterministic Handoff)', () => {
    it('preserves request ID, accumulated response, and streaming state without duplication or reset', () => {
      const activeRequestId = 'req-handoff-999';
      const partialText = 'MAVE is actively explaining quantum entanglement…';

      const handoff = handoffPresenceToConversation({
        activeRequestId,
        quickResponse: {
          text: partialText,
          requestId: activeRequestId,
          streaming: true
        },
        presenceState: 'speaking'
      });

      // Verification of continuity invariants:
      expect(handoff.activeRequestId).toBe(activeRequestId);
      expect(handoff.streamingText).toBe(partialText);
      expect(handoff.streamingStatus).toBe('streaming');
      expect(handoff.status).toBe('streaming');

      // Verify that ConversationShell renders this accumulated text seamlessly
      const html = renderToStaticMarkup(
        <ConversationShell state={handoff as ConversationState} />
      );
      expect(html).toContain(partialText);
      expect(html).toContain('data-testid="streaming-text-block"');
      // No duplicate messages in timeline
      expect(html).not.toContain('data-testid="response-answer-text"');
    });

    it('preserves existing conversation history turns during handoff', () => {
      const historyTurns = [
        {
          id: 'turn-1',
          type: 'message' as const,
          role: 'user' as const,
          content: 'What is the capital of France?'
        },
        {
          id: 'turn-2',
          type: 'message' as const,
          role: 'assistant' as const,
          content: 'The capital of France is Paris.'
        }
      ];

      const handoff = handoffPresenceToConversation({
        activeRequestId: 'req-turn-3',
        quickResponse: {
          text: 'Now explaining Lyon…',
          streaming: true
        },
        presenceState: 'speaking',
        historyMessages: historyTurns
      });

      expect(handoff.messages).toHaveLength(2);
      expect(handoff.messages[0]?.content).toBe('What is the capital of France?');
      expect(handoff.streamingText).toBe('Now explaining Lyon…');

      const html = renderToStaticMarkup(
        <ConversationShell state={handoff as ConversationState} />
      );
      expect(html).toContain('What is the capital of France?');
      expect(html).toContain('The capital of France is Paris.');
      expect(html).toContain('Now explaining Lyon…');
    });
  });

  describe('2. Conversation → Presence Collapse (Context Invariant)', () => {
    it('collapsing Conversation returns quick preview without deleting background context', () => {
      const conversationState: ConversationState = {
        status: 'result',
        activeRequestId: 'req-collapse-101',
        messages: [
          {
            id: 'm1',
            type: 'message',
            role: 'user',
            content: 'Summarize the release notes'
          },
          {
            id: 'm2',
            type: 'message',
            role: 'assistant',
            content: 'Release notes summarized in 3 points.'
          }
        ],
        cards: []
      };

      const collapsed = collapseConversationToPresence(conversationState);
      expect(collapsed).toBeDefined();
      expect(collapsed?.text).toBe('Release notes summarized in 3 points.');
      expect(collapsed?.requestId).toBe('req-collapse-101');
      expect(collapsed?.canExpand).toBe(true);

      // Invariant: conversationState still contains full history
      expect(conversationState.messages).toHaveLength(2);
      expect(conversationState.messages[0]?.content).toBe('Summarize the release notes');
    });

    it('collapsing an active stream marks quick response as streaming', () => {
      const streamingState: ConversationState = {
        status: 'streaming',
        activeRequestId: 'req-stream-collapse',
        streamingText: 'Processing data stream…',
        streamingStatus: 'streaming',
        messages: [],
        cards: []
      };

      const collapsed = collapseConversationToPresence(streamingState);
      expect(collapsed?.streaming).toBe(true);
      expect(collapsed?.text).toBe('Processing data stream…');
    });
  });

  describe('3. Content Provenance vs Execution Substrate Isolation', () => {
    it('renders legitimate vendor citations ("OpenAI Documentation", "Google Docs") as Content Provenance', () => {
      const stateWithVendorSources: ConversationState = {
        status: 'result',
        messages: [
          {
            id: 'm1',
            type: 'message',
            role: 'user',
            content: 'Where can I read about Structured Outputs?'
          },
          {
            id: 'm2',
            type: 'message',
            role: 'assistant',
            content: 'Here are the official documentation guides:'
          }
        ],
        cards: [
          {
            id: 'src-openai',
            type: 'source',
            domain: 'platform.openai.com',
            title: 'OpenAI Documentation',
            url: 'https://platform.openai.com/docs',
            snippet: 'Official guide to API models and structured output schemas.'
          },
          {
            id: 'src-google',
            type: 'source',
            domain: 'docs.google.com',
            title: 'Google Docs Collaboration Guide',
            url: 'https://docs.google.com',
            snippet: 'Real-time document sharing and version history.'
          }
        ]
      };

      const html = renderToStaticMarkup(<ConversationShell state={stateWithVendorSources} />);
      expect(html).toContain('data-testid="grouped-sources-section"');
      expect(html).toContain('OpenAI Documentation');
      expect(html).toContain('platform.openai.com');
      expect(html).toContain('Google Docs Collaboration Guide');
      expect(html).toContain('docs.google.com');
    });

    it('does NOT render execution substrate metadata (model IDs, provider IDs) in normal Conversation UI', () => {
      const substrate: ExecutionSubstrate = {
        providerId: 'openai',
        modelId: 'gpt-4o',
        runtime: 'cloud_paid_api',
        latencyMs: 840,
        tokensUsed: 124
      };

      const state: ConversationState = {
        status: 'result',
        executionSubstrate: substrate,
        messages: [
          {
            id: 'm1',
            type: 'message',
            role: 'assistant',
            content: 'Normal user response text.'
          }
        ],
        cards: []
      };

      const html = renderToStaticMarkup(<ConversationShell state={state} />);
      // Verify normal answer text renders
      expect(html).toContain('Normal user response text.');

      // Invariant: technical substrate is NOT rendered in user-facing UI
      expect(html).not.toContain('gpt-4o');
      expect(html).not.toContain('cloud_paid_api');
      expect(html).not.toContain('tokensUsed');
      expect(isExecutionSubstrateIsolated(substrate, html)).toBe(true);
    });

    it('filterContentProvenance correctly standardizes source cards into provenance records', () => {
      const sources = [
        {
          id: 'src-1',
          type: 'source' as const,
          domain: 'anthropic.com',
          title: 'Anthropic Research',
          url: 'https://anthropic.com/research',
          snippet: 'Constitutional AI findings.'
        }
      ];

      const prov = filterContentProvenance(sources);
      expect(prov).toHaveLength(1);
      expect(prov[0]?.title).toBe('Anthropic Research');
      expect(prov[0]?.domain).toBe('anthropic.com');
      expect(prov[0]?.sourceType).toBe('web');
    });
  });

  describe('4. Suggestion Shortcuts & Contextual Follow-up Chips', () => {
    it('renders suggested shortcuts as prompt accelerators without locking modal AI modes', () => {
      const onSelectShortcut = vi.fn();
      const state: ConversationState = {
        status: 'idle',
        suggestedShortcuts: ['Search', 'Analyze', 'Code', 'Translate'],
        messages: [],
        cards: []
      };

      const html = renderToStaticMarkup(
        <ConversationShell state={state} onSelectShortcut={onSelectShortcut} />
      );

      expect(html).toContain('data-testid="conversation-shortcuts-bar"');
      expect(html).toContain('data-testid="shortcut-search"');
      expect(html).toContain('data-testid="shortcut-analyze"');
      expect(html).toContain('data-testid="shortcut-code"');
      expect(html).toContain('data-testid="shortcut-translate"');

      // Free text entry remains available
      expect(html).toContain('data-testid="conversation-composer-input"');
    });

    it('renders contextual follow-up suggestions post-response', () => {
      const state: ConversationState = {
        status: 'richResult',
        messages: [
          {
            id: 'm1',
            type: 'message',
            role: 'assistant',
            content: 'Bonjour means hello in French.'
          }
        ],
        cards: [],
        followUpSuggestions: ['Explain grammar', 'More natural', 'Practice this']
      };

      const html = renderToStaticMarkup(<ConversationShell state={state} />);
      expect(html).toContain('data-testid="followup-suggestions"');
      expect(html).toContain('Explain grammar');
      expect(html).toContain('More natural');
      expect(html).toContain('Practice this');
    });
  });

  describe('5. Streaming Semantics, First-Token Truthfulness, and Cancellation', () => {
    it('renders truthful first-token observable progress banner without fabricated reasoning steps', () => {
      const state: ConversationState = {
        status: 'thinking',
        observableProgressText: 'Reading 4 sources from documentation…',
        messages: [],
        cards: []
      };

      const html = renderToStaticMarkup(<ConversationShell state={state} />);
      expect(html).toContain('data-testid="observable-progress-banner"');
      expect(html).toContain('Reading 4 sources from documentation…');
    });

    it('renders in-place streaming text with blinking cursor and Stop button', () => {
      const state: ConversationState = {
        status: 'streaming',
        streamingStatus: 'streaming',
        streamingText: 'Building AST for parser optimization…',
        messages: [],
        cards: []
      };

      const html = renderToStaticMarkup(<ConversationShell state={state} />);
      expect(html).toContain('data-testid="streaming-text-block"');
      expect(html).toContain('Building AST for parser optimization…');
      expect(html).toContain('data-testid="conversation-stop-button"');
      expect(html).toContain('Stop');
    });

    it('preserves accumulated text and marks response as [Stopped] on cancellation', () => {
      const state: ConversationState = {
        status: 'idle',
        streamingStatus: 'cancelled',
        messages: [],
        cards: [],
        timelineGroups: [
          {
            id: 'grp-cancelled',
            answerText: 'First two paragraphs completed before user cancelled…',
            isCancelled: true,
            streamingStatus: 'cancelled'
          }
        ]
      };

      const html = renderToStaticMarkup(<ConversationShell state={state} />);
      expect(html).toContain('First two paragraphs completed before user cancelled…');
      expect(html).toContain('data-testid="status-cancelled"');
      expect(html).toContain('[Stopped]');
    });

    it('marks response as [Interrupted] on user barge-in without deleting accumulated text', () => {
      const state: ConversationState = {
        status: 'idle',
        streamingStatus: 'interrupted',
        messages: [],
        cards: [],
        timelineGroups: [
          {
            id: 'grp-interrupted',
            answerText: 'Spoken output before user interrupted…',
            isInterrupted: true,
            streamingStatus: 'interrupted'
          }
        ]
      };

      const html = renderToStaticMarkup(<ConversationShell state={state} />);
      expect(html).toContain('Spoken output before user interrupted…');
      expect(html).toContain('data-testid="status-interrupted"');
      expect(html).toContain('[Interrupted]');
    });
  });

  describe('6. Deterministic Scroll Semantics & "New response ↓" Pill', () => {
    it('renders non-intrusive "New response ↓" pill when scrolled up', () => {
      const state: ConversationState = {
        status: 'streaming',
        streamingText: 'New incoming stream tokens…',
        isScrolledUp: true,
        messages: [],
        cards: []
      };

      const html = renderToStaticMarkup(<ConversationShell state={state} />);
      expect(html).toContain('data-testid="scroll-to-bottom-pill"');
      expect(html).toContain('New response');
      expect(html).toContain('↓');
    });

    it('does NOT render "New response ↓" pill when at bottom (isScrolledUp = false)', () => {
      const state: ConversationState = {
        status: 'streaming',
        streamingText: 'Tokens streaming at bottom…',
        isScrolledUp: false,
        messages: [],
        cards: []
      };

      const html = renderToStaticMarkup(<ConversationShell state={state} />);
      expect(html).not.toContain('data-testid="scroll-to-bottom-pill"');
    });
  });

  describe('7. Visible Timeline vs Runtime Context ("Load Earlier Conversation")', () => {
    it('renders "Load earlier conversation" button when earlier history exists', () => {
      const state: ConversationState = {
        status: 'idle',
        hasEarlierHistory: true,
        earlierHistoryCount: 15,
        messages: [
          {
            id: 'm1',
            type: 'message',
            role: 'assistant',
            content: 'Recent visible turn.'
          }
        ],
        cards: []
      };

      const html = renderToStaticMarkup(<ConversationShell state={state} />);
      expect(html).toContain('data-testid="btn-load-earlier-history"');
      expect(html).toContain('Load earlier conversation (15)');
    });
  });

  describe('8. Long Content != Workspace (Workspace Boundary)', () => {
    it('long answers render inside Conversation without forcing Workspace escalation', () => {
      const longText = 'Paragraph 1\n\n' + 'Paragraph 2\n\n'.repeat(10);
      const state: ConversationState = {
        status: 'result',
        messages: [
          {
            id: 'm1',
            type: 'message',
            role: 'assistant',
            content: longText
          }
        ],
        cards: []
      };

      const html = renderToStaticMarkup(<ConversationShell state={state} />);
      expect(html).toContain('Paragraph 1');
      // No forced workspace escalation
      expect(html).not.toContain('data-testid="workspace-escalation-banner"');
    });

    it('renders workspace escalation banner only when interaction complexity requires it', () => {
      const state: ConversationState = {
        status: 'result',
        workspaceEligible: true,
        workspaceReason: 'Task involves 5 modified files and interactive terminal execution.',
        messages: [],
        cards: []
      };

      const html = renderToStaticMarkup(<ConversationShell state={state} />);
      expect(html).toContain('data-testid="workspace-escalation-banner"');
      expect(html).toContain('Task involves 5 modified files and interactive terminal execution.');
      expect(html).toContain('data-testid="btn-expand-workspace"');
    });
  });

  describe('9. Local Error Handling & Retry', () => {
    it('renders local error card near failed request with Retry button', () => {
      const state: ConversationState = {
        status: 'error',
        messages: [],
        cards: [],
        timelineGroups: [
          {
            id: 'grp-err',
            error: {
              message: 'Connection to local brain failed (timeout 5000ms).',
              recoverable: true,
              suggestedAction: 'Retry Connection',
              technicalDetails: 'ECONNREFUSED 127.0.0.1:11434'
            }
          }
        ]
      };

      const html = renderToStaticMarkup(<ConversationShell state={state} />);
      expect(html).toContain('data-testid="local-error-card"');
      expect(html).toContain('Connection to local brain failed');
      expect(html).toContain('data-testid="btn-retry-error"');
      expect(html).toContain('Retry Connection');
      expect(html).toContain('ECONNREFUSED 127.0.0.1:11434');
    });
  });

  describe('10. Context Label & Primary MAVE Identity', () => {
    it('renders contextual label alongside MAVE without replacing primary brand', () => {
      const state: ConversationState = {
        status: 'idle',
        contextLabel: 'Language Practice',
        messages: [],
        cards: []
      };

      const html = renderToStaticMarkup(<ConversationShell state={state} />);
      expect(html).toContain('MAVE');
      expect(html).toContain('data-testid="conversation-context-label"');
      expect(html).toContain('Language Practice');
    });
  });

  describe('11. ChatOnlyPanel Wrapper', () => {
    it('renders ChatOnlyPanel with ConversationShell inside fixed-width container', () => {
      const state: ConversationState = {
        status: 'idle',
        messages: [
          {
            id: 'm1',
            type: 'message',
            role: 'assistant',
            content: 'Chat-only docked assistance.'
          }
        ],
        cards: []
      };

      const html = renderToStaticMarkup(<ChatOnlyPanel state={state} />);
      expect(html).toContain('data-testid="chat-only-panel"');
      expect(html).toContain('data-testid="conversation-shell"');
      expect(html).toContain('Chat-only docked assistance.');
    });
  });

  describe('12. Semantic Grouping & Hierarchy', () => {
    it('groupConversationTimeline structures User Question -> Answer -> Sources -> Cards', () => {
      const state: ConversationState = {
        status: 'richResult',
        messages: [
          {
            id: 'u1',
            type: 'message',
            role: 'user',
            content: 'What is WebSockets in Node 22?'
          },
          {
            id: 'a1',
            type: 'message',
            role: 'assistant',
            content: 'Node.js 22 provides built-in WebSocket client implementation.'
          }
        ],
        cards: [
          {
            id: 's1',
            type: 'source',
            domain: 'nodejs.org',
            title: 'Node.js 22 LTS',
            url: 'https://nodejs.org',
            snippet: 'Native WebSocket documentation.'
          }
        ]
      };

      const groups = groupConversationTimeline(state);
      expect(groups).toHaveLength(1);
      expect(groups[0]?.userMessage?.content).toBe('What is WebSockets in Node 22?');
      expect(groups[0]?.answerText).toBe('Node.js 22 provides built-in WebSocket client implementation.');
      expect(groups[0]?.sources).toHaveLength(1);
      expect(groups[0]?.sources?.[0]?.title).toBe('Node.js 22 LTS');
    });
  });

  describe('13. All 14 U2 Synthetic Mock Scenarios Verification', () => {
    it('all 14 U2 scenarios are defined and render valid static markup', () => {
      expect(U2_CONVERSATION_SCENARIOS).toHaveLength(14);

      const expectedU2Ids = [
        'u2_01_short_text',
        'u2_02_multiturn_voice',
        'u2_03_streaming_long_answer',
        'u2_04_answer_one_source',
        'u2_05_answer_multiple_sources',
        'u2_06_answer_video',
        'u2_07_translation_conversation',
        'u2_08_code_answer',
        'u2_09_cancelled_streaming',
        'u2_10_failed_request_retry',
        'u2_11_scrolled_up_streaming',
        'u2_12_presence_conversation_continuity',
        'u2_13_conversation_presence_collapse',
        'u2_14_workspace_escalation_eligible'
      ];

      for (const id of expectedU2Ids) {
        const scenario = U2_CONVERSATION_SCENARIOS.find((s) => s.id === id);
        expect(scenario).toBeDefined();
        expect(scenario!.snapshot).toBeDefined();

        // Render ConversationShell or PresenceSurface depending on scenario level
        if (scenario!.snapshot.level === 'conversation') {
          const html = renderToStaticMarkup(
            <ConversationShell state={scenario!.snapshot.conversation} />
          );
          expect(html).toContain('data-testid="conversation-shell"');
        }
      }
    });
  });

  describe('14. Visual QA P2 — User-Facing Terminology & Fluid Width Invariants', () => {
    it('does NOT expose internal architecture label "SIDECAR" or default "Desktop Companion" in user-facing header', () => {
      const htmlSidecar = renderToStaticMarkup(
        <ConversationShell
          state={{
            status: 'idle',
            messages: [],
            cards: []
          }}
          presentationMode="sidecar"
        />
      );

      // Must NOT leak internal architecture terminology
      expect(htmlSidecar).not.toContain('• SIDECAR');
      expect(htmlSidecar).not.toContain('Desktop Companion');
      expect(htmlSidecar).toContain('data-testid="conversation-header"');
      expect(htmlSidecar).toContain('MAVE');
    });

    it('uses fluid responsive card layout bounded by container', () => {
      const html = renderToStaticMarkup(
        <ConversationShell
          state={{
            status: 'result',
            messages: [
              { id: 'm1', type: 'message', role: 'user', content: 'Show me an example source' },
              { id: 'm2', type: 'message', role: 'assistant', content: 'Here is the source:' }
            ],
            cards: [
              {
                id: 's1',
                type: 'source',
                domain: 'example.com',
                title: 'Example Source',
                url: 'https://example.com',
                snippet: 'A snippet'
              }
            ]
          }}
          presentationMode="floating"
        />
      );

      expect(html).toContain('max-width:min(680px, 100%)');
    });
  });
});


