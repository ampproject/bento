import type { BuildOptions } from "./types";
import { basename, dirname, join, posix } from 'path';
import * as remapping from '@ampproject/remapping';
import type { SourceMapInput, SourceMapLoader } from '@ampproject/remapping';
import { VERSION } from '../compile/internal-version';
import * as minimist from 'minimist';
const argv = minimist(process.argv.slice(2));

export function massageSourcemaps(sourcemaps: SourceMapInput | SourceMapInput[], babelMaps: Map<string, any>, options: BuildOptions): string {
  /**
   * Something about the typing of this module really freaks out TypeScript.
   * Importing via `import remapping from '@ampproject/remapping'` results in remampping being undefined.
   * However, importing via `import * as remapping from '@ampproject/remapping'` results in TypeScript thinking
   * that remapping is an object with a `default` property. However, it is actually a function.
   */ 
  const remap: typeof remapping.default = remapping as any;
  const remapped = remap(
    sourcemaps,
    getSourceMapLoader(babelMaps),
    !argv.full_sourcemaps
  );

  remapped.sources = remapped.sources.map((source) => {
    if (source?.startsWith('/__SOURCE__/')) {
      return source.slice('/__SOURCE__/'.length);
    }
    return source;
  });
  remapped.sourceRoot = getSourceRoot(options);
  if (remapped.file) {
    remapped.file = basename(remapped.file);
  }

  return remapped.toString();
}

function getSourceMapLoader(babelMaps: Map<string, any>): SourceMapLoader {
  const root = process.cwd();
  return (f: string) => {
    if (f.includes('__SOURCE__')) {
      return null;
    }
    const file = join(root, f);
    // The Babel tranformed file and the original file have the same path,
    // which makes it difficult to distinguish during remapping's load phase.
    // We perform some manual path mangling to destingish the babel files
    // (which have a sourcemap) from the actual source file by pretending the
    // source file exists in the '__SOURCE__' root directory.
    const map = babelMaps.get(file);
    if (!map) {
      throw new Error(`failed to find sourcemap for babel file "${f}"`);
    }
    return {
      ...map,
      sourceRoot: posix.join('/__SOURCE__/', dirname(f)),
    };
  }
}

/**
 * Computes the base url for sourcemaps. Custom sourcemap URLs have placeholder
 * {version} that should be replaced with the actual version. Also, ensures
 * that a trailing slash exists.
 */
function getSourceRoot(options: BuildOptions): string {
  if (argv.sourcemap_url) {
    return String(argv.sourcemap_url)
      .replace(/\{version\}/g, VERSION)
      .replace(/([^/])$/, '$1/');
  }
  if (options.fortesting || !argv._.includes('dist')) {
    return 'http://localhost:8000/';
  }
  return `https://raw.githubusercontent.com/ampproject/bento/${VERSION}/`;
}

module.exports = {
  massageSourcemaps,
};
