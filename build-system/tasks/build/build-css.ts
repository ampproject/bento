import * as fastGlob from 'fast-glob';
import { mkdirSync } from 'fs';
import { basename } from 'path';
import { outputFile } from 'fs-extra';
import { endBuildStep, getComponentDir, watchDebounceDelay } from "./helpers";
import { watch } from 'chokidar';
import { debounce } from '../../common/debounce';
import { getInitializedComponents } from './components-cache';
import type { BuildOptions, ComponentBundle } from "../types";
import { jsifyCssAsync } from '../css/jsify-css';


async function buildComponentCss(bundle: ComponentBundle<string>, options: BuildOptions) {
  const { version } = bundle;
  mkdirSync('build/css', { recursive: true });

  const bundles = await fastGlob(`${getComponentDir(bundle)}/*.css`);

  await Promise.all(
    bundles.map(async (filename) => {
      const name = basename(filename, '.css');
      const css = await jsifyCssAsync(filename);
      await writeCssBinaries(name, version, css);
      // TODO (rileyajones) verify this is no longer necessary.
      // await buildBentoCss(name, versions, css);
    })
  );
}

async function writeCssBinaries(name: string, version: string, css: string): Promise<void> {
  const jsCss = 'export const CSS = ' + JSON.stringify(css) + ';\n';
  await Promise.all([
    writeVersion(`build/${name}`, 'css.js', version, jsCss),
    writeVersion(`build/css/${name}`, 'css', version, css)
  ]);
}

function writeVersion(prefix: string, fileExtension: string, version: string, content: string): Promise<void> {
  const outfile = `${prefix}-${version}.${fileExtension}`;
  return outputFile(outfile, content);
}

/**
 * Compile all the css and drop in the build folder
 */
export async function compileCss(options: BuildOptions = {}) {
  if (options.watch) {
    watch('css/**/*.css').on(
      'change',
      debounce(compileCss, watchDebounceDelay)
    );
  }

  const startTime = Date.now();
  // Must be in order because some iterations write while others append.
  const components = getInitializedComponents();
  await Promise.all(Object.values(components).map((component) => buildComponentCss(component, options)));
  endBuildStep('Recompiled all CSS files into', 'build/', startTime);
}
