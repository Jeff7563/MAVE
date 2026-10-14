#!/usr/bin/env node
import { OllamaBrainProvider } from '@mave/providers';

async function runLiveSmoke() {
  console.log('================================================================');
  console.log(' MAVE PRE-M5 — F1.5-C2 LIVE QUALIFICATION SMOKE                 ');
  console.log('================================================================\n');

  const provider = new OllamaBrainProvider({ defaultNumCtx: 4096 });
  const modelTag = 'qwen2.5:1.5b';
  const normalizedId = 'ollama-qwen2.5-1.5b';

  console.log(`Testing Live Qualification Smoke on Winner: ${modelTag} (${normalizedId})\n`);

  const tests = [
    { name: 'Thai Conversational Greeting', prompt: 'สวัสดี MAVE วันนี้เป็นยังไงบ้าง' },
    { name: 'English Short Advice', prompt: "Hey MAVE, what's a good 5-minute stretch routine?" },
    { name: 'Language Learning (Bilingual Correction)', prompt: "ถ้าผมจะพูดว่า 'She don't know nothing' มันผิดตรงไหนบ้าง ช่วยแก้ให้หน่อย" },
    { name: 'Voice Conciseness Constraint', prompt: 'สรุปประโยชน์ของวิตามินซีใน 1 ประโยคสั้นๆ' }
  ];

  for (const t of tests) {
    console.log(`[Test] ${t.name}`);
    console.log(`Prompt: "${t.prompt}"`);

    const t0 = performance.now();
    let ttft = 0;
    let full = '';

    const stream = provider.chat({
      requestId: `smoke-${Date.now()}`,
      sessionId: `smoke-sess-${Date.now()}`,
      intent: 'conversation',
      messages: [{ role: 'user', content: t.prompt }]
    }, {
      modelId: normalizedId,
      maxTokens: 150,
      temperature: 0.7
    });

    for await (const ev of stream) {
      if (ev.type === 'delta') {
        if (ttft === 0) ttft = performance.now() - t0;
        full += ev.text;
      }
    }
    const totalMs = performance.now() - t0;

    console.log(`TTFT: ${Math.round(ttft)}ms | Total: ${Math.round(totalMs)}ms`);
    console.log(`Response:\n${full.trim()}\n`);
    console.log('----------------------------------------------------------------\n');
  }

  // Unload after smoke
  await fetch('http://127.0.0.1:11434/api/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: modelTag, keep_alive: 0 })
  });
  console.log('Live qualification smoke completed; model unloaded.');
}

runLiveSmoke().catch(console.error);

