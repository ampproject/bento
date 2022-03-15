/**
 * @fileoverview
 * Transforms Preact-style props ("class") into React-style ("className")
 */
import { NodePath, PluginObj } from "@babel/core";
import { CallExpression, JSXAttribute } from "@babel/types";
import {ATTRIBUTES_PREACT_TO_REACT} from '../../common/preact-prop-names';

const propNameFn = 'propName'; 

 export default function (babel: any): PluginObj {
   const {types: t} = babel;
 
   function getReactStyle(name: string): string {
     return ATTRIBUTES_PREACT_TO_REACT[name] ?? name;
   }
 
   return {
     name: 'react-style-props',
     visitor: {
       JSXAttribute(path: NodePath<JSXAttribute>) {
         const reactStyle = getReactStyle((path.node.name as any).name);
         path.node.name.name = reactStyle;
       },
       CallExpression(path: NodePath<CallExpression>) {
         if (!t.isIdentifier(path.node.callee, {name: propNameFn})) {
           return;
         }
         const arg: NodePath<Node> = path.get('arguments.0') as any;
         if (!arg.isStringLiteral()) {
           throw arg.buildCodeFrameError('Should be string literal');
         }
         const reactStyle = getReactStyle(arg.node.value);
         path.replaceWith(t.stringLiteral(reactStyle));
       },
     },
   };
 };
 