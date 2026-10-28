import fs from 'node:fs/promises';
import path from 'node:path';
import { z } from 'zod';
import { ToolExecutionError, type ToolDefinition } from '../types.js';
import type { WorkspaceScope } from '../workspace.js';

const MAX_ENTRIES = 200;
const MAX_READ_BYTES = 64 * 1024;
const SECRET_FILE = /(^|[\\/])(\.env(\.[\w-]+)?|id_rsa|id_ed25519|.*\.pem|.*\.key|credentials(\.json)?)$/i;

export function createListDirectoryTool(scope: WorkspaceScope): ToolDefinition<{ path: string }> {
  return {
    id: 'fs.list_directory',
    title: 'List folder',
    description: "List files and folders inside MAVE's allowed folders.",
    riskLevel: 'read_only',
    timeoutMs: 10_000,
    argsHint: { path: 'folder path (default: main project folder)' },
    argsSchema: z.object({ path: z.string().trim().max(1024).default('.') }).strict(),
    block(args) {
      return guard(scope, args.path);
    },
    summarize(args) {
      return `List ${scope.resolve(args.path)}`;
    },
    async execute(args) {
      const dir = scope.require(args.path);
      const entries = await fs.readdir(dir, { withFileTypes: true });
      const visible = entries
        .filter((e) => e.name !== 'node_modules' && e.name !== '.git')
        .sort((a, b) => Number(b.isDirectory()) - Number(a.isDirectory()) || a.name.localeCompare(b.name));
      const shown = visible.slice(0, MAX_ENTRIES).map((e) => (e.isDirectory() ? `${e.name}/` : e.name));
      const more = visible.length > MAX_ENTRIES ? `\n… and ${visible.length - MAX_ENTRIES} more` : '';
      return {
        output: `${dir}\n${shown.join('\n')}${more}`,
        data: { path: dir, entries: shown, total: visible.length }
      };
    }
  };
}

export function createReadTextFileTool(scope: WorkspaceScope): ToolDefinition<{ path: string }> {
  return {
    id: 'fs.read_text_file',
    title: 'Read file',
    description: "Read a text file (first 64 KB) inside MAVE's allowed folders. Secret files are refused.",
    riskLevel: 'read_only',
    timeoutMs: 10_000,
    argsHint: { path: 'file path' },
    argsSchema: z.object({ path: z.string().trim().min(1).max(1024) }).strict(),
    block(args) {
      const scoped = guard(scope, args.path);
      if (scoped) return scoped;
      if (SECRET_FILE.test(scope.resolve(args.path))) {
        return 'MAVE does not read secret files (.env, keys, credentials).';
      }
      return undefined;
    },
    summarize(args) {
      return `Read ${scope.resolve(args.path)}`;
    },
    async execute(args) {
      const file = scope.require(args.path);
      const handle = await fs.open(file, 'r');
      try {
        const stat = await handle.stat();
        if (stat.isDirectory()) throw new ToolExecutionError(`${file} is a folder`);
        const buffer = Buffer.alloc(Math.min(stat.size, MAX_READ_BYTES));
        await handle.read(buffer, 0, buffer.length, 0);
        if (buffer.includes(0)) throw new ToolExecutionError(`${path.basename(file)} looks like a binary file`);
        const text = buffer.toString('utf-8');
        const note = stat.size > MAX_READ_BYTES ? `\n… (showing first 64 KB of ${stat.size} bytes)` : '';
        return { output: text + note, data: { path: file, bytes: stat.size } };
      } finally {
        await handle.close();
      }
    }
  };
}

function guard(scope: WorkspaceScope, target: string): string | undefined {
  try {
    scope.require(target);
    return undefined;
  } catch (err) {
    return err instanceof Error ? err.message : String(err);
  }
}
