import { describe, expect, it } from 'vitest';
import { parseActionBlocks, stripActionBlocksForDisplay, buildToolPromptSection } from '../action-protocol.js';
import { QuickCommandMatcher } from '../quick-commands.js';

const matcher = new QuickCommandMatcher();

describe('QuickCommandMatcher', () => {
  it.each([
    ['เปิดยูทูป', 'system.open_url', { url: 'https://www.youtube.com' }],
    ['เปิด youtube ให้หน่อยครับ', 'system.open_url', { url: 'https://www.youtube.com' }],
    ['Hey MAVE, open GitHub please', 'system.open_url', { url: 'https://github.com' }],
    ['ช่วยเปิด vscode หน่อย', 'system.launch_app', { app: 'vscode' }],
    ['open calculator', 'system.launch_app', { app: 'calculator' }],
    ['เปิดเครื่องคิดเลข', 'system.launch_app', { app: 'calculator' }],
    ['เปิด C:\\project\\MAVE', 'system.open_path', { path: 'C:\\project\\MAVE' }],
    ['เปิดโฟลเดอร์ C:\\project', 'system.open_path', { path: 'C:\\project' }],
    ['open example.com', 'system.open_url', { url: 'example.com' }],
    ['ค้นหา ราคาทองวันนี้', 'system.web_search', { query: 'ราคาทองวันนี้', engine: 'google' }],
    ['เปิดเพลง lofi ในยูทูป', 'system.web_search', { query: 'lofi', engine: 'youtube' }],
    ['play daft punk', 'system.web_search', { query: 'daft punk', engine: 'youtube' }],
    ['git status', 'git.status', {}],
    ['รันเทส', 'terminal.run_command', { command: 'pnpm test' }],
    ['run pnpm build', 'terminal.run_command', { command: 'pnpm build' }],
    ['ให้ claude ช่วยสรุปว่าโปรเจกต์ถึงไหนแล้ว', 'agent.delegate', { agent: 'claude', task: 'สรุปว่าโปรเจกต์ถึงไหนแล้ว', mode: 'plan' }],
    ['ask codex to fix the failing test', 'agent.delegate', { agent: 'codex', task: 'fix the failing test', mode: 'edit' }],
    ['สั่ง antigravity ไปเพิ่มปุ่ม settings', 'agent.delegate', { agent: 'antigravity', task: 'เพิ่มปุ่ม settings', mode: 'edit' }]
  ])('%s', (text, toolId, args) => {
    const match = matcher.match(text);
    expect(match?.request.toolId).toBe(toolId);
    expect(match?.request.args).toEqual(args);
    expect(match?.request.source).toBe('user');
  });

  it.each([
    'What does awkward mean?',
    'แปลประโยคนี้เป็นไทยหน่อย',
    'เปิดใจคุยกันหน่อย',
    'open the conversation about my week',
    'ให้กำลังใจหน่อย'
  ])('leaves normal conversation to the brain: %s', (text) => {
    expect(matcher.match(text)).toBeUndefined();
  });
});

describe('action protocol', () => {
  it('extracts action blocks and strips them from the answer', () => {
    const text = 'Sure, opening it now.\n```mave-action\n{"tool":"system.open_url","args":{"url":"https://youtube.com"},"reason":"asked"}\n```\n';
    const parsed = parseActionBlocks(text);
    expect(parsed.text).toBe('Sure, opening it now.');
    expect(parsed.actions).toEqual([
      { toolId: 'system.open_url', args: { url: 'https://youtube.com' }, source: 'brain', reason: 'asked' }
    ]);
    expect(parsed.errors).toEqual([]);
  });

  it('caps actions per answer and reports broken JSON', () => {
    const many = JSON.stringify([1, 2, 3, 4].map((i) => ({ tool: 'git.status', args: { cwd: String(i) } })));
    const parsed = parseActionBlocks(`a\n\`\`\`mave-action\n${many}\n\`\`\`\n\`\`\`mave-action\n{oops\n\`\`\``);
    expect(parsed.actions).toHaveLength(3);
    expect(parsed.errors.length).toBe(2);
  });

  it('hides half-streamed action blocks from live text', () => {
    expect(stripActionBlocksForDisplay('Opening\n```mave-action\n{"tool": "sys')).toBe('Opening');
  });

  it('builds a prompt section listing tools', () => {
    const section = buildToolPromptSection([
      { id: 'git.status', title: 'Git status', description: 'Show status.', riskLevel: 'read_only', timeoutMs: 1, argsHint: { cwd: 'folder' } }
    ]);
    expect(section).toContain('- git.status — Show status. Args: cwd: folder.');
    expect(section).toContain('```mave-action');
  });
});
