import type { Format } from 'esbuild';

export type BuildOptions = {
  babelCaller?: string;
  continueOnError?: boolean;
  fortesting?: any;
  localDev?: boolean;
  minify?: boolean;
  watch?: boolean;
  wrapper?: CompileWrapper;
};

export type ComponentBuildOptions = BuildOptions & {
  binaries?: ExtensionBinary[];
  isRebuild?: boolean;
}

export type ExtensionBinary = {
  entryPoint: string;
  outfile: string;
  external: string[];
  remap?: Record<string, string>;
  wrapper?: CompileWrapper;
  babelCaller?: string;
}

export type ComponentBundleOptions = {
  hasCss: boolean;
};

// TODO (rileyajones) update bundles to a seperate attribute if multiple versions are needed.
export type ComponentBundle<T extends string | string[] = string | string[]> = {
  name: string;
  version: T;
  options: ComponentBundleOptions;
};

export type JsBundleOptions = {
  includePolyfills?: boolean;
  toName: string;
  minifiedName: string;
  aliasName?: string;
};

export type JsBundle = {
  srcDir: string;
  srcFilename: string;
  destDir: string;
  minifiedDestDir: string;
  options: JsBundleOptions;
}

export type EsbuildCompileOptions = BuildOptions & JsBundleOptions & {
  externalDependencies?: string[];
  remapDependencies?: Record<string, string>;
  name?: string;
  onWatchBuild?: (result: Promise<void>) => void;
  outputFormat?: Format;
};

export type CompileWrapper = 'bento' | 'none';
