import * as terser from 'terser';
import * as minimist from 'minimist';
const argv = minimist(process.argv.slice(2));

/**
 * Name cache to help terser perform cross-binary property mangling.
 */
 const nameCache: terser.MinifyOptions['nameCache'] = {};

/**
 * Minify the code with Terser. Only used by the ESBuild.
 */
 export async function minify(code: string): Promise<{code: string, map: any, error?: Error}> {
  const terserOptions: terser.MinifyOptions = {
    mangle: {
      properties: {
        regex: '_AMP_PRIVATE_$',
        keep_quoted: /** @type {'strict'} */ ('strict'),
      },
    },
    compress: {
      // Settled on this count by incrementing number until there was no more
      // effect on minification quality.
      passes: 3,
    },
    output: {
      beautify: !!argv.pretty_print,
      keep_quoted_props: true,
    },
    sourceMap: true,
    toplevel: true,
    module: !!argv.esm,
    nameCache: argv.nomanglecache ? undefined : nameCache,
  };

  // Remove the local variable name cache which should not be reused between binaries.
  // See https://github.com/ampproject/amphtml/issues/36476
  (nameCache as any).vars = undefined;

  const minified = await terser.minify(code, terserOptions);
  return {code: minified.code ?? '', map: minified.map};
}
