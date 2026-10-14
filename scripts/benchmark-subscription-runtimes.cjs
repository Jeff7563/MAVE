const { spawn } = require('node:child_process');

async function measureClaude(model, runIndex) {
  const t0 = Date.now();
  let tInit = 0;
  let tFirstToken = 0;
  let tResult = 0;
  let tokens = 0;
  let text = '';
  let rateLimit = null;
  let reportedModel = '';
  let cliTtft = 0;

  return new Promise((resolve) => {
    const args = [
      '-p', 'Say the word OK only.',
      '--verbose',
      '--tools', '',
      '--safe-mode',
      '--output-format', 'stream-json',
      '--include-partial-messages',
      '--no-session-persistence'
    ];
    if (model) {
      args.push('--model', model);
    }

    const cleanEnv = { ...process.env };
    delete cleanEnv['ANTHROPIC_API_KEY'];
    delete cleanEnv['ANTHROPIC_AUTH_TOKEN'];
    delete cleanEnv['ANTHROPIC_BASE_URL'];
    delete cleanEnv['CLAUDE_API_KEY'];

    const child = spawn('claude', args, {
      stdio: ['ignore', 'pipe', 'pipe'],
      env: cleanEnv
    });

    let stdoutRemainder = '';

    child.stdout.on('data', (chunk) => {
      stdoutRemainder += chunk.toString();
      const lines = stdoutRemainder.split('\n');
      stdoutRemainder = lines.pop() ?? '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        try {
          const parsed = JSON.parse(trimmed);
          if (parsed.type === 'system' && parsed.subtype === 'init') {
            tInit = Date.now() - t0;
            reportedModel = parsed.model || '';
          } else if (parsed.type === 'stream_event') {
            const ev = parsed.event;
            if (ev?.type === 'content_block_delta' && ev?.delta?.type === 'text_delta') {
              if (tFirstToken === 0) {
                tFirstToken = Date.now() - t0;
              }
              tokens++;
              text += ev.delta.text || '';
            }
          } else if (parsed.type === 'rate_limit_event') {
            rateLimit = parsed.rate_limit_info;
          } else if (parsed.type === 'result') {
            tResult = Date.now() - t0;
            if (parsed.ttft_ms) cliTtft = parsed.ttft_ms;
            if (!text && parsed.result) text = parsed.result;
          }
        } catch {}
      }
    });

    child.on('close', (code) => {
      const tTotal = Date.now() - t0;
      resolve({
        runtime: 'claude',
        requestedModel: model || 'default (sonnet)',
        resolvedModel: reportedModel,
        runIndex,
        code,
        tInitMs: tInit,
        tFirstTokenMs: tFirstToken || tResult,
        cliReportedTtftMs: cliTtft,
        tTotalMs: tTotal,
        text: text.trim(),
        rateLimitSummary: rateLimit ? `${rateLimit.rateLimitType}: util=${rateLimit.unifiedWindows?.five_hour?.utilization}` : 'none'
      });
    });
  });
}

async function run() {
  console.log('--- Starting Claude Code Benchmark ---');
  
  // 5 runs of Haiku
  console.log('\nBenchmarking Claude Code (haiku) - 5 runs:');
  const haikuRuns = [];
  for (let i = 1; i <= 5; i++) {
    process.stdout.write(`  Run ${i}... `);
    const res = await measureClaude('haiku', i);
    haikuRuns.push(res);
    console.log(`Init: ${res.tInitMs}ms, TTFT: ${res.tFirstTokenMs}ms (CLI: ${res.cliReportedTtftMs}ms), Total: ${res.tTotalMs}ms, Result: "${res.text}"`);
    await new Promise((r) => setTimeout(r, 800));
  }

  // 5 runs of Sonnet (default)
  console.log('\nBenchmarking Claude Code (sonnet) - 5 runs:');
  const sonnetRuns = [];
  for (let i = 1; i <= 5; i++) {
    process.stdout.write(`  Run ${i}... `);
    const res = await measureClaude('sonnet', i);
    sonnetRuns.push(res);
    console.log(`Init: ${res.tInitMs}ms, TTFT: ${res.tFirstTokenMs}ms (CLI: ${res.cliReportedTtftMs}ms), Total: ${res.tTotalMs}ms, Result: "${res.text}"`);
    await new Promise((r) => setTimeout(r, 800));
  }

  // 2 runs of Opus (careful with quota)
  console.log('\nBenchmarking Claude Code (opus) - 2 runs:');
  const opusRuns = [];
  for (let i = 1; i <= 2; i++) {
    process.stdout.write(`  Run ${i}... `);
    const res = await measureClaude('opus', i);
    opusRuns.push(res);
    console.log(`Init: ${res.tInitMs}ms, TTFT: ${res.tFirstTokenMs}ms (CLI: ${res.cliReportedTtftMs}ms), Total: ${res.tTotalMs}ms, Result: "${res.text}"`);
    await new Promise((r) => setTimeout(r, 800));
  }

  console.log('\n=== Summary Results ===');
  function avg(arr, key) {
    return Math.round(arr.reduce((s, x) => s + x[key], 0) / arr.length);
  }
  console.log(`Haiku:  Cold TTFT: ${haikuRuns[0].tFirstTokenMs}ms, Warm Avg TTFT: ${avg(haikuRuns.slice(1), 'tFirstTokenMs')}ms, Total Avg: ${avg(haikuRuns, 'tTotalMs')}ms`);
  console.log(`Sonnet: Cold TTFT: ${sonnetRuns[0].tFirstTokenMs}ms, Warm Avg TTFT: ${avg(sonnetRuns.slice(1), 'tFirstTokenMs')}ms, Total Avg: ${avg(sonnetRuns, 'tTotalMs')}ms`);
  console.log(`Opus:   Cold TTFT: ${opusRuns[0].tFirstTokenMs}ms, Warm Avg TTFT: ${opusRuns[1].tFirstTokenMs}ms, Total Avg: ${avg(opusRuns, 'tTotalMs')}ms`);
}

run().catch(console.error);

