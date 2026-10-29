import type { ToolDescriptor } from '@mave/contracts';
import type { AnyToolDefinition } from './types.js';

export class ToolRegistry {
  private readonly tools = new Map<string, AnyToolDefinition>();

  register(tool: AnyToolDefinition): void {
    if (!tool.id || !/^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)*$/.test(tool.id)) {
      throw new Error(`Invalid tool id '${tool.id}'`);
    }
    if (this.tools.has(tool.id)) {
      throw new Error(`Tool '${tool.id}' is already registered`);
    }
    this.tools.set(tool.id, tool);
  }

  registerAll(tools: AnyToolDefinition[]): void {
    for (const tool of tools) this.register(tool);
  }

  unregister(id: string): boolean {
    return this.tools.delete(id);
  }

  has(id: string): boolean {
    return this.tools.has(id);
  }

  get(id: string): AnyToolDefinition | undefined {
    return this.tools.get(id);
  }

  list(): AnyToolDefinition[] {
    return Array.from(this.tools.values());
  }

  describe(): ToolDescriptor[] {
    return this.list().map((tool) => ({
      id: tool.id,
      title: tool.title,
      description: tool.description,
      riskLevel: tool.riskLevel,
      timeoutMs: tool.timeoutMs,
      argsHint: tool.argsHint ?? {}
    }));
  }
}
