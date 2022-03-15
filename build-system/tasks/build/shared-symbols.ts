/**
 * @fileoverview
 * These are the packages, and their exports that are included in `bento.js`
 * Extension `bento-*.js` binaries will use these exports as provided by
 * `bento.js` from the `BENTO` global.
 *
 * We specify each export explicitly by name.
 * Unlisted imports will be bundled with each binary.
 */

import {
  Declaration,
  isExportAllDeclaration, isExportDefaultDeclaration,
  isExportNamedDeclaration, isTypeScript,
  isExportDefaultSpecifier,
  isExportNamespaceSpecifier,
  isStringLiteral,
  VariableDeclaration,
  VariableDeclarator,
  Identifier,
  FunctionDeclaration,
} from '@babel/types';
import { parse } from '@babel/parser';
import { readFileSync } from 'fs-extra';
import { resolvePath } from '../../babel-config/import-resolver';

// These must be aliased from `src/`, e.g. `#preact` to `src/preact`.
// See tsconfig.json for the list of aliases.
const packages = [
  'core/context',
  'preact',
  'preact/base-element',
  'preact/compat',
  'preact/component',
  'preact/context',
  'preact/slot',
];

export function getExportedSymbols(source: string): string[] {
  const tree = parse(source, {
    sourceType: 'module',
    plugins: ['typescript', 'jsx', 'exportDefaultFrom'],
  });
  const symbols: string[] = [];
  for (const node of tree.program.body) {
    if (isExportAllDeclaration(node)) {
      throw new Error('Should not "export *"');
    }
    if (isExportDefaultDeclaration(node)) {
      throw new Error('Should not "export default"');
    }
    if (!isExportNamedDeclaration(node)) {
      continue;
    }
    const { declaration } = node;
    symbols.push(...getDeclaredVariableNames(declaration as VariableDeclaration));
    if (!isTypeScript(declaration)) {
      const name = (declaration as FunctionDeclaration)?.id?.name;
      if (name) {
        symbols.push();
      }
    }
    symbols.push(
      ...node.specifiers.map((node) => {
        if (isExportDefaultSpecifier(node)) {
          throw new Error('Should not export from a default import');
        }
        if (isExportNamespaceSpecifier(node)) {
          throw new Error('Should not export a namespace');
        }
        const { exported, local } = node;
        if (isStringLiteral(exported)) {
          throw new Error('Should not export symbol as string');
        }
        if (local.name !== exported.name) {
          throw new Error(
            `Exported name "${exported.name}" should match local name "${local.name}"`
          );
        }
        return exported.name;
      })
    );
  }
  return symbols;
}

function getDeclaredVariableNames(declaration?: VariableDeclaration): string[] {
  const { declarations } = declaration || {};
  if (!declarations) {
    return [];
  }
  return declarations
    .filter((node: VariableDeclarator) => !isTypeScript(node))
    .map((declarator: VariableDeclarator) => (declarator.id as Identifier).name);
}

let sharedBentoSymbols: Record<string, string[]> | null;

export function getSharedSymbols(): Record<string, string[]> {
  if (!sharedBentoSymbols) {
    const entries = packages.map((pkg) => {
      const filepath = resolvePath(`src/${pkg}`);
      try {
        const source = readFileSync(filepath, 'utf8');
        const symbols = getExportedSymbols(source);
        return [`#${pkg}`, symbols];
      } catch (e) {
        e.message = `${filepath}: ${e.message}`;
        throw e;
      }
    });
    sharedBentoSymbols = Object.fromEntries(entries);
  }
  return sharedBentoSymbols!;
}
