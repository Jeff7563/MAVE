import type { RunProcessOptions, RunProcessResult, SystemAdapter } from '../system-adapter.js';

export interface FakeCall {
  kind: 'openExternal' | 'openPath' | 'launchApp' | 'run';
  target: string;
  args?: string[];
  options?: RunProcessOptions;
}

export class FakeSystemAdapter implements SystemAdapter {
  readonly calls: FakeCall[] = [];
  runResult: Partial<RunProcessResult> = {};
  runLines: string[] = [];
  runDelayMs = 0;

  constructor(readonly platform: NodeJS.Platform = 'win32') {}

  async openExternal(target: string): Promise<void> {
    this.calls.push({ kind: 'openExternal', target });
  }

  async openPath(target: string): Promise<void> {
    this.calls.push({ kind: 'openPath', target });
  }

  async launchApp(command: string, args: string[] = []): Promise<void> {
    this.calls.push({ kind: 'launchApp', target: command, args });
  }

  async run(command: string, args: string[], options: RunProcessOptions = {}): Promise<RunProcessResult> {
    this.calls.push({ kind: 'run', target: command, args, options });
    for (const line of this.runLines) options.onLine?.(line, 'stdout');
    if (this.runDelayMs > 0) {
      await new Promise<void>((resolve) => {
        const t = setTimeout(resolve, this.runDelayMs);
        options.signal?.addEventListener('abort', () => {
          clearTimeout(t);
          resolve();
        });
      });
    }
    return {
      exitCode: 0,
      stdout: '',
      stderr: '',
      truncated: false,
      cancelled: options.signal?.aborted ?? false,
      ...this.runResult
    };
  }
}
