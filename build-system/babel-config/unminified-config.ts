import {getImportResolverPlugin} from './import-resolver';
import {getReplacePlugin} from './helpers';
import * as minimist from "minimist";
const argv = minimist(process.argv.slice(2));

/**
 * Gets the config for babel transforms run during `amp build`.
 */
export function getUnminifiedConfig() {
  const reactJsxPlugin = [
    '@babel/plugin-transform-react-jsx',
    {
      pragma: 'Preact.createElement',
      pragmaFrag: 'Preact.Fragment',
      useSpread: true,
    },
  ];

  const targets =
    argv.esm || argv.sxg ? {esmodules: true} : {browsers: ['Last 2 versions']};
  const presetEnv = [
    '@babel/preset-env',
    {
      bugfixes: true,
      modules: false,
      loose: true,
      targets,
      shippedProposals: true,
    },
  ];
  const presetTypescript = [
    '@babel/preset-typescript',
    {jsxPragma: 'Preact', jsxPragmaFrag: 'Preact.Fragment'},
  ];
  const replacePlugin = getReplacePlugin();
  const unminifiedPlugins = [
    './build-system/babel-plugins/babel-plugin-jsx-style-object',
    getImportResolverPlugin(),
    argv.coverage ? 'babel-plugin-istanbul' : null,
    replacePlugin,
    './build-system/babel-plugins/babel-plugin-transform-json-import',
    './build-system/babel-plugins/babel-plugin-transform-json-configuration',
    './build-system/babel-plugins/babel-plugin-transform-jss',
    './build-system/babel-plugins/babel-plugin-transform-fix-leading-comments',
    './build-system/babel-plugins/babel-plugin-transform-promise-resolve',
    './build-system/babel-plugins/babel-plugin-transform-amp-extension-call',
    './build-system/babel-plugins/babel-plugin-dom-jsx-svg-namespace',
    reactJsxPlugin,
  ].filter(Boolean);
  const unminifiedPresets = [presetTypescript, presetEnv];
  return {
    compact: false,
    plugins: unminifiedPlugins,
    presets: unminifiedPresets,
    sourceMaps: true,
    assumptions: {
      constantSuper: true,
      noClassCalls: true,
      setClassMethods: true,
      setPublicClassFields: true,
    },
  };
}
