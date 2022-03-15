import { join } from 'path';
import { getMinifiedConfig } from './minified-config';
import { getUnminifiedConfig } from './unminified-config';

export function mergeReactBabelConfig(config: any) {
  const rootDir = join(__dirname, '../../');
  return {
    ...config,
    plugins: [
      join(
        rootDir,
        './build-system/babel-plugins/babel-plugin-react-style-props'
      ),
      ...(config.plugins || []),
    ],
  };
}

export function getReactUnminifiedConfig() {
  return mergeReactBabelConfig(getUnminifiedConfig());
}

export function getReactMinifiedConfig() {
  return mergeReactBabelConfig(getMinifiedConfig());
}
