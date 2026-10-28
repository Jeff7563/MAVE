import { DEFAULT_APPS, DEFAULT_SITES, type AppEntry, type SiteEntry } from '../app-catalog.js';
import type { AnyToolDefinition } from '../types.js';
import type { WorkspaceScope } from '../workspace.js';
import { createDelegateAgentTool, DEFAULT_CODING_AGENTS, type CodingAgentDefinition } from './agents.js';
import { createListDirectoryTool, createReadTextFileTool } from './files.js';
import {
  createLaunchAppTool,
  createOpenPathTool,
  createOpenUrlTool,
  createWebSearchTool
} from './system.js';
import { createGitStatusTool, createRunCommandTool } from './terminal.js';

export interface BuiltinToolsOptions {
  scope: WorkspaceScope;
  apps?: AppEntry[];
  sites?: SiteEntry[];
  agents?: CodingAgentDefinition[];
}

export function createBuiltinTools(options: BuiltinToolsOptions): AnyToolDefinition[] {
  const apps = options.apps ?? DEFAULT_APPS;
  const sites = options.sites ?? DEFAULT_SITES;
  const agents = options.agents ?? DEFAULT_CODING_AGENTS;
  return [
    createOpenUrlTool(sites),
    createWebSearchTool(),
    createLaunchAppTool(apps),
    createOpenPathTool(options.scope),
    createListDirectoryTool(options.scope),
    createReadTextFileTool(options.scope),
    createGitStatusTool(options.scope),
    createRunCommandTool(options.scope),
    createDelegateAgentTool(options.scope, agents)
  ];
}

export * from './agents.js';
export * from './files.js';
export * from './system.js';
export * from './terminal.js';
