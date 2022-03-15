import {bold, gray, yellow} from 'kleur/colors';
import {isCiBuild} from './ci';

/**
 * Used by tests to wrap progress dots. Attempts to match the terminal width
 * during local development and defaults to 150 if it couldn't be determined.
 */
export const dotWrappingWidth = isCiBuild() ? 150 : process.stdout.columns ?? 150;

/**
 * Used by CI job scripts to print a prefix before top-level logging lines.
 */
let loggingPrefix = '';

/**
 * Logs messages with a timestamp. The timezone suffix is dropped.
 */
export function log(...messages: any[]) {
  const timestamp = new Date().toTimeString().split(' ')[0];
  const prefix = `[${gray(timestamp)}]`;
  console.log(prefix, ...messages);
}

/**
 * Sets the logging prefix for the ongoing PR check job
 */
export function setLoggingPrefix(prefix: string) {
  loggingPrefix = prefix;
}

/**
 * Returns the formatted logging prefix for the ongoing PR check job
 */
export function getLoggingPrefix(): string {
  return bold(yellow(loggingPrefix));
}

/**
 * Logs messages only during local development
 */
export function logLocalDev(...messages: string[]) {
  if (!isCiBuild()) {
    log(...messages);
  }
}

/**
 * Logs messages on the same line to indicate progress
 */
export function logOnSameLine(...messages: string[]) {
  if (!isCiBuild() && process.stdout.isTTY) {
    process.stdout.moveCursor(0, -1);
    process.stdout.cursorTo(0);
    process.stdout.clearLine(0);
  }
  log(...messages);
}

/**
 * Logs messages on the same line only during local development
 */
export function logOnSameLineLocalDev(...messages: string[]) {
  if (!isCiBuild()) {
    logOnSameLine(...messages);
  }
}

/**
 * Logs messages without a timestamp
 */
export function logWithoutTimestamp(...messages: string[]) {
  console.log(...messages);
}

/**
 * Logs messages without a timestamp only during local development
 */
export function logWithoutTimestampLocalDev(...messages: string[]) {
  if (!isCiBuild()) {
    console.log(...messages);
  }
}
