import { ensureDirSync, existsSync, readFileSync, writeFileSync } from 'fs-extra';
import { cyan } from 'kleur/colors';
import { logLocalDev } from './logging';

/**
 * Writes the given contents to the patched file if updated
 * @param {string} patchedName Name of patched file
 * @param {string} file Contents to write
 */
function writeIfUpdated(patchedName: string, file: string) {
  if (
    !existsSync(patchedName) ||
    readFileSync(patchedName, 'utf8') != file
  ) {
    writeFileSync(patchedName, file);
    logLocalDev('Patched', cyan(patchedName));
  }
}

/**
 * Adds a missing export statement to the preact module.
 */
export function patchPreact() {
  ensureDirSync('node_modules/preact/dom');
  const file = `export { render, hydrate } from 'preact';`;
  writeIfUpdated('node_modules/preact/dom/index.js', file);
}
