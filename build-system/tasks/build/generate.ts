import * as dedent from 'dedent';
import { posix } from 'path';
import { outputFile } from 'fs-extra';
import { BuildOptions, ComponentBundle, JsBundle } from '../types';
import { getSharedSymbols } from './shared-symbols';

function getRuntimeEntrypointSource() {
  return dedent(`
  import {isEsm} from '#core/mode';
  import {install as installCustomElements} from '#polyfills/custom-elements';

  ${Object.entries(getSharedSymbols())
      .map(
        ([name, symbols]) => `import {${symbols.join(', ')}} from '${name}';`
      )
      .join('\n')}

  if (!isEsm()) {
    installCustomElements(self, class {});
  }

  const bento = self.BENTO || [];

  bento['_'] = {
  ${Object.entries(getSharedSymbols())
      .map(([name, symbols]) => [
        `// ${name}`,
        ...symbols.map((symbol) => `'${symbol}': ${symbol},`),
      ])
      .flat()
      .join('\n')}
  };

  bento.push = (fn) => {
    fn();
  };

  self.BENTO = bento;

  for (const fn of bento) {
    bento.push(fn);
  }
`);
}

export function generateRuntimeEntrypoint(bundle: JsBundle, options: BuildOptions) {
  const { srcDir, srcFilename } = bundle;
  const filename = `${srcDir}/${srcFilename}`;
  return outputFile(filename, getRuntimeEntrypointSource());
}

export function generateEntrypointSource({name}: ComponentBundle<string>, outputFilename: string) {
  const bentoCePath = posix.relative(
    posix.dirname(outputFilename),
    'src/preact/bento-ce'
  );

  return dedent(`
    import {BaseElement} from '../base-element';
    import {defineBentoElement} from '${bentoCePath}';

    function defineElement() {
      defineBentoElement(__name__, BaseElement);
    }

    defineElement();
  `).replace('__name__', JSON.stringify(name));
}
