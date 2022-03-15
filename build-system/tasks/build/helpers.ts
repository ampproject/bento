import * as minimist from 'minimist';
import { cyan, green, red } from 'kleur/colors';
import { log } from '../../common/logging';
import { ComponentBundle } from '../types';
const argv = minimist(process.argv.slice(2));

/**
 * Used to debounce file edits during watch to prevent races.
 */
export const watchDebounceDelay = 1000;

/**
 * The set of entrypoints currently watched by compileJs.
 */
 export const watchedEntryPoints: Set<string> = new Set();

export function maybeToEsmName(name: string): string {
  // Npm esm names occur at an earlier stage.
  if (name.includes('.module')) {
    return name;
  }
  return argv.esm ? name.replace(/\.js$/, '.mjs') : name;
}

export function maybeToNpmEsmName(name: string): string {
  return argv.esm ? name.replace(/\.js$/, '.module.js') : name;
}

export function getComponentDir({ name, version }: ComponentBundle<string>) {
  return `src/components/${name}/${version}`;
}

/**
 * Stops the timer for the given build step and prints the execution time.
 * @param {string} stepName Name of the action, like 'Compiled' or 'Minified'
 * @param {string} targetName Name of the target, like a filename or path
 * @param {DOMHighResTimeStamp} startTime Start time of build step
 */
export function endBuildStep(stepName: string, targetName: string, startTime: DOMHighResTimeStamp) {
  const endTime = Date.now();
  const executionTime = new Date(endTime - startTime);
  const mins = executionTime.getMinutes();
  const secs = executionTime.getSeconds();
  const ms = ('000' + executionTime.getMilliseconds().toString()).slice(-3);
  let timeString = '(';
  if (mins > 0) {
    timeString += mins + ' m ' + secs + '.' + ms + ' s)';
  } else if (secs === 0) {
    timeString += ms + ' ms)';
  } else {
    timeString += secs + '.' + ms + ' s)';
  }
  log(stepName, cyan(targetName), green(timeString));
}

/**
 * Handles a bundling error
 */
export function handleBundleError(err: Error, continueOnError: boolean, destFilename: string) {
  let message = err.toString();
  if (err.stack) {
    // Drop the node_modules call stack, which begins with '    at'.
    message = err.stack.replace(/    at[^]*/, '').trim();
  }
  log(red('ERROR:'), message, '\n');
  const reasonMessage = `Could not compile ${cyan(destFilename)}`;
  if (continueOnError) {
    log(red('ERROR:'), reasonMessage);
  } else {
    throw new Error(reasonMessage);
  }
}
