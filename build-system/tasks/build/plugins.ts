import {posix} from "path";
import { getEsbuildBabelPlugin } from "../../common/esbuild-babel";
import { build, Plugin } from 'esbuild';
import type { BuildOptions, EsbuildCompileOptions } from "../types";

export function getEsbuildPlugins(options: EsbuildCompileOptions): {
  plugins: Plugin[];
  babelMaps: Map<string, unknown>;
} {
  const babelCaller = options.babelCaller ?? (options.minify ? 'minified' : 'unminified');
  const babelMaps = new Map<string, unknown>();
  const babelPlugin = getEsbuildBabelPlugin(
    babelCaller,
    /* enableCache */ true,
    { babelMaps }
  );
  const plugins: Plugin[] = [babelPlugin];

  if (options.remapDependencies) {
    plugins.unshift(remapDependenciesPlugin(options));
  }

  return { plugins, babelMaps };
}


/**
 * Returns the list of dependencies for a given JS entrypoint by having esbuild
 * generate a metafile for it. Uses the set of babel plugins that would've been
 * used to compile the entrypoint.
 */
 export async function getDependencies(entryPoint: string, options: BuildOptions): Promise<string[]> {
  const caller = options.minify ? 'minified' : 'unminified';
  const babelPlugin = getEsbuildBabelPlugin(caller, /* enableCache */ true);
  const result = await build({
    entryPoints: [entryPoint],
    bundle: true,
    write: false,
    metafile: true,
    plugins: [babelPlugin],
  });
  return Object.keys(result.metafile?.inputs ?? {});
}

/**
 * Generates a plugin to remap the dependencies of a JS bundle.
 */
function remapDependenciesPlugin(options: EsbuildCompileOptions): Plugin {
  const remaps = Object.entries(options.remapDependencies ?? {}).map(
    ([path, value]) => ({ regex: new RegExp(`^${path}$`), value })
  );
  const external = options.externalDependencies ?? [];
  return {
    name: 'remap-dependencies',
    setup(build) {
      build.onResolve({ filter: /.*/ }, (args) => {
        const { path: importPath, resolveDir } = args;
        const dep = importPath.startsWith('.')
          ? posix.join(resolveDir, importPath)
          : importPath;
        for (const { regex, value } of remaps) {
          if (!regex.test(dep)) {
            continue;
          }
          const isExternal = external.includes(value);
          return {
            path: isExternal ? value : require.resolve(value),
            external: isExternal,
          };
        }
      });
    },
  };
}
