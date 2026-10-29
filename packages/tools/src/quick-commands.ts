import type { ToolCallRequestInput } from '@mave/contracts';
import { DEFAULT_APPS, DEFAULT_SITES, findApp, findSite, type AppEntry, type SiteEntry } from './app-catalog.js';
import { DEFAULT_CODING_AGENTS, findCodingAgent, type CodingAgentDefinition } from './builtin/agents.js';

/**
 * Deterministic Thai/English command matcher — the "fast path" for actions.
 * "เปิดยูทูป", "open vscode", "ค้นหา ราคาทอง", "ให้ claude ช่วยดูโปรเจกต์"
 * run instantly without waiting for a brain. Anything not matched goes to the brain.
 */

export interface QuickCommandMatch {
  request: ToolCallRequestInput;
  /** Short confirmation MAVE can say/show, e.g. "Opening YouTube". */
  acknowledgement: string;
}

export interface QuickCommandMatcherOptions {
  apps?: AppEntry[];
  sites?: SiteEntry[];
  agents?: CodingAgentDefinition[];
}

const WAKE_PREFIX = /^(hey\s+mave|ok\s+mave|mave|เมฟ|เฮ้\s*เมฟ)[\s,，]*/i;
const POLITE_PREFIX = /^(ช่วย|รบกวน|please|can you|could you|ขอ)\s*/i;
const POLITE_SUFFIX = /(\s*(ให้หน่อย|หน่อย|ด้วย|ให้ที|ที|ครับ|คับ|ค่ะ|คะ|นะ|จ้า|จ้ะ|please|for me|now|เลย))+[\s.!?]*$/i;

const OPEN_VERB = /^(เปิด|open|launch|start|run app|go to|ไปที่)\s*(.+)$/i;
const FOLDER_WORD = /^(โฟลเดอร์|folder|ไฟล์|file)\s*(.+)$/i;
const SEARCH_YT = /^(?:(?:ค้นหา|หา|search|search for|เปิดเพลง|play|เล่นเพลง|เปิดคลิป)\s*)(.+?)\s*(?:(?:ใน|บน|on|in)\s*(?:youtube|ยูทูป|ยูทูบ))$/i;
const PLAY_MUSIC = /^(?:เปิดเพลง|เล่นเพลง|play)\s*(.+)$/i;
const SEARCH = /^(?:ค้นหา|ค้น|search for|search|google|กูเกิล)\s*(.+)$/i;
const GIT_STATUS = /^(git status|สถานะ\s*git|เช็ค\s*git|เช็คกิต|ดู\s*git\s*status)$/i;
const RUN = /^(?:รันคำสั่ง|รัน|run command|run)\s+(.+)$/i;
const RUN_TESTS = /^(รันเทส|รันเทสต์|run tests?|run the tests?)$/i;
const AGENT = /^(?:ให้|บอก|สั่ง|ask|tell|use)\s*([a-z฀-๿ ]+?)\s*(?:ช่วย|ไป|to|:|,)\s*(.+)$/i;
const EDIT_VERBS = /(แก้|ซ่อม|เพิ่ม|สร้าง|เขียน|ทำ\s*(ฟีเจอร์|ระบบ)|implement|fix|add|build|create|write|refactor|edit|change|update)/i;

export class QuickCommandMatcher {
  private readonly apps: AppEntry[];
  private readonly sites: SiteEntry[];
  private readonly agents: CodingAgentDefinition[];

  constructor(options: QuickCommandMatcherOptions = {}) {
    this.apps = options.apps ?? DEFAULT_APPS;
    this.sites = options.sites ?? DEFAULT_SITES;
    this.agents = options.agents ?? DEFAULT_CODING_AGENTS;
  }

  match(rawText: string): QuickCommandMatch | undefined {
    const text = clean(rawText);
    if (!text || text.length > 500) return undefined;

    if (RUN_TESTS.test(text)) {
      return this.make('terminal.run_command', { command: 'pnpm test' }, 'Running the tests');
    }
    if (GIT_STATUS.test(text)) {
      return this.make('git.status', {}, 'Checking git status');
    }

    const agent = AGENT.exec(text);
    if (agent?.[1] && agent[2]) {
      const def = findCodingAgent(agent[1].trim(), this.agents);
      if (def) {
        const task = agent[2].trim();
        const mode = EDIT_VERBS.test(task) ? 'edit' : 'plan';
        return this.make('agent.delegate', { agent: def.id, task, mode }, `Asking ${def.title}`);
      }
    }

    const yt = SEARCH_YT.exec(text);
    if (yt?.[1]) {
      return this.make('system.web_search', { query: yt[1].trim(), engine: 'youtube' }, `Searching YouTube for ${yt[1].trim()}`);
    }
    const music = PLAY_MUSIC.exec(text);
    if (music?.[1]) {
      return this.make('system.web_search', { query: music[1].trim(), engine: 'youtube' }, `Playing ${music[1].trim()} on YouTube`);
    }

    const open = OPEN_VERB.exec(text);
    if (open?.[2]) {
      const target = clean(open[2]);
      const opened = this.resolveOpenTarget(target);
      if (opened) return opened;
    }

    const search = SEARCH.exec(text);
    if (search?.[1]) {
      return this.make('system.web_search', { query: search[1].trim(), engine: 'google' }, `Searching for ${search[1].trim()}`);
    }

    const run = RUN.exec(text);
    if (run?.[1]) {
      return this.make('terminal.run_command', { command: run[1].trim() }, `Running ${run[1].trim()}`);
    }

    return undefined;
  }

  private resolveOpenTarget(target: string): QuickCommandMatch | undefined {
    const folder = FOLDER_WORD.exec(target);
    if (folder?.[2] && looksLikePath(folder[2].trim())) {
      return this.make('system.open_path', { path: folder[2].trim() }, `Opening ${folder[2].trim()}`);
    }
    if (looksLikePath(target)) {
      return this.make('system.open_path', { path: target }, `Opening ${target}`);
    }
    const site = findSite(target, this.sites);
    if (site) return this.make('system.open_url', { url: site.url }, `Opening ${site.title}`);
    const app = findApp(target, this.apps);
    if (app) return this.make('system.launch_app', { app: app.id }, `Opening ${app.title}`);
    if (/^(https?:\/\/|www\.)\S+$/i.test(target) || /^[\w-]+(\.[\w-]+)+(\/\S*)?$/.test(target)) {
      return this.make('system.open_url', { url: target }, `Opening ${target}`);
    }
    return undefined;
  }

  private make(toolId: string, args: Record<string, unknown>, acknowledgement: string): QuickCommandMatch {
    return { request: { toolId, args, source: 'user' }, acknowledgement };
  }
}

function clean(text: string): string {
  let t = text.trim().replace(/\s+/g, ' ');
  t = t.replace(WAKE_PREFIX, '');
  t = t.replace(POLITE_PREFIX, '');
  t = t.replace(POLITE_SUFFIX, '');
  return t.trim().replace(/[.!?。]+$/u, '');
}

function looksLikePath(value: string): boolean {
  return /^([a-z]:[\\/]|\\\\|\/|~[\\/]|\.{1,2}[\\/])/i.test(value);
}
