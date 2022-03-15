import { mkdirSync, writeFile } from "fs-extra";
import { loadOptions, transform } from "@babel/core";
import * as fastGlob from "fast-glob";
import { join, parse } from 'path';
import type { BuildOptions, ComponentBundle, ExtensionBinary } from "../types";
import * as minimist from 'minimist';
import { endBuildStep, getComponentDir, maybeToNpmEsmName } from "./helpers";
import { esbuildCompile } from "./esbuild-compile";
import { batchedRead, TransformCache } from "../../common/transform-cache";
import { jssOptions } from "../../babel-config/jss-config";
const argv = minimist(process.argv.slice(2));

export function buildNpmBinaries(bundle: ComponentBundle<string>, entryPoint: string, options: BuildOptions) {
  const npm: Record<string, ExtensionBinary> = {
    preact: {
      entryPoint: 'component.js',
      outfile: 'component-preact.js',
      external: ['preact', 'preact/dom', 'preact/compat', 'preact/hooks'],
      remap: { 'preact/dom': 'preact' },
    },
    react: {
      babelCaller: options.minify ? 'react-minified' : 'react-unminified',
      entryPoint: 'component.js',
      outfile: 'component-react.js',
      external: ['react', 'react-dom'],
      remap: {
        'preact': 'react',
        '.*/preact/compat': 'react',
        'preact/hooks': 'react',
        'preact/dom': 'react-dom',
      },
    },
    bento: {
      entryPoint,
      outfile: 'web-component.js',
      external: [],
    },
  };

  const binaries = Object.values(npm);
  return buildBinaries(getComponentDir(bundle), binaries, options);
}

export async function buildNpmCss(bundle: ComponentBundle<string>, options: BuildOptions) {
  const componentDir = getComponentDir(bundle)
  const startCssTime = Date.now();
  const filenames = await fastGlob(join(componentDir, '**', '*.jss.js'));
  if (!filenames.length) {
    return;
  }

  const css = (await Promise.all(filenames.map(getCssForJssFile))).join('');
  const outfile = join(componentDir, 'dist', 'styles.css');
  await writeFile(outfile, css);
  endBuildStep('Wrote CSS', `${bundle.name} → styles.css`, startCssTime);
}

let jssCache: TransformCache<string> | null;

/**
 * Returns the minified CSS for a .jss.js file.
 */
async function getCssForJssFile(jssFile: string): Promise<string> {
  // Lazily instantiate the TransformCache
  if (!jssCache) {
    jssCache = new TransformCache('.jss-cache');
  }

  const { contents, hash } = await batchedRead(jssFile);
  const fileCss = await jssCache.get(hash);
  if (fileCss) {
    return fileCss;
  }

  const babelOptions: any = loadOptions({ caller: { name: 'jss' } });
  if (!babelOptions) {
    throw new Error('Could not find babel config for jss');
  }
  babelOptions['filename'] = jssFile;

  await transform(contents, babelOptions);
  jssCache.set(hash, Promise.resolve(jssOptions.css));
  return jssOptions.css;
}

export async function buildBinaries(componentDir: string, binaries: ExtensionBinary[], options: BuildOptions): Promise<void> {
  mkdirSync(`${componentDir}/dist`, {recursive: true});

  const promises = binaries.map((binary) => {
    const { babelCaller, entryPoint, external, outfile, remap, wrapper } = binary;
    const { name } = parse(outfile);
    const esm = argv.esm || argv.sxg || false;
    return esbuildCompile(componentDir + '/', entryPoint, `${componentDir}/dist`, {
      ...options,
      toName: maybeToNpmEsmName(`${name}.max.js`),
      minifiedName: maybeToNpmEsmName(`${name}.js`),
      aliasName: '',
      outputFormat: esm ? 'esm' : 'cjs',
      externalDependencies: external,
      remapDependencies: remap,
      wrapper: wrapper ?? options.wrapper,
      babelCaller: babelCaller ?? options.babelCaller,
    });
  });
  await Promise.all(promises);
}

