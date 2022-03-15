import { relative } from 'path';
import { loadOptions, transformAsync } from '@babel/core';
import { TransformCache, batchedRead, md5 } from './transform-cache';
import type { BabelFileResult, TransformOptions } from '@babel/core';
import type { Plugin } from 'esbuild';

type CacheMessageDef = {
  filename: string;
  code: string;
  map: unknown;
};

/**
 * Used to cache babel transforms done by esbuild.
 */
let transformCache: TransformCache<CacheMessageDef>;

type EsbuildBablePluginCallbacks = {
  preSetup?: () => void;
  postLoad?: () => void;
  babelMaps?: Map<string, unknown>;
};

/**
 * Creates a babel plugin for esbuild for the given caller. Optionally enables
 * caching to speed up transforms.
 */
export function getEsbuildBabelPlugin(
  callerName: string,
  enableCache: boolean,
  callbacks: EsbuildBablePluginCallbacks = {}): Plugin {
  const { preSetup = () => { }, postLoad = () => { }, babelMaps } = callbacks;

  async function transformContents(filename: string, contents: string, hash: string, babelOptions: TransformOptions): Promise<CacheMessageDef> {
    if (enableCache) {
      if (!transformCache) {
        transformCache = new TransformCache('.babel-cache');
      }
      const cached = transformCache.get(hash);
      if (cached) {
        return cached;
      }
    }

    const promise = transformAsync(contents, babelOptions)
      .then((result) => {
        const { code, map } = result as BabelFileResult;
        return { filename, code: code || '', map };
      });

    if (enableCache) {
      transformCache.set(hash, promise);
    }

    return promise.finally(postLoad);
  }

  return {
    name: 'babel',

    async setup(build) {
      preSetup();

      build.onLoad(
        { filter: /\.(cjs|mjs|js|jsx|ts|tsx)$/, namespace: '' },
        async (file) => {
          const filename = file.path;
          const babelOptions = loadOptions({ caller: { name: callerName }, filename }) || {};

          const { contents, hash } = await batchedRead(filename);
          const rehash = md5(
            JSON.stringify({
              callerName,
              filename,
              hash,
              babelOptions,
              argv: process.argv.slice(2),
            })
          );

          const transformed = await transformContents(
            filename,
            contents,
            rehash,
            getFileBabelOptions(babelOptions, filename)
          );
          babelMaps?.set(filename, transformed.map);
          return { contents: transformed.code };
        }
      );
    },
  };
}

const CJS_TRANSFORMS = new Set([
  'transform-modules-commonjs',
  'proposal-dynamic-import',
  'syntax-dynamic-import',
  'proposal-export-namespace-from',
  'syntax-export-namespace-from',
]);


function getFileBabelOptions(babelOptions: TransformOptions, filename: string): TransformOptions {
  // Patch for leaving files within node_modules as esm, since esbuild will break when trying
  // to process a module file that contains CJS exports. This function is called after
  // babel.loadOptions, therefore all of the plugins from preset-env have already been applied.
  // and must be disabled individually.
  if (filename.includes('node_modules')) {
    const plugins = babelOptions.plugins?.filter(
      ({ key }: any) => !CJS_TRANSFORMS.has(key)
    );
    babelOptions = { ...babelOptions, plugins };
  }

  // The amp runner automatically sets cwd to the `amphtml` directory.
  const root = process.cwd();
  const filenameRelative = relative(root, filename);

  return {
    ...babelOptions,
    filename,
    filenameRelative,
  };
}
