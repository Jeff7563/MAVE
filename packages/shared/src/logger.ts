import pino from 'pino';

export interface LoggerOptions {
  level?: string;
  name?: string;
}

export function createLogger(options?: LoggerOptions) {
  return pino({
    name: options?.name ?? 'mave',
    level: options?.level ?? process.env['LOG_LEVEL'] ?? 'info',
    redact: {
      paths: [
        'apiKey',
        'key',
        'secret',
        'token',
        'authorization',
        'headers.authorization',
        'headers.Authorization',
        'clientSecret',
        'OPENAI_API_KEY',
        'PICOVOICE_ACCESS_KEY',
        '*.apiKey',
        '*.secret',
        '*.token'
      ],
      censor: '[REDACTED]'
    },
    timestamp: pino.stdTimeFunctions.isoTime
  });
}

export type Logger = ReturnType<typeof createLogger>;
export const rootLogger = createLogger();
