import * as React from 'react';
import {useScope} from '@toolkit/core/providers/Client';
import {providerKeyFor, use} from '@toolkit/core/providers/Providers';

type ReloadFn = () => void;
export const ReloadState = providerKeyFor<{reloads: number}>({
  name: 'reload-state',
  defaultValue: {reloads: 0},
});

/**
 * Reload state is used to know whent to skip the cache and reload data on a page.
 *
 * If the value changes, you should reload any data cached from the previous value.
 */
export function useReloadState(): number {
  return use(ReloadState).reloads;
}

/**
 *
 * Call `const reload=useReload(); reload();` when:
 * - User initiates a page refresh, or
 * - You want the surrounding screen to re-request the initially loaded data
 */
export function useReload(): ReloadFn {
  const {reloads} = use(ReloadState);
  const scope = useScope('screen');

  return function reload() {
    scope.provideValue(ReloadState, {reloads: reloads + 1});
  };
}
