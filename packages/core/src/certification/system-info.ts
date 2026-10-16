// ============================================================================
// System Environment & Hardware Inspector (C3.1 / C4-B)
//
// Invariant: Non-destructive gathering ONLY.
// Must safely execute on Work PC where Ollama/GPU are not available.
// ============================================================================

import { execSync } from 'node:child_process';
import os from 'node:os';
import type { SystemEnvironmentInfo } from './types.js';
import { sampleNvidiaGpu } from './vram.js';

export interface SystemInfoDeps {
  readonly baseUrl?: string;
  readonly fetchFn?: typeof fetch;
  readonly execCommand?: (cmd: string) => string;
}

/**
 * Gathers system environment, hardware, runtime, and daemon status safely.
 */
export async function gatherSystemInfo(deps?: SystemInfoDeps): Promise<SystemEnvironmentInfo> {
  const baseUrl = deps?.baseUrl ?? 'http://127.0.0.1:11434';
  const fetchFn = deps?.fetchFn ?? fetch;
  const execFn =
    deps?.execCommand ??
    ((cmd: string) =>
      execSync(cmd, {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore'],
        timeout: 3000
      }));

  // 1. OS & CPU
  const cpus = os.cpus();
  const firstCpu = cpus[0];
  const cpuModel = firstCpu ? firstCpu.model.trim() : 'Unknown CPU';
  const cpuCores = cpus.length;
  const totalRamBytes = os.totalmem();
  const freeRamBytes = os.freemem();
  const totalRamGiB = Number((totalRamBytes / (1024 * 1024 * 1024)).toFixed(2));
  const freeRamGiB = Number((freeRamBytes / (1024 * 1024 * 1024)).toFixed(2));

  // 2. Node & pnpm version
  const nodeVersion = process.version;
  let pnpmVersion = 'unknown';
  try {
    pnpmVersion = execFn('pnpm -v').trim();
  } catch {}

  // 3. Git HEAD
  let gitHead = 'unknown';
  try {
    gitHead = execFn('git rev-parse HEAD').trim();
  } catch {}

  // 4. GPU info via nvidia-smi
  const gpuInfo = sampleNvidiaGpu({ phase: 'BASELINE', execCommand: execFn });

  // 5. Ollama version & health
  let ollamaVersion: string | undefined;
  let ollamaHealthy = false;

  try {
    const versionRes = await fetchFn(`${baseUrl}/api/version`, {
      method: 'GET',
      headers: { Accept: 'application/json' }
    });
    if (versionRes.ok) {
      const vData = (await versionRes.json()) as { version?: string };
      ollamaVersion = vData.version;
    }
  } catch {}

  try {
    const tagsRes = await fetchFn(`${baseUrl}/api/tags`, {
      method: 'GET',
      headers: { Accept: 'application/json' }
    });
    ollamaHealthy = tagsRes.ok;
  } catch {}

  return {
    os: `${os.type()} ${os.release()}`,
    platform: os.platform(),
    arch: os.arch(),
    cpuModel,
    cpuCores,
    totalRamBytes,
    totalRamGiB,
    freeRamGiB,
    nodeVersion,
    pnpmVersion,
    gitHead,
    gpuInfo,
    ollamaVersion,
    ollamaHealthy
  };
}

/**
 * Formats SystemEnvironmentInfo for console/log display.
 */
export function formatSystemInfo(info: SystemEnvironmentInfo): string {
  const gpuStatus = info.gpuInfo.available
    ? `${info.gpuInfo.totalMiB.toFixed(0)} MiB Total, ${info.gpuInfo.usedMiB.toFixed(0)} MiB Used (${info.gpuInfo.utilizationGpuPct}% util)`
    : `UNAVAILABLE (${info.gpuInfo.error ?? 'nvidia-smi not found'})`;

  return [
    `OS:             ${info.os} (${info.platform} ${info.arch})`,
    `CPU:            ${info.cpuModel} (${info.cpuCores} cores)`,
    `RAM:            ${info.totalRamGiB} GiB total, ${info.freeRamGiB} GiB free`,
    `Node / pnpm:    Node ${info.nodeVersion} / pnpm ${info.pnpmVersion}`,
    `Git HEAD:       ${info.gitHead}`,
    `GPU (NVIDIA):   ${gpuStatus}`,
    `Ollama:         ${info.ollamaHealthy ? `HEALTHY (v${info.ollamaVersion ?? 'unknown'})` : 'UNAVAILABLE / NOT RUNNING'}`
  ].join('\n');
}
