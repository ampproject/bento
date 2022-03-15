const lodashDebounce = require('lodash.debounce'); // This module cannot be imported using `import`

type DebouncableFunction<S, T> = (...args: S[]) => T;

/**
 * Creates a debounced function that delays invoking func until after wait
 * milliseconds have elapsed since the last time the debounced function was invoked.
 *
 * Notably, invokes the function both the leading and trailing edges of the event.
 */
export function debounce<S, T>(func: DebouncableFunction<S, T>, wait: number): DebouncableFunction<S, T> {
  return lodashDebounce(func, wait, {leading: true, trailing: true});
}
