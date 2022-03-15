import {BUILD_CONSTANTS} from '../compile/build-constants';

/**
 * Computes options for minify-replace and returns the plugin object.
 */
 export function getReplacePlugin(): Array<string|Object> {
  /**
   * @param {string} identifierName the identifier name to replace
   * @param {boolean|string} value the value to replace with
   * @return {!Object} replacement options used by minify-replace plugin
   */
  function createReplacement(identifierName: string, value: boolean | string) {
    const replacement =
      typeof value === 'boolean'
        ? {type: 'booleanLiteral', value}
        : {type: 'stringLiteral', value};
    return {identifierName, replacement};
  }

  const replacements = Object.entries(BUILD_CONSTANTS).map(([ident, val]) =>
    createReplacement(ident, val)
  );


  return ['minify-replace', {replacements}];
}
