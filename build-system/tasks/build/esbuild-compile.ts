import * as esbuild from 'esbuild';
import { outputFile, copySync } from 'fs-extra';
import { dirname, join } from 'path';
import { EsbuildCompileOptions } from '../types';
import { endBuildStep, maybeToEsmName } from './helpers';
import { minify } from './minify';
import { massageSourcemaps } from '../sourcemaps';
import { getEsbuildPlugins } from './plugins';
import * as minimist from 'minimist';
import { getWrapper } from './wrappers';
const argv = minimist(process.argv.slice(2));


export async function esbuildCompile(srcDir: string, srcFilename: string, destDir: string, options: EsbuildCompileOptions) {
  const startTime = Date.now();
  const entryPoint = join(srcDir, srcFilename);
  const filename = options.minify
    ? options.minifiedName
    : options.toName ?? srcFilename;
  const destFilename = maybeToEsmName(filename);
  const destFile = join(destDir, filename);

  const { banner, footer } = getWrapper(options);
  const { plugins, babelMaps } = getEsbuildPlugins(options);

  let result: null | esbuild.BuildResult = null;
  // try {
  await build(startTime)
  // } catch (err) {
  //   handleBundleError(err, !!options.watch, destFilename)
  // }

  async function build(startTime: number): Promise<void> {
    if (!result) {
      result = await esbuild.build({
        entryPoints: [entryPoint],
        bundle: true,
        sourcemap: true,
        sourceRoot: dirname(destFile),
        sourcesContent: !!argv.full_sourcemaps,
        outfile: destFile,
        plugins,
        format: options.outputFormat,
        banner,
        footer,
        // For es5 builds, ensure esbuild-injected code is transpiled.
        target: argv.esm ? 'es6' : 'es5',
        incremental: !!options.watch,
        logLevel: 'silent',
        external: options.externalDependencies,
        mainFields: ['module', 'browser', 'main'],
        write: false,
      });
    } else {
      result = await result.rebuild!();
    }
    const outputFiles = result.outputFiles ?? [];
    let code = outputFiles.find(({ path }) => !path.endsWith('.map'))!.text;
    let map = outputFiles.find(({ path }) => path.endsWith('.map'))!.text;

    if (options.minify) {
      const { code: minified, map: minifiedMap } = await minify(code);
      code = minified;
      map = await massageSourcemaps([minifiedMap, map], babelMaps, options);
    } else {
      map = await massageSourcemaps([map], babelMaps, options);
    }

    await Promise.all([
      outputFile(destFile, code),
      outputFile(`${destFile}.map`, map),
    ]);

    await finishBundle(destDir, destFilename, options, startTime);
  }
}

/**
 * Performs the final steps after a JS file is bundled and optionally minified
 * with esbuild and babel.
 */
async function finishBundle(destDir: string, destFilename: string, options: EsbuildCompileOptions, startTime: number) {
  const logPrefix = options.minify ? 'Minified' : 'Compiled';
  let { aliasName } = options;
  if (aliasName) {
    if (!options.minify) {
      aliasName = aliasName.replace(/\.js$/, '.max.js');
    }
    aliasName = maybeToEsmName(aliasName);
    copySync(
      join(destDir, destFilename),
      join(destDir, aliasName)
    );
    endBuildStep(logPrefix, `${destFilename} → ${aliasName}`, startTime);
  } else {
    const loggingName =
      !destFilename.startsWith('amp-')
        ? `${options.name} → ${destFilename}`
        : destFilename;
    endBuildStep(logPrefix, loggingName, startTime);
  }
}
