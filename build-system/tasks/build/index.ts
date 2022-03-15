import { JS_BUNDLES } from "../../compile/bundles.config";
import type { BuildOptions } from "../types";
import { buildBundle } from "./build-bundle";
import { compileCss } from "./build-css";
import * as minimist from 'minimist';
import { buildComponents } from "./build-components";
import { generateRuntimeEntrypoint } from "./generate";
import { patchPreact } from "../../common/update-packages";
const argv = minimist(process.argv.slice(2));

async function buildCoreRuntime(options: BuildOptions) {
  patchPreact();
  const bundle = JS_BUNDLES['bento.js'];
  await generateRuntimeEntrypoint(bundle, options);
  return buildBundle(bundle, options);
}

export async function build() {
  process.env.NODE_ENV = 'development';
  const options: BuildOptions = {
    fortesting: argv.fortesting,
    localDev: true,
    minify: false,
    watch: argv.watch,
  };
  // Prebuild Steps
  await compileCss(options);
  // TODO do we need to generate frames.html?

  // TODO build these in parallel based on parameters.
  await buildCoreRuntime(options);
  await buildComponents(options);
}

if (require.main === module) {
  build();
}
