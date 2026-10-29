import type { ToolRiskLevel } from '@mave/contracts';

/**
 * Shell command risk classification for the terminal tool.
 * This is a safety net, not a sandbox: anything not known-safe needs approval.
 */

/** Commands that only read state or run project checks. */
const SAFE_PATTERNS: RegExp[] = [
  /^git\s+(status|diff|log|show|branch(\s+(-a|-v|-vv|--list))?|remote\s+-v|rev-parse)\b/i,
  /^(pnpm|npm|yarn|bun)\s+(test|run\s+(test|lint|typecheck|build)|lint|typecheck|build|ls|list|outdated|-v|--version)\b/i,
  /^(node|python|python3|py|pnpm|npm|git|uv|pip|code|claude|codex|agy)\s+(-v|-V|--version)\s*$/i,
  /^(pytest|vitest|tsc\s+--noEmit)\b/i,
  /^(ls|dir|pwd|whoami|hostname|echo|where|which|type|cat|tree)\b/i
];

/** Commands that can destroy data or the repository. Always explicit confirmation. */
const DESTRUCTIVE_PATTERNS: RegExp[] = [
  /\brm\s+(-[a-z]*r[a-z]*f|-[a-z]*f[a-z]*r|--recursive|-r\b)/i,
  /\b(rmdir|rd)\s+\/s\b/i,
  /\bdel\s+(\/[a-z]\s+)*\/[sq]\b/i,
  /\bRemove-Item\b.*-Recurse/i,
  /\bformat(\.com)?\s+[a-z]:/i,
  /\bmkfs(\.\w+)?\b/i,
  /\bdd\s+if=/i,
  /\bgit\s+reset\s+--hard\b/i,
  /\bgit\s+clean\s+-[a-z]*[fdx]/i,
  /\bgit\s+push\b.*(--force|-f\b|--force-with-lease)/i,
  /\bgit\s+branch\s+-D\b/i,
  /\bgit\s+checkout\s+--\s+\./i,
  /\bgit\s+(restore|stash\s+(drop|clear))\b/i,
  /\b(drop\s+(table|database)|truncate\s+table)\b/i,
  /\bshutdown\b|\brestart-computer\b|\breboot\b/i,
  /\breg\s+delete\b/i,
  /\bchmod\s+-R\b|\bchown\s+-R\b/i,
  />\s*\/dev\/sd[a-z]/i
];

/** Never run, even with approval: obvious credential exfiltration or fork bombs. */
const BLOCKED_PATTERNS: RegExp[] = [
  /:\(\)\s*\{\s*:\|:&\s*\};:/,
  /\b(curl|wget|iwr|Invoke-WebRequest)\b[^|]*\|\s*(sh|bash|iex|Invoke-Expression|powershell)\b/i,
  /\b(cat|type|Get-Content)\b[^|]*(\.ssh[\\/]|id_rsa|\.aws[\\/]credentials|\.env\b)/i
];

const CHAINING = /(&&|\|\||;|\||`|\$\(|>|<)/;

export function classifyCommandRisk(command: string): ToolRiskLevel {
  const trimmed = command.trim();
  if (DESTRUCTIVE_PATTERNS.some((re) => re.test(trimmed))) {
    return 'destructive';
  }
  // Chained / redirected commands are never "known safe".
  if (!CHAINING.test(trimmed) && SAFE_PATTERNS.some((re) => re.test(trimmed))) {
    return 'safe_local';
  }
  return 'external_side_effect';
}

export function blockedCommandReason(command: string): string | undefined {
  const trimmed = command.trim();
  if (BLOCKED_PATTERNS.some((re) => re.test(trimmed))) {
    return 'This command looks like credential exfiltration or a remote-script pipe, which MAVE never runs.';
  }
  return undefined;
}
