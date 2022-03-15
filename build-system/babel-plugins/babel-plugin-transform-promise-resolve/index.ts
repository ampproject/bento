import type { NodePath, PluginObj } from '@babel/core';
import type { CallExpression } from '@babel/types';
import { dirname, relative } from 'path';
const { addNamed } = require('@babel/helper-module-imports');

/**
 * @interface {babel.PluginPass}
 */
export default function (babel: any, options: any = {}): PluginObj {
  const { types: t } = babel;
  const promiseResolveMatcher = t.buildMatchMemberExpression('Promise.resolve');
  const { importFrom = 'src/core/data-structures/promise' } = options;

  return {
    visitor: {
      CallExpression(path: NodePath<CallExpression>) {
        const { node } = path;
        const { filename } = this.file.opts;

        if (node.arguments.length > 0) {
          return;
        }
        if (!filename) {
          throw new Error('Cannot use plugin without providing a filename');
        }

        const callee = path.get('callee');
        if (!promiseResolveMatcher(callee.node)) {
          return;
        }

        // Ensure the source is relative to the current file by prepending.
        // Relative will return "foo" instead of "./foo". And if it returned
        // a "../foo", making it "./../foo" doesn't hurt.
        const source =
          './' +
          toPosix(
            relative(dirname(filename), importFrom)
          );
        const resolvedPromise = addNamed(path, 'resolvedPromise', source, {
          importedType: 'es6',
        });
        callee.replaceWith(resolvedPromise);
      },
    },
  };
};

/**
 * Even though we are using the path module, JS Modules should never have
 * their paths specified in Windows format.
 */
function toPosix(path: string): string {
  return path.replace(/\\\\?/g, '/');
}
