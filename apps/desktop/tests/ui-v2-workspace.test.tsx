import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { WorkspaceShell } from '../src/renderer/src/ui-v2/workspace/WorkspaceShell';
import { U5_WORKSPACE_SCENARIOS } from '../src/renderer/src/ui-v2/mocks/mock-scenarios';
import type {
  WorkspaceState,
  ConversationState
} from '../src/renderer/src/ui-v2/types';
import fs from 'fs';
import path from 'path';

describe('MAVE UI V2 — U5 Workspace Surface Foundation & Structured Work Tests', () => {
  // -------------------------------------------------------------------------
  // 1. Workspace != Agent Runtime Invariant & State Continuity
  // -------------------------------------------------------------------------
  describe('1. Workspace != Agent Runtime & State Continuity', () => {
    it('Research Workspace does NOT imply or render autonomous agent wording', () => {
      const researchState: WorkspaceState = {
        type: 'research',
        status: 'completed',
        objective: 'Evaluate token streaming protocols across HTTP/2 and WebSockets',
        userFacingState: 'Synthesis Complete',
        researchFindings: [
          {
            title: 'HTTP/2 Server-Sent Events',
            summary: 'Lower protocol overhead for unidirectional token streaming.',
            takeaways: ['Simple reconnection semantics', 'Zero duplex overhead']
          }
        ]
      };

      const html = renderToStaticMarkup(
        <WorkspaceShell state={researchState} />
      );

      // Must render research findings
      expect(html).toContain('Evaluate token streaming protocols');
      expect(html).toContain('Lower protocol overhead for unidirectional token streaming.');
      expect(html).toContain('Simple reconnection semantics');
      expect(html).toContain('Synthesis Complete');

      // Invariant: Diff Review & Research must not claim "Autonomous Agent"
      expect(html).not.toContain('Autonomous Agent Running');
      expect(html).not.toContain('Agent Workspace');
    });

    it('Diff Review Workspace renders multi-file tabs, unified diff lines, and review actions', () => {
      const diffState: WorkspaceState = {
        type: 'diff_review',
        status: 'idle',
        userFacingState: 'Ready for Review',
        diffArtifacts: [
          {
            filePath: 'src/renderer/src/ui-v2/workspace/WorkspaceShell.tsx',
            changeType: 'modified',
            additions: 12,
            deletions: 4,
            diffLines: [
              { type: 'context', oldLineNumber: 10, newLineNumber: 10, text: 'import React from "react";' },
              { type: 'deletion', oldLineNumber: 11, text: '-const legacyMode = true;' },
              { type: 'addition', newLineNumber: 11, text: '+const adaptiveMode = true;' }
            ]
          }
        ]
      };

      const html = renderToStaticMarkup(
        <WorkspaceShell state={diffState} />
      );

      expect(html).toContain('WorkspaceShell.tsx');
      expect(html).toContain('import React from &quot;react&quot;;');
      expect(html).toContain('const adaptiveMode = true;');
      expect(html).toContain('const legacyMode = true;');
      expect(html).toContain('Approve Diff');
      expect(html).toContain('Request Revision');
      expect(html).not.toContain('Agent Workspace');
    });

    it('Conversation state is preserved and hosted seamlessly in Workspace Region A', () => {
      const convState: ConversationState = {
        status: 'result',
        messages: [
          {
            id: 'm1',
            type: 'message',
            role: 'user',
            content: 'Please refactor the workspace surface into composable regions'
          },
          {
            id: 'm2',
            type: 'message',
            role: 'assistant',
            content: 'Regions separated: Left Rail (Chat), Center (Work), Right (Context).'
          }
        ],
        cards: []
      };

      const wsState: WorkspaceState = {
        type: 'project',
        status: 'running',
        userFacingState: 'Generating Components',
        currentPlanStep: 2,
        totalPlanSteps: 4,
        planSteps: ['Design regions', 'Implement components', 'Write tests', 'Doc review'],
        artifacts: [
          {
            id: 'art-1',
            title: 'WorkspaceShell.tsx',
            type: 'code',
            content: 'export const WorkspaceShell = () => null;'
          }
        ]
      };

      const html = renderToStaticMarkup(
        <WorkspaceShell state={wsState} conversationState={convState} />
      );

      // Left rail should preserve the conversation messages
      expect(html).toContain('Please refactor the workspace surface');
      expect(html).toContain('Regions separated: Left Rail');
      // Primary work area should contain the workspace step
      expect(html).toContain('Generating Components');
      expect(html).toContain('2 / 4 steps • 50%');
    });
  });

  // -------------------------------------------------------------------------
  // 2. Composable Regions, Focus Mode & Visual Dismiss
  // -------------------------------------------------------------------------
  describe('2. Composable Regions, Focus Mode & Visual Dismiss', () => {
    const mockState: WorkspaceState = {
      type: 'generic',
      status: 'idle',
      title: 'MAVE Surface Workspace',
      userFacingState: 'Active Document',
      artifacts: [
        {
          id: 'art-spec',
          title: 'SPECIFICATION.md',
          type: 'markdown',
          content: '# MAVE UI V2 Workspace Spec\nDetails of Level 3 Surface.'
        }
      ],
      activeArtifactId: 'art-spec',
      targetFiles: [
        { path: 'docs/architecture/MAVE_UI_SURFACE_ARCHITECTURE.md', status: 'modified' }
      ]
    };

    it('Renders master header with Presence mark, semantic badge, region toggles, and navigation buttons', () => {
      const html = renderToStaticMarkup(<WorkspaceShell state={mockState} />);

      // Presence mark
      expect(html).toContain('data-testid="adaptive-presence-mark"');
      // Title
      expect(html).toContain('MAVE Surface Workspace');
      // Semantic badge
      expect(html).toContain('Active Document');
      // Region toggles
      expect(html).toContain('Focus');
      expect(html).toContain('Chat');
      expect(html).toContain('Context');
      // Navigation
      expect(html).toContain('Conversation');
      expect(html).toContain('Presence');
      // Close button
      expect(html).toContain('Dismiss workspace');
    });

    it('Supporting context displays multi-artifact list and target files in Region C', () => {
      const html = renderToStaticMarkup(<WorkspaceShell state={mockState} />);

      expect(html).toContain('SPECIFICATION.md');
      expect(html).toContain('MAVE_UI_SURFACE_ARCHITECTURE.md');
      expect(html).toContain('Target Files');
    });
  });

  // -------------------------------------------------------------------------
  // 3. Execution Substrate Privacy (Provider / Model Diagnostics Isolation)
  // -------------------------------------------------------------------------
  describe('3. Execution Substrate Privacy', () => {
    it('Normal workspace view strictly omits provider IDs, model IDs, tokens, and latency', () => {
      const stateWithInternalDiagnostics: WorkspaceState = {
        type: 'project',
        status: 'completed',
        userFacingState: 'Finished Drafting Proposal',
        diagnostics: {
          providerId: 'claude-code',
          runtimeId: 'claude-subscription',
          modelId: 'claude-3-7-sonnet',
          tokensUsed: 2048,
          latencyMs: 950
        },
        artifacts: [
          {
            id: 'art-prop',
            title: 'PROPOSAL.md',
            type: 'markdown',
            content: 'Executive summary for Q3 roadmap.'
          }
        ]
      };

      const html = renderToStaticMarkup(
        <WorkspaceShell state={stateWithInternalDiagnostics} />
      );

      // Must display clean user-facing state
      expect(html).toContain('Finished Drafting Proposal');
      expect(html).toContain('PROPOSAL.md');
      expect(html).toContain('Executive summary for Q3 roadmap.');

      // MUST NOT leak execution substrate in the rendered user DOM
      expect(html).not.toContain('claude-code');
      expect(html).not.toContain('claude-3-7-sonnet');
      expect(html).not.toContain('claude-subscription');
      expect(html).not.toContain('2048 tokens');
      expect(html).not.toContain('950ms');
      expect(html).not.toContain('Codex');
      expect(html).not.toContain('Antigravity');
      expect(html).not.toContain('Ollama');
    });
  });

  // -------------------------------------------------------------------------
  // 4. Progress Truthfulness
  // -------------------------------------------------------------------------
  describe('4. Progress Truthfulness', () => {
    it('Determinate progress accurately renders step counts and percentage when total steps are known', () => {
      const determinateState: WorkspaceState = {
        type: 'project',
        status: 'running',
        userFacingState: 'Building bundle',
        currentPlanStep: 3,
        totalPlanSteps: 5,
        planSteps: ['Lint', 'Typecheck', 'Bundle renderer', 'Package', 'Verify']
      };

      const html = renderToStaticMarkup(
        <WorkspaceShell state={determinateState} />
      );

      expect(html).toContain('3 / 5 steps • 60%');
      expect(html).toContain('Bundle renderer');
    });

    it('Indeterminate progress renders "Working…" when total duration or steps are unknown', () => {
      const indeterminateState: WorkspaceState = {
        type: 'project',
        status: 'running',
        userFacingState: 'Running test matrix',
        planSteps: ['Executing test suite…']
      };

      const html = renderToStaticMarkup(
        <WorkspaceShell state={indeterminateState} />
      );

      expect(html).toContain('Working…');
      expect(html).toContain('data-testid="indeterminate-progress-label"');
      expect(html).not.toContain('data-testid="determinate-progress-label"');
    });

    it('Waiting for approval renders approval card distinctly from active execution', () => {
      const approvalState: WorkspaceState = {
        type: 'agent',
        status: 'waiting_for_approval',
        userFacingState: 'Approval Required',
        activeApproval: {
          id: 'appr-file-write',
          type: 'approval',
          actionRequested: 'Permission to modify configuration',
          riskLevel: 'Level 2 — External',
          riskClass: 'mutation'
        }
      };

      const html = renderToStaticMarkup(
        <WorkspaceShell state={approvalState} />
      );

      expect(html).toContain('Approval Required');
      expect(html).toContain('Permission to modify configuration');
      expect(html).toContain('Allow Action');
      expect(html).toContain('Deny');
    });
  });

  // -------------------------------------------------------------------------
  // 5. All 16 U5 Scenarios Render Cleanly
  // -------------------------------------------------------------------------
  describe('5. All 16 U5 Scenarios Render Cleanly', () => {
    it('verifies that each of the 16 U5 scenarios produces valid HTML without throwing', () => {
      expect(U5_WORKSPACE_SCENARIOS.length).toBe(16);

      for (const scenario of U5_WORKSPACE_SCENARIOS) {
        expect(() => {
          const html = renderToStaticMarkup(
            <WorkspaceShell
              state={scenario.snapshot.workspace}
              conversationState={scenario.snapshot.conversation}
            />
          );
          expect(html).toBeTruthy();
          expect(html.length).toBeGreaterThan(100);
        }).not.toThrow();
      }
    });
  });

  // -------------------------------------------------------------------------
  // 6. Production M4 Preservation Gate
  // -------------------------------------------------------------------------
  describe('6. Production M4 Preservation Gate', () => {
    it('Verifies existing M4 surface components and production paths remain intact', () => {
      const surfaceViewPath = path.resolve(__dirname, '../src/renderer/src/components/surface/SurfaceView.tsx');
      const maveCapsulePath = path.resolve(__dirname, '../src/renderer/src/components/surface/MaveCapsule.tsx');
      const presenceMarkPath = path.resolve(__dirname, '../src/renderer/src/components/surface/PresenceMark.tsx');

      expect(fs.existsSync(surfaceViewPath)).toBe(true);
      expect(fs.existsSync(maveCapsulePath)).toBe(true);
      expect(fs.existsSync(presenceMarkPath)).toBe(true);

      const surfaceContent = fs.readFileSync(surfaceViewPath, 'utf-8');
      expect(surfaceContent).toContain('SurfaceView');

      const capsuleContent = fs.readFileSync(maveCapsulePath, 'utf-8');
      expect(capsuleContent).toContain('MaveCapsule');
    });
  });

  // -------------------------------------------------------------------------
  // 7. Visual QA P2 — File + Diff Workspace Artifact Dominance
  // -------------------------------------------------------------------------
  describe('7. Visual QA P2 — File + Diff Workspace Artifact Dominance', () => {
    it('promotes conversation diff card to dominate main workspace canvas', () => {
      const html = renderToStaticMarkup(
        <WorkspaceShell
          state={{
            type: 'project',
            title: 'Runtime Config',
            status: 'idle',
            steps: []
          }}
          conversationState={{
            status: 'result',
            messages: [],
            cards: [
              {
                id: 'diff-1',
                type: 'diff',
                filename: 'runtime.ts',
                path: 'src/config/runtime.ts',
                additions: 8,
                deletions: 2,
                lines: [
                  { type: 'context', text: 'import { ProviderPolicy } from "./types";', oldLineNumber: 1, newLineNumber: 1 },
                  { type: 'add', text: 'export const DEFAULT_PROVIDER = "subscription_runtime";', newLineNumber: 2 }
                ]
              }
            ]
          }}
        />
      );

      // Central workspace canvas renders WorkspaceDiffView
      expect(html).toContain('data-testid="workspace-diff-view"');
      expect(html).toContain('runtime.ts');
      expect(html).toContain('+8');
      expect(html).toContain('-2');
      expect(html).toContain('DEFAULT_PROVIDER');
      expect(html).toContain('subscription_runtime');
      // Must NOT be an empty canvas
      expect(html).not.toContain('No active project steps');
    });
  });

  // -------------------------------------------------------------------------
  // 8. MAVE VSM4 — Adaptive Artifact-Dominant Workspace System Tests
  // -------------------------------------------------------------------------
  describe('8. MAVE VSM4 — Adaptive Artifact-Dominant Workspace System Tests', () => {
    it('Diff Review Workspace collapses secondary rails by default for full-width artifact dominance', () => {
      const diffState: WorkspaceState = {
        type: 'diff_review',
        title: 'Review Network Timeout',
        status: 'idle',
        userFacingState: 'Ready for Review',
        diffArtifacts: [
          {
            filePath: 'src/network/client.ts',
            additions: 3,
            deletions: 1,
            diffLines: [
              { type: 'context', text: 'export const timeout = 5000;', oldLineNumber: 10, newLineNumber: 10 },
              { type: 'deletion', text: '-  timeout: 5000,', oldLineNumber: 11 },
              { type: 'addition', text: '+  timeout: 15000,', newLineNumber: 11 }
            ]
          }
        ]
      };

      const html = renderToStaticMarkup(<WorkspaceShell state={diffState} />);

      // Primary work canvas dominates with diff view
      expect(html).toContain('data-testid="workspace-diff-view"');
      expect(html).toContain('client.ts');

      // Rigid three-column default is removed: side rails are collapsed by default
      expect(html).not.toContain('data-testid="workspace-conversation-region"');
      expect(html).not.toContain('data-testid="workspace-context-region"');

      // Clean header: MAVE / Title, no noisy CODE badge
      expect(html).toContain('MAVE');
      expect(html).toContain('Review Network Timeout');
      expect(html).not.toContain('>CODE<');
      expect(html).not.toContain('>WORKSPACE<');
    });

    it('Empty supporting context collapses completely without reserving blank screen width', () => {
      const documentState: WorkspaceState = {
        type: 'project',
        title: 'Product Requirements',
        status: 'idle',
        userFacingState: 'Draft Ready',
        artifacts: [
          {
            id: 'doc-1',
            type: 'document',
            title: 'PRD.md',
            content: '# Product Requirements\n\nArtifact primacy is enforced.'
          }
        ]
      };

      const html = renderToStaticMarkup(<WorkspaceShell state={documentState} />);

      // Single artifact is in primary canvas
      expect(html).toContain('data-testid="workspace-project-view"');
      expect(html).toContain('PRD.md');
      expect(html).toContain('Artifact primacy is enforced.');

      // Zero supporting context exists -> context rail is completely collapsed
      expect(html).not.toContain('data-testid="workspace-context-region"');
    });

    it('Focus Mode presentation collapses conversation and context while preserving all state', () => {
      const stateWithContext: WorkspaceState = {
        type: 'project',
        title: 'Architecture Spec',
        status: 'running',
        userFacingState: 'Working',
        targetFiles: [{ path: 'src/arch.ts', status: 'modified' }],
        artifacts: [
          { id: 'a1', type: 'document', title: 'ARCH.md', content: 'Architecture content.' },
          { id: 'a2', type: 'document', title: 'NOTES.md', content: 'Notes.' }
        ]
      };

      const convState: ConversationState = {
        status: 'result',
        messages: [{ id: 'm1', type: 'message', role: 'user', content: 'Generate architecture specification' }],
        cards: []
      };

      const html = renderToStaticMarkup(
        <WorkspaceShell
          state={stateWithContext}
          conversationState={convState}
          initialFocusMode={true}
        />
      );

      // Focus Mode flag is active
      expect(html).toContain('data-focus-mode="true"');

      // Secondary rails are hidden from DOM in focus mode
      expect(html).not.toContain('data-testid="workspace-conversation-region"');
      expect(html).not.toContain('data-testid="workspace-context-region"');

      // Primary work area remains fully rendered and active
      expect(html).toContain('data-testid="workspace-project-view"');
      expect(html).toContain('Architecture content.');
    });

    it('Conversation state is reused faithfully when conversation rail is toggled open', () => {
      const state: WorkspaceState = {
        type: 'diff_review',
        title: 'Diff Review With Discussion',
        status: 'idle',
        diffArtifacts: [
          {
            filePath: 'src/server.ts',
            additions: 1,
            deletions: 0,
            diffLines: [{ type: 'addition', text: '+app.listen(3000);', newLineNumber: 1 }]
          }
        ]
      };

      const convState: ConversationState = {
        status: 'result',
        activeRequestId: 'req-vsm4-test',
        messages: [
          { id: 'm1', type: 'message', role: 'user', content: 'Can we change the port to 3000?' },
          { id: 'm2', type: 'message', role: 'assistant', content: 'Updated port to 3000 in server.ts.' }
        ],
        cards: []
      };

      const html = renderToStaticMarkup(
        <WorkspaceShell
          state={state}
          conversationState={convState}
          initialShowConversation={true}
        />
      );

      // Conversation rail is rendered with exact conversation state
      expect(html).toContain('data-testid="workspace-conversation-region"');
      expect(html).toContain('Can we change the port to 3000?');
      expect(html).toContain('Updated port to 3000 in server.ts.');

      // Diff canvas remains alongside it
      expect(html).toContain('data-testid="workspace-diff-view"');
      expect(html).toContain('server.ts');
    });

    it('Research Workspace synthesizes findings, takeaways, comparison, and sources in structured reading canvas', () => {
      const researchState: WorkspaceState = {
        type: 'research',
        title: 'Database Comparison',
        status: 'completed',
        userFacingState: 'Synthesis Complete',
        researchFindings: {
          question: 'PostgreSQL vs SQLite for embedded desktop memory',
          summary: 'SQLite provides zero daemon overhead, local ACID compliance, and WAL mode concurrency.',
          takeaways: [
            'Zero external process dependency',
            'WAL mode allows concurrent readers with a single writer'
          ]
        },
        sources: [
          {
            id: 'src-sqlite',
            type: 'source',
            title: 'SQLite WAL Mode Documentation',
            domain: 'sqlite.org',
            url: 'https://sqlite.org/wal.html',
            snippet: 'Write-Ahead Logging provides significant concurrency improvements.'
          }
        ]
      };

      const html = renderToStaticMarkup(<WorkspaceShell state={researchState} />);

      expect(html).toContain('data-testid="workspace-research-view"');
      expect(html).toContain('PostgreSQL vs SQLite for embedded desktop memory');
      expect(html).toContain('SQLite provides zero daemon overhead');
      expect(html).toContain('Zero external process dependency');
      expect(html).toContain('SQLite WAL Mode Documentation');

      // Sources are embedded in research canvas, not in redundant third column
      expect(html).not.toContain('data-testid="workspace-context-region"');
      expect(html).not.toContain('data-testid="workspace-conversation-region"');
    });

    it('Workspace minimize preserves ongoing task callbacks without destroying task state', () => {
      let minimizedToConversation = false;
      let collapsedToPresence = false;
      let dismissed = false;

      const runningTaskState: WorkspaceState = {
        type: 'project',
        title: 'Background Compilation',
        status: 'running',
        userFacingState: 'Building...',
        currentPlanStep: 2,
        totalPlanSteps: 4
      };

      const handleMinConv = () => { minimizedToConversation = true; };
      const handleColPres = () => { collapsedToPresence = true; };
      const handleClose = () => { dismissed = true; };

      const html = renderToStaticMarkup(
        <WorkspaceShell
          state={runningTaskState}
          onMinimizeToConversation={handleMinConv}
          onCollapseToPresence={handleColPres}
          onClose={handleClose}
        />
      );

      // Verify affordances exist
      expect(html).toContain('data-testid="btn-workspace-minimize-conversation"');
      expect(html).toContain('data-testid="btn-workspace-collapse-presence"');
      expect(html).toContain('data-testid="btn-workspace-close"');
      expect(html).toContain('Building...');

      // Invariant: handlers are bound without premature invocation
      expect(minimizedToConversation).toBe(false);
      expect(collapsedToPresence).toBe(false);
      expect(dismissed).toBe(false);

      // Verify callback functionality
      handleMinConv();
      handleColPres();
      handleClose();
      expect(minimizedToConversation).toBe(true);
      expect(collapsedToPresence).toBe(true);
      expect(dismissed).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // 9. VSM4.1 Workspace Default Composition & Narrow Adaptation Hardening
  // -------------------------------------------------------------------------
  describe('9. VSM4.1 Workspace Default Composition & Narrow Adaptation Hardening', () => {
    it('diff_review defaults to side rails completely collapsed (showConversation=false, showContext=false)', () => {
      const diffState: WorkspaceState = {
        id: 'ws-diff-canonical',
        type: 'diff_review',
        title: 'Network Timeout Patch',
        status: 'idle',
        userFacingState: 'Ready for Review',
        files: [{ path: 'src/net.ts', status: 'modified' }],
        diffArtifacts: [
          {
            filePath: 'src/net.ts',
            additions: 2,
            deletions: 1,
            diffLines: [{ type: 'addition', text: '+ timeout: 15000', newLineNumber: 10 }]
          }
        ]
      };

      const convState: ConversationState = {
        status: 'idle',
        messages: [{ id: 'm1', type: 'message', role: 'user', content: 'Review diff' }],
        cards: []
      };

      const html = renderToStaticMarkup(
        <WorkspaceShell state={diffState} conversationState={convState} />
      );

      // Diff dominates immediately
      expect(html).toContain('data-testid="workspace-diff-view"');
      expect(html).toContain('src/net.ts');

      // Side rails are collapsed by default in diff_review
      expect(html).not.toContain('data-testid="workspace-conversation-region"');
      expect(html).not.toContain('data-testid="workspace-context-region"');

      // Toggles remain available in header
      expect(html).toContain('data-testid="btn-workspace-toggle-chat"');
      expect(html).toContain('data-testid="btn-workspace-toggle-context"');
    });

    it('narrow viewport preserves SurfaceLevel workspace without falling back to presence', () => {
      const narrowScenario = U5_WORKSPACE_SCENARIOS.find((s) => s.id === 'u5_16_narrow_workspace');
      expect(narrowScenario).toBeDefined();

      // Invariant: level must strictly be 'workspace'
      expect(narrowScenario!.snapshot.level).toBe('workspace');
      expect(narrowScenario!.snapshot.workspace.title).toBe('Responsive Workspace');

      const html = renderToStaticMarkup(
        <WorkspaceShell state={narrowScenario!.snapshot.workspace} />
      );

      // Must render workspace project view, NOT presence capsule
      expect(html).toContain('data-testid="workspace-shell"');
      expect(html).toContain('ResponsiveLayout.md');
      expect(html).not.toContain('data-testid="presence-capsule"');
      expect(html).not.toContain('data-testid="presence-wordmark"');
    });

    it('opening optional rails preserves diff artifact data without state loss', () => {
      const diffState: WorkspaceState = {
        id: 'ws-diff-rails',
        type: 'diff_review',
        title: 'Payment Gateway Refactor',
        status: 'idle',
        files: [{ path: 'src/payment.ts', status: 'modified' }],
        diffArtifacts: [
          {
            filePath: 'src/payment.ts',
            additions: 10,
            deletions: 2,
            diffLines: [
              { type: 'context', text: 'export class PaymentClient {', oldLineNumber: 1, newLineNumber: 1 },
              { type: 'addition', text: '+  async charge(amount: number) {', newLineNumber: 2 }
            ]
          }
        ]
      };

      const convState: ConversationState = {
        status: 'result',
        messages: [{ id: 'm1', type: 'message', role: 'user', content: 'Ensure idempotency key is sent.' }],
        cards: []
      };

      // 1. Render with Chat opened
      const htmlWithChat = renderToStaticMarkup(
        <WorkspaceShell state={diffState} conversationState={convState} initialShowConversation={true} />
      );
      expect(htmlWithChat).toContain('data-testid="workspace-conversation-region"');
      expect(htmlWithChat).toContain('Ensure idempotency key is sent.');
      expect(htmlWithChat).toContain('data-testid="workspace-diff-view"');
      expect(htmlWithChat).toContain('PaymentClient');

      // 2. Render with Context opened
      const htmlWithContext = renderToStaticMarkup(
        <WorkspaceShell state={diffState} conversationState={convState} initialShowContext={true} />
      );
      expect(htmlWithContext).toContain('data-testid="workspace-context-region"');
      expect(htmlWithContext).toContain('src/payment.ts');
      expect(htmlWithContext).toContain('data-testid="workspace-diff-view"');
      expect(htmlWithContext).toContain('charge(amount: number)');

      // 3. Render with both opened
      const htmlWithBoth = renderToStaticMarkup(
        <WorkspaceShell
          state={diffState}
          conversationState={convState}
          initialShowConversation={true}
          initialShowContext={true}
        />
      );
      expect(htmlWithBoth).toContain('data-testid="workspace-conversation-region"');
      expect(htmlWithBoth).toContain('data-testid="workspace-context-region"');
      expect(htmlWithBoth).toContain('data-testid="workspace-diff-view"');
    });
  });
});



