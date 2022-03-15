import { componentBundles, verifyBundles } from '../../compile/bundles.config';
import { ComponentBundle } from "../types";

type ComponentNameVersion = string;

const componentsCache: Record<string, ComponentBundle<string>> = {};

/**
 * Returns an object keyed by each version of each component.
 */
export function getInitializedComponents(): Record<ComponentNameVersion, ComponentBundle<string>> {
  if (Object.keys(componentsCache).length > 0) {
    return componentsCache;
  }
  verifyBundles();
  componentBundles.forEach(({name, version, options}) => {
    const versions = Array.isArray(version) ? version : [version];
    versions.forEach((v) => {
      componentsCache[`${name}-${v}`] = {
        name,
        version: v,
        options,
      };
    });
  });

  return componentsCache;
}
