import { defineConfig } from 'tsup';

export default defineConfig([
  {
    entry: ['src/main/index.ts'],
    format: ['cjs'],
    outDir: 'dist/main',
    external: ['electron', 'sql.js'],
    noExternal: [/@mave\/.*/, 'pino', 'xstate', 'zod', 'drizzle-orm'],
    target: 'node20'
  },
  {
    entry: ['src/preload/index.ts'],
    format: ['cjs'],
    outDir: 'dist/preload',
    external: ['electron'],
    noExternal: [/@mave\/.*/, 'zod'],
    target: 'node20'
  }
]);
