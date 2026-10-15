import React, { useState } from 'react';
import type {
  SurfaceLevel,
  UiV2Snapshot,
  PresenceState,
  PresentationMode,
  SidecarPlacement
} from '../types';
import { MOCK_SCENARIOS, type MockScenario } from '../mocks/mock-scenarios';
import { PresenceSurface } from '../presence/PresenceSurface';
import { ConversationShell } from '../conversation/ConversationShell';
import { ChatOnlyPanel } from '../conversation/ChatOnlyPanel';
import { WorkspaceShell } from '../workspace/WorkspaceShell';
import { evaluateExpansionEligibility, normalizeAudioRms } from '../presence/presence-rules';
import {
  handoffPresenceToConversation,
  collapseConversationToPresence
} from '../conversation/conversation-rules';
import './MaveUiLab.css';
import '../tokens.css';

type ViewportPreset = 'compact' | 'chat' | 'sidecar' | 'workspace' | 'fill';

const VIEWPORT_DIMENSIONS: Record<ViewportPreset, { width: string; height: string }> = {
  compact: { width: '360px', height: '180px' },
  chat: { width: '400px', height: '640px' },
  sidecar: { width: '380px', height: '640px' },
  workspace: { width: '960px', height: '640px' },
  fill: { width: '100%', height: '100%' }
};

/**
 * MaveUiLab
 *
 * Developer-only UI Lab / Surface Lab.
 * Allows instant, isolated preview of all MAVE UI V2 states without requiring:
 * - Wake word or microphone
 * - Speech-to-Text or Faster-Whisper
 * - Ollama or local AI hardware
 * - Cloud subscription runtimes or network
 */
export const MaveUiLab: React.FC = () => {
  const [selectedScenarioId, setSelectedScenarioId] = useState<string>(MOCK_SCENARIOS[0]!.id);
  const [currentScenario, setCurrentScenario] = useState<MockScenario>(MOCK_SCENARIOS[0]!);
  const [snapshot, setSnapshot] = useState<UiV2Snapshot>(MOCK_SCENARIOS[0]!.snapshot);
  const [viewportPreset, setViewportPreset] = useState<ViewportPreset>('fill');
  const [audioLevelOverride, setAudioLevelOverride] = useState<number>(0);
  const [officeMode, setOfficeMode] = useState<boolean>(false);
  const [reducedMotion, setReducedMotion] = useState<boolean>(false);
  const [isFlowRunning, setIsFlowRunning] = useState<boolean>(false);
  const [flowStep, setFlowStep] = useState<string>('');
  const [sidecarPlacement, setSidecarPlacement] = useState<SidecarPlacement>('right');
  const [isPinned, setIsPinned] = useState<boolean>(false);
  const [simulatedBackdrop, setSimulatedBackdrop] = useState<'none' | 'vscode' | 'browser' | 'word'>('none');

  // Automatic Lifecycle Demo: idle -> waking -> listening -> thinking -> speaking -> idle
  const handlePlayLifecycle = () => {
    if (isFlowRunning) return;
    setIsFlowRunning(true);
    setFlowStep('Waking…');
    setSnapshot((prev) => ({
      ...prev,
      level: 'presence',
      presence: { ...prev.presence, state: 'waking', audioLevel: 0.1, quickResponse: undefined }
    }));

    setTimeout(() => {
      setFlowStep('Listening…');
      setSnapshot((prev) => ({
        ...prev,
        presence: { ...prev.presence, state: 'listening', audioLevel: 0.7 }
      }));

      setTimeout(() => {
        setFlowStep('Thinking…');
        setSnapshot((prev) => ({
          ...prev,
          presence: { ...prev.presence, state: 'thinking', audioLevel: 0 }
        }));

        setTimeout(() => {
          setFlowStep('Speaking…');
          setSnapshot((prev) => ({
            ...prev,
            presence: {
              ...prev.presence,
              state: 'speaking',
              audioLevel: 0.5,
              quickResponse: {
                text: 'In French, that’s “Bonjour”. It means “Hello”.',
                sourceLabel: 'French Reference'
              }
            }
          }));

          setTimeout(() => {
            setFlowStep('');
            setIsFlowRunning(false);
            setSnapshot((prev) => ({
              ...prev,
              presence: { ...prev.presence, state: 'idle', audioLevel: 0 }
            }));
          }, 2600);
        }, 1600);
      }, 2000);
    }, 600);
  };

  // Immediate Barge-in transition: Interruption detected -> switch to listening instantly
  const handleBargeIn = () => {
    setSnapshot((prev) => ({
      ...prev,
      level: 'presence',
      presence: {
        ...prev.presence,
        state: 'listening',
        audioLevel: 0.85,
        quickResponse: undefined
      }
    }));
  };

  // Load a scenario
  const handleSelectScenario = (scenario: MockScenario) => {
    setSelectedScenarioId(scenario.id);
    setCurrentScenario(scenario);
    setSnapshot(JSON.parse(JSON.stringify(scenario.snapshot)));
    setAudioLevelOverride(scenario.snapshot.presence.audioLevel);

    // Auto-adjust viewport preset to match scenario level & presentation mode
    if (scenario.snapshot.level === 'presence') {
      setViewportPreset('compact');
    } else if (scenario.snapshot.level === 'conversation') {
      const mode = scenario.snapshot.presentationMode || scenario.snapshot.conversation?.presentationMode;
      if (mode === 'sidecar') {
        setViewportPreset('sidecar');
      } else {
        setViewportPreset('chat');
      }
    } else if (scenario.snapshot.level === 'workspace') {
      setViewportPreset('workspace');
    }

    const pl = scenario.snapshot.sidecarPlacement || scenario.snapshot.conversation?.sidecarPlacement;
    if (pl) {
      setSidecarPlacement(pl);
    }
    const pinned = scenario.snapshot.isPinned ?? scenario.snapshot.conversation?.isPinned;
    if (pinned !== undefined) {
      setIsPinned(pinned);
    }
  };

  // Switch Surface Level manually
  const handleSetLevel = (level: SurfaceLevel) => {
    setSnapshot((prev) => ({ ...prev, level }));
    if (level === 'presence') setViewportPreset('compact');
    if (level === 'conversation') setViewportPreset('chat');
    if (level === 'workspace') setViewportPreset('workspace');
  };

  // Switch Presence State manually
  const handleSetPresenceState = (state: PresenceState) => {
    setSnapshot((prev) => ({
      ...prev,
      presence: {
        ...prev.presence,
        state
      }
    }));
  };

  // Quick Response preset selector
  const handleSetQuickResponsePreset = (type: 'none' | 'translation' | 'timer' | 'long') => {
    if (type === 'none') {
      setSnapshot((prev) => ({
        ...prev,
        presence: { ...prev.presence, quickResponse: undefined }
      }));
    } else if (type === 'translation') {
      setSnapshot((prev) => ({
        ...prev,
        presence: {
          ...prev.presence,
          quickResponse: {
            text: 'In French, that’s “Bonjour”. It means “Hello”.',
            sourceLabel: 'French Reference'
          }
        }
      }));
    } else if (type === 'timer') {
      setSnapshot((prev) => ({
        ...prev,
        presence: {
          ...prev.presence,
          quickResponse: {
            text: 'Timer set for 15 minutes.'
          }
        }
      }));
    } else if (type === 'long') {
      setSnapshot((prev) => ({
        ...prev,
        presence: {
          ...prev.presence,
          quickResponse: {
            text: 'This is a long analytical explanation of quantum entanglement that exceeds single quick response capacity and would normally expand into Conversation surface.',
            sourceLabel: 'Science Reference'
          }
        }
      }));
    }
  };

  // Mock message sending
  const handleSendMessage = (text: string) => {
    setSnapshot((prev) => ({
      ...prev,
      conversation: {
        ...prev.conversation,
        messages: [
          ...prev.conversation.messages,
          {
            id: `msg-${Date.now()}`,
            type: 'message',
            role: 'user',
            content: text
          },
          {
            id: `msg-${Date.now() + 1}`,
            type: 'message',
            role: 'assistant',
            content: `[DEV MOCK RESPONSE]: Received "${text}". Simulating MAVE cognitive answer.`
          }
        ]
      }
    }));
  };

  // Mock approval action
  const handleAllowAction = (id: string) => {
    setSnapshot((prev) => {
      const updatedCards = prev.conversation.cards.map((c) =>
        c.id === id && c.type === 'approval' ? { ...c, status: 'allowed' as const } : c
      );
      const updatedWorkspace = prev.workspace.activeApproval?.id === id
        ? {
            ...prev.workspace,
            status: 'running' as const,
            activeApproval: undefined,
            outputSummary: 'Command approved by user. Executing safely...'
          }
        : prev.workspace;

      return {
        ...prev,
        conversation: { ...prev.conversation, cards: updatedCards },
        workspace: updatedWorkspace
      };
    });
  };

  const handleDenyAction = (id: string) => {
    setSnapshot((prev) => {
      const updatedCards = prev.conversation.cards.map((c) =>
        c.id === id && c.type === 'approval' ? { ...c, status: 'denied' as const } : c
      );
      const updatedWorkspace = prev.workspace.activeApproval?.id === id
        ? {
            ...prev.workspace,
            status: 'idle' as const,
            activeApproval: undefined,
            outputSummary: 'Action denied by user. Task halted.'
          }
        : prev.workspace;

      return {
        ...prev,
        conversation: { ...prev.conversation, cards: updatedCards },
        workspace: updatedWorkspace
      };
    });
  };

  const currentDimensions = VIEWPORT_DIMENSIONS[viewportPreset];

  return (
    <div className="mave-ui-lab-root" data-testid="mave-ui-lab-root">
      {/* 1. Left Sidebar: Scenarios and Live Controls */}
      <aside className="mave-ui-lab-sidebar">
        <div className="mave-ui-lab-sidebar-header">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontWeight: 700, fontSize: '15px', color: '#f8fafc' }}>
              MAVE UI Lab
            </span>
            <span
              style={{
                fontSize: '10px',
                fontWeight: 600,
                color: 'var(--mave-v2-accent-listening)',
                background: 'rgba(56, 189, 248, 0.1)',
                padding: '2px 6px',
                borderRadius: '4px'
              }}
            >
              U0 Prototype
            </span>
          </div>
          <div style={{ fontSize: '11px', color: '#64748b' }}>
            Adaptive Surface V2 Foundation Harness
          </div>
        </div>

        {/* 12 One-Click Scenarios */}
        <div className="mave-ui-lab-scenario-list" data-testid="scenario-list">
          <div style={{ fontSize: '10px', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', padding: '4px 6px' }}>
            Interactive Scenarios
          </div>
          {MOCK_SCENARIOS.map((sc) => {
            const isSelected = sc.id === selectedScenarioId;
            return (
              <button
                key={sc.id}
                onClick={() => handleSelectScenario(sc)}
                className={`mave-ui-lab-scenario-btn ${isSelected ? 'active' : ''}`}
                data-testid={`scenario-btn-${sc.id}`}
              >
                <span>{sc.name}</span>
                <span style={{ fontSize: '10px', color: isSelected ? 'rgba(56, 189, 248, 0.7)' : '#64748b' }}>
                  {sc.category.toUpperCase()}
                </span>
              </button>
            );
          })}
        </div>

        {/* Live Mock State Controls */}
        <div className="mave-ui-lab-controls-panel">
          <div style={{ fontSize: '11px', fontWeight: 600, color: '#94a3b8' }}>
            Surface Level:
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '4px' }}>
            {(['presence', 'conversation', 'workspace'] as SurfaceLevel[]).map((lvl) => (
              <button
                key={lvl}
                onClick={() => handleSetLevel(lvl)}
                style={{
                  padding: '5px',
                  borderRadius: '4px',
                  border: '1px solid var(--mave-v2-border-subtle)',
                  background: snapshot.level === lvl ? 'var(--mave-v2-accent-listening)' : 'rgba(255, 255, 255, 0.05)',
                  color: snapshot.level === lvl ? '#0f172a' : '#cbd5e1',
                  fontWeight: 600,
                  fontSize: '11px',
                  cursor: 'pointer',
                  textTransform: 'capitalize'
                }}
              >
                {lvl}
              </button>
            ))}
          </div>

          {/* Audio RMS Level Slider */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#94a3b8' }}>
              <span>RMS Level:</span>
              <span title="Raw vs Normalized perceptual amplitude">
                Raw: {(audioLevelOverride * 100).toFixed(0)}% │ Norm: {(normalizeAudioRms(audioLevelOverride) * 100).toFixed(0)}%
              </span>
            </div>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={audioLevelOverride}
              onChange={(e) => {
                const val = parseFloat(e.target.value);
                setAudioLevelOverride(val);
                setSnapshot((prev) => ({
                  ...prev,
                  presence: { ...prev.presence, audioLevel: val }
                }));
              }}
              style={{ width: '100%', cursor: 'pointer' }}
            />
          </div>

          {/* Presence State Selector */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <div style={{ fontSize: '11px', color: '#94a3b8' }}>Presence State:</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '4px' }}>
              {(['idle', 'waking', 'listening', 'thinking', 'speaking', 'error'] as PresenceState[]).map((st) => (
                <button
                  key={st}
                  onClick={() => handleSetPresenceState(st)}
                  style={{
                    padding: '3px',
                    borderRadius: '4px',
                    border: '1px solid var(--mave-v2-border-subtle)',
                    background: snapshot.presence.state === st ? 'rgba(56, 189, 248, 0.2)' : 'rgba(255, 255, 255, 0.03)',
                    color: snapshot.presence.state === st ? '#38bdf8' : '#94a3b8',
                    fontSize: '10px',
                    cursor: 'pointer',
                    textTransform: 'capitalize'
                  }}
                  data-testid={`btn-presence-state-${st}`}
                >
                  {st}
                </button>
              ))}
            </div>
          </div>

          {/* U1 Presence Lifecycle & Barge-in Demos */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', paddingTop: '4px', borderTop: '1px solid rgba(255, 255, 255, 0.06)' }}>
            <div style={{ fontSize: '11px', fontWeight: 600, color: '#94a3b8' }}>
              Presence Demos (U1):
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px' }}>
              <button
                onClick={handlePlayLifecycle}
                disabled={isFlowRunning}
                style={{
                  padding: '5px',
                  borderRadius: '4px',
                  border: '1px solid var(--mave-v2-border-subtle)',
                  background: isFlowRunning ? 'rgba(56, 189, 248, 0.3)' : 'rgba(56, 189, 248, 0.12)',
                  color: '#38bdf8',
                  fontSize: '10px',
                  fontWeight: 600,
                  cursor: isFlowRunning ? 'default' : 'pointer'
                }}
                data-testid="btn-play-flow"
              >
                {isFlowRunning ? flowStep || 'Playing…' : '▶ Play Flow'}
              </button>
              <button
                onClick={handleBargeIn}
                style={{
                  padding: '5px',
                  borderRadius: '4px',
                  border: '1px solid var(--mave-v2-border-subtle)',
                  background: 'rgba(239, 68, 68, 0.12)',
                  color: '#f87171',
                  fontSize: '10px',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
                title="Simulate user interrupting MAVE speech output"
                data-testid="btn-barge-in"
              >
                ⚡ Barge-in
              </button>
            </div>
          </div>

          {/* Office Mode & Reduced Motion Toggles */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', paddingTop: '4px', borderTop: '1px solid rgba(255, 255, 255, 0.06)' }}>
            <div style={{ fontSize: '11px', color: '#94a3b8' }}>Modes & Accessibility:</div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '10px', color: '#cbd5e1', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={officeMode}
                  onChange={(e) => setOfficeMode(e.target.checked)}
                  data-testid="checkbox-office-mode"
                />
                Office (Silent)
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '10px', color: '#cbd5e1', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={reducedMotion}
                  onChange={(e) => setReducedMotion(e.target.checked)}
                  data-testid="checkbox-reduced-motion"
                />
                Reduced Motion
              </label>
            </div>
          </div>

          {/* Quick Response Preset Selector */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', paddingTop: '4px', borderTop: '1px solid rgba(255, 255, 255, 0.06)' }}>
            <div style={{ fontSize: '11px', color: '#94a3b8' }}>Quick Response Bubble:</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '4px' }}>
              <button
                onClick={() => handleSetQuickResponsePreset('none')}
                style={{ padding: '3px', borderRadius: '4px', border: '1px solid rgba(255, 255, 255, 0.08)', background: !snapshot.presence.quickResponse ? 'rgba(255,255,255,0.1)' : 'transparent', color: '#94a3b8', fontSize: '10px', cursor: 'pointer' }}
              >
                None
              </button>
              <button
                onClick={() => handleSetQuickResponsePreset('translation')}
                style={{ padding: '3px', borderRadius: '4px', border: '1px solid rgba(255, 255, 255, 0.08)', background: 'transparent', color: '#38bdf8', fontSize: '10px', cursor: 'pointer' }}
              >
                Translation
              </button>
              <button
                onClick={() => handleSetQuickResponsePreset('timer')}
                style={{ padding: '3px', borderRadius: '4px', border: '1px solid rgba(255, 255, 255, 0.08)', background: 'transparent', color: '#38bdf8', fontSize: '10px', cursor: 'pointer' }}
              >
                Confirmation
              </button>
              <button
                onClick={() => handleSetQuickResponsePreset('long')}
                style={{ padding: '3px', borderRadius: '4px', border: '1px solid rgba(255, 255, 255, 0.08)', background: 'transparent', color: '#f59e0b', fontSize: '10px', cursor: 'pointer' }}
                title="Triggers expansion rule due to text length"
              >
                Long Payload
              </button>
            </div>
            {/* Expansion Rule Evaluator Pill */}
            {(() => {
              const evalResult = evaluateExpansionEligibility({
                text: snapshot.presence.quickResponse?.text,
                cards: snapshot.level === 'presence' ? undefined : snapshot.conversation.cards
              });
              return (
                <div
                  style={{
                    fontSize: '9px',
                    color: evalResult.shouldExpand ? '#f59e0b' : '#38bdf8',
                    background: evalResult.shouldExpand ? 'rgba(245, 158, 11, 0.1)' : 'rgba(56, 189, 248, 0.1)',
                    padding: '3px 5px',
                    borderRadius: '4px',
                    lineHeight: 1.3
                  }}
                  data-testid="expansion-eval-result"
                >
                  Rule: {evalResult.reason}
                </div>
              );
            })()}
          </div>

          {/* U4 Presentation Mode & Sidecar Controls */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', paddingTop: '4px', borderTop: '1px solid rgba(255, 255, 255, 0.06)' }}>
            <div style={{ fontSize: '11px', color: '#94a3b8' }}>Presentation Mode (U4):</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px' }}>
              {(['floating', 'sidecar'] as PresentationMode[]).map((mode) => {
                const currentMode = snapshot.presentationMode || snapshot.conversation.presentationMode || 'floating';
                const active = currentMode === mode;
                return (
                  <button
                    key={mode}
                    onClick={() => {
                      setSnapshot((prev) => ({
                        ...prev,
                        presentationMode: mode,
                        conversation: { ...prev.conversation, presentationMode: mode }
                      }));
                      if (mode === 'sidecar') setViewportPreset('sidecar');
                      else if (mode === 'floating' && viewportPreset === 'sidecar') setViewportPreset('chat');
                    }}
                    style={{
                      padding: '4px',
                      borderRadius: '4px',
                      border: '1px solid var(--mave-v2-border-subtle)',
                      background: active ? 'var(--mave-v2-accent-listening)' : 'rgba(255, 255, 255, 0.05)',
                      color: active ? '#0f172a' : '#cbd5e1',
                      fontWeight: 600,
                      fontSize: '10px',
                      cursor: 'pointer',
                      textTransform: 'capitalize'
                    }}
                    data-testid={`btn-presentation-mode-${mode}`}
                  >
                    {mode}
                  </button>
                );
              })}
            </div>

            {/* Sidecar Placement Selector */}
            {(snapshot.presentationMode === 'sidecar' || snapshot.conversation.presentationMode === 'sidecar' || viewportPreset === 'sidecar') && (
              <>
                <div style={{ fontSize: '10px', color: '#64748b', marginTop: '2px' }}>Sidecar Placement:</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '4px' }}>
                  {(['left', 'right', 'floating'] as SidecarPlacement[]).map((pl) => (
                    <button
                      key={pl}
                      onClick={() => {
                        setSidecarPlacement(pl);
                        setSnapshot((prev) => ({
                          ...prev,
                          sidecarPlacement: pl,
                          conversation: { ...prev.conversation, sidecarPlacement: pl }
                        }));
                      }}
                      style={{
                        padding: '3px',
                        borderRadius: '4px',
                        border: '1px solid var(--mave-v2-border-subtle)',
                        background: sidecarPlacement === pl ? 'rgba(56, 189, 248, 0.2)' : 'transparent',
                        color: sidecarPlacement === pl ? '#38bdf8' : '#94a3b8',
                        fontSize: '10px',
                        cursor: 'pointer',
                        textTransform: 'capitalize'
                      }}
                      data-testid={`btn-placement-${pl}`}
                    >
                      {pl}
                    </button>
                  ))}
                </div>

                {/* Pin Always-on-Top Toggle */}
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '10px', color: '#cbd5e1', cursor: 'pointer', marginTop: '2px' }}>
                  <input
                    type="checkbox"
                    checked={isPinned}
                    onChange={(e) => {
                      setIsPinned(e.target.checked);
                      setSnapshot((prev) => ({
                        ...prev,
                        isPinned: e.target.checked,
                        conversation: { ...prev.conversation, isPinned: e.target.checked }
                      }));
                    }}
                    data-testid="checkbox-sidecar-pinned"
                  />
                  📌 Pin on Top (Always on Top)
                </label>

                {/* Simulated Host App Backdrop */}
                <div style={{ fontSize: '10px', color: '#64748b', marginTop: '2px' }}>Host App Backdrop:</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '3px' }}>
                  {(['none', 'vscode', 'browser', 'word'] as const).map((app) => (
                    <button
                      key={app}
                      onClick={() => setSimulatedBackdrop(app)}
                      style={{
                        padding: '3px 2px',
                        borderRadius: '3px',
                        border: '1px solid rgba(255, 255, 255, 0.08)',
                        background: simulatedBackdrop === app ? 'rgba(56, 189, 248, 0.2)' : 'transparent',
                        color: simulatedBackdrop === app ? '#38bdf8' : '#64748b',
                        fontSize: '9px',
                        cursor: 'pointer'
                      }}
                      data-testid={`btn-backdrop-${app}`}
                    >
                      {app}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      </aside>

      {/* 2. Main Preview Viewport */}
      <main className="mave-ui-lab-main">
        {/* Top Toolbar */}
        <header className="mave-ui-lab-toolbar">
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ fontWeight: 600, fontSize: '13px' }}>
              Active Scenario: <span style={{ color: 'var(--mave-v2-accent-listening)' }}>{currentScenario.name}</span>
            </span>
            <span
              style={{
                fontSize: '11px',
                color: '#94a3b8',
                background: 'rgba(255, 255, 255, 0.05)',
                padding: '2px 8px',
                borderRadius: '4px'
              }}
            >
              [MOCK PREVIEW]
            </span>
          </div>

          {/* Viewport Presets */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '11px', color: '#64748b' }}>Viewport:</span>
            {(['compact', 'chat', 'sidecar', 'workspace', 'fill'] as ViewportPreset[]).map((preset) => (
              <button
                key={preset}
                onClick={() => setViewportPreset(preset)}
                style={{
                  padding: '3px 8px',
                  borderRadius: '4px',
                  border: '1px solid var(--mave-v2-border-subtle)',
                  background: viewportPreset === preset ? 'rgba(56, 189, 248, 0.2)' : 'transparent',
                  color: viewportPreset === preset ? '#38bdf8' : '#94a3b8',
                  fontSize: '11px',
                  cursor: 'pointer',
                  textTransform: 'capitalize'
                }}
                data-testid={`btn-viewport-${preset}`}
              >
                {preset}
              </button>
            ))}
          </div>
        </header>

        {/* Live Canvas Area */}
        <div
          className={`mave-ui-lab-canvas-area ${reducedMotion ? 'mave-v2-reduced-motion-preview' : ''}`}
          style={{
            display: 'flex',
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '16px',
            width: '100%',
            height: '100%',
            padding: '24px',
            boxSizing: 'border-box',
            position: 'relative'
          }}
        >
          {/* Simulated Host Application Window (VS Code, Chrome, Word) */}
          {simulatedBackdrop !== 'none' && (
            <div
              style={{
                flex: 1,
                height: '100%',
                maxHeight: '680px',
                background:
                  simulatedBackdrop === 'vscode'
                    ? '#1e1e1e'
                    : simulatedBackdrop === 'browser'
                    ? '#202124'
                    : '#2b579a',
                borderRadius: '8px',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
                boxShadow: '0 8px 30px rgba(0, 0, 0, 0.5)'
              }}
              data-testid="simulated-host-backdrop"
            >
              <div
                style={{
                  padding: '8px 14px',
                  background: 'rgba(0, 0, 0, 0.25)',
                  borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  fontSize: '12px'
                }}
              >
                <div style={{ display: 'flex', gap: '6px' }}>
                  <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#ef4444' }} />
                  <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#f59e0b' }} />
                  <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#10b981' }} />
                </div>
                <span style={{ marginLeft: '8px', color: '#cbd5e1', fontWeight: 500 }}>
                  {simulatedBackdrop === 'vscode'
                    ? 'VS Code — workspace.ts — MAVE'
                    : simulatedBackdrop === 'browser'
                    ? 'Chrome — MDN Web Docs'
                    : 'Word — Architecture Briefing.docx'}
                </span>
              </div>
              <div style={{ flex: 1, padding: '20px', fontFamily: simulatedBackdrop === 'vscode' ? 'monospace' : 'inherit', color: '#94a3b8', fontSize: '13px' }}>
                {simulatedBackdrop === 'vscode' && (
                  <pre style={{ margin: 0 }}>
                    {`// Primary Editor Window — MAVE Companion docked at side\nfunction buildCompanion() {\n  // Focusing on code while MAVE answers queries in sidecar\n  return true;\n}`}
                  </pre>
                )}
                {simulatedBackdrop === 'browser' && (
                  <div>
                    <h3 style={{ color: '#f1f5f9', marginTop: 0 }}>Web Documentation</h3>
                    <p>Browsing references while MAVE sidecar provides instant summaries...</p>
                  </div>
                )}
                {simulatedBackdrop === 'word' && (
                  <div>
                    <h2 style={{ color: '#f1f5f9', marginTop: 0 }}>Quarterly Planning Document</h2>
                    <p>Drafting documentation with MAVE assisting side-by-side without screen takeover.</p>
                  </div>
                )}
              </div>
            </div>
          )}

          <div
            className="mave-ui-lab-viewport-frame"
            style={{
              width: currentDimensions.width,
              height: currentDimensions.height,
              maxHeight: '100%',
              maxWidth: '100%'
            }}
          >
            {snapshot.level === 'presence' && (
              <PresenceSurface
                state={snapshot.presence.state}
                audioLevel={snapshot.presence.audioLevel}
                quickResponse={snapshot.presence.quickResponse}
                officeMode={officeMode}
                onExpand={() => {
                  const handoff = handoffPresenceToConversation({
                    quickResponse: snapshot.presence.quickResponse,
                    presenceState: snapshot.presence.state,
                    activeRequestId: snapshot.conversation.activeRequestId,
                    historyMessages: snapshot.conversation.messages
                  });
                  setSnapshot((prev) => ({
                    ...prev,
                    level: 'conversation',
                    conversation: {
                      ...prev.conversation,
                      ...handoff
                    }
                  }));
                  setViewportPreset('chat');
                }}
                onWakeToggle={() =>
                  handleSetPresenceState(
                    snapshot.presence.state === 'idle' ? 'listening' : 'idle'
                  )
                }
                onStopListening={() => handleSetPresenceState('idle')}
                onCancelThinking={() => handleSetPresenceState('idle')}
                onStopSpeaking={() => handleSetPresenceState('idle')}
                onRetryError={() => handleSetPresenceState('thinking')}
                onDismissError={() => handleSetPresenceState('idle')}
                onDismissQuickResponse={() => handleSetQuickResponsePreset('none')}
              />
            )}

            {snapshot.level === 'conversation' && (
              (snapshot.presentationMode === 'sidecar' || snapshot.conversation.presentationMode === 'sidecar' || viewportPreset === 'sidecar') ? (
                <ChatOnlyPanel
                  state={snapshot.conversation}
                  presenceState={snapshot.presence.state}
                  audioLevel={snapshot.presence.audioLevel}
                  placement={sidecarPlacement}
                  isPinned={isPinned}
                  onTogglePin={() => {
                    setIsPinned(!isPinned);
                    setSnapshot((prev) => ({
                      ...prev,
                      isPinned: !isPinned,
                      conversation: { ...prev.conversation, isPinned: !isPinned }
                    }));
                  }}
                  onSendMessage={handleSendMessage}
                  onCollapseToPresence={() => {
                    const quickResp = collapseConversationToPresence(snapshot.conversation);
                    setSnapshot((prev) => ({
                      ...prev,
                      level: 'presence',
                      presence: {
                        ...prev.presence,
                        state: quickResp?.streaming ? 'speaking' : 'idle',
                        quickResponse: quickResp
                      }
                    }));
                    setViewportPreset('compact');
                  }}
                  onExpandToConversation={() => {
                    setSnapshot((prev) => ({
                      ...prev,
                      presentationMode: 'floating',
                      conversation: { ...prev.conversation, presentationMode: 'floating' }
                    }));
                    setViewportPreset('chat');
                  }}
                  onClose={() => {
                    // Visual dismiss: hide or minimize, do NOT destroy context or cancel stream
                    handleSetLevel('presence');
                  }}
                  onCancelGeneration={() => {
                    setSnapshot((prev) => {
                      const text = prev.conversation.streamingText;
                      return {
                        ...prev,
                        conversation: {
                          ...prev.conversation,
                          status: 'idle',
                          streamingStatus: 'cancelled',
                          streamingText: undefined,
                          timelineGroups: [
                            ...(prev.conversation.timelineGroups || []),
                            {
                              id: `group-cancelled-${Date.now()}`,
                              answerText: text,
                              isCancelled: true,
                              streamingStatus: 'cancelled'
                            }
                          ]
                        }
                      };
                    });
                  }}
                  onRetry={() => {
                    setSnapshot((prev) => ({
                      ...prev,
                      conversation: {
                        ...prev.conversation,
                        status: 'thinking',
                        observableProgressText: 'Retrying previous request…'
                      }
                    }));
                  }}
                  onAllowAction={handleAllowAction}
                  onDenyAction={handleDenyAction}
                  officeMode={officeMode}
                  width="100%"
                  height="100%"
                />
              ) : (
                <ConversationShell
                  state={snapshot.conversation}
                  presenceState={snapshot.presence.state}
                  audioLevel={snapshot.presence.audioLevel}
                  officeMode={officeMode}
                  onSendMessage={handleSendMessage}
                  onCollapseToPresence={() => {
                    const quickResp = collapseConversationToPresence(snapshot.conversation);
                    setSnapshot((prev) => ({
                      ...prev,
                      level: 'presence',
                      presence: {
                        ...prev.presence,
                        state: quickResp?.streaming ? 'speaking' : 'idle',
                        quickResponse: quickResp
                      }
                    }));
                    setViewportPreset('compact');
                  }}
                  onExpandToWorkspace={() => handleSetLevel('workspace')}
                  onCancelGeneration={() => {
                    setSnapshot((prev) => {
                      const text = prev.conversation.streamingText;
                      return {
                        ...prev,
                        conversation: {
                          ...prev.conversation,
                          status: 'idle',
                          streamingStatus: 'cancelled',
                          streamingText: undefined,
                          timelineGroups: [
                            ...(prev.conversation.timelineGroups || []),
                            {
                              id: `group-cancelled-${Date.now()}`,
                              answerText: text,
                              isCancelled: true,
                              streamingStatus: 'cancelled'
                            }
                          ]
                        }
                      };
                    });
                  }}
                  onRetry={() => {
                    setSnapshot((prev) => ({
                      ...prev,
                      conversation: {
                        ...prev.conversation,
                        status: 'thinking',
                        observableProgressText: 'Retrying previous request…'
                      }
                    }));
                  }}
                  onAllowAction={handleAllowAction}
                  onDenyAction={handleDenyAction}
                  width="100%"
                  height="100%"
                />
              )
            )}

            {snapshot.level === 'workspace' && (
              <WorkspaceShell
                state={snapshot.workspace}
                conversationState={snapshot.conversation}
                officeMode={officeMode}
                onMinimizeToConversation={() => handleSetLevel('conversation')}
                onCollapseToPresence={() => handleSetLevel('presence')}
                onClose={() => handleSetLevel('presence')}
                onSendMessage={handleSendMessage}
                onAllowApproval={handleAllowAction}
                onDenyApproval={handleDenyAction}
                onSelectArtifact={(id) => {
                  setSnapshot((prev) => ({
                    ...prev,
                    workspace: {
                      ...prev.workspace,
                      activeArtifactId: id
                    }
                  }));
                }}
                onSelectFile={(path) => {
                  setSnapshot((prev) => ({
                    ...prev,
                    workspace: {
                      ...prev.workspace,
                      targetFiles: prev.workspace.targetFiles?.map((f) =>
                        f.path === path ? { ...f, status: 'modified' as const } : f
                      )
                    }
                  }));
                }}
                onApproveReview={() => {
                  setSnapshot((prev) => ({
                    ...prev,
                    workspace: {
                      ...prev.workspace,
                      status: 'completed',
                      userFacingState: 'Diff Approved',
                      outputSummary: 'Changes approved. Ready to apply or commit.'
                    }
                  }));
                }}
                onRequestRevision={() => {
                  setSnapshot((prev) => ({
                    ...prev,
                    workspace: {
                      ...prev.workspace,
                      status: 'idle',
                      userFacingState: 'Revision Requested',
                      outputSummary: 'Revision notes noted. Awaiting follow-up.'
                    }
                  }));
                }}
                onRetry={() => {
                  setSnapshot((prev) => ({
                    ...prev,
                    workspace: {
                      ...prev.workspace,
                      status: 'running',
                      userFacingState: 'Retrying…',
                      outputSummary: 'Re-running workspace task…'
                    }
                  }));
                }}
                onCancelTask={() => {
                  setSnapshot((prev) => ({
                    ...prev,
                    workspace: {
                      ...prev.workspace,
                      status: 'idle',
                      userFacingState: 'Cancelled',
                      outputSummary: 'Task cancelled by user.'
                    }
                  }));
                }}
              />
            )}
          </div>
        </div>
      </main>
    </div>
  );
};

