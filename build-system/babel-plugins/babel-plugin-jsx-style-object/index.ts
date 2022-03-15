/**
 * @fileoverview
 * Converts Object Expression syntax in `style={{foo: 'bar'}}` to a concatenated
 * string expression.
 *
 * This only transforms a file if it imports the `baseModule` for JSX below,
 * which lacks runtime support for converting the Object into a string.
 * This transform takes that responsibility instead.
 */

import { Node, NodePath, PluginObj } from '@babel/core';
import { ImportDeclaration, JSXAttribute, ObjectMethod, ObjectProperty } from '@babel/types';
const { addNamed } = require('@babel/helper-module-imports');

const baseModule = 'core/dom/jsx';
const helperModule = '#core/dom/jsx-style-property-string';
const helperFnName = 'jsxStylePropertyString';

// All values from here, converted to dash-case:
// https://github.com/facebook/react/blob/a7c5726/packages/react-dom/src/shared/CSSProperty.js
const nonDimensional = new Set([
  'animation-iteration-count',
  'aspect-ratio',
  'border-image-outset',
  'border-image-slice',
  'border-image-width',
  'box-flex',
  'box-flex-group',
  'box-ordinal-group',
  'column-count',
  'columns',
  'flex',
  'flex-grow',
  'flex-positive',
  'flex-shrink',
  'flex-negative',
  'flex-order',
  'grid-area',
  'grid-row',
  'grid-row-end',
  'grid-row-span',
  'grid-row-start',
  'grid-column',
  'grid-column-end',
  'grid-column-span',
  'grid-column-start',
  'font-weight',
  'line-clamp',
  'line-height',
  'opacity',
  'order',
  'orphans',
  'tab-size',
  'widows',
  'z-index',
  'zoom',

  // SVG-related properties
  'fill-opacity',
  'flood-opacity',
  'stop-opacity',
  'stroke-dasharray',
  'stroke-dashoffset',
  'stroke-miterlimit',
  'stroke-opacity',
  'stroke-width',
]);

export default function (babel: any): PluginObj {
  const { types: t } = babel;

  const dashCase = (camelCase: string) =>
    camelCase.replace(/[A-Z]/g, '-$&').toLowerCase();

  let hasBaseModule = false;

  function transformProp(path: NodePath<ObjectProperty>): Node|null {
    // @ts-ignore
    const name = path.node.key.name || path.node.key.value;
    const cssName = dashCase(name);
    const isDimensional = !nonDimensional.has(cssName);
    const value = path.get('value');
    const evaluated = value.evaluate();

    // If we can evaluate the value, return a composed string.
    if (evaluated.confident) {
      const { value } = evaluated;
      if (value == null || value === '') {
        return null;
      }
      const withUnit =
        isDimensional && typeof value === 'number' ? `${value}px` : value;
      return t.stringLiteral(`${cssName}:${withUnit};`);
    }

    // Otherwise call the helper function to evaluate nullish and dimensional values.
    const helperFn = addNamed(path, helperFnName, helperModule);
    const args = [t.stringLiteral(cssName), value.node];
    if (isDimensional) {
      args.push(t.booleanLiteral(true));
    }
    return t.callExpression(helperFn, args);
  }

  function mergeBinaryConcat(props: Array<Node | null>): Node {
    let expr = null;
    while (props.length) {
      const part = props.shift();
      if (part) {
        if (!expr) {
          expr = part;
        } else {
          expr = t.binaryExpression('+', expr, part);
        }
      }
    }
    return expr;
  }

  function replaceExpression(path: NodePath<Node | JSXAttribute>) {
    if (path.isLogicalExpression()) {
      if (
        path.node.operator === '&&' ||
        path.node.operator === '||' ||
        path.node.operator === '??'
      ) {
        replaceExpression(path.get('right'));
      }
      return;
    }
    if (path.isConditionalExpression()) {
      replaceExpression(path.get('consequent'));
      replaceExpression(path.get('alternate'));
      return;
    }
    if (!path.isObjectExpression()) {
      return;
    }
    path = /** @type {NodePath<babel.types.ObjectExpression>} */ (path);
    const properties = path.get('properties');
    const props = (Array.isArray(properties) ? properties : [properties]).map((prop) => {
      if (prop.isSpreadElement()) {
        throw prop.buildCodeFrameError(
          'You should not use spread properties in style object expressions.'
        );
      }
      if ((prop.node as ObjectProperty).computed) {
        throw (prop
          .get('key') as NodePath<Node>)
          .buildCodeFrameError(
            'You should not use computed props in style object expressions. Instead, use multiple properties directly. They can be "null" when unwanted.'
          );
      }
      return transformProp(prop as NodePath<ObjectProperty>);
    });
    const merged = mergeBinaryConcat(props);
    path.replaceWith(merged || t.stringLiteral(''));
  }

  return {
    name: 'jsx-style-object',
    visitor: {
      Program: {
        enter(path: NodePath) {
          hasBaseModule = false;
          path.traverse({
            ImportDeclaration(path: NodePath<ImportDeclaration>) {
              if (path.node.source.value.endsWith(baseModule)) {
                hasBaseModule = true;
                path.stop();
              }
            },
          });
        },
      },
      JSXAttribute(path: NodePath<JSXAttribute>) {
        if (!hasBaseModule) {
          return;
        }
        if (!t.isJSXIdentifier(path.node.name, { name: 'style' })) {
          return;
        }
        const expression = path.get('value.expression');
        replaceExpression(expression as NodePath);
      },
    },
  };
};
