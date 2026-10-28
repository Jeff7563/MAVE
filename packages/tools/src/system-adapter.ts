import { spawn, type ChildProcess, type SpawnOptions } from 'node:child_process';

export interface RunProcessOptions {
  cwd?: string;
  env?: NodeJS.ProcessEnv;
  signal?: AbortSignal;
  /** Data written to stdin, then stdin is closed. */
  stdin?: string;
  /** Called with each complete output line (stdout and stderr). */
  onLine?: (line: string, stream: 'stdout' | 'stderr') => void;
  /** Max bytes kept per stream. Default 64 KiB. */
  maxOutputBytes?: number;
  /** Windows only: pass args to the process without Node's quoting (needed for `cmd /s /c "..."`). */
  windowsVerbatimArguments?: boolean;
}

export interface RunProcessResult {
  exitCode: number | null;
  stdout: string;
  stderr: string;
  truncated: boolean;
  cancelled: boolean;
}

/**
 * Everything a tool needs from the operating system goes through this adapter,
 * so the desktop app can inject Electron's `shell` and tests can inject fakes.
 */
export interface SystemAdapter {
  readonly platform: NodeJS.Platform;
  /** Open an http(s) URL or app URI (e.g. spotify:, ms-settings:) with the default handler. */
  openExternal(target: string): Promise<void>;
  /** Open a file or folder with its default application / file explorer. */
  openPath(target: string): Promise<void>;
  /** Start an application detached from MAVE. */
  launchApp(command: string, args?: string[]): Promise<void>;
  /** Run a process to completion, capturing output. shell is always false. */
  run(command: string, args: string[], options?: RunProcessOptions): Promise<RunProcessResult>;
}

export type SpawnFn = (command: string, args: string[], options: SpawnOptions) => ChildProcess;

export interface NodeSystemAdapterOptions {
  platform?: NodeJS.Platform;
  spawnFn?: SpawnFn;
}

/** Default adapter based on child_process. Works on Windows, macOS and Linux. */
export class NodeSystemAdapter implements SystemAdapter {
  readonly platform: NodeJS.Platform;
  private readonly spawnFn: SpawnFn;

  constructor(options: NodeSystemAdapterOptions = {}) {
    this.platform = options.platform ?? process.platform;
    this.spawnFn = options.spawnFn ?? spawn;
  }

  async openExternal(target: string): Promise<void> {
    await this.detached(...this.openerFor(target));
  }

  async openPath(target: string): Promise<void> {
    await this.detached(...this.openerFor(target));
  }

  async launchApp(command: string, args: string[] = []): Promise<void> {
    if (this.platform === 'win32') {
      // Start-Process resolves App Paths (chrome, code, spotify...) like the Run dialog,
      // without going through cmd.exe parsing. Values are single-quoted PowerShell literals.
      const argList = args.length ? ` -ArgumentList ${args.map(psQuote).join(',')}` : '';
      await this.detached('powershell.exe', [
        '-NoProfile',
        '-NonInteractive',
        '-WindowStyle',
        'Hidden',
        '-Command',
        `Start-Process -FilePath ${psQuote(command)}${argList}`
      ]);
      return;
    }
    if (this.platform === 'darwin' && !command.includes('/')) {
      await this.detached('open', ['-a', command, ...(args.length ? ['--args', ...args] : [])]);
      return;
    }
    await this.detached(command, args);
  }

  run(command: string, args: string[], options: RunProcessOptions = {}): Promise<RunProcessResult> {
    const maxBytes = options.maxOutputBytes ?? 64 * 1024;
    return new Promise((resolve, reject) => {
      if (options.signal?.aborted) {
        resolve({ exitCode: null, stdout: '', stderr: '', truncated: false, cancelled: true });
        return;
      }
      let child: ChildProcess;
      try {
        child = this.spawnFn(command, args, {
          cwd: options.cwd,
          env: options.env ?? process.env,
          shell: false,
          windowsHide: true,
          windowsVerbatimArguments: options.windowsVerbatimArguments,
          // Own process group on POSIX so cancel can stop grandchildren too.
          detached: this.platform !== 'win32',
          stdio: [options.stdin !== undefined ? 'pipe' : 'ignore', 'pipe', 'pipe']
        });
      } catch (err) {
        reject(err);
        return;
      }

      let stdout = '';
      let stderr = '';
      let truncated = false;
      let cancelled = false;
      const remainders = { stdout: '', stderr: '' };

      const append = (stream: 'stdout' | 'stderr', chunk: Buffer | string) => {
        const text = chunk.toString();
        if (stream === 'stdout') {
          if (stdout.length < maxBytes) stdout += text;
          else truncated = true;
        } else {
          if (stderr.length < maxBytes) stderr += text;
          else truncated = true;
        }
        if (options.onLine) {
          const combined = remainders[stream] + text;
          const lines = combined.split(/\r?\n/);
          remainders[stream] = lines.pop() ?? '';
          for (const line of lines) if (line.trim()) options.onLine(line, stream);
        }
      };

      child.stdout?.on('data', (d) => append('stdout', d));
      child.stderr?.on('data', (d) => append('stderr', d));

      const onAbort = () => {
        cancelled = true;
        killTree(child, this.platform, this.spawnFn);
      };
      options.signal?.addEventListener('abort', onAbort, { once: true });

      child.on('error', (err) => {
        options.signal?.removeEventListener('abort', onAbort);
        reject(err);
      });
      child.on('close', (code) => {
        options.signal?.removeEventListener('abort', onAbort);
        for (const stream of ['stdout', 'stderr'] as const) {
          if (options.onLine && remainders[stream].trim()) options.onLine(remainders[stream], stream);
        }
        resolve({
          exitCode: code,
          stdout: stdout.slice(0, maxBytes),
          stderr: stderr.slice(0, maxBytes),
          truncated,
          cancelled
        });
      });

      if (options.stdin !== undefined) {
        child.stdin?.end(options.stdin, 'utf-8');
      }
    });
  }

  private openerFor(target: string): [string, string[]] {
    // explorer.exe opens URLs, URIs and paths with their default handler, no shell parsing.
    if (this.platform === 'win32') return ['explorer.exe', [target]];
    if (this.platform === 'darwin') return ['open', [target]];
    return ['xdg-open', [target]];
  }

  private detached(command: string, args: string[]): Promise<void> {
    return new Promise((resolve, reject) => {
      let child: ChildProcess;
      try {
        child = this.spawnFn(command, args, {
          detached: true,
          shell: false,
          windowsHide: true,
          stdio: 'ignore'
        });
      } catch (err) {
        reject(err);
        return;
      }
      let settled = false;
      child.once('error', (err) => {
        if (!settled) {
          settled = true;
          reject(err);
        }
      });
      child.once('spawn', () => {
        if (!settled) {
          settled = true;
          child.unref();
          resolve();
        }
      });
    });
  }
}

/** Quote a value as a PowerShell single-quoted literal. */
export function psQuote(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

function killTree(child: ChildProcess, platform: NodeJS.Platform, spawnFn: SpawnFn): void {
  try {
    if (platform === 'win32' && child.pid) {
      // Kill the whole tree: agents and package managers spawn grandchildren.
      spawnFn('taskkill', ['/pid', String(child.pid), '/T', '/F'], { stdio: 'ignore', shell: false });
    } else if (child.pid) {
      try {
        process.kill(-child.pid, 'SIGTERM');
      } catch {
        child.kill('SIGTERM');
      }
    }
  } catch {
    // process already gone
  }
}
