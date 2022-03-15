import {readFileSync} from 'fs';
import {join} from 'path';
const moduleResolver =  require('babel-plugin-module-resolver');

const TSCONFIG_PATH = join(__dirname, '..', '..', 'tsconfig.base.json');
let tsConfigPaths: null | Record<string, string> = null;

/**
 * Reads import paths from tsconfig.json. This file is used by VSCode for
 * Intellisense/auto-import. Rather than duplicate and require updating both
 * files, we can read from it directly. JSConfig format looks like:
 * { compilerOptions: { paths: {
 *   '#foo/*': ['./src/foo/*'],
 *   '#bar/*': ['./bar/*'],
 * } } }
 * This method outputs the necessary alias object for the module-resolver Babel
 * plugin, which excludes the "/*" for each. The above paths would result in:
 * {
 *   '#foo': './src/foo',
 *   '#bar': './bar',
 * }
 */
export function readJsconfigPaths(): Record<string, string> {
  if (!tsConfigPaths) {
    const tsConfig = JSON.parse(readFileSync(TSCONFIG_PATH, 'utf8'));
    const aliasPaths: [string, string[]] = tsConfig.compilerOptions.paths;

    const stripSuffix = (s: string) => s.replace(/\/\*$/, '');
    // eslint-disable-next-line local/no-deep-destructuring
    const aliases = Object.entries(aliasPaths)
      .map(([alias, [dest]]) => [
      stripSuffix(alias),
      stripSuffix(dest),
    ]);

    tsConfigPaths = Object.fromEntries(aliases);
  }

  return tsConfigPaths!;
}

/**
 * Import map configuration.
 */
export function getImportResolver() {
  return {
    root: ['.'],
    alias: readJsconfigPaths(),
    extensions: ['.js', '.jsx', '.ts', '.tsx'],
    stripExtensions: [],
    babelOptions: {
      caller: {
        name: 'import-resolver',
      },
    },
  };
}

/**
 * Produces an alias map with paths relative to the provided root.
 */
export function getRelativeAliasMap(rootDir: string): Record<string, string> {
  return Object.fromEntries(
    Object.entries(getImportResolver().alias).map(([alias, destPath]) => [
      alias,
      join(rootDir, destPath),
    ])
  );
}

/**
 * Import resolver Babel plugin configuration.
 */
export function getImportResolverPlugin(): [string, ReturnType<typeof getImportResolver>] {
  return ['module-resolver', getImportResolver()];
}

/**
 * Resolves a filepath using the same logic as the rest of our build pipeline (babel module-resolver).
 * The return value is a relative path from the amphtml folder.
 */
export function resolvePath(filepath: string): string {
  // 2nd arg is a file from which to make a relative path.
  // The actual file doesn't need to exist. In this case it is process.cwd()/anything
  return moduleResolver.resolvePath(filepath, 'anything', getImportResolver());
}
