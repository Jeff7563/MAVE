import { describe, expect, it } from 'vitest';
import type { BrainEvent } from '@mave/contracts';
import { ActionBrainProvider } from '../action-brain-provider.js';
import { createBuiltinTools } from '../builtin/index.js';
import { ToolExecutor } from '../executor.js';
import { QuickCommandMatcher } from '../quick-commands.js';
import { ToolRegistry } from '../registry.js';
import { StreamingActionFilter } from '../streaming-action-filter.js';
import { WorkspaceScope } from '../workspace.js';
import { FakeSystemAdapter } from './helpers.js';

function setup() {
  const registry = new ToolRegistry();
  registry.registerAll(createBuiltinTools({ scope: new WorkspaceScope(['/tmp']) }));
  const system = new FakeSystemAdapter('win32');
  const executor = new ToolExecutor({ registry, system });
  return { provider: new ActionBrainProvider(executor), system };
}

async function run(provider: ActionBrainProvider, requestId: string): Promise<BrainEvent[]> {
  const events: BrainEvent[] = [];
  for await (const e of provider.chat({ requestId, sessionId: 's', intent: 'conversation', messages: [{ role: 'user', content: 'x' }] })) {
    events.push(e);
  }
  return events;
}

describe('ActionBrainProvider', () => {
  it('runs a queued quick command and answers in Thai', async () => {
    const { provider, system } = setup();
    const text = 'เปิดยูทูปหน่อย';
    provider.enqueue('r1', new QuickCommandMatcher().match(text)!, text);
    const events = await run(provider, 'r1');
    expect(system.calls[0]?.target).toBe('https://www.youtube.com');
    const done = events.at(-1);
    expect(done?.type === 'completed' && done.text).toBe('เปิด YouTube แล้วครับ');
    expect(provider.hasPending('r1')).toBe(false);
  });

  it('answers in English and reports failures', async () => {
    const { provider } = setup();
    provider.enqueue('r2', { request: { toolId: 'system.launch_app', args: { app: 'nope' } }, acknowledgement: 'Opening nope' }, 'open nope');
    const events = await run(provider, 'r2');
    const done = events.at(-1);
    expect(done?.type === 'completed' && done.text).toMatch(/^I couldn’t do that/);
  });

  it('errors when nothing was queued', async () => {
    const { provider } = setup();
    const events = await run(provider, 'missing');
    expect(events.at(-1)?.type).toBe('error');
  });
});

describe('StreamingActionFilter', () => {
  it('never emits action blocks, even when split across deltas', () => {
    const filter = new StreamingActionFilter();
    const deltas = ['Sure, opening ', 'it now.\n`', '``mave-', 'action\n{"tool":"system.open_url",', '"args":{}}\n``', '`\nAnything else?'];
    const out = deltas.map((d) => filter.push(d)).join('');
    expect(out).not.toContain('mave-action');
    expect(out).not.toContain('`');
    expect(out).toContain('Sure, opening it now.');
    expect(out).toContain('Anything else?');
  });

  it('passes plain text through unchanged', () => {
    const filter = new StreamingActionFilter();
    expect(['Hel', 'lo ', 'world'].map((d) => filter.push(d)).join('')).toBe('Hello world');
  });

  it('lets ordinary code fences through', () => {
    const filter = new StreamingActionFilter();
    const out = ['Use ', '```ts\nconst a = 1;\n```', ' ok'].map((d) => filter.push(d)).join('');
    expect(out).toBe('Use ```ts\nconst a = 1;\n``` ok');
  });
});

describe('ActionBrainProvider background tools', () => {
  it('answers immediately for long tools and keeps them running after the turn', async () => {
    const { provider, system } = setup();
    system.runDelayMs = 50;
    system.runResult = { stdout: 'analysis done' };
    const text = 'ให้ claude ช่วยสรุปโปรเจกต์';
    const match = new QuickCommandMatcher().match(text)!;
    provider.enqueue('r3', match, text);
    // approval handler is missing in this setup → would deny; use a user-run safe command instead
    provider.enqueue('r4', new QuickCommandMatcher().match('git status')!, 'git status');
    const events = await run(provider, 'r3');
    const done = events.at(-1);
    expect(done?.type === 'completed' && done.text).toContain('ดูความคืบหน้า');
    await provider.drain();
    const gitEvents = await run(provider, 'r4');
    expect(gitEvents.at(-1)?.type).toBe('completed');
  });
});
