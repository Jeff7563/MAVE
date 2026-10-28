import { z } from 'zod';
import { blockedCommandReason, classifyCommandRisk } from '../command-safety.js';
import { ToolExecutionError, type ToolDefinition } from '../types.js';
import type { WorkspaceScope } from '../workspace.js';

interface RunCommandArgs {
  command: string;
  cwd: string;
}

/** Build the argv that runs a command line through the platform shell. */
export function shellInvocation(platform: NodeJS.Platform, command: string): { file: string; args: string[]; verbatim: boolean } {
  if (platform === 'win32') {
    // `cmd /d /s /c "<command>"` — /s strips the outer quotes and keeps the rest verbatim.
    return { file: 'cmd.exe', args: ['/d', '/s', '/c', `"${command}"`], verbatim: true };
  }
  return { file: '/bin/sh', args: ['-c', command], verbatim: false };
}

export function createRunCommandTool(scope: WorkspaceScope): ToolDefinition<RunCommandArgs> {
  return {
    id: 'terminal.run_command',
    title: 'Run terminal command',
    description:
      'Run a shell command inside an allowed project folder. Read-only/test commands run directly; anything else asks first; destructive commands always ask.',
    riskLevel: 'safe_local',
    timeoutMs: 10 * 60 * 1000,
    argsHint: { command: 'e.g. "pnpm test" or "git status"', cwd: 'folder (default: main project folder)' },
    argsSchema: z
      .object({
        command: z.string().trim().min(1).max(4000),
        cwd: z.string().trim().max(1024).default('.')
      })
      .strict(),
    classifyRisk(args) {
      return classifyCommandRisk(args.command);
    },
    block(args) {
      const blocked = blockedCommandReason(args.command);
      if (blocked) return blocked;
      try {
        scope.require(args.cwd);
        return undefined;
      } catch (err) {
        return err instanceof Error ? err.message : String(err);
      }
    },
    summarize(args) {
      return `Run "${args.command}" in ${scope.resolve(args.cwd)}`;
    },
    async execute(args, ctx) {
      const cwd = scope.require(args.cwd);
      const shell = shellInvocation(ctx.system.platform, args.command);
      const result = await ctx.system.run(shell.file, shell.args, {
        cwd,
        signal: ctx.signal,
        windowsVerbatimArguments: shell.verbatim,
        onLine: (line) => ctx.progress(line)
      });
      if (result.cancelled) throw new ToolExecutionError('Cancelled');
      const tail = (text: string) => (text.length > 4000 ? `…${text.slice(-4000)}` : text);
      const output = [tail(result.stdout.trim()), tail(result.stderr.trim())].filter(Boolean).join('\n');
      if (result.exitCode !== 0) {
        throw new ToolExecutionError(`Exited with code ${result.exitCode}${output ? `\n${output}` : ''}`);
      }
      return {
        output: output || '(no output)',
        data: { exitCode: result.exitCode, truncated: result.truncated, cwd }
      };
    }
  };
}

export function createGitStatusTool(scope: WorkspaceScope): ToolDefinition<{ cwd: string }> {
  return {
    id: 'git.status',
    title: 'Git status',
    description: 'Show the current branch and changed files of a repository in an allowed folder.',
    riskLevel: 'read_only',
    timeoutMs: 20_000,
    argsHint: { cwd: 'repository folder (default: main project folder)' },
    argsSchema: z.object({ cwd: z.string().trim().max(1024).default('.') }).strict(),
    block(args) {
      try {
        scope.require(args.cwd);
        return undefined;
      } catch (err) {
        return err instanceof Error ? err.message : String(err);
      }
    },
    summarize(args) {
      return `git status in ${scope.resolve(args.cwd)}`;
    },
    async execute(args, ctx) {
      const cwd = scope.require(args.cwd);
      const result = await ctx.system.run('git', ['status', '--short', '--branch'], { cwd, signal: ctx.signal });
      if (result.exitCode !== 0) {
        throw new ToolExecutionError(result.stderr.trim() || `git exited with code ${result.exitCode}`);
      }
      return { output: result.stdout.trim() || 'Working tree clean', data: { cwd } };
    }
  };
}
