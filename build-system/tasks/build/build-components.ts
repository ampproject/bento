import { BuildOptions, ComponentBundle } from "../types";
import { red } from 'kleur/colors';
import { getInitializedComponents } from "./components-cache";
import * as minimist from 'minimist';
import { log } from "../../common/logging";
import { endBuildStep } from "./helpers";
import { buildComponent } from "./build-component";
const argv = minimist(process.argv.slice(2));

/**
 * Process the command line arguments --nocomponents, --components, and
 * --components_from and return a list of the referenced components.
 *
 * @param {boolean} preBuild Used for lazy building of components.
 */
function getComponentsToBuild(components: Record<string, ComponentBundle<string>>, prebuild = false): Set<string> {
  const componentsToBuild = new Set<string>();
  if (argv.components) {
    if (typeof argv.components !== 'string') {
      log(red('ERROR:'), 'Missing list of components.');
      process.exit(1);
    }
    const explicitComponents = argv.components.replace(/\s/g, '').split(',');
    explicitComponents.forEach((component: string) => componentsToBuild.add(component));
  }
  if (!prebuild && !argv.nocomponents && !argv.components && !argv.core_runtime_only) {
    Object.values(components)
      .map((component) => component.name)
      .forEach((component) => componentsToBuild.add(component));
  }
  return componentsToBuild;
}

export async function buildComponents(options: BuildOptions) {
  const startTime = Date.now();
  const components = getInitializedComponents();
  const toBuild = getComponentsToBuild(components);
  const results = Object.values(components)
    .filter((component) => toBuild.has(component.name))
    .map((component) =>
      buildComponent(
        component,
        options,
      )
    );

  await Promise.all(results);
  if (results.length > 0) {
    endBuildStep(
      options.minify ? 'Minified all' : 'Compiled all',
      'components',
      startTime
    );
  }
}
