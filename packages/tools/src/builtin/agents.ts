import { z } from 'zod';
import { ToolExecutionError, type ToolDefinition } from '../types.js';
import type { WorkspaceScope } from '../workspace.js';
import { shellInvocation } from './terminal.js';

/**
 * Delegation to coding agent CLIs the user already has installed and signed in
 * to (official CLIs only — no token reuse). The task text goes through stdin so
 * it never needs shell quoting.
 */
export type AgentMode = 'plan' | 'edit';

export interface CodingAgentDefinition {
  id: string;
  title: string;
  aliases: string[];
  /** Command line (without the task) per mode. */
  commandFor(mode: AgentMode): string;
  /** How to read stdout. */
  output: 'text' | 'antigravity-stream-json';
  /** Build stdin payload from the task text. */
  stdinFor?(task: string): string;
}

export const DEFAULT_CODING_AGENTS: CodingAgentDefinition[] = [
  {
    id: 'claude',
    title: 'Claude Code',
    aliases: ['claude', 'claude code', 'คล็อด', 'คลอด'],
    // Headless print mode. plan = read-only analysis, acceptEdits = may edit files in cwd.
    commandFor: (mode) =>
      `claude -p --output-format text --permission-mode ${mode === 'edit' ? 'acceptEdits' : 'plan'}`,
    output: 'text'
  },
  {
    id: 'codex',
    title: 'Codex CLI',
    aliases: ['codex', 'โคเด็กซ์', 'โค้ดเด็กซ์'],
    // `-` reads the prompt from stdin.
    commandFor: (mode) =>
      `codex exec --skip-git-repo-check --sandbox ${mode === 'edit' ? 'workspace-write' : 'read-only'} -`,
    output: 'text'
  },
  {
    id: 'antigravity',
    title: 'Antigravity',
    aliases: ['antigravity', 'agy', 'แอนตี้กราวิตี้', 'แอนติกราวิตี้'],
    // Same official stream-json protocol as AntigravityBrainProvider. Edit mode drops --sandbox.
    commandFor: (mode) =>
      `agy --input-format stream-json --output-format stream-json --disable-slash-commands${mode === 'edit' ? '' : ' --sandbox'}`,
    output: 'antigravity-stream-json',
    stdinFor: (task) => `${JSON.stringify({ event: 'user', message: { content: task } })}\n`
  }
];

export function findCodingAgent(name: string, agents: CodingAgentDefinition[] = DEFAULT_CODING_AGENTS): CodingAgentDefinition | undefined {
  const n = name.trim().toLowerCase();
  return agents.find((a) => a.id === n || a.aliases.includes(n));
}

interface DelegateArgs {
  agent: string;
  task: string;
  cwd: string;
  mode: AgentMode;
}

export function createDelegateAgentTool(
  scope: WorkspaceScope,
  agents: CodingAgentDefinition[] = DEFAULT_CODING_AGENTS
): ToolDefinition<DelegateArgs> {
  return {
    id: 'agent.delegate',
    title: 'Ask a coding agent',
    description: `Hand a coding or project task to a coding agent CLI (${agents.map((a) => a.id).join(', ')}). mode "plan" only reads and answers; mode "edit" may change files in the folder.`,
    // Plan mode still sends project content to a cloud agent and edit mode changes
    // files, so both ask first (unless granted for the session).
    riskLevel: 'external_side_effect',
    timeoutMs: 30 * 60 * 1000,
    argsHint: {
      agent: agents.map((a) => a.id).join(' | '),
      task: 'what the agent should do',
      cwd: 'project folder (default: main project folder)',
      mode: '"plan" (read-only, default) or "edit"'
    },
    argsSchema: z
      .object({
        agent: z.string().trim().min(1).max(50),
        task: z.string().trim().min(1).max(8000),
        cwd: z.string().trim().max(1024).default('.'),
        mode: z.enum(['plan', 'edit']).default('plan')
      })
      .strict(),
    block(args) {
      if (!findCodingAgent(args.agent, agents)) {
        return `Unknown coding agent "${args.agent}". Available: ${agents.map((a) => a.id).join(', ')}`;
      }
      try {
        scope.require(args.cwd);
        return undefined;
      } catch (err) {
        return err instanceof Error ? err.message : String(err);
      }
    },
    summarize(args) {
      const agent = findCodingAgent(args.agent, agents);
      const verb = args.mode === 'edit' ? 'work on (may edit files)' : 'look at (read-only)';
      return `Ask ${agent?.title ?? args.agent} to ${verb} ${scope.resolve(args.cwd)}: "${truncate(args.task, 160)}"`;
    },
    async execute(args, ctx) {
      const agent = findCodingAgent(args.agent, agents);
      if (!agent) throw new ToolExecutionError(`Unknown agent ${args.agent}`);
      const cwd = scope.require(args.cwd);
      const shell = shellInvocation(ctx.system.platform, agent.commandFor(args.mode));
      ctx.progress(`${agent.title} started in ${cwd}`);

      const env = { ...process.env };
      // Billing safety (same as AntigravityBrainProvider): use the signed-in subscription, not stray API keys.
      delete env['GEMINI_API_KEY'];
      delete env['GOOGLE_GEMINI_BASE_URL'];

      let finalText = '';
      const result = await ctx.system.run(shell.file, shell.args, {
        cwd,
        env,
        signal: ctx.signal,
        windowsVerbatimArguments: shell.verbatim,
        stdin: agent.stdinFor ? agent.stdinFor(args.task) : args.task,
        maxOutputBytes: 256 * 1024,
        onLine: (line, stream) => {
          if (agent.output === 'antigravity-stream-json' && stream === 'stdout') {
            const parsed = parseAntigravityLine(line);
            if (parsed.progress) ctx.progress(parsed.progress);
            if (parsed.final !== undefined) finalText = parsed.final;
          } else if (stream === 'stdout') {
            ctx.progress(truncate(line, 300));
          }
        }
      });
      if (result.cancelled) throw new ToolExecutionError('Cancelled');
      if (result.exitCode !== 0) {
        const detail = (result.stderr || result.stdout).trim().slice(-2000);
        throw new ToolExecutionError(
          `${agent.title} exited with code ${result.exitCode}${detail ? `: ${detail}` : ''}. Is the ${agent.id} CLI installed and signed in?`
        );
      }
      const text = agent.output === 'text' ? result.stdout.trim() : finalText.trim();
      return {
        output: text || `${agent.title} finished with no text output`,
        data: { agent: agent.id, mode: args.mode, cwd }
      };
    }
  };
}

function parseAntigravityLine(line: string): { progress?: string; final?: string } {
  try {
    const event = JSON.parse(line) as {
      event?: string;
      step_update?: { step_type?: string; state?: string };
      result?: { status?: string; response?: string; error?: unknown };
    };
    if (event.event === 'step_update' && event.step_update?.step_type === 'tool') {
      return { progress: `tool step ${event.step_update.state ?? ''}`.trim() };
    }
    if (event.event === 'result' && event.result) {
      if (event.result.status && event.result.status !== 'SUCCESS') {
        return { final: `Antigravity finished with status ${event.result.status}` };
      }
      return { final: event.result.response ?? '' };
    }
  } catch {
    // non-JSON line: ignore
  }
  return {};
}

function truncate(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}
