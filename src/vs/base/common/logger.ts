/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { isCI, isWeb } from './platform.js';

const isDevMode = !isCI && !isWeb; // Consideramos desarrollo si no es CI ni web

// Configuración del logger simple sin Winston para evitar dependencias externas
class SimpleLogger {
  private level: 'debug' | 'info' | 'warn' | 'error' = isDevMode ? 'debug' : 'warn';

  private shouldLog(level: 'debug' | 'info' | 'warn' | 'error'): boolean {
    const levels = { debug: 0, info: 1, warn: 2, error: 3 };
    return levels[level] >= levels[this.level];
  }

  debug(message: string, ...args: unknown[]): void {
    if (this.shouldLog('debug')) {
      console.debug(`[DEBUG] ${message}`, ...args);
    }
  }

  info(message: string, ...args: unknown[]): void {
    if (this.shouldLog('info')) {
      console.info(`[INFO] ${message}`, ...args);
    }
  }

  warn(message: string, ...args: unknown[]): void {
    if (this.shouldLog('warn')) {
      console.warn(`[WARN] ${message}`, ...args);
    }
  }

  error(message: string, error?: Error, ...args: unknown[]): void {
    if (this.shouldLog('error')) {
      if (error) {
        console.error(`[ERROR] ${message}`, error, ...args);
      } else {
        console.error(`[ERROR] ${message}`, ...args);
      }
    }
  }
}

const logger = new SimpleLogger();

// Interfaz del logger
export interface ILogger {
  debug(message: string, ...meta: unknown[]): void;
  info(message: string, ...meta: unknown[]): void;
  warn(message: string, ...meta: unknown[]): void;
  error(message: string, error?: Error, ...meta: unknown[]): void;
}

// Implementación del logger
class VSCodeLogger implements ILogger {
  debug(message: string, ...meta: unknown[]): void {
    logger.debug(message, ...meta);
  }

  info(message: string, ...meta: unknown[]): void {
    logger.info(message, ...meta);
  }

  warn(message: string, ...meta: unknown[]): void {
    logger.warn(message, ...meta);
  }

  error(message: string, error?: Error, ...meta: unknown[]): void {
    logger.error(message, error, ...meta);
  }
}

// Instancia singleton del logger
export const vscodeLogger = new VSCodeLogger();

// Función helper para crear loggers específicos de módulo
export function createModuleLogger(moduleName: string): ILogger {
  return {
    debug: (message: string, ...meta: unknown[]) => vscodeLogger.debug(`[${moduleName}] ${message}`, ...meta),
    info: (message: string, ...meta: unknown[]) => vscodeLogger.info(`[${moduleName}] ${message}`, ...meta),
    warn: (message: string, ...meta: unknown[]) => vscodeLogger.warn(`[${moduleName}] ${message}`, ...meta),
    error: (message: string, error?: Error, ...meta: unknown[]) => vscodeLogger.error(`[${moduleName}] ${message}`, error, ...meta)
  };
}