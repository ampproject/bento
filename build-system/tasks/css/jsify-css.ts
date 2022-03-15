// @ts-ignore
import * as cssImports from 'css-imports';
import { red } from 'kleur/colors';
import * as fs from 'fs-extra';
import * as postcss from 'postcss';
import * as postcssImport from 'postcss-import';
import * as cssnano from 'cssnano';
import { batchedRead, md5, TransformCache } from '../../common/transform-cache';
import { log } from '../../common/logging';
import { dirname, join } from 'path';

// NOTE: see https://github.com/ai/browserslist#queries for `browsers` list
const browsersList = {
  overrideBrowserslist: [
    'last 5 ChromeAndroid versions',
    'last 5 iOS versions',
    'last 3 FirefoxAndroid versions',
    'last 5 Android versions',
    'last 2 ExplorerMobile versions',
    'last 2 OperaMobile versions',
    'last 2 OperaMini versions',
  ],
};


// See https://cssnano.co/docs/what-are-optimisations for full list.
// We try and turn off any optimization that is marked unsafe.
const cssNanoDefaultOptions = {
  autoprefixer: false,
  convertValues: false,
  discardUnused: false,
  cssDeclarationSorter: false,
  // `mergeIdents` this is only unsafe if you rely on those animation names in
  // JavaScript.
  mergeIdents: true,
  reduceIdents: false,
  reduceInitial: false,
  zindex: false,
  svgo: {
    encode: false,
  },
};

const packageJsonPath = join(__dirname, '..', '..', '..', 'package.json');

let environmentHash: null | Promise<string> = null;

export type CssTransformResult = {
  css: string;
  warnings: string[];
};

/**
 * Used to cache css transforms done by postcss.
 */
let transformCache: TransformCache<CssTransformResult>;

/**
 * Computes the transitive closure of CSS files imported by the given file.
 */
async function getCssImports(cssFile: string): Promise<string[]> {
  const contents = await fs.readFile(cssFile);
  const topLevelImports: string[] = cssImports(contents)
    .map((result: any) => result.path)
    .filter((importedFile: string) => !importedFile.startsWith('http'))
    .map((importedFile: string) => join(dirname(cssFile), importedFile));
  if (topLevelImports.length == 0) {
    return topLevelImports;
  }
  const nestedImports = await Promise.all(
    topLevelImports.map(async (file: string) => await getCssImports(file))
  );
  return topLevelImports.concat(nestedImports.flat());
}

/**
 * 'Jsify' a CSS file - Adds vendor specific css prefixes to the css file,
 * compresses the file, removes the copyright comment, and adds the sourceURL
 * to the stylesheet
 *
 * @param {string} filename css file
 * @return {!Promise<string>} that resolves with the css content after
 *    processing
 */
export async function jsifyCssAsync(filename: string): Promise<string> {
  const { contents, hash: filehash } = await batchedRead(filename);
  const imports = await getCssImports(filename);
  const importHashes = await Promise.all(
    imports.map(async (importedFile) => (await batchedRead(importedFile)).hash)
  );
  const hash = md5(filehash, ...importHashes, await getEnvironmentHash());
  const result = await transformCss(contents, hash, filename);

  result.warnings.forEach((warn) => log(red(warn)));
  return result.css + '\n/*# sourceURL=/' + filename + '*/';
}

function getEnvironmentHash(): Promise<string> {
  if (environmentHash) {
    return environmentHash;
  }

  // We want to set environmentHash to a promise synchronously s.t.
  // we never end up with multiple calculations at the same time.
  environmentHash = Promise.resolve().then(async () => {
    const packageJsonHash = md5(await fs.promises.readFile(packageJsonPath));
    const cssOptions = JSON.stringify({ cssNanoDefaultOptions, browsersList });
    return md5(packageJsonHash, cssOptions);
  });
  return environmentHash;
}

/**
 * Transform a css string using postcss.

 * @param {string} contents the css text to transform
 * @param {!string=} opt_filename the filename of the file being transformed. Used for sourcemaps generation.
 * @return {!Promise<CssTransformResultDef>} that resolves with the css content after
 *    processing
 */
 export async function transformCssString(contents: string, opt_filename?: string): Promise<CssTransformResult> {
  const hash = md5(contents);
  return transformCss(contents, hash, opt_filename);
}

async function transformCss(contents: string, hash: string, opt_filename?: string): Promise<CssTransformResult> {
  if (!transformCache) {
    transformCache = new TransformCache('.css-cache');
  }
  const cached = transformCache.get(hash);
  if (cached) {
    return cached;
  }

  const transformed = transform(contents, opt_filename);
  transformCache.set(hash, transformed);
  return transformed;
}

async function transform(contents: string, opt_filename?: string): Promise<CssTransformResult> {
  const cssnanoTransformer = cssnano({
    preset: ['default', cssNanoDefaultOptions],
  });
  const autoprefixer = await import('autoprefixer'); // Lazy-imported to speed up task loading.
  const cssprefixer = (autoprefixer as any)(browsersList);
  const transformers = [postcssImport, cssprefixer, cssnanoTransformer];
  return postcss
    .default(transformers) // @ts-ignore
    .process(contents, { 'from': opt_filename })
    .then((result) => ({
      css: result.css,
      warnings: result.warnings().map((warning) => warning.toString()),
    }));
}
