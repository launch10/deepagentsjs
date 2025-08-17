import { getRequestContext } from './als';

type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'http';

interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: string;
  requestId?: string;
  method?: string;
  path?: string;
  [key: string]: any;
}

class Logger {
  private isDevelopment = false;
  private logLevel: LogLevel = 'info';

  constructor() {
    // Default log level - will be configured via setConfig
  }

  // Call this from your app initialization with env variables
  setConfig(env: { LOG_LEVEL?: string; NODE_ENV?: string }) {
    if (env.LOG_LEVEL) {
      this.logLevel = env.LOG_LEVEL.toLowerCase() as LogLevel;
    }
    if (env.NODE_ENV) {
      this.isDevelopment = env.NODE_ENV !== 'production';
    }
  }

  private shouldLog(level: LogLevel): boolean {
    const levels: LogLevel[] = ['debug', 'http', 'info', 'warn', 'error'];
    const currentLevelIndex = levels.indexOf(this.logLevel);
    const messageLevelIndex = levels.indexOf(level);
    return messageLevelIndex >= currentLevelIndex;
  }

  private formatMessage(entry: LogEntry): string {
    if (this.isDevelopment) {
      // Colored output for development
      const colors: Record<LogLevel, string> = {
        debug: '\x1b[36m', // cyan
        http: '\x1b[35m',  // magenta
        info: '\x1b[32m',  // green
        warn: '\x1b[33m',  // yellow
        error: '\x1b[31m', // red
      };
      const reset = '\x1b[0m';
      const color = colors[entry.level];
      
      const { level, message, timestamp, requestId, method, path, ...rest } = entry;
      let output = `${color}[${level.toUpperCase()}]${reset} ${timestamp}`;
      if (requestId) output += ` [${requestId}]`;
      if (method && path) output += ` ${method} ${path}`;
      output += ` ${message}`;
      if (Object.keys(rest).length > 0) {
        output += ` ${JSON.stringify(rest)}`;
      }
      return output;
    } else {
      // JSON output for production
      return JSON.stringify(entry);
    }
  }

  private log(level: LogLevel, message: string, meta?: any) {
    if (!this.shouldLog(level)) return;

    const context = getRequestContext();
    const entry: LogEntry = {
      level,
      message,
      timestamp: new Date().toISOString(),
      ...(context && {
        requestId: context.requestId,
        method: context.method,
        path: context.path,
      }),
      ...meta,
    };

    const formatted = this.formatMessage(entry);
    
    // Wrangler/Miniflare doesn't always show console.debug, so use console.log for all non-error levels
    switch (level) {
      case 'debug':
      case 'http':
      case 'info':
        console.log(formatted);
        break;
      case 'warn':
        console.warn(formatted);
        break;
      case 'error':
        console.error(formatted);
        break;
    }
  }

  debug(message: string, meta?: any) {
    this.log('debug', message, meta);
  }

  http(message: string, meta?: any) {
    this.log('http', message, meta);
  }

  info(message: string, meta?: any) {
    this.log('info', message, meta);
  }

  warn(message: string, meta?: any) {
    this.log('warn', message, meta);
  }

  error(message: string, meta?: any) {
    this.log('error', message, meta);
  }
}

export const logger = new Logger();

export function logError(error: Error | unknown, context?: Record<string, unknown>): void {
  const errorObj = error instanceof Error ? error : new Error(String(error));
  
  logger.error(context ? `${Object.entries(context).map(([k, v]) => `${k}=${v}`).join(' ')}` : 'An error occurred', {
    error: {
      message: errorObj.message,
      stack: errorObj.stack,
      name: errorObj.name,
    },
    ...context,
  });
}

// Simple error handlers for Workers environment
if (typeof addEventListener !== 'undefined') {
  addEventListener('unhandledrejection', (event: any) => {
    logError(event.reason, { type: 'UnhandledRejection' });
  });
}