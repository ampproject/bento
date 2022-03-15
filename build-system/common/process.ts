/**
 * @fileoverview Provides functions for executing tasks in a child process.
 * Separated from `exec` to allow import before `npm` installs dependencies.
 */

import { spawnSync, SpawnSyncOptions, SpawnSyncReturns } from 'child_process';

const shellCmd = process.platform == 'win32' ? 'cmd' : '/bin/bash';

/**
 * Spawns the given command in a child process with the given options.
 * Special-cases the AMP task runner so that it is correctly spawned on all
 * platforms (node shebangs do not work on Windows).
 *
 */
export function spawnProcess(cmd: string, options: SpawnSyncOptions = {}) {
  const cmdToSpawn = cmd.startsWith('amp ') ? `node ${cmd}` : cmd;
  return spawnSync(cmdToSpawn, {shell: shellCmd, ...options});
}

/**
 * Executes the provided command, returning the process object.
 */
export function getOutput(cmd: string, options: SpawnSyncOptions = {}) {
  return spawnProcess(cmd, {
    cwd: options.cwd || process.cwd(),
    env: options.env || process.env,
    stdio: options.stdio || 'pipe',
    encoding: options.encoding || 'utf-8',
  }) as SpawnSyncReturns<string>;
}

/**
 * Executes the provided command, returning its stdout.
 */
export function getStdout(cmd: string, options: SpawnSyncOptions = {}) {
  return getOutput(cmd, options).stdout;
}

/**
 * Executes the provided command, returning its stderr.
 */
export function getStderr(cmd: string, options: SpawnSyncOptions = {}) {
  return getOutput(cmd, options).stderr;
}
