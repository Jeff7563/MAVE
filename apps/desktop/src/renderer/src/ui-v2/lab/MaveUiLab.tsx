import React, { useState } from 'react';
import type { SurfaceLevel, UiV2Snapshot, PresenceState } from '../types';
import { MOCK_SCENARIOS, type MockScenario } from '../mocks/mock-scenarios';
import { PresenceSurface } from '../presence/PresenceSurface';
import { ConversationShell } from '../conversation/ConversationShell';
import { WorkspaceShell } from '../workspace/WorkspaceShell';
import './MaveUiLab.css';
import '../tokens.css';

type ViewportPreset = 'compact' | 'chat' | 'workspace' | 'fill';

const VIEWPORT_DIMENSIONS: Record<ViewportPreset, { width: string; height: string }> = {
  compact: { width: '360px', height: '180px' },
  chat: { width: '400px', height: '640px' },
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
  const [selectedScenarioId, setSelectedScenarioId] = useState<string>('01_presence_idle');
  const [currentScenario, setCurrentScenario] = useState<MockScenario>(MOCK_SCENARIOS[0]!);
  const [snapshot, setSnapshot] = useState<UiV2Snapshot>(MOCK_SCENARIOS[0]!.snapshot);
  const [viewportPreset, setViewportPreset] = useState<ViewportPreset>('fill');
  const [audioLevelOverride, setAudioLevelOverride] = useState<number>(0);

  // Load a scenario
  const handleSelectScenario = (scenario: MockScenario) => {
    setSelectedScenarioId(scenario.id);
    setCurrentScenario(scenario);
    setSnapshot(JSON.parse(JSON.stringify(scenario.snapshot)));
    setAudioLevelOverride(scenario.snapshot.presence.audioLevel);

    // Auto-adjust viewport preset to match scenario level
    if (scenario.snapshot.level === 'presence') {
      setViewportPreset('compact');
    } else if (scenario.snapshot.level === 'conversation') {
      setViewportPreset('chat');
    } else if (scenario.snapshot.level === 'workspace') {
      setViewportPreset('workspace');
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
              <span>Simulated Audio Level:</span>
              <span>{(audioLevelOverride * 100).toFixed(0)}%</span>
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

          {/* Quick Presence State Selector */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <div style={{ fontSize: '11px', color: '#94a3b8' }}>Presence State:</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '4px' }}>
              {(['idle', 'listening', 'thinking', 'speaking', 'waking', 'error'] as PresenceState[]).map((st) => (
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
                >
                  {st}
                </button>
              ))}
            </div>
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
            {(['compact', 'chat', 'workspace', 'fill'] as ViewportPreset[]).map((preset) => (
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
              >
                {preset}
              </button>
            ))}
          </div>
        </header>

        {/* Live Canvas Area */}
        <div className="mave-ui-lab-canvas-area">
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
                onExpand={() => handleSetLevel('conversation')}
                onWakeToggle={() =>
                  handleSetPresenceState(
                    snapshot.presence.state === 'idle' ? 'listening' : 'idle'
                  )
                }
              />
            )}

            {snapshot.level === 'conversation' && (
              <ConversationShell
                state={snapshot.conversation}
                presenceState={snapshot.presence.state}
                audioLevel={snapshot.presence.audioLevel}
                onSendMessage={handleSendMessage}
                onCollapseToPresence={() => handleSetLevel('presence')}
                onExpandToWorkspace={() => handleSetLevel('workspace')}
                onAllowAction={handleAllowAction}
                onDenyAction={handleDenyAction}
                width="100%"
                height="100%"
              />
            )}

            {snapshot.level === 'workspace' && (
              <WorkspaceShell
                state={snapshot.workspace}
                onMinimizeToConversation={() => handleSetLevel('conversation')}
                onCollapseToPresence={() => handleSetLevel('presence')}
                onAllowApproval={handleAllowAction}
                onDenyApproval={handleDenyAction}
              />
            )}
          </div>
        </div>
      </main>
    </div>
  );
};

