import { cyan, red } from 'kleur/colors';
import type { ComponentBundle } from '../tasks/types';
import { log } from '../common/logging';

// Reexporting to assert the type.
export const componentBundles: ComponentBundle[] = require('./bundles.config.components.json');

export const JS_BUNDLES = Object.freeze({
  'bento.js': {
    // This file is generated, so we find its source in the build/ dir
    // See compileBentoRuntime() and generateBentoRuntimeEntrypoint()
    srcDir: 'build/',
    srcFilename: 'bento.js',
    destDir: './dist',
    minifiedDestDir: './dist',
    options: {
      includePolyfills: false,
      toName: 'bento.max.js',
      minifiedName: 'bento.js',
      // For backwards-compat:
      aliasName: 'custom-elements-polyfill.js',
    },
  }
});

function verifyBundle(condition: boolean, field: string, message: string, name: string, found: string) {
  if (!condition) {
    log(red('ERROR:'), cyan(field), message, cyan(name), '\n' + found);
    process.exit(1);
  }
}

export function verifyBundles() {
  componentBundles.forEach((bundle, i) => {
    const bundleString = JSON.stringify(bundle, null, 2);
    verifyBundle(
      'name' in bundle,
      'name',
      'is missing from',
      '',
      bundleString
    );
    verifyBundle(
      i === 0 || bundle.name.localeCompare(componentBundles[i - 1].name) >= 0,
      'name',
      'is out of order. bentoBundles should be alphabetically sorted by name.',
      bundle.name,
      bundleString
    );
    verifyBundle(
      'version' in bundle,
      'version',
      'is missing from',
      bundle.name,
      bundleString
    );
  });
};
