import type { ToolAuditRecord } from '@mave/contracts';

export interface ToolAuditSink {
  record(entry: ToolAuditRecord): void | Promise<void>;
}

/** Bounded in-memory audit log. A SQLite sink can be added without changing the executor. */
export class InMemoryToolAuditLog implements ToolAuditSink {
  private readonly entries: ToolAuditRecord[] = [];

  constructor(private readonly maxEntries = 500) {}

  record(entry: ToolAuditRecord): void {
    this.entries.push(entry);
    if (this.entries.length > this.maxEntries) {
      this.entries.splice(0, this.entries.length - this.maxEntries);
    }
  }

  list(limit = 50): ToolAuditRecord[] {
    return this.entries.slice(-limit).reverse();
  }

  clear(): void {
    this.entries.length = 0;
  }
}

const SENSITIVE_KEY = /(pass(word)?|secret|token|api[_-]?key|authorization|cookie|credential)/i;
const SENSITIVE_VALUE = /\b(sk-[A-Za-z0-9_-]{16,}|gh[pousr]_[A-Za-z0-9]{20,}|AIza[0-9A-Za-z_-]{20,}|xox[abprs]-[A-Za-z0-9-]{10,})\b/g;

export function redactText(text: string): string {
  return text.replace(SENSITIVE_VALUE, '[REDACTED]');
}

/** Redact secrets from tool args before they are logged, audited or shown. */
export function redactArgs(args: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(args)) {
    if (SENSITIVE_KEY.test(key)) {
      out[key] = '[REDACTED]';
    } else if (typeof value === 'string') {
      out[key] = redactText(value.length > 2000 ? `${value.slice(0, 2000)}…` : value);
    } else if (value && typeof value === 'object' && !Array.isArray(value)) {
      out[key] = redactArgs(value as Record<string, unknown>);
    } else {
      out[key] = value;
    }
  }
  return out;
}
