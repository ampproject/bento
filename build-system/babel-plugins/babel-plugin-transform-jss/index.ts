/**
 * Takes a .jss.js file and transforms the `useStyles` export to remove side effects
 * and directly return the classes map. Also includes special key 'CSS' in the classes
 * object with the entire CSS string.
 *
 * @example
 * In:
 * ```
 * import {createUseStyles} from 'react-jss'
 *
 * const jss = { button: { fontSize: 12 }}
 * export const useStyles = createUseStyles(jss);
 *
 * import {useStyles} from './imported.jss';
 * useStyles().button;
 * ```
 *
 * Out:
 * ```
 * const jss = { button: { fontSize: 12 }}
 * const _classes = {button: 'button-1'}
 * export const useStyles = () => _classes;
 * export const CSS = '.button-1 { font-size: 12px }'
 * export const $button = 'button-1';
 *
 * import {useStyles} from './imported.jss';
 * import {$button as _$button} from './imported.jss';
 * _$button
 * ```
 */

import hash from './create-hash';
import { create } from 'jss';
import * as preset from 'jss-preset-default';
import { join, relative } from 'path';
import { transformCssString } from '../../tasks/css/jsify-css';
import type { NodePath, PluginObj } from '@babel/core';
import type { CallExpression, Identifier, ImportDeclaration, MemberExpression, ObjectMethod, ObjectProperty, Program, SpreadElement, VariableDeclaration } from '@babel/types';
const { addNamed } = require('@babel/helper-module-imports');

module.exports = function ({ template, types: t }: any): PluginObj {
  function isJssFile(filename: string): boolean {
    return filename.endsWith('.jss.js');
  }

  function classnameId(name: string): string {
    return `\$${name}`;
  }

  function findImportDeclaration(reference: NodePath, importedName: string): NodePath<ImportDeclaration> | null {
    if (!reference.isIdentifier()) {
      return null;
    }

    const binding = reference.scope.getBinding(reference.node.name);
    if (!binding || binding.kind !== 'module') {
      return null;
    }

    const { path } = binding;
    const { parentPath } = path;

    if (
      !parentPath?.isImportDeclaration() ||
      !path.isImportSpecifier() ||
      !t.isIdentifier(path.node.imported, { name: importedName })
    ) {
      return null;
    }

    return parentPath;
  }

  /**
   * Replacess MemberExpressions.
   * @example
   * In:
   * ```
   *   import {useStyles} from 'foo';
   *   const a = useStyles();
   *   a.b;
   *   useStyles().c;
   * ```
   * Out:
   * ```
   *   import {useStyles} from 'foo';
   *   import {$b as _$b} from 'foo';
   *   import {$c as _$c} from 'foo';
   *   $_b;
   *   $_c;
   * ```
   */
  function replaceMemberExpression(importDeclaration: NodePath<ImportDeclaration>, memberExpression: NodePath<MemberExpression>): boolean {
    if (!memberExpression.isMemberExpression({ computed: false })) {
      return false;
    }
    const { property } = memberExpression.node;
    if (!t.isIdentifier(property)) {
      return false;
    }

    const localId = getImportIdentifier(importDeclaration, (property as Identifier).name);
    memberExpression.replaceWith(t.cloneNode(localId));

    return true;
  }

  /**
   * Replaces VariableDeclarations that use ObjectPatterns (destructuring).
   * @example
   * In:
   * ```
   *   import {useStyles} from 'foo';
   *   const {a, ...rest} = useStyles();
   * ```
   * Out:
   * ```
   *   import {useStyles} from 'foo';
   *   import {$a as _$a} from 'foo';
   *   const {a: _unused, ...rest} = useStyles();
   *   const a = $_a;
   * ```
   */
  function replaceObjectPattern(importDeclaration: NodePath<ImportDeclaration>, variableDeclarator: NodePath<VariableDeclaration>): boolean {
    if (
      !variableDeclarator.isVariableDeclarator() ||
      // @ts-ignore
      !t.isObjectPattern(variableDeclarator.node.id)
    ) {
      return false;
    }
    // @ts-ignore
    const { properties } = variableDeclarator.node.id;
    const replacedPropertyCount = properties.reduce((count: number, property: ObjectProperty) => {
      const { computed, key, value } = property;
      if (computed || !t.isIdentifier(value) || !t.isIdentifier(key)) {
        return count;
      }
      const importId = getImportIdentifier(importDeclaration, (key as Identifier).name);
      // @ts-ignore
      const declaration = variableDeclarator.parentPath;
      declaration.insertAfter(
        template.statement.ast(
          // @ts-ignore
          `${declaration.node.kind} ${value.name} = ${importId.name}`
        )
      );
      // Unused props are required to allow ...rest:
      // const {a: _unused, ...rest} = useStyles();
      // const a = _$a;
      // @ts-ignore
      property.value = variableDeclarator.scope.generateUidIdentifier('unused');
      return count + 1;
    }, 0);
    if (properties.length === replacedPropertyCount) {
      // @ts-ignore
      variableDeclarator.remove();
    }
    return true;
  }

  /**
   * Replaces VariableDeclarators by following their references.
   * @example
   * In:
   * ```
   *   import {useStyles} from 'foo';
   *   const a = useStyles();
   *   a.b;
   * ```
   * Out:
   * ```
   *   import {useStyles} from 'foo';
   *   import {$b as _$b} from 'foo';
   *   $_b;
   * ```
   */
  function replaceVariableDeclaratorRefs(
    importDeclaration: NodePath<ImportDeclaration>,
    variableDeclarator: NodePath<any>
  ): boolean {
    if (
      !variableDeclarator.isVariableDeclarator() ||
      !t.isIdentifier(variableDeclarator.node.id)
    ) {
      return false;
    }
    const { referencePaths } =
      variableDeclarator.scope.bindings[(variableDeclarator.node.id as Identifier).name];
    const replacedReferenceCount = referencePaths.reduce(
      (count, identifier: NodePath<any>) =>
        replaceExpression(importDeclaration, identifier) ? count + 1 : count,
      0
    );
    if (referencePaths.length === replacedReferenceCount) {
      variableDeclarator.remove();
    }
    return true;
  }

  function replaceExpression(importDeclaration: NodePath<ImportDeclaration>, callExpressionOrIdentifier: NodePath<CallExpression | Identifier>): boolean {
    const { parentPath } = callExpressionOrIdentifier;
    return (
      replaceMemberExpression(importDeclaration, parentPath as NodePath<MemberExpression>) ||
      replaceObjectPattern(importDeclaration, parentPath as NodePath<VariableDeclaration>) ||
      replaceVariableDeclaratorRefs(importDeclaration, parentPath as NodePath<VariableDeclaration>)
    );
  }

  function getImportIdentifier(importDeclaration: NodePath<ImportDeclaration>, name: string): string {
    return addNamed(
      importDeclaration,
      classnameId(name),
      importDeclaration.node.source.value
    );
  }

  const seen = new Map();

  function compileJss(JSS: string, filename: string) {
    const relativeFilepath = relative(join(__dirname, '../../..'), filename);
    const filehash = hash.createHash(relativeFilepath);
    const jss = create({
      ...preset.default(),
      createGenerateId: () => {
        return (rule) => {
          const dashCaseKey = rule.key.replace(
            /([A-Z])/g,
            (c) => `-${c.toLowerCase()}`
          );
          const className = `${dashCaseKey}-${filehash}`;
          if (seen.has(className)) {
            throw new Error(
              `Classnames must be unique across all files. Found a duplicate: ${className}`
            );
          }
          seen.set(className, filename);
          return className;
        };
      },
    });
    return jss.createStyleSheet(JSS as any);
  }

  return {
    visitor: {
      Program(_path: NodePath<Program>, state: any) {
        const { filename } = state.file.opts;
        seen.forEach((file, key) => {
          if (file === filename) {
            seen.delete(key);
          }
        });
      },

      CallExpression(path: NodePath<CallExpression>, state: any) {
        const callee = path.get('callee');

        // Replace users that import JSS.
        const importDeclaration = findImportDeclaration(callee, 'useStyles');
        if (importDeclaration) {
          replaceExpression(importDeclaration, path);
          return;
        }

        // Replace JSS exporter
        const { filename } = state.file.opts;
        if (!isJssFile(filename)) {
          return;
        }

        if (!callee.isIdentifier({ name: 'createUseStyles' })) {
          return;
        }

        const { confident, value: JSS } = (path.get('arguments.0') as any as NodePath<Node>).evaluate();
        if (!confident) {
          throw path.buildCodeFrameError(
            `First argument to createUseStyles must be statically evaluatable.`
          );
        }
        const sheet = compileJss(JSS, filename);
        if ('CSS' in sheet.classes) {
          throw path.buildCodeFrameError(
            'Cannot have class named CSS in your JSS object.'
          );
        }

        // This codepath is used when generating CSS files for npm distribution, separate from
        // AMP-mode compilation.
        if ((this.opts as any).css) {
          (this.opts as any).css = transformCssString(sheet.toString()).then(({ css }) => {
            (this.opts as any).css = css;
          });
          return;
        }

        // Create the classes var.
        // This is required for compatibility when a useStyles() result is
        // passed around.
        const id = path.scope.generateUidIdentifier('classes');
        const init = t.valueToNode(sheet.classes);
        path.scope.push({ id, init });
        path.scope.bindings[id.name].path.parentPath?.addComment(
          'leading',
          '* @enum {string}'
        );

        // Replace useStyles with a getter for the new `classes` var.
        path.replaceWith(template.expression.ast`(() => ${t.cloneNode(id)})`);

        // Export each classname.
        const exportDeclaration = path.findParent(
          (p) => p.type === 'ExportNamedDeclaration'
        );
        for (const key in sheet.classes) {
          const id = t.identifier(classnameId(key));
          const init = t.valueToNode(sheet.classes[key]);
          exportDeclaration?.insertBefore(
            template.statement.ast`export const ${id} = ${init}`
          );
        }

        // Export a variable named CSS with the compiled CSS.
        transformCssString(sheet.toString()).then(({ css }) => {
          const cssStr = t.stringLiteral(css);
          const cssExport = template.ast`export const CSS = ${cssStr}`;
          exportDeclaration?.insertAfter(cssExport);
        });
      },

      // Remove the import for react-jss
      ImportDeclaration(path: NodePath<ImportDeclaration>, state: any) {
        const { filename } = state.file.opts;
        if (!isJssFile(filename)) {
          return;
        }

        if (path.node.source.value === 'react-jss') {
          path.remove();
        }
      },
    },
  };
};
