import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { CardRenderer } from '../src/renderer/src/ui-v2/cards/CardRenderer';
import { CardShell } from '../src/renderer/src/ui-v2/primitives/CardShell';
import { SourceCard, SourceGroupCard, VideoCard, ImageCard } from '../src/renderer/src/ui-v2/cards/MediaCards';
import { FileCard, CodeCard, DiffCard } from '../src/renderer/src/ui-v2/cards/CodeAndFileCards';
import { StructuredComparisonCard } from '../src/renderer/src/ui-v2/cards/StructuredComparisonCard';
import { TranslationCard } from '../src/renderer/src/ui-v2/cards/TranslationCard';
import { TaskCard, ProgressCard, ApprovalCard, ErrorCard } from '../src/renderer/src/ui-v2/cards/ActionAndTaskCards';
import { ConversationShell } from '../src/renderer/src/ui-v2/conversation/ConversationShell';
import { U3_RICH_CARD_SCENARIOS } from '../src/renderer/src/ui-v2/mocks/mock-scenarios';
import type {
  UiV2Card,
  SourceCardData,
  SourceGroupCardData,
  ComparisonCardData,
  ProgressCardData,
  ApprovalCardData,
  DiffCardData,
  ConversationState
} from '../src/renderer/src/ui-v2/types';

describe('MAVE UI V2 — U3 Rich Cards & Structured Information Presentation Tests', () => {
  // -------------------------------------------------------------------------
  // 1. Typed Dispatch: All 14 Card Types Render via CardRenderer
  // -------------------------------------------------------------------------
  describe('1. Typed Dispatch (All 14 Card Types)', () => {
    it('dispatches and renders all 14 canonical card types correctly', () => {
      const cards: UiV2Card[] = [
        {
          id: 'card-1',
          type: 'message',
          role: 'assistant',
          content: 'Hello from assistant card'
        },
        {
          id: 'card-2',
          type: 'translation',
          originalText: 'Bonjour',
          translatedText: 'Hello',
          targetLanguage: 'English'
        },
        {
          id: 'card-3',
          type: 'source',
          citationIndex: 1,
          title: 'React Documentation',
          domain: 'react.dev',
          url: 'https://react.dev',
          snippet: 'React docs snippet'
        },
        {
          id: 'card-4',
          type: 'source_group',
          sources: [
            {
              id: 'sg-1',
              type: 'source',
              citationIndex: 1,
              title: 'Source 1',
              domain: 'example.com',
              url: 'https://example.com',
              snippet: 'Snippet 1'
            }
          ]
        },
        {
          id: 'card-5',
          type: 'video',
          title: 'TypeScript Tutorial',
          channel: 'TechCraft',
          duration: '10:00'
        },
        {
          id: 'card-6',
          type: 'image',
          caption: 'Architecture Overview Diagram',
          url: 'https://example.com/diagram.png'
        },
        {
          id: 'card-7',
          type: 'file',
          path: 'src/main.ts',
          fileType: 'typescript',
          linesModified: 5
        },
        {
          id: 'card-8',
          type: 'code',
          language: 'typescript',
          code: 'const x = 42;'
        },
        {
          id: 'card-9',
          type: 'diff',
          filename: 'main.ts',
          additions: 3,
          deletions: 1
        },
        {
          id: 'card-10',
          type: 'comparison',
          columns: [{ key: 'col1', label: 'Col 1' }],
          rows: [{ id: 'row1', values: { col1: 'Val 1' } }]
        },
        {
          id: 'card-11',
          type: 'task',
          taskName: 'Build Assets',
          status: 'running'
        },
        {
          id: 'card-12',
          type: 'progress',
          label: 'Downloading Packages',
          determinate: true,
          completedSteps: 2,
          totalSteps: 4,
          percent: 50
        },
        {
          id: 'card-13',
          type: 'approval',
          actionRequested: 'Delete cache folder',
          riskLevel: 'Level 3 — Destructive',
          riskClass: 'destructive'
        },
        {
          id: 'card-14',
          type: 'error',
          errorMessage: 'Connection lost'
        }
      ];

      for (const card of cards) {
        const html = renderToStaticMarkup(<CardRenderer card={card} />);
        expect(html).toBeTruthy();
        expect(html.length).toBeGreaterThan(20);
      }
    });

    it('renders individual direct card components cleanly', () => {
      // VideoCard
      const videoHtml = renderToStaticMarkup(
        <VideoCard
          data={{
            id: 'v-test',
            type: 'video',
            channel: 'Tech Channel',
            duration: '15:00',
            title: 'Deep Learning Basics'
          }}
        />
      );
      expect(videoHtml).toContain('Tech Channel');
      expect(videoHtml).toContain('15:00');
      expect(videoHtml).toContain('Deep Learning Basics');

      // ImageCard
      const imgHtml = renderToStaticMarkup(
        <ImageCard
          data={{
            id: 'img-test',
            type: 'image',
            caption: 'System Flow Diagram',
            url: 'https://example.com/flow.png'
          }}
        />
      );
      expect(imgHtml).toContain('System Flow Diagram');
      expect(imgHtml).toContain('data-testid="image-canvas-placeholder"');

      // FileCard
      const fileHtml = renderToStaticMarkup(
        <FileCard
          data={{
            id: 'f-test',
            type: 'file',
            path: 'src/utils/normalizer.ts',
            fileType: 'typescript',
            linesModified: 12
          }}
        />
      );
      expect(fileHtml).toContain('normalizer.ts');
      expect(fileHtml).toContain('12 lines modified');

      // CodeCard
      const codeHtml = renderToStaticMarkup(
        <CodeCard
          data={{
            id: 'c-test',
            type: 'code',
            language: 'typescript',
            code: 'const a = 1;\nconst b = 2;',
            lineNumbers: true
          }}
        />
      );
      expect(codeHtml).toContain('data-testid="code-table-with-lines"');
      expect(codeHtml).toContain('const a = 1;');

      // TranslationCard
      const transHtml = renderToStaticMarkup(
        <TranslationCard
          data={{
            id: 't-test',
            type: 'translation',
            originalText: 'Guten Tag',
            translatedText: 'Good day',
            targetLanguage: 'German',
            pronunciation: 'GOO-tən TAHK'
          }}
        />
      );
      expect(transHtml).toContain('Guten Tag');
      expect(transHtml).toContain('Good day');
      expect(transHtml).toContain('/GOO-tən TAHK/');

      // TaskCard
      const taskHtml = renderToStaticMarkup(
        <TaskCard
          data={{
            id: 'tk-test',
            type: 'task',
            taskName: 'Compile Bundle',
            status: 'running',
            currentStep: 'Minifying chunks'
          }}
        />
      );
      expect(taskHtml).toContain('Compile Bundle');
      expect(taskHtml).toContain('Minifying chunks');
      expect(taskHtml).toContain('RUNNING');
    });
  });

  // -------------------------------------------------------------------------
  // 2. Content Provenance vs Execution Substrate Isolation
  // -------------------------------------------------------------------------
  describe('2. Content Provenance & Legitimate Vendor Sources', () => {
    it('renders legitimate vendor source citations with full provenance', () => {
      const sourceCard: SourceCardData = {
        id: 'src-openai',
        type: 'source',
        citationIndex: 1,
        title: 'OpenAI Platform Documentation',
        domain: 'platform.openai.com',
        url: 'https://platform.openai.com/docs/guides/reasoning',
        snippet: 'Official reference for reasoning tokens and multi-turn conversations.',
        authorOrDate: 'OpenAI · Oct 2024'
      };

      const html = renderToStaticMarkup(<SourceCard data={sourceCard} />);
      expect(html).toContain('OpenAI Platform Documentation');
      expect(html).toContain('platform.openai.com');
      expect(html).toContain('[1]');
      expect(html).toContain('Official reference for reasoning tokens');
      expect(html).toContain('OpenAI · Oct 2024');

      // Crucial invariant: Content Provenance != Execution Substrate
      // Vendor citations MUST NOT leak raw model IDs or execution metrics into user cards
      expect(html).not.toContain('Model: gpt-4o');
      expect(html).not.toContain('tokensUsed');
      expect(html).not.toContain('latencyMs');
    });
  });

  // -------------------------------------------------------------------------
  // 3. Source Group Composition & Summary
  // -------------------------------------------------------------------------
  describe('3. Source Group Card', () => {
    it('groups multiple citations cleanly into a unified composite card', () => {
      const groupData: SourceGroupCardData = {
        id: 'sg-composite',
        type: 'source_group',
        sources: [
          {
            id: 's1',
            type: 'source',
            citationIndex: 1,
            title: 'OpenAI Documentation',
            domain: 'platform.openai.com',
            url: 'https://platform.openai.com',
            snippet: 'OpenAI docs snippet'
          },
          {
            id: 's2',
            type: 'source',
            citationIndex: 2,
            title: 'Microsoft Learn',
            domain: 'learn.microsoft.com',
            url: 'https://learn.microsoft.com',
            snippet: 'Microsoft learn snippet'
          },
          {
            id: 's3',
            type: 'source',
            citationIndex: 3,
            title: 'GitHub Discussion #42',
            domain: 'github.com',
            url: 'https://github.com',
            snippet: 'GitHub issue discussion'
          },
          {
            id: 's4',
            type: 'source',
            citationIndex: 4,
            title: 'Local Architecture Spec',
            domain: 'local:docs/spec.md',
            url: 'local:///docs/spec.md',
            snippet: 'Local architectural specification'
          }
        ]
      };

      const html = renderToStaticMarkup(<SourceGroupCard data={groupData} />);
      // Renders group badge & count
      expect(html).toContain('Sources · 4');
      // Renders summary list
      expect(html).toContain('data-testid="source-group-summary-list"');
      expect(html).toContain('OpenAI Documentation');
      expect(html).toContain('Microsoft Learn');
      expect(html).toContain('GitHub Discussion #42');
      expect(html).toContain('Local Architecture Spec');
      // Toggle affordance
      expect(html).toContain('data-testid="btn-toggle-source-group"');
    });

    it('eliminates nested CardShell containers when expanded', () => {
      const groupData: SourceGroupCardData = {
        id: 'sg-composite-expanded',
        type: 'source_group',
        defaultExpanded: true,
        sources: [
          {
            id: 's1',
            type: 'source',
            citationIndex: 1,
            title: 'Authoritative Documentation',
            domain: 'docs.example.com',
            url: 'https://docs.example.com',
            snippet: 'Example snippet'
          },
          {
            id: 's2',
            type: 'source',
            citationIndex: 2,
            title: 'Secondary Source',
            domain: 'secondary.example.com',
            url: 'https://secondary.example.com',
            snippet: 'Secondary snippet'
          }
        ]
      };

      const html = renderToStaticMarkup(<SourceGroupCard data={groupData} />);
      expect(html).toContain('data-testid="source-group-expanded-list"');
      expect(html).toContain('Authoritative Documentation');
      expect(html).toContain('Secondary Source');
      // Invariant: CardShell must not be nested inside CardShell
      const cardShellOccurrences = (html.match(/mave-v2-card-shell/g) || []).length;
      expect(cardShellOccurrences).toBe(1);
    });
  });

  // -------------------------------------------------------------------------
  // 4. Structured Comparison & Responsive Narrow Transformation
  // -------------------------------------------------------------------------
  describe('4. Structured Comparison & Responsive Transformation', () => {
    const comparisonData: ComparisonCardData = {
      id: 'comp-1',
      type: 'comparison',
      title: 'Subscription Runtime Comparison',
      caption: 'Evaluating subscription runtimes versus metered APIs',
      columns: [
        { key: 'runtime', label: 'Runtime', isPrimary: true },
        { key: 'category', label: 'Category' },
        { key: 'quota', label: 'Quota Model' }
      ],
      rows: [
        {
          id: 'codex',
          badge: 'Primary',
          highlighted: true,
          values: {
            runtime: 'Codex CLI',
            category: 'Subscription',
            quota: 'Flat Monthly'
          }
        },
        {
          id: 'claude',
          badge: 'Secondary',
          values: {
            runtime: 'Claude Code',
            category: 'Subscription',
            quota: 'Flat Monthly'
          }
        }
      ]
    };

    it('renders semantic accessible <table> in default/wide mode', () => {
      const html = renderToStaticMarkup(<StructuredComparisonCard data={comparisonData} />);
      expect(html).toContain('<table');
      expect(html).toContain('data-testid="comparison-table"');
      expect(html).toContain('data-testid="comparison-th-runtime"');
      expect(html).toContain('data-testid="comparison-th-category"');
      expect(html).toContain('data-testid="comparison-th-quota"');
      expect(html).toContain('Codex CLI');
      expect(html).toContain('data-highlighted="true"');
      expect(html).toContain('Primary');
    });

    it('transforms into stacked key-value records when responsiveStack is true', () => {
      const narrowData: ComparisonCardData = {
        ...comparisonData,
        responsiveStack: true,
        density: 'compact'
      };

      const html = renderToStaticMarkup(<StructuredComparisonCard data={narrowData} />);
      expect(html).toContain('data-testid="comparison-stacked-list"');
      expect(html).toContain('data-testid="comparison-stacked-record-codex"');
      expect(html).toContain('data-testid="comparison-stacked-record-claude"');
      expect(html).toContain('Category:');
      expect(html).toContain('Quota Model:');
      // Table elements should not be present in stacked view
      expect(html).not.toContain('<table');
    });
  });

  // -------------------------------------------------------------------------
  // 5. Progress Truthfulness: Determinate vs Indeterminate
  // -------------------------------------------------------------------------
  describe('5. Progress Truthfulness (Determinate vs Indeterminate)', () => {
    it('renders real known counts and percentage for determinate progress', () => {
      const determinateData: ProgressCardData = {
        id: 'prog-det',
        type: 'progress',
        label: 'Codebase Symbol Indexing',
        determinate: true,
        completedSteps: 3,
        totalSteps: 5,
        percent: 60,
        currentStep: 'Parsing AST definitions'
      };

      const html = renderToStaticMarkup(<ProgressCard data={determinateData} />);
      expect(html).toContain('data-determinate="true"');
      expect(html).toContain('Step 3/5');
      expect(html).toContain('60%');
      expect(html).toContain('role="progressbar"');
      expect(html).toContain('aria-valuenow="60"');
      expect(html).toContain('Parsing AST definitions');
    });

    it('renders ongoing activity without fake percentage for indeterminate progress', () => {
      const indeterminateData: ProgressCardData = {
        id: 'prog-indet',
        type: 'progress',
        label: 'Executing Integration Test Suite',
        determinate: false,
        currentStep: 'Suite 4: contracts',
        statusMessage: 'Awaiting async process completion…'
      };

      const html = renderToStaticMarkup(<ProgressCard data={indeterminateData} />);
      expect(html).toContain('data-determinate="false"');
      expect(html).toContain('Working…');
      expect(html).toContain('data-testid="indeterminate-progress-bar"');
      // Invariant: NEVER fabricate percentage numbers from elapsed time
      expect(html).not.toContain('data-testid="progress-percentage-label"');
      expect(html).not.toContain('73%');
      expect(html).not.toContain('aria-valuenow');
    });
  });

  // -------------------------------------------------------------------------
  // 6. Approval Presentation Boundary (Pure Presentation Only)
  // -------------------------------------------------------------------------
  describe('6. Approval Presentation Boundary', () => {
    it('renders action request with prototype boundary notice and mock taxonomy', () => {
      const approvalData: ApprovalCardData = {
        id: 'appr-1',
        type: 'approval',
        actionRequested: 'Purge build cache directory to reclaim 3.8 GB disk space',
        riskLevel: 'Level 3 — Destructive',
        riskClass: 'destructive',
        command: 'rm -rf ./build/cache',
        directory: 'D:\\project\\MAVE',
        status: 'pending',
        riskExplanation: 'Permanent deletion of compiled artifacts from disk.'
      };

      const html = renderToStaticMarkup(<ApprovalCard data={approvalData} />);
      // Marked with prototype boundary
      expect(html).toContain('data-prototype-gate="true"');
      expect(html).toContain('[Prototype Notice]');
      expect(html).toContain('Level 3 — Destructive');
      expect(html).toContain('Purge build cache directory');
      expect(html).toContain('Permanent deletion of compiled artifacts');
      expect(html).toContain('$ rm -rf ./build/cache');
      expect(html).toContain('Directory:');
      // Action buttons
      expect(html).toContain('data-testid="btn-allow-action"');
      expect(html).toContain('data-testid="btn-deny-action"');
    });
  });

  // -------------------------------------------------------------------------
  // 7. Safe String Rendering (Code, Diffs, Paths, Commands)
  // -------------------------------------------------------------------------
  describe('7. Safe String Rendering (Security Boundary)', () => {
    it('escapes code, diffs, and commands as safe text without HTML injection', () => {
      const maliciousSnippet = '<script>alert("xss")</script><img src=x onerror=alert(1)>';

      const codeCard: UiV2Card = {
        id: 'code-xss',
        type: 'code',
        language: 'html',
        code: maliciousSnippet
      };

      const html = renderToStaticMarkup(<CardRenderer card={codeCard} />);
      // Should be HTML entity escaped, never raw executable tags
      expect(html).toContain('&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;');
      expect(html).not.toContain('<script>alert("xss")</script>');
    });

    it('renders diff lines safely with semantic add/remove attributes', () => {
      const diffData: DiffCardData = {
        id: 'diff-1',
        type: 'diff',
        filename: 'config.ts',
        additions: 1,
        deletions: 1,
        defaultExpanded: true,
        lines: [
          { type: 'remove', text: 'export const USE_PAID = true;', oldLineNumber: 10 },
          { type: 'add', text: 'export const USE_PAID = false;', newLineNumber: 10 }
        ]
      };

      const html = renderToStaticMarkup(<DiffCard data={diffData} />);
      expect(html).toContain('data-testid="diff-line-remove"');
      expect(html).toContain('data-testid="diff-line-add"');
      expect(html).toContain('+1');
      expect(html).toContain('-1');
      expect(html).toContain('export const USE_PAID = false;');
    });
  });

  // -------------------------------------------------------------------------
  // 8. Progressive Disclosure (Collapsible Details)
  // -------------------------------------------------------------------------
  describe('8. Progressive Disclosure', () => {
    it('CardShell supports expandable details via detailsSlot and expand toggle', () => {
      const htmlExpanded = renderToStaticMarkup(
        <CardShell
          title="Progressive Card"
          expandable={true}
          expanded={true}
          detailsSlot={<div data-testid="progressive-content">Extended Details Here</div>}
        >
          <div>Primary Content</div>
        </CardShell>
      );

      expect(htmlExpanded).toContain('data-testid="card-expand-toggle"');
      expect(htmlExpanded).toContain('data-testid="card-details-slot"');
      expect(htmlExpanded).toContain('Extended Details Here');

      const htmlCollapsed = renderToStaticMarkup(
        <CardShell
          title="Progressive Card"
          expandable={true}
          expanded={false}
          detailsSlot={<div data-testid="progressive-content">Extended Details Here</div>}
        >
          <div>Primary Content</div>
        </CardShell>
      );

      expect(htmlCollapsed).toContain('data-testid="card-expand-toggle"');
      expect(htmlCollapsed).not.toContain('Extended Details Here');
    });

    it('ErrorCard provides progressive disclosure for technical details', () => {
      const errorData = {
        id: 'err-1',
        type: 'error' as const,
        errorMessage: 'Local Ollama service unreachable',
        recoverable: true,
        technicalDetails: 'ECONNREFUSED 127.0.0.1:11434 at TCPConnectWrap'
      };

      const html = renderToStaticMarkup(<ErrorCard data={errorData} onRetry={() => {}} />);
      expect(html).toContain('Local Ollama service unreachable');
      expect(html).toContain('data-testid="btn-toggle-error-details"');
      expect(html).toContain('data-testid="btn-retry-error"');
    });
  });

  // -------------------------------------------------------------------------
  // 9. U2 Semantic Cleanup Gate: Follow-up Suggestions Lifetime
  // -------------------------------------------------------------------------
  describe('9. U2 Semantic Cleanup Gate: Follow-up Suggestions Lifetime', () => {
    it('renders follow-up suggestions upon completed response and provides dismiss affordance', () => {
      const conversationState: ConversationState = {
        status: 'result',
        messages: [
          { id: 'm1', type: 'message', role: 'user', content: 'Translate Bonjour' },
          { id: 'm2', type: 'message', role: 'assistant', content: 'Hello' }
        ],
        cards: [],
        followUpSuggestions: ['Explain grammar', 'Practice pronunciation', 'Give examples']
      };

      const html = renderToStaticMarkup(<ConversationShell state={conversationState} />);
      expect(html).toContain('data-testid="followup-suggestions"');
      expect(html).toContain('Explain grammar');
      expect(html).toContain('Practice pronunciation');
      expect(html).toContain('Give examples');
      expect(html).toContain('data-testid="btn-dismiss-followups"');
    });
  });

  // -------------------------------------------------------------------------
  // 10. U2 Semantic Cleanup Gate: Workspace Escalation Copy
  // -------------------------------------------------------------------------
  describe('10. U2 Semantic Cleanup Gate: Workspace Escalation Copy', () => {
    it('displays generic semantic wording without falsely claiming agent execution', () => {
      const stateWithWorkspaceEligible: ConversationState = {
        status: 'result',
        workspaceEligible: true,
        messages: [
          { id: 'm1', type: 'message', role: 'user', content: 'Compare these 12 architecture proposals' },
          { id: 'm2', type: 'message', role: 'assistant', content: 'Here is the summary table.' }
        ],
        cards: []
      };

      const html = renderToStaticMarkup(<ConversationShell state={stateWithWorkspaceEligible} />);
      // Generic semantic wording requirement:
      expect(html).toContain('This task works better in Workspace.');
      // Must NOT falsely claim "agent execution" when no agent is running:
      expect(html).not.toContain('Task requires sustained agent execution');
    });
  });

  // -------------------------------------------------------------------------
  // 11. U2 Semantic Cleanup Gate: Streaming Accessibility
  // -------------------------------------------------------------------------
  describe('11. U2 Semantic Cleanup Gate: Streaming Accessibility', () => {
    it('separates coherent live announcements from rapid visual streaming tokens', () => {
      const streamingState: ConversationState = {
        status: 'streaming',
        streamingStatus: 'streaming',
        streamingText: 'Quantum mechanics is a fundamental theory…',
        observableProgressText: 'Thinking…',
        messages: [
          { id: 'm1', type: 'message', role: 'user', content: 'Explain quantum mechanics' }
        ],
        cards: []
      };

      const html = renderToStaticMarkup(<ConversationShell state={streamingState} />);
      // Coherent live region for screen readers:
      expect(html).toContain('data-testid="streaming-live-region"');
      expect(html).toContain('aria-live="polite"');
      expect(html).toContain('role="status"');

      // Visual streaming text block is marked aria-hidden to eliminate token spam:
      expect(html).toContain('aria-hidden="true"');
      expect(html).toContain('data-testid="streaming-text-block"');
    });
  });

  // -------------------------------------------------------------------------
  // 12. Verification of all 15 U3 Mock Scenarios
  // -------------------------------------------------------------------------
  describe('12. U3 UI Lab Scenarios Verification', () => {
    it('verifies that all 15 U3 scenarios render without throwing errors', () => {
      expect(U3_RICH_CARD_SCENARIOS).toHaveLength(15);

      for (const scenario of U3_RICH_CARD_SCENARIOS) {
        expect(scenario.id).toMatch(/^u3_\d\d_/);
        expect(scenario.name).toContain('U3-');
        expect(scenario.snapshot.conversation.cards.length).toBeGreaterThan(0);

        const html = renderToStaticMarkup(
          <ConversationShell state={scenario.snapshot.conversation as ConversationState} />
        );
        expect(html).toBeTruthy();
        expect(html.length).toBeGreaterThan(100);
      }
    });
  });
});
