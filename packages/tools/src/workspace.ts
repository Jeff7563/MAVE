import path from 'node:path';

/**
 * Folder scope guard. File, git, terminal and agent tools may only touch paths
 * inside the allowed roots (e.g. C:\project). Paths are normalized first so
 * `..` tricks cannot escape the scope.
 */
export class WorkspaceScope {
  private readonly roots: string[];
  private readonly pathApi: path.PlatformPath;

  constructor(roots: string[], platform: NodeJS.Platform = process.platform) {
    this.pathApi = platform === 'win32' ? path.win32 : path.posix;
    this.roots = roots
      .filter((r) => typeof r === 'string' && r.trim().length > 0)
      .map((r) => this.pathApi.resolve(r.trim()));
  }

  listRoots(): string[] {
    return [...this.roots];
  }

  get defaultRoot(): string | undefined {
    return this.roots[0];
  }

  /** Resolve a user path (absolute, or relative to the first root). */
  resolve(target: string): string {
    const base = this.defaultRoot ?? process.cwd();
    return this.pathApi.resolve(base, target.trim());
  }

  contains(target: string): boolean {
    const resolved = this.resolve(target);
    return this.roots.some((root) => {
      const rel = this.pathApi.relative(this.normalizeCase(root), this.normalizeCase(resolved));
      return rel === '' || (!rel.startsWith('..') && !this.pathApi.isAbsolute(rel));
    });
  }

  /** Returns the resolved path, or throws when it is outside every root. */
  require(target: string): string {
    if (this.roots.length === 0) {
      throw new Error('No workspace folders are configured for MAVE tools (set MAVE_TOOL_ROOTS)');
    }
    const resolved = this.resolve(target);
    if (!this.contains(resolved)) {
      throw new Error(`Path is outside MAVE's allowed folders: ${resolved}`);
    }
    return resolved;
  }

  private normalizeCase(p: string): string {
    return this.pathApi === path.win32 ? p.toLowerCase() : p;
  }
}
