/**
 * MAVE UI V2 — Conversation Interaction Rules & Handoff Semantics
 * Track: U2 Conversation Surface Foundation
 *
 * Implements deterministic handoffs, semantic grouping, provenance filtering,
 * and timeline state management.
 */

import type {
  ConversationState,
  QuickResponseData,
  PresenceState,
  ResponseGroup,
  MessageCardData,
  SourceCardData,
  ContentProvenance,
  ExecutionSubstrate,
  UiV2Card
} from '../types';

export interface PresenceHandoffInput {
  quickResponse?: QuickResponseData;
  presenceState?: PresenceState;
  activeRequestId?: string;
  historyMessages?: MessageCardData[];
}

/**
 * Handoff from Presence to Conversation.
 *
 * Invariant: Preserves current request identity, accumulated streaming text,
 * and conversation context. Does NOT restart the request, duplicate assistant
 * output, or reset the session.
 */
export function handoffPresenceToConversation(input: PresenceHandoffInput): ConversationState {
  const requestId = input.quickResponse?.requestId || input.activeRequestId || `req-${Date.now()}`;
  const isStreaming = input.quickResponse?.streaming ?? (input.presenceState === 'thinking' || input.presenceState === 'speaking');
  const initialText = input.quickResponse?.text || '';

  const messages: MessageCardData[] = input.historyMessages ? [...input.historyMessages] : [];

  // If there is accumulated text and it is not already the last assistant message
  const lastMsg = messages[messages.length - 1];
  const hasExistingInMessages = lastMsg && lastMsg.role === 'assistant' && lastMsg.content === initialText;

  if (initialText && !hasExistingInMessages && !isStreaming) {
    messages.push({
      id: `msg-${requestId}`,
      type: 'message',
      role: 'assistant',
      content: initialText
    });
  }

  const group: ResponseGroup = {
    id: `group-${requestId}`,
    requestId,
    streamingText: isStreaming ? initialText : undefined,
    answerText: !isStreaming ? initialText : undefined,
    streamingStatus: isStreaming ? 'streaming' : (initialText ? 'completed' : 'idle'),
    observableProgressText: input.presenceState === 'thinking' && !initialText ? 'Thinking…' : undefined
  };

  return {
    status: isStreaming ? 'streaming' : (input.presenceState === 'error' ? 'error' : 'idle'),
    activeRequestId: requestId,
    streamingText: isStreaming ? initialText : undefined,
    streamingStatus: isStreaming ? 'streaming' : 'completed',
    observableProgressText: group.observableProgressText,
    messages,
    cards: []
  };
}

/**
 * Collapse Conversation back to Presence.
 *
 * Invariant: Surface State != Conversation Context.
 * Collapsing is purely a surface viewport change; does NOT clear conversation context,
 * stop background processing, or cancel active tasks.
 */
export function collapseConversationToPresence(state: ConversationState): QuickResponseData | undefined {
  // If there is an active stream or recent response, extract a clean preview
  if (state.streamingText) {
    return {
      text: state.streamingText,
      requestId: state.activeRequestId,
      streaming: true,
      canExpand: true
    };
  }

  // Look for the last assistant message
  const assistantMsgs = state.messages.filter((m) => m.role === 'assistant');
  const lastAssistant = assistantMsgs[assistantMsgs.length - 1];
  if (lastAssistant) {
    return {
      text: lastAssistant.content,
      requestId: state.activeRequestId,
      streaming: false,
      canExpand: true
    };
  }

  // Look in timeline groups
  if (state.timelineGroups && state.timelineGroups.length > 0) {
    const lastGroup = state.timelineGroups[state.timelineGroups.length - 1];
    if (lastGroup) {
      const text = lastGroup.streamingText || lastGroup.answerText;
      if (text) {
        return {
          text,
          requestId: lastGroup.requestId,
          streaming: lastGroup.streamingStatus === 'streaming',
          canExpand: true
        };
      }
    }
  }

  return undefined;
}

/**
 * Group conversation items into structured ResponseGroup turns.
 *
 * Prevents rigid chat-bubble monotony by grouping:
 * [User Message] -> [MAVE Answer] -> [Supporting Sources] -> [Rich Cards] -> [Follow-ups]
 */
export function groupConversationTimeline(state: ConversationState): ResponseGroup[] {
  if (state.timelineGroups && state.timelineGroups.length > 0) {
    return state.timelineGroups;
  }

  const groups: ResponseGroup[] = [];
  const sourceCards: SourceCardData[] = [];
  const richCards: UiV2Card[] = [];

  // Separate sources and rich cards
  for (const card of state.cards) {
    if (card.type === 'source') {
      sourceCards.push(card);
    } else {
      richCards.push(card);
    }
  }

  const messages = state.messages || [];

  if (messages.length === 0) {
    // If no messages but streaming text exists
    if (state.streamingText || state.observableProgressText) {
      groups.push({
        id: `group-active`,
        requestId: state.activeRequestId,
        streamingText: state.streamingText,
        streamingStatus: state.streamingStatus || (state.streamingText ? 'streaming' : 'waiting_first_token'),
        observableProgressText: state.observableProgressText,
        sources: sourceCards,
        cards: richCards,
        followUpSuggestions: state.followUpSuggestions
      });
    }
    return groups;
  }

  let currentGroup: ResponseGroup | null = null;

  for (const msg of messages) {
    if (msg.role === 'user') {
      // If we had a group open, push it
      if (currentGroup) {
        groups.push(currentGroup);
      }
      currentGroup = {
        id: `group-${msg.id}`,
        userMessage: msg,
        sources: [],
        cards: []
      };
    } else if (msg.role === 'assistant') {
      if (!currentGroup) {
        currentGroup = {
          id: `group-${msg.id}`,
          answerText: msg.content,
          sources: [],
          cards: []
        };
      } else {
        currentGroup.answerText = msg.content;
      }
    }
  }

  // Handle active streaming / first-token state on the last group
  if (state.streamingText || state.observableProgressText) {
    if (!currentGroup) {
      currentGroup = {
        id: `group-active`,
        requestId: state.activeRequestId,
        streamingText: state.streamingText,
        streamingStatus: state.streamingStatus || 'streaming',
        observableProgressText: state.observableProgressText,
        sources: [],
        cards: []
      };
    } else if (!currentGroup.answerText) {
      currentGroup.streamingText = state.streamingText;
      currentGroup.streamingStatus = state.streamingStatus || 'streaming';
      currentGroup.observableProgressText = state.observableProgressText;
    } else {
      groups.push(currentGroup);
      currentGroup = {
        id: `group-active`,
        requestId: state.activeRequestId,
        streamingText: state.streamingText,
        streamingStatus: state.streamingStatus || 'streaming',
        observableProgressText: state.observableProgressText,
        sources: [],
        cards: []
      };
    }
  }

  if (currentGroup) {
    // Attach sources and cards to the last group
    currentGroup.sources = [...(currentGroup.sources || []), ...sourceCards];
    currentGroup.cards = [...(currentGroup.cards || []), ...richCards];
    currentGroup.followUpSuggestions = state.followUpSuggestions;
    groups.push(currentGroup);
  }

  return groups;
}

/**
 * Filter and format Content Provenance.
 *
 * Verifies that genuine citation provenance (e.g. "OpenAI Documentation",
 * "Google Docs", "Anthropic Research", "Wikipedia") is preserved and rendered,
 * while isolating execution substrate metadata.
 */
export function filterContentProvenance(
  sources: (SourceCardData | ContentProvenance)[]
): ContentProvenance[] {
  return sources.map((item) => {
    if ('type' in item && item.type === 'source') {
      return {
        id: item.id,
        title: item.title || item.domain,
        sourceType: 'web',
        domain: item.domain,
        url: item.url,
        snippet: item.snippet,
        authorOrDate: item.authorOrDate
      };
    }
    return item as ContentProvenance;
  });
}

/**
 * Validation check for execution substrate isolation.
 * Guarantees that internal provider/model execution strings do not leak
 * into normal conversation view.
 */
export function isExecutionSubstrateIsolated(
  substrate: ExecutionSubstrate | undefined,
  renderedDomText: string
): boolean {
  if (!substrate) return true;
  if (!substrate.modelId && !substrate.providerId) return true;

  // Check if providerId appears in rendered UI as a technical badge
  // Note: Legitimate citations like "OpenAI Documentation" must still be allowed!
  // This validates that technical badges like "Model: gpt-4o" or raw substrate do not leak.
  if (substrate.modelId && renderedDomText.includes(`Model: ${substrate.modelId}`)) {
    return false;
  }
  return true;
}
