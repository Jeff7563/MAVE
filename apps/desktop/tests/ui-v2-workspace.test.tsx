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
});

