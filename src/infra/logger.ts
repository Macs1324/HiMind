import pino from 'pino';

export function createLogger() {
  const level = 'info';
  const pretty = !!process.stdout.isTTY; // interactive terminal = local dev

  if (!pretty) {
    // Non-interactive: emit JSON to stdout (Cloud Logging, CI, containers)
    return pino({ level });
  }

  // Local interactive: pretty-print to console
  return pino({
    level,
    transport: {
      target: 'pino-pretty',
      options: {
        colorize: true,
        translateTime: 'SYS:standard',
        singleLine: true
      }
    }
  });
}

