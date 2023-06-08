/**
 * Server implementation of providers...
 */

import {getRequestScope} from '@toolkit/providers/firebase/server/Handler';
import {ProviderScope, scope} from './ProviderImpl';
import {ProviderKey, setUseProviderImpl} from './Providers';

export function addProviderScope(providers: any[]) {
  const requestScopedProviders = scope(providers);
  getRequestScope().set('providers', requestScopedProviders);
}

export function useScope() {
  return getRequestScope().get('providers') as ProviderScope;
}

/**
 * Use a provided value on the client.
 *
 * Triggers a react state update when a provided value changes,
 * iff the value is set using `providesValue()`.
 */
function use<T>(key: ProviderKey<T>): T {
  const scope = useScope();
  return scope.use(key);
}

setUseProviderImpl(use);
