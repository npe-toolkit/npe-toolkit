import * as React from 'react';
import {useScope} from '@toolkit/core/providers/Client';
import {providerKeyFor, use} from '@toolkit/core/providers/Providers';

type ReloadFn = () => void;
export const ReloadKey = providerKeyFor<ReloadFn>({name: 'reload'});
export const ReloadState = providerKeyFor<number>({name: 'reload-state'});

/**
 * A reload boundary should be set in one top-level component per scope.
 *
 * To request a reload:
 * ```
 * const reload = useReload();
 * ...
 * reload();
 * ```
 *
 * When reloading:
 * - All components in the scope that have called `useReloadState()` will
 * get a new value for the reload state.
 * - Entire component tree from component containing `useReloadBoundary()`
 *   will be re-rendered.
 */
export function useReloadBoundary(): void {
  const reloads = React.useRef(0);
  const scope = useScope();

  const reload = React.useCallback(() => {
    reloads.current += 1;
    scope.provideValue(ReloadState, reloads.current);
  }, []);

  scope.provideValue(ReloadState, reloads.current);
  scope.provideValue(ReloadKey, reload);
}

/**
 * Reload state is used to know whent to skip the cache and reload data on a page.
 *
 * If the value changes, you should reload any data cached from the previous value.
 */
export function useReloadState(): number {
  return use(ReloadState);
}

/**
 *
 * Call `const reload=useReload(); reload();` when:
 * - User initiates a page refresh, or
 * - You want the surrounding screen to re-request the initially loaded data
 */
export function useReload(): ReloadFn {
  return use(ReloadKey);
}
