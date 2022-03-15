import { watch } from "chokidar";
import { outputFileSync, pathExistsSync } from 'fs-extra'
import { debounce } from "../../common/debounce";
import {join} from 'path';
import type { BuildOptions, ComponentBuildOptions, ComponentBundle, EsbuildCompileOptions } from "../types";
import { buildBinaries, buildNpmBinaries, buildNpmCss } from "./build-binaries";
import { generateEntrypointSource } from "./generate";
import { getComponentDir, watchDebounceDelay, watchedEntryPoints } from "./helpers";
import * as minimist from 'minimist';
import { esbuildCompile } from "./esbuild-compile";
import { getDependencies } from "./plugins";
const argv = minimist(process.argv.slice(2));

export async function buildComponent(bundle: ComponentBundle<string>, options: ComponentBuildOptions) {
  if (options.watch) {
    await watchComponent(bundle, options);
  }

  const promises: Promise<void>[] = [];
  const buildFilename = getBuildFilename(bundle);;

  const componentDir = getComponentDir(bundle);
  promises.push(buildNpmBinaries(bundle, buildFilename, options));
  promises.push(buildNpmCss(bundle, options));
  if (options.binaries) {
    promises.push(buildBinaries(componentDir, options.binaries, options));
  }
  if (options.isRebuild) {
    return Promise.all(promises);
  }

  // promises.push(
  //   buildComponentJs(bundle, buildFilename, {
  //     ...options,
  //     wrapper: 'none',
  //   })
  // );
  return Promise.all(promises);
}

/**
 * Build the JavaScript for the extension specified
 *
 * @param {string} name Name of the extension. Must be the sub directory in
 *     the components directory and the name of the JS and optional CSS file.
 * @param {!Object} options
 * @return {!Promise}
 */
 async function buildComponentJs(bundle: ComponentBundle<string>, filename: string, options: BuildOptions): Promise<void> {
   const {name, version} = bundle;
  const componentDir = getComponentDir(bundle);

  await compileJs(`${componentDir}/`, filename, './dist/v0', {
    ...options,
    toName: `${name}-${version}.max.js`,
    minifiedName: `${name}-${version}.js`,
    // TODO(rileyajones): Do we need to support -latest versions?
    wrapper: 'none',
  });
}

/**
 * Bundles (max) or compiles (min) a given JavaScript file entry point.
 *
 * @param {string} srcDir Path to the src directory
 * @param {string} srcFilename Name of the JS source file
 * @param {string} destDir Destination folder for output script
 * @param {?Object} options
 * @return {!Promise}
 */
 async function compileJs(srcDir: string, srcFilename: string, destDir: string, options: EsbuildCompileOptions): Promise<void> {
  const entryPoint = join(srcDir, srcFilename);
  if (watchedEntryPoints.has(entryPoint)) {
    return;
  }

  if (options.watch) {
    watchedEntryPoints.add(entryPoint);
    const deps = await getDependencies(entryPoint, options);
    const watchFunc = async () => {
      await doCompileJs({...options, continueOnError: true});
    };
    watch(deps).on('change', debounce<void, void>(watchFunc, watchDebounceDelay));
  }

  /**
   * Actually performs the steps to compile the entry point.
   */
  async function doCompileJs(options: EsbuildCompileOptions): Promise<void> {
    const buildResult = esbuildCompile(srcDir, srcFilename, destDir, options);
    if (options.onWatchBuild) {
      options.onWatchBuild(buildResult);
    }
    await buildResult;
  }

  await doCompileJs(options);
}

/**
 * Bento extensions may specify their own bento-*.js file to specify custom
 * install logic. Otherwise, we generate an install script with the default
 * configuration.
 */
function getBuildFilename(bundle: ComponentBundle<string>): string {
  const componentDir = getComponentDir(bundle);
  const { name } = bundle;

  const filename = `${name}.js`

  if (pathExistsSync(`${componentDir}/${filename}`)) {
    return filename;
  }
  const generatedFilename = `build/${filename}`;
  const generatedOutputFilename = `${componentDir}/${generatedFilename}`;
  const generatedSource = generateEntrypointSource(
    bundle,
    generatedOutputFilename
  );
  outputFileSync(generatedOutputFilename, generatedSource);
  return generatedFilename;
}

/**
 * Watches for non-JS changes within an components directory to trigger
 * recompilation.
 */
async function watchComponent(
  bundle: ComponentBundle<string>,
  options: BuildOptions
): Promise<void> {
  /**
   * Steps to run when a watched file is modified.
   */
  function watchFunc() {
    buildComponent(bundle, {
      ...options,
      continueOnError: true,
      isRebuild: true,
      watch: false,
    });
  }

  const cssDeps = `${getComponentDir(bundle)}/**/*.css`;
  const ignored = /dist/; //should not watch npm dist folders.
  watch([cssDeps], { ignored }).on(
    'change',
    debounce<void, void>(watchFunc, watchDebounceDelay)
  );
}

