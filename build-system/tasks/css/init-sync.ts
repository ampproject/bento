import {CssTransformResult, transformCssString} from './jsify-css';

/**
 * Wrapper for the asynchronous transformCssString that is used by transformCssSync()
 * in build-system/tasks/css/jsify-css-sync.js.
 */
export function init() {
  return function (cssStr: string, opt_filename: any): Promise<CssTransformResult> {
    return Promise.resolve(transformCssString(cssStr, opt_filename));
  };
}
