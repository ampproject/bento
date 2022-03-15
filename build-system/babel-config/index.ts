import {readdirSync} from 'fs';

/**
 * Populates a single object with the babel configs from all the *-config.js
 * files in this directory.
 *
 * @return {!Object}
 */
function getAllBabelConfigs() {
  const files = readdirSync(__dirname);
  const babelConfigFiles = readdirSync(__dirname)
    .filter((file) => file.includes('-config.ts'));
  const babelConfigs = babelConfigFiles.map((file) => require(`./${file}`));
  return Object.assign({}, ...babelConfigs);
}

export default getAllBabelConfigs();
