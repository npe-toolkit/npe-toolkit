import * as React from 'react';
import {useScope} from '@toolkit/core/providers/Client';
import {providerKeyFor, use} from '@toolkit/core/providers/Providers';

type ReloadFn = () => void;
export const ReloadKey = providerKeyFor<ReloadFn>();

// Call this in a top-level app component you'd like to see reloaded
// Callers can check the state is the same to see if re-render is due to force relocd
export function useReloadState(): number {
  const [reloadState, setReloadState] = React.useState(0);
  const reloads = React.useRef(0);
  const scope = useScope();

  scope.provideValue(ReloadKey, () => {
    reloads.current = reloads.current + 1;
    setReloadState(reloads.current);
  });

  return reloadState;
}

// Returns function that will reload
export function useReload(): ReloadFn {
  return use(ReloadKey);
}
