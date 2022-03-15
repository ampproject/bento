import { join } from 'path';
import { getDependencies } from './plugins';
import { watchDebounceDelay, watchedEntryPoints } from './helpers';
import { watch } from 'chokidar';
import { debounce } from '../../common/debounce';
import { esbuildCompile } from './esbuild-compile';
import type { BuildOptions, JsBundle } from '../types';

export async function buildBundle(bundle: JsBundle, buildOptions: BuildOptions) {
  const { srcDir, srcFilename, options: bundleOptions } = bundle;
  const destDir = buildOptions.minify ? bundle.minifiedDestDir : bundle.destDir;
  const options = {
    ...bundleOptions,
    ...buildOptions
  };
  const entryPoint = join(srcDir, srcFilename);
  if (watchedEntryPoints.has(entryPoint)) {
    return;
  }
  if (options.watch) {
    watchedEntryPoints.add(entryPoint);
    const deps = await getDependencies(entryPoint, options);
    const watchFunc = async () => {
      // await doCompileJs({...options, continueOnError: true});
      await esbuildCompile(srcDir, srcFilename, destDir, options);
    };
    watch(deps).on('change', debounce<void, void>(watchFunc, watchDebounceDelay));
  }
  // TODO (rileyajones) add support for watch mode.
  await esbuildCompile(srcDir, srcFilename, destDir, options);
}
