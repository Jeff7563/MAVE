import { z } from 'zod';
import {
  appTargetFor,
  DEFAULT_APPS,
  DEFAULT_SITES,
  findApp,
  findSite,
  type AppEntry,
  type SiteEntry
} from '../app-catalog.js';
import { ToolExecutionError, type ToolDefinition } from '../types.js';
import type { WorkspaceScope } from '../workspace.js';

const ALLOWED_URI_SCHEMES = ['spotify:', 'discord:', 'line:', 'ms-settings:', 'mailto:', 'vscode:', 'zoommtg:'];

export function isOpenableUrl(value: string): boolean {
  try {
    const url = new URL(value);
    if (url.protocol === 'http:' || url.protocol === 'https:') return true;
    return ALLOWED_URI_SCHEMES.includes(url.protocol);
  } catch {
    return false;
  }
}

/** Accepts "youtube.com", "www.x.com/path" and turns them into https URLs. */
export function normalizeUrl(input: string): string {
  const value = input.trim();
  if (/^[a-z][a-z0-9+.-]*:/i.test(value)) return value;
  if (/^[\w-]+(\.[\w-]+)+(\/\S*)?$/.test(value)) return `https://${value}`;
  return value;
}

export function createOpenUrlTool(sites: SiteEntry[] = DEFAULT_SITES): ToolDefinition<{ url: string }> {
  return {
    id: 'system.open_url',
    title: 'Open website',
    description: 'Open a website (http/https) or a known site name like "youtube" in the default browser.',
    riskLevel: 'safe_local',
    timeoutMs: 10_000,
    argsHint: { url: 'https URL or a known site name (youtube, gmail, github...)' },
    argsSchema: z.object({ url: z.string().trim().min(1).max(2048) }).strict(),
    block(args) {
      const target = resolveSite(args.url, sites);
      return isOpenableUrl(target) ? undefined : `Not an http(s) link MAVE can open: ${args.url}`;
    },
    summarize(args) {
      return `Open ${resolveSite(args.url, sites)} in the browser`;
    },
    async execute(args, ctx) {
      const target = resolveSite(args.url, sites);
      await ctx.system.openExternal(target);
      return { output: `Opened ${target}`, data: { url: target } };
    }
  };
}

function resolveSite(value: string, sites: SiteEntry[]): string {
  const site = findSite(value, sites);
  return site ? site.url : normalizeUrl(value);
}

export function createWebSearchTool(): ToolDefinition<{ query: string; engine: 'google' | 'youtube' }> {
  return {
    id: 'system.web_search',
    title: 'Search the web',
    description: 'Open a Google or YouTube search for a query in the default browser.',
    riskLevel: 'safe_local',
    timeoutMs: 10_000,
    argsHint: { query: 'search text', engine: '"google" (default) or "youtube"' },
    argsSchema: z
      .object({
        query: z.string().trim().min(1).max(500),
        engine: z.enum(['google', 'youtube']).default('google')
      })
      .strict(),
    summarize(args) {
      return `Search ${args.engine === 'youtube' ? 'YouTube' : 'Google'} for "${args.query}"`;
    },
    async execute(args, ctx) {
      const q = encodeURIComponent(args.query);
      const url =
        args.engine === 'youtube'
          ? `https://www.youtube.com/results?search_query=${q}`
          : `https://www.google.com/search?q=${q}`;
      await ctx.system.openExternal(url);
      return { output: `Searching ${args.engine} for "${args.query}"`, data: { url } };
    }
  };
}

export function createOpenPathTool(scope: WorkspaceScope): ToolDefinition<{ path: string }> {
  return {
    id: 'system.open_path',
    title: 'Open file or folder',
    description: "Open a file or folder inside MAVE's allowed folders with its default app.",
    riskLevel: 'safe_local',
    timeoutMs: 10_000,
    argsHint: { path: 'absolute path, or relative to the main project folder' },
    argsSchema: z.object({ path: z.string().trim().min(1).max(1024) }).strict(),
    block(args) {
      try {
        scope.require(args.path);
        return undefined;
      } catch (err) {
        return err instanceof Error ? err.message : String(err);
      }
    },
    summarize(args) {
      return `Open ${scope.resolve(args.path)}`;
    },
    async execute(args, ctx) {
      const target = scope.require(args.path);
      await ctx.system.openPath(target);
      return { output: `Opened ${target}`, data: { path: target } };
    }
  };
}

export function createLaunchAppTool(apps: AppEntry[] = DEFAULT_APPS): ToolDefinition<{ app: string }> {
  return {
    id: 'system.launch_app',
    title: 'Open app',
    description: `Open a desktop app by name. Known apps: ${apps.map((a) => a.id).join(', ')}.`,
    riskLevel: 'safe_local',
    timeoutMs: 15_000,
    argsHint: { app: 'app name, e.g. "vscode", "chrome", "spotify", "เครื่องคิดเลข"' },
    argsSchema: z.object({ app: z.string().trim().min(1).max(200) }).strict(),
    block(args) {
      const entry = findApp(args.app, apps);
      if (!entry) return `MAVE doesn't know an app called "${args.app}" yet. Add it to the app catalog first.`;
      return undefined;
    },
    summarize(args) {
      const entry = findApp(args.app, apps);
      return `Open ${entry?.title ?? args.app}`;
    },
    async execute(args, ctx) {
      const entry = findApp(args.app, apps);
      if (!entry) throw new ToolExecutionError(`Unknown app: ${args.app}`);
      const target = appTargetFor(entry, ctx.system.platform);
      if (!target) throw new ToolExecutionError(`${entry.title} is not configured for this operating system`);
      if (target.startsWith('uri:')) {
        await ctx.system.openExternal(target.slice(4));
      } else {
        await ctx.system.launchApp(target);
      }
      return { output: `Opened ${entry.title}`, data: { app: entry.id } };
    }
  };
}
