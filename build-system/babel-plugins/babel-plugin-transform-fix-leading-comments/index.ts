import type { NodePath, PluginObj } from "@babel/core";
import type { Statement } from "@babel/types";

/**
 * Reassigns the trailing comments of a statement to be leading comment of its
 * next sibling. This is because JSDoc comments (which should be on the next
 * statement) get erroneously assigned as trailing comments of this statement.
 *
 * @interface {babel.PluginPass}
 */
 export default function (): PluginObj {
  return {
    manipulateOptions(_opts: any, parserOpts: any) {
      parserOpts.createParenthesizedExpressions = true;
    },

    visitor: {
      Statement(path: NodePath<Statement>) {
        const {node} = path;
        const {trailingComments} = node;
        if (!trailingComments || trailingComments.length <= 0) {
          return;
        }

        // Babel NodePath definition is missing getNextSibling
        const next = path.getNextSibling();
        if (!next) {
          return;
        }

        node.trailingComments = null;
         // Babels typing isn't very good. Node.addComments expects an array of any
         //  and will not accept an array of comments.
        next.addComments('leading', trailingComments as any[]);
      },
    },
  };
};
