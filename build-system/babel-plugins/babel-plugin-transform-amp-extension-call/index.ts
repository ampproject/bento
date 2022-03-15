import type { NodePath, PluginObj } from "@babel/core";
import type { CallExpression } from "@babel/types";

/**
 * @interface {babel.PluginPass}
 */
 export default function (babel: any): PluginObj {
  const {types: t} = babel;
  return {
    name: 'transform-amp-extension-call',
    visitor: {
      CallExpression(path: NodePath<CallExpression>) {
        const {node} = path;
        const {callee} = node;
        if (
          t.isIdentifier((callee as any).object, {name: 'AMP'}) &&
          t.isIdentifier((callee as any).property, {name: 'extension'})
        ) {
          const {body} = node.arguments[node.arguments.length - 1] as any;

          if (t.isBlockStatement(body)) {
            path.replaceWithMultiple(body.body);
          } else {
            path.replaceWith(body);
          }
        }
      },
    },
  };
};
