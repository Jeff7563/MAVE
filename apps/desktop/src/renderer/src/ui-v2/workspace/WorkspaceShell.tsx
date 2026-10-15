import React, { useState, useEffect } from 'react';
import type {
  WorkspaceState,
  ConversationState,
  WorkspaceArtifact
} from '../types';
import { AdaptivePresenceMark } from '../primitives/AdaptivePresenceMark';
import {
  FocusIcon,
  ChatIcon,
  FolderIcon,
  MinimizeIcon,
  CloseIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  AlertIcon,
  HandIcon,
  RetryIcon
} from '../primitives/Icons';
import { WorkspaceDiffView } from './WorkspaceDiffView';
import { WorkspaceResearchView } from './WorkspaceResearchView';
import { WorkspaceProjectView } from './WorkspaceProjectView';
import { AgentWorkspaceView } from './AgentWorkspaceView';
import { LanguageWorkspaceView } from './LanguageWorkspaceView';
import { ConversationShell } from '../conversation/ConversationShell';
import { ApprovalCard } from '../cards/ActionAndTaskCards';
import { SourceCard } from '../cards/MediaCards';
import '../tokens.css';


export interface WorkspaceShellProps {
  state: WorkspaceState;
  conversationState?: ConversationState;
  onMinimizeToConversation?: () => void;
  onCollapseToPresence?: () => void;
  onClose?: () => void;
  onAllowApproval?: (id: string) => void;
  onDenyApproval?: (id: string) => void;
  onSendMessage?: (text: string) => void;
  onSelectArtifact?: (id: string) => void;
  onSelectFile?: (path: string) => void;
  onApproveReview?: () => void;
  onRequestRevision?: () => void;
  onRetry?: () => void;
  onCancelTask?: () => void;
  onListenExample?: (phrase: string) => void;
  onStartSpeakingPractice?: (phrase: string) => void;
  onStopSpeakingPractice?: () => void;
  onSaveVocabularyMock?: (id: string) => void;
  onChangeCorrectionIntensity?: (intensity: any) => void;
  onToggleShowTranslation?: () => void;
  onStepOutOfRole?: () => void;
  onResumeRoleplay?: () => void;
  onPracticeAgain?: () => void;
  className?: string;
  officeMode?: boolean;
  width?: string | number;
  height?: string | number;
  initialFocusMode?: boolean;
  initialShowConversation?: boolean;
  initialShowContext?: boolean;
}

/**
 * WorkspaceShell
 *
 * Master Level 3 Workspace Surface container.
 *
 * Core Architectural Invariants:
 * 1. Workspace != Agent Runtime (Hosts Diff Review, Research, Projects, Artifacts, and Agent Oversight)
 * 2. Surface State != Task State (Visual dismiss or minimizing does NOT cancel ongoing background work)
 * 3. Composable Regions: Conversation | Primary Work Area | Supporting Context | Activity
 * 4. Execution Substrate Privacy: Provider/model details remain Developer Diagnostics only
 * 5. Progress Truthfulness: Real determinate counts when known; indeterminate when unknown.
 */
export const WorkspaceShell: React.FC<WorkspaceShellProps> = ({
  state,
  conversationState,
  onMinimizeToConversation,
  onCollapseToPresence,
  onClose,
  onAllowApproval,
  onDenyApproval,
  onSendMessage,
  onSelectArtifact,
  onSelectFile,
  onApproveReview,
  onRequestRevision,
  onRetry,
  onCancelTask,
  onListenExample,
  onStartSpeakingPractice,
  onStopSpeakingPractice,
  onSaveVocabularyMock,
  onChangeCorrectionIntensity,
  onToggleShowTranslation,
  onStepOutOfRole,
  onResumeRoleplay,
  onPracticeAgain,
  className = '',
  officeMode = false,
  width = '100%',
  height = '100%',
  initialFocusMode,
  initialShowConversation,
  initialShowContext
}) => {
  const activeConversation: ConversationState =
    conversationState ||
    state.conversation || {
      status: 'idle',
      messages: [],
      cards: []
    };

  const hasConvMessages = Boolean(activeConversation.messages && activeConversation.messages.length > 0);
  const isLanguageMode = state.type === 'language';
  const hasMultipleArtifacts = Boolean(state.artifacts && state.artifacts.length > 1);
  const contextFiles = state.files || state.targetFiles;
  const hasContextContent = state.type !== 'language' && Boolean(
    state.activeApproval ||
    hasMultipleArtifacts ||
    (contextFiles && contextFiles.length > 0) ||
    (state.sources && state.sources.length > 0 && state.type !== 'research')
  );

  const isFocusRequested =
    initialFocusMode ??
    state.isFocusMode ??
    (state.userFacingState === 'Focus Review' || (state.type === 'diff_review' && state.title?.toLowerCase().includes('deep diff'))) ??
    false;

  const [isFocusMode, setIsFocusMode] = useState<boolean>(isFocusRequested);

  const defaultShowConversation = (): boolean => {
    if (initialShowConversation !== undefined) return initialShowConversation;
    if (state.initialShowConversation !== undefined) return state.initialShowConversation;
    if (isLanguageMode) return false;
    if (activeConversation.status === 'streaming') return true;
    // In technical diff review and research, artifact dominates full width by default
    if (state.type === 'diff_review' || state.type === 'research') return false;
    return hasConvMessages || state.type === 'project' || state.type === 'agent';
  };

  const defaultShowContext = (): boolean => {
    if (initialShowContext !== undefined) return initialShowContext;
    if (state.initialShowContext !== undefined) return state.initialShowContext;
    if (!hasContextContent) return false;
    if (state.activeApproval) return true;
    // In diff review and research, supporting elements are embedded in the main canvas
    if (state.type === 'diff_review' || state.type === 'research') return false;
    return hasContextContent;
  };

  const [showConversation, setShowConversation] = useState<boolean>(defaultShowConversation);
  const [showContext, setShowContext] = useState<boolean>(defaultShowContext);
  const [activeArtifactId, setActiveArtifactId] = useState<string | undefined>(
    state.activeArtifactId || state.artifacts?.[0]?.id
  );
  const [selectedFile, setSelectedFile] = useState<string | undefined>(
    state.files?.[0]?.path
  );

  // Sync internal artifact selection if controlled from props
  useEffect(() => {
    if (state.activeArtifactId) {
      setActiveArtifactId(state.activeArtifactId);
    }
  }, [state.activeArtifactId]);

  // Re-sync default rail visibility and focus state when workspace task/identity changes
  useEffect(() => {
    setShowConversation(defaultShowConversation());
    setShowContext(defaultShowContext());
    setIsFocusMode(isFocusRequested);
  }, [state.id, state.type, state.initialShowConversation, state.initialShowContext, initialShowConversation, initialShowContext, isFocusRequested]);

  // Sync internal file selection if updated
  useEffect(() => {
    if (state.files?.[0]?.path) {
      setSelectedFile(state.files[0].path);
    }
  }, [state.files, state.id]);

  // Keyboard shortcut listener (Local component shortcuts only)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if user is typing inside an input or textarea
      const target = e.target as HTMLElement;
      if (target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA') return;

      if (e.key === 'Escape' && isFocusMode) {
        setIsFocusMode(false);
      } else if (e.altKey && (e.key === 'f' || e.key === 'F')) {
        e.preventDefault();
        setIsFocusMode((prev) => !prev);
      } else if (e.altKey && (e.key === 'c' || e.key === 'C')) {
        e.preventDefault();
        setShowConversation((prev) => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isFocusMode]);

  const isRunning = state.status === 'running';
  const isWaitingApproval = state.status === 'waiting_approval';
  const isCompleted = state.status === 'completed';
  const isFailed = state.status === 'error';

  // Semantic Status Color
  const statusColor = isCompleted
    ? 'var(--mave-v2-accent-success)'
    : isWaitingApproval
    ? 'var(--mave-v2-accent-warning)'
    : isFailed
    ? 'var(--mave-v2-accent-error)'
    : isRunning
    ? 'var(--mave-v2-accent-thinking)'
    : 'var(--mave-v2-text-muted)';

  // User-facing semantic status text (Zero provider leakage)
  const semanticStatusText =
    state.userFacingState ||
    (isCompleted
      ? 'Completed'
      : isWaitingApproval
      ? 'Waiting for Approval'
      : isFailed
      ? 'Failed'
      : isRunning
      ? 'Working'
      : 'Ready');

  // Active Artifact lookup
  const currentArtifact: WorkspaceArtifact | undefined =
    state.artifacts?.find((a) => a.id === activeArtifactId) || state.artifacts?.[0];

  return (
    <div
      className={`mave-v2-workspace-shell ${isFocusMode ? 'mave-v2-workspace-focus' : ''} ${className}`.trim()}
      style={{
        width,
        height,
        background: 'rgba(12, 16, 28, 0.88)',
        backdropFilter: 'blur(28px)',
        WebkitBackdropFilter: 'blur(28px)',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        borderRadius: '20px',
        boxShadow: '0 24px 64px rgba(0, 0, 0, 0.65), 0 0 1px rgba(255, 255, 255, 0.15) inset',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        boxSizing: 'border-box',
        color: '#f8fafc',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        position: 'relative'
      }}
      data-testid="workspace-shell"
      data-type={state.type}
      data-focus-mode={isFocusMode ? 'true' : 'false'}
    >
      {/* 1. Workspace Header */}
      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '12px 20px',
          borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
          background: 'rgba(255, 255, 255, 0.02)',
          userSelect: 'none'
        }}
      >
        {/* Left: Identity, Title, Semantic Status (Clean, zero debug noise) */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
          <AdaptivePresenceMark
            size="status"
            state={isRunning ? 'thinking' : isWaitingApproval ? 'idle' : 'idle'}
          />
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0, overflow: 'hidden' }}>
            <span style={{ fontWeight: 600, fontSize: '13px', letterSpacing: '0.14em', color: '#f8fafc', flexShrink: 0 }}>
              MAVE
            </span>
            <span style={{ color: 'rgba(255, 255, 255, 0.25)', fontSize: '12px', flexShrink: 0 }}>/</span>
            <span
              style={{
                fontWeight: 600,
                fontSize: '13px',
                color: '#f8fafc',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap'
              }}
              data-testid="workspace-title"
              title={state.title}
            >
              {state.title}
            </span>
            {semanticStatusText && (
              <span
                style={{
                  fontSize: '10px',
                  fontWeight: 600,
                  color: statusColor,
                  background: 'rgba(255, 255, 255, 0.05)',
                  padding: '2px 8px',
                  borderRadius: '4px',
                  textTransform: 'uppercase',
                  letterSpacing: '0.4px',
                  border: isWaitingApproval ? '1px solid rgba(245, 158, 11, 0.4)' : 'none',
                  flexShrink: 0
                }}
                data-testid="workspace-status-badge"
              >
                {semanticStatusText}
              </span>
            )}
          </div>
        </div>

        {/* Right: Region Toggles & Navigation Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
          {/* Focus Mode Toggle */}
          <button
            onClick={() => setIsFocusMode(!isFocusMode)}
            title={isFocusMode ? 'Exit Focus Mode (Esc)' : 'Focus Primary Artifact (Alt+F)'}
            aria-label={isFocusMode ? 'Exit Focus Mode' : 'Focus Primary Artifact'}
            style={{
              background: isFocusMode ? 'rgba(56, 189, 248, 0.15)' : 'transparent',
              border: isFocusMode ? '1px solid rgba(56, 189, 248, 0.4)' : '1px solid var(--mave-v2-border-subtle)',
              borderRadius: '6px',
              color: isFocusMode ? 'var(--mave-v2-accent-listening)' : 'var(--mave-v2-text-secondary)',
              padding: '4px 8px',
              fontSize: '11px',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '5px'
            }}
            data-testid="btn-workspace-focus"
            aria-pressed={isFocusMode}
          >
            <FocusIcon size={12} color={isFocusMode ? 'var(--mave-v2-accent-listening)' : 'var(--mave-v2-text-secondary)'} />
            <span>Focus</span>
          </button>

          {/* Conversation Panel Toggle */}
          {!isFocusMode && (
            <button
              onClick={() => setShowConversation(!showConversation)}
              title={showConversation ? 'Hide Conversation Rail (Alt+C)' : 'Show Conversation Rail (Alt+C)'}
              aria-label="Toggle Conversation Rail"
              style={{
                background: showConversation ? 'rgba(255, 255, 255, 0.08)' : 'transparent',
                border: '1px solid var(--mave-v2-border-subtle)',
                borderRadius: '6px',
                color: showConversation ? 'var(--mave-v2-text-primary)' : 'var(--mave-v2-text-muted)',
                padding: '4px 8px',
                fontSize: '11px',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px'
              }}
              data-testid="btn-workspace-toggle-chat"
              aria-pressed={showConversation}
            >
              <ChatIcon size={12} color={showConversation ? 'var(--mave-v2-text-primary)' : 'var(--mave-v2-text-muted)'} />
              <span>Chat</span>
            </button>
          )}

          {/* Supporting Context Toggle */}
          {!isFocusMode && (
            <button
              onClick={() => hasContextContent && setShowContext(!showContext)}
              disabled={!hasContextContent}
              title={!hasContextContent ? 'No supporting context available' : showContext ? 'Collapse Context Panel' : 'Expand Context Panel'}
              aria-label="Toggle Context Panel"
              style={{
                background: showContext && hasContextContent ? 'rgba(255, 255, 255, 0.08)' : 'transparent',
                border: '1px solid var(--mave-v2-border-subtle)',
                borderRadius: '6px',
                color: hasContextContent
                  ? (showContext ? 'var(--mave-v2-text-primary)' : 'var(--mave-v2-text-muted)')
                  : 'rgba(255, 255, 255, 0.25)',
                padding: '4px 8px',
                fontSize: '11px',
                cursor: hasContextContent ? 'pointer' : 'default',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                opacity: hasContextContent ? 1 : 0.4
              }}
              data-testid="btn-workspace-toggle-context"
              aria-pressed={showContext && hasContextContent}
            >
              <FolderIcon size={12} color={hasContextContent ? (showContext ? 'var(--mave-v2-text-primary)' : 'var(--mave-v2-text-muted)') : 'rgba(255, 255, 255, 0.25)'} />
              <span>Context</span>
            </button>
          )}

          <div style={{ width: '1px', height: '16px', background: 'var(--mave-v2-border-subtle)', margin: '0 4px' }} />

          {/* Minimize to Conversation */}
          <button
            onClick={() => onMinimizeToConversation?.()}
            title="Minimize to Conversation"
            aria-label="Minimize to Conversation"
            style={{
              background: 'transparent',
              border: '1px solid var(--mave-v2-border-subtle)',
              borderRadius: '6px',
              color: 'var(--mave-v2-text-secondary)',
              padding: '4px 8px',
              fontSize: '11px',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '5px'
            }}
            data-testid="btn-workspace-minimize-conversation"
          >
            <MinimizeIcon size={12} color="var(--mave-v2-text-secondary)" />
            <span>Conversation</span>
          </button>

          {/* Collapse to Presence */}
          <button
            onClick={() => onCollapseToPresence?.()}
            title="Minimize to Ambient Presence"
            aria-label="Minimize to Ambient Presence"
            style={{
              background: 'transparent',
              border: '1px solid var(--mave-v2-border-subtle)',
              borderRadius: '6px',
              color: 'var(--mave-v2-text-secondary)',
              padding: '4px 8px',
              fontSize: '11px',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px'
            }}
            data-testid="btn-workspace-collapse-presence"
          >
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'currentColor' }} />
            <span>Presence</span>
          </button>

          {/* Close Surface (Visual dismiss != Cancel task) */}
          <button
            onClick={() => onClose?.()}
            title="Dismiss workspace (preserves task)"
            aria-label="Dismiss workspace"
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--mave-v2-text-muted)',
              padding: '4px 6px',
              fontSize: '13px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
            data-testid="btn-workspace-close"
          >
            <CloseIcon size={13} color="var(--mave-v2-text-muted)" />
          </button>
        </div>
      </header>

      {/* 2. Composable Workspace Regions Canvas */}
      <div
        style={{
          flex: 1,
          display: 'flex',
          overflow: 'hidden',
          position: 'relative',
          minWidth: 0,
          minHeight: 0
        }}
      >
        {/* REGION A: Conversation Rail (Left, Collapsible) */}
        {!isFocusMode && showConversation && (
          <aside
            className="mave-v2-workspace-conv-rail"
            style={{
              width: '260px',
              minWidth: '220px',
              maxWidth: '280px',
              borderRight: '1px solid rgba(255, 255, 255, 0.06)',
              background: 'rgba(10, 14, 26, 0.6)',
              backdropFilter: 'blur(16px)',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              minHeight: 0,
              flexShrink: 0
            }}
            data-testid="workspace-conversation-region"
          >
            <div
              style={{
                padding: '8px 14px',
                borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
                fontSize: '11px',
                fontWeight: 600,
                color: 'var(--mave-v2-text-secondary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexShrink: 0
              }}
            >
              <span>Conversation Context</span>
              <button
                onClick={() => setShowConversation(false)}
                style={{ background: 'transparent', border: 'none', color: 'var(--mave-v2-text-dim)', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                title="Collapse Conversation Rail"
                data-testid="btn-collapse-conv-rail"
              >
                <ChevronLeftIcon size={12} color="var(--mave-v2-text-dim)" />
              </button>
            </div>
            <div style={{ flex: 1, overflow: 'hidden', minHeight: 0 }}>
              <ConversationShell
                state={activeConversation}
                officeMode={officeMode}
                onSendMessage={onSendMessage}
                width="100%"
                height="100%"
              />
            </div>
          </aside>
        )}

        {/* REGION B: Primary Work Area (Center, Flex 1) */}
        <main
          style={{
            flex: 1,
            minWidth: 0,
            minHeight: 0,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            padding: '16px 20px',
            background: 'rgba(0, 0, 0, 0.1)'
          }}
          data-testid="workspace-primary-work-area"
        >
          {/* Failure banner (if failed) */}
          {isFailed && (
            <div
              style={{
                background: 'rgba(239, 68, 68, 0.1)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                borderRadius: 'var(--mave-v2-radius-card)',
                padding: '10px 14px',
                marginBottom: '12px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between'
              }}
              data-testid="workspace-error-banner"
            >
              <div style={{ fontSize: '12px', color: '#fca5a5', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <AlertIcon size={14} color="#f87171" />
                <span>Task encountered an error. Completed artifacts and conversation context are preserved.</span>
              </div>
              {onRetry && (
                <button
                  onClick={onRetry}
                  style={{
                    background: 'rgba(239, 68, 68, 0.2)',
                    border: '1px solid rgba(239, 68, 68, 0.4)',
                    color: '#f87171',
                    borderRadius: '4px',
                    padding: '4px 10px',
                    fontSize: '11px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}
                  data-testid="btn-workspace-retry"
                >
                  <RetryIcon size={11} color="#f87171" />
                  <span>Retry Task</span>
                </button>
              )}
            </div>
          )}

          {/* Attention Banner (Waiting for User) */}
          {isWaitingApproval && (
            <div
              style={{
                background: 'rgba(245, 158, 11, 0.1)',
                border: '1px solid rgba(245, 158, 11, 0.35)',
                borderRadius: 'var(--mave-v2-radius-card)',
                padding: '10px 14px',
                marginBottom: '12px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                color: 'var(--mave-v2-accent-warning)',
                fontSize: '12px'
              }}
              data-testid="workspace-waiting-banner"
            >
              <HandIcon size={14} color="var(--mave-v2-accent-warning)" />
              <span style={{ fontWeight: 600 }}>MAVE is waiting for your approval before proceeding.</span>
            </div>
          )}

          {/* Primary Work Area Slot Dispatcher */}
          {(() => {
            const conversationDiffCard = (activeConversation.cards?.find((c) => c.type === 'diff')
              || activeConversation.timelineGroups?.flatMap(g => g.cards || []).find(c => c.type === 'diff')) as any;

            // 1. Diff Review Workspace
            if (state.type === 'diff_review' || currentArtifact?.type === 'diff' || (!currentArtifact && conversationDiffCard)) {
              const diffData = currentArtifact?.diffData || (state.diffArtifacts?.[0] ? {
                id: 'diff-artifact-0',
                type: 'diff' as const,
                filename: state.diffArtifacts[0].filePath,
                additions: state.diffArtifacts[0].additions,
                deletions: state.diffArtifacts[0].deletions,
                lines: state.diffArtifacts[0].diffLines?.map((l: any) => ({
                  type: l.type === 'addition' ? 'add' : l.type === 'deletion' ? 'remove' : 'context',
                  text: l.text,
                  oldLineNumber: l.oldLineNumber,
                  newLineNumber: l.newLineNumber
                }))
              } : conversationDiffCard ? {
                id: conversationDiffCard.id,
                type: 'diff' as const,
                filename: conversationDiffCard.filename,
                path: conversationDiffCard.path,
                additions: conversationDiffCard.additions,
                deletions: conversationDiffCard.deletions,
                lines: conversationDiffCard.lines || []
              } : undefined);

              return (
                <WorkspaceDiffView
                  diffData={diffData}
                  files={state.files || state.targetFiles || (diffData?.filename ? [{ path: diffData.path || diffData.filename, status: 'modified' }] : undefined)}
                  selectedFilePath={selectedFile || diffData?.path || diffData?.filename}
                  onSelectFile={(f) => {
                    setSelectedFile(f);
                    onSelectFile?.(f);
                  }}
                  onApproveReview={onApproveReview}
                  onRequestRevision={onRequestRevision}
                />
              );
            }

            // 2. Research Workspace
            if (state.type === 'research' || currentArtifact?.type === 'research') {
              const findingsObj = Array.isArray(state.researchFindings) ? state.researchFindings[0] : state.researchFindings;
              return (
                <WorkspaceResearchView
                  question={currentArtifact?.researchFindings?.question || findingsObj?.question || state.currentObjective || state.objective}
                  summary={currentArtifact?.researchFindings?.summary || findingsObj?.summary || state.outputSummary}
                  takeaways={currentArtifact?.researchFindings?.takeaways || findingsObj?.takeaways}
                  sources={currentArtifact?.sources || state.sources}
                  comparison={currentArtifact?.comparisonData}
                />
              );
            }

            // 3. Language Practice Workspace (Canonical U6 Experience)
            if (state.type === 'language' || state.languageSession) {
              return (
                <LanguageWorkspaceView
                  state={state}
                  officeMode={officeMode}
                  onListenExample={onListenExample}
                  onStartSpeakingPractice={onStartSpeakingPractice}
                  onStopSpeakingPractice={onStopSpeakingPractice}
                  onSaveVocabularyMock={onSaveVocabularyMock}
                  onChangeCorrectionIntensity={onChangeCorrectionIntensity}
                  onToggleShowTranslation={onToggleShowTranslation}
                  onStepOutOfRole={onStepOutOfRole}
                  onResumeRoleplay={onResumeRoleplay}
                  onPracticeAgain={onPracticeAgain}
                />
              );
            }

            // 4. Agent Workspace (Specific synthetic mock context)
            if (state.type === 'agent' || state.type === 'agent_work') {
              return (
                <AgentWorkspaceView
                  state={state}
                  onAllowApproval={onAllowApproval}
                  onDenyApproval={onDenyApproval}
                  hasExternalContextPanel={showContext && hasContextContent}
                />
              );
            }

            // 5. Default Generic / Project Workspace
            const projectSteps = (state.steps && state.steps.length > 0)
              ? state.steps
              : state.planSteps && state.planSteps.length > 0
              ? state.planSteps.map((p, idx) => ({
                  id: `plan-step-${idx}`,
                  label: p,
                  status: (state.currentPlanStep && idx + 1 < state.currentPlanStep)
                    ? 'completed' as const
                    : (state.currentPlanStep === idx + 1 ? 'active' as const : 'pending' as const)
                }))
              : [];

            const isDeterminate = state.totalPlanSteps !== undefined || (state.steps && state.steps.some(s => s.status === 'completed'));
            const calculatedPercent = state.totalPlanSteps && state.currentPlanStep
              ? Math.round((state.currentPlanStep / state.totalPlanSteps) * 100)
              : undefined;

            return (
              <WorkspaceProjectView
                title={state.title}
                objective={state.currentObjective || state.objective}
                artifactTitle={currentArtifact?.title}
                artifactContent={currentArtifact?.content || state.outputSummary}
                artifactLanguage={currentArtifact?.language}
                steps={projectSteps}
                currentStepNumber={state.currentPlanStep}
                totalStepsCount={state.totalPlanSteps}
                status={state.status}
                determinate={isDeterminate}
                progressPercent={calculatedPercent}
                onAction={(act) => {
                  if (act === 'cancel' && onCancelTask) onCancelTask();
                }}
              />
            );
          })()}
        </main>

        {/* REGION C: Supporting Context & Activity Panel (Right, Collapsible — Collapses when empty) */}
        {!isFocusMode && showContext && hasContextContent && (
          <aside
            className="mave-custom-scrollbar mave-v2-workspace-context-rail"
            style={{
              width: '240px',
              minWidth: '200px',
              maxWidth: '260px',
              borderLeft: '1px solid rgba(255, 255, 255, 0.06)',
              background: 'rgba(10, 14, 26, 0.65)',
              backdropFilter: 'blur(16px)',
              display: 'flex',
              flexDirection: 'column',
              overflowY: 'auto',
              overflowX: 'hidden',
              minHeight: 0,
              padding: '14px',
              gap: '14px',
              flexShrink: 0
            }}
            data-testid="workspace-context-region"
          >
            <div
              style={{
                fontSize: '11px',
                fontWeight: 600,
                color: 'var(--mave-v2-text-secondary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                paddingBottom: '4px',
                borderBottom: '1px solid rgba(255, 255, 255, 0.05)'
              }}
            >
              <span>Supporting Context</span>
              <button
                onClick={() => setShowContext(false)}
                style={{ background: 'transparent', border: 'none', color: 'var(--mave-v2-text-dim)', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                title="Collapse Context Panel"
                data-testid="btn-collapse-context-rail"
              >
                <ChevronRightIcon size={12} color="var(--mave-v2-text-dim)" />
              </button>
            </div>

            {/* Active Approval Card if waiting */}
            {state.activeApproval && (
              <div data-testid="workspace-approval-slot">
                <ApprovalCard
                  data={state.activeApproval}
                  onAllow={() => onAllowApproval?.(state.activeApproval!.id)}
                  onDeny={() => onDenyApproval?.(state.activeApproval!.id)}
                />
              </div>
            )}

            {/* Artifacts Switcher (if artifacts exist) */}
            {state.artifacts && state.artifacts.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }} data-testid="workspace-artifacts-list">
                <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--mave-v2-text-muted)', textTransform: 'uppercase' }}>
                  Artifacts ({state.artifacts.length})
                </div>
                {state.artifacts.map((art) => {
                  const isSel = art.id === activeArtifactId;
                  return (
                    <button
                      key={art.id}
                      onClick={() => {
                        setActiveArtifactId(art.id);
                        onSelectArtifact?.(art.id);
                      }}
                      style={{
                        padding: '6px 8px',
                        borderRadius: '4px',
                        border: isSel ? '1px solid var(--mave-v2-accent-listening)' : '1px solid rgba(255, 255, 255, 0.06)',
                        background: isSel ? 'rgba(56, 189, 248, 0.12)' : 'rgba(255, 255, 255, 0.02)',
                        color: isSel ? 'var(--mave-v2-accent-listening)' : 'var(--mave-v2-text-secondary)',
                        fontSize: '11px',
                        cursor: 'pointer',
                        textAlign: 'left',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between'
                      }}
                      data-testid={`artifact-item-${art.id}`}
                    >
                      <span style={{ fontWeight: isSel ? 600 : 400 }}>{art.title}</span>
                      <span style={{ fontSize: '9px', color: 'var(--mave-v2-text-dim)', textTransform: 'uppercase' }}>
                        {art.type}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}

            {/* Context Files (if provided) */}
            {(() => {
              const contextFiles = state.files || state.targetFiles;
              if (!contextFiles || contextFiles.length === 0) return null;
              return (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }} data-testid="workspace-files-list">
                  <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--mave-v2-text-muted)', textTransform: 'uppercase' }}>
                    Target Files ({contextFiles.length})
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    {contextFiles.map((file, i) => (
                      <div
                        key={i}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          fontSize: '11px',
                          padding: '4px 6px',
                          borderRadius: '4px',
                          background: 'rgba(255, 255, 255, 0.03)'
                        }}
                      >
                        <span style={{ color: 'var(--mave-v2-text-primary)', fontFamily: 'monospace' }}>
                          {file.path.split(/[\\/]/).pop()}
                        </span>
                        <span
                          style={{
                            fontSize: '9px',
                            color: file.status === 'modified' ? 'var(--mave-v2-accent-warning)' : 'var(--mave-v2-accent-listening)',
                            fontWeight: 600
                          }}
                        >
                          {file.status.toUpperCase()}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}

            {/* Supporting Sources (if provided) */}
            {state.sources && state.sources.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }} data-testid="workspace-supporting-sources">
                <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--mave-v2-text-muted)', textTransform: 'uppercase' }}>
                  References ({state.sources.length})
                </div>
                {state.sources.map((src) => (
                  <SourceCard key={src.id} data={{ ...src, density: 'compact' }} />
                ))}
              </div>
            )}
          </aside>
        )}
      </div>
    </div>
  );
};
