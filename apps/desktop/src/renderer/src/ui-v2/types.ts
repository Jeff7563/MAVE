/**
 * MAVE UI V2 — Prototype Types & State Semantics
 * Track: U0 Adaptive Surface Foundation
 */

export type SurfaceLevel = 'presence' | 'conversation' | 'workspace';

export type PresenceState =
  | 'idle'
  | 'waking'
  | 'listening'
  | 'thinking'
  | 'speaking'
  | 'error';

export type OrbSize = 'hero' | 'medium' | 'compact' | 'status';

export type PresenceControlAction =
  | 'wake'
  | 'stop-listening'
  | 'cancel-thinking'
  | 'stop-speaking'
  | 'retry'
  | 'dismiss'
  | 'expand';

export interface OfficeModeState {
  enabled: boolean;
  silentListening?: boolean;
}

export interface ExpansionEligibility {
  shouldExpand: boolean;
  reason: string;
  triggerType:
    | 'single_compact'
    | 'rich_cards'
    | 'structured_content'
    | 'long_text'
    | 'code_inspection'
    | 'interactive_approval'
    | 'explicit_user_request';
}

export interface QuickResponseData {
  text: string;
  sourceLabel?: string;
  timestamp?: number;
  canExpand?: boolean;
  requestId?: string;
  streaming?: boolean;
}

/**
 * Content Provenance
 *
 * Information origin representing legitimate documentation, articles, media,
 * or reference material cited by MAVE.
 * This is user-facing citation data and MUST render in normal conversation UI
 * even when the title or domain contains vendor names (e.g. "OpenAI Documentation", "Google Docs").
 */
export interface ContentProvenance {
  id?: string;
  title: string;
  sourceType: 'documentation' | 'web' | 'video' | 'file' | 'reference' | 'academic' | 'news';
  domain?: string;
  url?: string;
  snippet?: string;
  authorOrDate?: string;
}

/**
 * Execution Substrate
 *
 * Technical AI model and provider execution details (e.g. Ollama, Claude,
 * Codex, Antigravity, model IDs, token counts, latency).
 * This is technical infrastructure metadata and MUST NOT render in normal
 * user-facing conversation UI (reserved strictly for diagnostics).
 */
export interface ExecutionSubstrate {
  providerId: 'ollama' | 'claude' | 'codex' | 'antigravity' | 'openai' | string;
  modelId?: string;
  runtime?: string;
  latencyMs?: number;
  tokensUsed?: number;
}

export type CardType =
  | 'message'
  | 'translation'
  | 'source'
  | 'video'
  | 'file'
  | 'code'
  | 'task'
  | 'approval'
  | 'error';

export interface BaseCardData {
  id: string;
  type: CardType;
  title?: string;
  timestamp?: string;
}

export interface MessageCardData extends BaseCardData {
  type: 'message';
  role: 'user' | 'assistant';
  content: string;
  semanticRuntime?: string;
  isTranscript?: boolean;
}

export interface TranslationCardData extends BaseCardData {
  type: 'translation';
  originalText: string;
  translatedText: string;
  targetLanguage: string;
  naturalAlternative?: string;
  grammarNote?: string;
  vocabulary?: { term: string; meaning: string }[];
}

export interface SourceCardData extends BaseCardData {
  type: 'source';
  domain: string;
  url: string;
  snippet: string;
  authorOrDate?: string;
  provenance?: ContentProvenance;
}

export interface VideoCardData extends BaseCardData {
  type: 'video';
  channel: string;
  duration: string;
  thumbnailPlaceholder?: string;
  summary?: string;
}

export interface FileCardData extends BaseCardData {
  type: 'file';
  path: string;
  fileType: string;
  linesModified?: number;
  previewSnippet?: string;
}

export interface CodeCardData extends BaseCardData {
  type: 'code';
  language: string;
  code: string;
  filename?: string;
}

export interface TaskCardData extends BaseCardData {
  type: 'task';
  taskName: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'waiting_approval';
  currentStep?: string;
  responsibleRuntime?: string;
  progressPercent?: number;
}

export interface ApprovalCardData extends BaseCardData {
  type: 'approval';
  actionRequested: string;
  riskLevel: 'Level 0 — Read Only' | 'Level 1 — Safe Local' | 'Level 2 — External' | 'Level 3 — Destructive';
  riskClass: 'read_only' | 'safe_local' | 'mutation' | 'destructive';
  command?: string;
  directory?: string;
  status?: 'pending' | 'allowed' | 'denied';
}

export interface ErrorCardData extends BaseCardData {
  type: 'error';
  errorMessage: string;
  recoverable?: boolean;
  suggestedAction?: string;
}

export type UiV2Card =
  | MessageCardData
  | TranslationCardData
  | SourceCardData
  | VideoCardData
  | FileCardData
  | CodeCardData
  | TaskCardData
  | ApprovalCardData
  | ErrorCardData;

export type StreamingStatus =
  | 'idle'
  | 'request_accepted'
  | 'waiting_first_token'
  | 'streaming'
  | 'completed'
  | 'cancelled'
  | 'failed'
  | 'interrupted';

export interface TimelineError {
  message: string;
  recoverable?: boolean;
  suggestedAction?: string;
  technicalDetails?: string;
}

/**
 * ResponseGroup
 *
 * Semantic grouping for a conversational turn:
 * User Message -> MAVE Response -> Sources -> Media/Rich Cards -> Follow-up Suggestions
 * Prevents rigid chat-bubble monotony and creates clear hierarchy.
 */
export interface ResponseGroup {
  id: string;
  requestId?: string;
  userMessage?: MessageCardData;
  answerText?: string;
  streamingText?: string;
  streamingStatus?: StreamingStatus;
  observableProgressText?: string;
  sources?: SourceCardData[];
  cards?: UiV2Card[];
  followUpSuggestions?: string[];
  error?: TimelineError;
  isCancelled?: boolean;
  isInterrupted?: boolean;
  timestamp?: number | string;
}

export interface ConversationState {
  status: 'idle' | 'listening' | 'thinking' | 'streaming' | 'result' | 'richResult' | 'error';
  observableProgressText?: string;
  messages: MessageCardData[];
  cards: UiV2Card[];
  streamingText?: string;
  streamingStatus?: StreamingStatus;
  activeRequestId?: string;
  suggestedShortcuts?: string[];
  followUpSuggestions?: string[];
  contextLabel?: string;
  semanticRuntimeLabel?: string;
  executionSubstrate?: ExecutionSubstrate;
  hasEarlierHistory?: boolean;
  earlierHistoryCount?: number;
  workspaceEligible?: boolean;
  workspaceReason?: string;
  isScrolledUp?: boolean;
  timelineGroups?: ResponseGroup[];
}

export type WorkspaceType = 'agent' | 'language' | 'research' | 'project';

export interface WorkspaceStep {
  id: string;
  label: string;
  status: 'pending' | 'active' | 'completed' | 'failed';
  timestamp?: string;
}

export interface WorkspaceFile {
  path: string;
  status: 'analyzed' | 'modified' | 'created';
}

export interface WorkspaceState {
  type: WorkspaceType;
  title: string;
  status: 'idle' | 'running' | 'waiting_approval' | 'completed' | 'error';
  currentObjective?: string;
  steps: WorkspaceStep[];
  files?: WorkspaceFile[];
  activeApproval?: ApprovalCardData;
  languageContext?: {
    targetLanguage: string;
    mode: string;
    vocabulary: { term: string; meaning: string }[];
    naturalPhrasing?: string;
  };
  sources?: SourceCardData[];
  outputSummary?: string;
}

export interface UiV2Snapshot {
  level: SurfaceLevel;
  presence: {
    state: PresenceState;
    audioLevel: number;
    quickResponse?: QuickResponseData;
  };
  conversation: ConversationState;
  workspace: WorkspaceState;
}

