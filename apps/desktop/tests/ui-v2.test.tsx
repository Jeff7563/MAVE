import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { AdaptivePresenceMark } from '../src/renderer/src/ui-v2/primitives/AdaptivePresenceMark';
import { CardShell } from '../src/renderer/src/ui-v2/primitives/CardShell';
import {
  MessageCard,
  TranslationCard,
  SourceCard,
  VideoCard,
  FileCard,
  CodeCard,
  TaskCard,
  ApprovalCard,
  ErrorCard,
  CardRenderer
} from '../src/renderer/src/ui-v2/cards';
import { PresenceSurface } from '../src/renderer/src/ui-v2/presence/PresenceSurface';
import { ConversationShell } from '../src/renderer/src/ui-v2/conversation/ConversationShell';
import { ChatOnlyPanel } from '../src/renderer/src/ui-v2/conversation/ChatOnlyPanel';
import { WorkspaceShell } from '../src/renderer/src/ui-v2/workspace/WorkspaceShell';
import { AgentWorkspaceView } from '../src/renderer/src/ui-v2/workspace/AgentWorkspaceView';
import { LanguageWorkspaceView } from '../src/renderer/src/ui-v2/workspace/LanguageWorkspaceView';
import { MOCK_SCENARIOS } from '../src/renderer/src/ui-v2/mocks/mock-scenarios';
import { MaveUiLab } from '../src/renderer/src/ui-v2/lab/MaveUiLab';
import type { PresenceState, OrbSize, UiV2Card } from '../src/renderer/src/ui-v2/types';

describe('MAVE UI V2 — U0 Adaptive Surface Foundation & UI Lab', () => {
  describe('AdaptivePresenceMark Primitive', () => {
    it('renders all required sizes: hero, medium, compact, status', () => {
      const sizes: OrbSize[] = ['hero', 'medium', 'compact', 'status'];
      for (const size of sizes) {
        const html = renderToStaticMarkup(<AdaptivePresenceMark size={size} state="idle" />);
        expect(html).toContain(`mave-v2-orb-${size}`);
        expect(html).toContain('data-size="' + size + '"');
        expect(html).toContain('<svg');
      }
    });

    it('renders all required presence states with semantic attributes', () => {
      const states: PresenceState[] = ['idle', 'waking', 'listening', 'thinking', 'speaking', 'error'];
      for (const state of states) {
        const html = renderToStaticMarkup(<AdaptivePresenceMark state={state} size="compact" />);
        expect(html).toContain(`mave-v2-orb-state-${state}`);
        expect(html).toContain(`aria-label="MAVE Status: ${state}"`);
      }
    });

    it('renders acoustic waveform bars in listening and speaking states', () => {
      const htmlListening = renderToStaticMarkup(
        <AdaptivePresenceMark state="listening" size="compact" audioLevel={0.8} />
      );
      expect(htmlListening).toContain('<rect');

      const htmlSpeaking = renderToStaticMarkup(
        <AdaptivePresenceMark state="speaking" size="compact" audioLevel={0.9} />
      );
      expect(htmlSpeaking).toContain('<rect');
    });

    it('renders status dot without large bars in status size', () => {
      const html = renderToStaticMarkup(<AdaptivePresenceMark state="idle" size="status" />);
      expect(html).toContain('<circle cx="20" cy="20" r="4"');
    });
  });

  describe('Card Foundation & Renderers', () => {
    it('renders CardShell with metadata badge, title, timestamp, and actions slot', () => {
      const html = renderToStaticMarkup(
        <CardShell
          badge="Test Badge"
          title="Test Title"
          timestamp="2m ago"
          actions={<button>Action</button>}
          highlighted
        >
          <div>Card content text</div>
        </CardShell>
      );
      expect(html).toContain('Test Badge');
      expect(html).toContain('Test Title');
      expect(html).toContain('2m ago');
      expect(html).toContain('Card content text');
      expect(html).toContain('Action');
      expect(html).toContain('mave-v2-card-highlighted');
    });

    it('renders MessageCard for user and assistant with correct styling', () => {
      const userHtml = renderToStaticMarkup(
        <MessageCard
          data={{
            id: 'm1',
            type: 'message',
            role: 'user',
            content: 'Hello MAVE'
          }}
        />
      );
      expect(userHtml).toContain('Hello MAVE');
      expect(userHtml).toContain('data-testid="message-card-user"');

      const assistantHtml = renderToStaticMarkup(
        <MessageCard
          data={{
            id: 'm2',
            type: 'message',
            role: 'assistant',
            content: 'Hello! How can I help you?',
            semanticRuntime: 'MAVE • Local Fast Brain'
          }}
        />
      );
      expect(assistantHtml).toContain('Hello! How can I help you?');
      expect(assistantHtml).toContain('MAVE • Local Fast Brain');
      expect(assistantHtml).toContain('data-testid="message-card-assistant"');
    });

    it('renders TranslationCard with natural alternative, grammar note, and vocabulary pills', () => {
      const html = renderToStaticMarkup(
        <TranslationCard
          data={{
            id: 't1',
            type: 'translation',
            targetLanguage: 'Thai',
            originalText: 'I agree',
            translatedText: 'ผมเห็นด้วยครับ',
            naturalAlternative: 'ฉันเห็นพ้องกับคุณ',
            grammarNote: 'agree is a verb',
            vocabulary: [{ term: 'agree', meaning: 'เห็นด้วย' }]
          }}
        />
      );
      expect(html).toContain('Translation • Thai');
      expect(html).toContain('I agree');
      expect(html).toContain('ผมเห็นด้วยครับ');
      expect(html).toContain('Natural Alternative');
      expect(html).toContain('agree is a verb');
      expect(html).toContain('agree</strong> = เห็นด้วย');
      expect(html).toContain('Listen');
      expect(html).toContain('Copy');
    });

    it('renders SourceCard with domain and external link', () => {
      const html = renderToStaticMarkup(
        <SourceCard
          data={{
            id: 's1',
            type: 'source',
            domain: 'github.com',
            title: 'MAVE Repository',
            url: 'https://github.com/mave',
            snippet: 'Personal AI desktop orchestrator'
          }}
        />
      );
      expect(html).toContain('github.com');
      expect(html).toContain('MAVE Repository');
      expect(html).toContain('Personal AI desktop orchestrator');
      expect(html).toContain('View Source ↗');
    });

    it('renders VideoCard with duration badge and channel info', () => {
      const html = renderToStaticMarkup(
        <VideoCard
          data={{
            id: 'v1',
            type: 'video',
            channel: 'Tech Channel',
            duration: '10:30',
            title: 'Architecture Overview'
          }}
        />
      );
      expect(html).toContain('Video Result');
      expect(html).toContain('Tech Channel');
      expect(html).toContain('10:30');
      expect(html).toContain('Architecture Overview');
    });

    it('renders FileCard and CodeCard with syntax blocks', () => {
      const fileHtml = renderToStaticMarkup(
        <FileCard
          data={{
            id: 'f1',
            type: 'file',
            path: 'src/main.ts',
            fileType: 'ts',
            linesModified: 12,
            previewSnippet: '+ const x = 1;'
          }}
        />
      );
      expect(fileHtml).toContain('main.ts');
      expect(fileHtml).toContain('12 lines modified');
      expect(fileHtml).toContain('+ const x = 1;');

      const codeHtml = renderToStaticMarkup(
        <CodeCard
          data={{
            id: 'c1',
            type: 'code',
            language: 'typescript',
            code: 'export const mave = true;',
            filename: 'mave.ts'
          }}
        />
      );
      expect(codeHtml).toContain('typescript');
      expect(codeHtml).toContain('mave.ts');
      expect(codeHtml).toContain('export const mave = true;');
      expect(codeHtml).toContain('Copy Code');
    });

    it('renders TaskCard with progress bar and runtime badge', () => {
      const html = renderToStaticMarkup(
        <TaskCard
          data={{
            id: 'tk1',
            type: 'task',
            taskName: 'Refactor surface components',
            status: 'running',
            progressPercent: 65,
            currentStep: 'Generating AST patches',
            responsibleRuntime: 'MAVE • Agent'
          }}
        />
      );
      expect(html).toContain('Refactor surface components');
      expect(html).toContain('65%');
      expect(html).toContain('Generating AST patches');
      expect(html).toContain('MAVE • Agent');
    });

    it('renders ApprovalCard with M5 Risk Level, command, and Allow/Deny buttons', () => {
      const html = renderToStaticMarkup(
        <ApprovalCard
          data={{
            id: 'app1',
            type: 'approval',
            actionRequested: 'Delete git branch',
            riskLevel: 'Level 3 — Destructive',
            riskClass: 'destructive',
            command: 'git branch -D feat/test',
            directory: 'D:\\project\\MAVE'
          }}
          onAllow={() => {}}
          onDeny={() => {}}
        />
      );
      expect(html).toContain('Action Approval Required');
      expect(html).toContain('Level 3 — Destructive');
      expect(html).toContain('git branch -D feat/test');
      expect(html).toContain('Confirm Destructive Action');
      expect(html).toContain('Deny');
    });

    it('renders ErrorCard with diagnostic message and retry option', () => {
      const html = renderToStaticMarkup(
        <ErrorCard
          data={{
            id: 'e1',
            type: 'error',
            title: 'Connection Lost',
            errorMessage: 'Local daemon unreachable',
            recoverable: true,
            suggestedAction: 'Retry'
          }}
          onRetry={() => {}}
        />
      );
      expect(html).toContain('Connection Lost');
      expect(html).toContain('Local daemon unreachable');
      expect(html).toContain('Retry');
    });

    it('CardRenderer dispatches correctly across card union', () => {
      const cards: UiV2Card[] = [
        { id: '1', type: 'message', role: 'user', content: 'test msg' },
        { id: '2', type: 'translation', targetLanguage: 'TH', originalText: 'hi', translatedText: 'สวัสดี' },
        { id: '3', type: 'source', domain: 'example.com', title: 'Ex', url: 'https://ex.com', snippet: 'snip' },
        { id: '4', type: 'video', channel: 'Ch', duration: '5:00', title: 'Vid' },
        { id: '5', type: 'file', path: 'a.txt', fileType: 'txt' },
        { id: '6', type: 'code', language: 'js', code: 'x = 1' },
        { id: '7', type: 'task', taskName: 'T', status: 'completed' },
        { id: '8', type: 'approval', actionRequested: 'Act', riskLevel: 'Level 1 — Safe Local', riskClass: 'safe_local' },
        { id: '9', type: 'error', errorMessage: 'Err' }
      ];

      for (const card of cards) {
        const html = renderToStaticMarkup(<CardRenderer card={card} />);
        expect(html.length).toBeGreaterThan(0);
      }
    });
  });

  describe('Presence Surface Component', () => {
    it('renders compact capsule with state labels', () => {
      const html = renderToStaticMarkup(
        <PresenceSurface state="listening" audioLevel={0.75} />
      );
      expect(html).toContain('data-testid="presence-surface"');
      expect(html).toContain('Listening…');
      expect(html).toContain('data-state="listening"');
    });

    it('renders quick response bubble above capsule when present', () => {
      const html = renderToStaticMarkup(
        <PresenceSurface
          state="speaking"
          quickResponse={{
            text: 'Temperature is 28C today',
            sourceLabel: 'Weather Service'
          }}
        />
      );
      expect(html).toContain('data-testid="presence-quick-response"');
      expect(html).toContain('Temperature is 28C today');
      expect(html).toContain('Weather Service');
    });
  });

  describe('Conversation Shell & Chat-Only Mode', () => {
    it('renders conversation shell with timeline, shortcuts, and composer', () => {
      const html = renderToStaticMarkup(
        <ConversationShell
          state={{
            status: 'idle',
            messages: [{ id: 'm1', type: 'message', role: 'user', content: 'Hello' }],
            cards: [],
            suggestedShortcuts: ['Search', 'Analyze', 'Code']
          }}
        />
      );
      expect(html).toContain('data-testid="conversation-shell"');
      expect(html).toContain('data-testid="conversation-timeline"');
      expect(html).toContain('data-testid="conversation-composer-input"');
      expect(html).toContain('Search');
      expect(html).toContain('Analyze');
      expect(html).toContain('Code');
    });

    it('renders ChatOnlyPanel with narrow right-docked layout container', () => {
      const html = renderToStaticMarkup(
        <ChatOnlyPanel
          state={{
            status: 'idle',
            messages: [],
            cards: []
          }}
        />
      );
      expect(html).toContain('data-testid="chat-only-panel"');
      expect(html).toContain('mave-v2-chat-only-panel');
    });

    it('displays observable progress banner when provided without fake steps', () => {
      const html = renderToStaticMarkup(
        <ConversationShell
          state={{
            status: 'streaming',
            observableProgressText: 'Reading 4 sources from filesystem…',
            messages: [],
            cards: []
          }}
        />
      );
      expect(html).toContain('data-testid="observable-progress-banner"');
      expect(html).toContain('Reading 4 sources from filesystem…');
    });
  });

  describe('Workspace Shell & Contextual Experiences', () => {
    it('renders AgentWorkspaceView with plan decomposition and target files', () => {
      const html = renderToStaticMarkup(
        <AgentWorkspaceView
          state={{
            type: 'agent',
            title: 'Migration Agent',
            status: 'running',
            currentObjective: 'Migrate legacy workflows',
            steps: [
              { id: '1', label: 'Scan files', status: 'completed' },
              { id: '2', label: 'Generate markdown', status: 'active' }
            ],
            files: [{ path: 'workflow.ts', status: 'modified' }]
          }}
        />
      );
      expect(html).toContain('data-testid="agent-workspace-view"');
      expect(html).toContain('Migrate legacy workflows');
      expect(html).toContain('Scan files');
      expect(html).toContain('COMPLETED');
      expect(html).toContain('Generate markdown');
      expect(html).toContain('ACTIVE');
      expect(html).toContain('workflow.ts');
    });

    it('renders LanguageWorkspaceView treating language as an experience, not global branding', () => {
      const html = renderToStaticMarkup(
        <LanguageWorkspaceView
          state={{
            type: 'language',
            title: 'Japanese Practice',
            status: 'running',
            steps: [{ id: '1', label: 'Speaking practice', status: 'active' }],
            languageContext: {
              targetLanguage: 'Japanese',
              mode: 'Conversational',
              naturalPhrasing: 'Natural phrasing example',
              vocabulary: [{ term: 'こんにちは', meaning: 'Hello' }]
            }
          }}
        />
      );
      expect(html).toContain('data-testid="language-workspace-view"');
      expect(html).toContain('Speaking Session • Japanese');
      expect(html).toContain('Natural Suggestion');
      expect(html).toContain('Session Vocabulary Recap');
      expect(html).toContain('こんにちは');
      // Must NOT contain global branding "Your AI language assistant"
      expect(html).not.toContain('Your AI language assistant');
    });

    it('WorkspaceShell dispatches correctly to workspace views based on type', () => {
      const agentHtml = renderToStaticMarkup(
        <WorkspaceShell
          state={{
            type: 'agent',
            title: 'Agent Task',
            status: 'running',
            steps: []
          }}
        />
      );
      expect(agentHtml).toContain('data-testid="agent-workspace-view"');

      const languageHtml = renderToStaticMarkup(
        <WorkspaceShell
          state={{
            type: 'language',
            title: 'Language Session',
            status: 'running',
            steps: []
          }}
        />
      );
      expect(languageHtml).toContain('data-testid="language-workspace-view"');
    });
  });

  describe('UI Lab & Mock Scenarios', () => {
    it('all 12 mock scenarios are defined and valid', () => {
      expect(MOCK_SCENARIOS.length).toBeGreaterThanOrEqual(12);

      const expectedIds = [
        '01_presence_idle',
        '02_presence_listening',
        '03_presence_speaking',
        '04_quick_response',
        '05_chat_only',
        '06_chat_video',
        '07_chat_sources',
        '08_conversation_streaming',
        '09_workspace_agent_running',
        '10_workspace_waiting_approval',
        '11_language_practice',
        '12_error_offline'
      ];

      for (const id of expectedIds) {
        const found = MOCK_SCENARIOS.find((s) => s.id === id);
        expect(found).toBeDefined();
        expect(found!.snapshot).toBeDefined();
      }
    });

    it('MaveUiLab harness renders sidebar scenario buttons and preview canvas', () => {
      const html = renderToStaticMarkup(<MaveUiLab />);
      expect(html).toContain('data-testid="mave-ui-lab-root"');
      expect(html).toContain('data-testid="scenario-list"');
      expect(html).toContain('01 Presence Idle');
      expect(html).toContain('12 Error / Offline');
      expect(html).toContain('[MOCK PREVIEW]');
    });
  });
});
