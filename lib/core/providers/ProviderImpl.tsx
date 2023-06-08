/**
 * Implementation utilities for providers.
 */

import {Opt} from '@toolkit/core/util/Types';
import {
  KeyForProvides,
  KeyForProvidesValue,
  Provider,
  ProviderKey,
} from './Providers';

export type Listener<T> = (value: T) => void;
export type Unlisten = () => void;

/** Internal scope API */
export type ProviderScope = {
  // TODO: Consider changing to putProvider and put
  provide<T>(key: ProviderKey<T>, provider: Provider<T>): void;
  provideValue<T>(key: ProviderKey<T>, value: T): void;
  use<T>(key: ProviderKey<T>): T;
  listen<T>(key: ProviderKey<T>, fn: Listener<T>): Unlisten;
};

/** Internal scope implementation */
export function scope(
  providers: any[] = [],
  parentScope?: Opt<ProviderScope>,
): ProviderScope {
  // Will have type-safe accessors
  const providerMap = new Map<ProviderKey<any>, Provider<any>>();
  const listeners = new Map<ProviderKey<any>, Listener<any>[]>();

  for (const provider of providers) {
    if (provider[KeyForProvides]) {
      providerMap.set(provider[KeyForProvides], provider);
    } else if (provider[KeyForProvidesValue]) {
      providerMap.set(provider[KeyForProvidesValue], () => provider);
    } else {
      throw Error(`Invalid provider: ${provider}`);
    }
  }

  return {
    provide: <T,>(key: ProviderKey<T>, provider: Provider<T>): void => {
      providerMap.set(key, provider);
    },

    provideValue: <T,>(key: ProviderKey<T>, value: T): void => {
      providerMap.set(key, () => value);
      const ls = listeners.get(key) ?? [];
      ls.forEach(fn => fn(value));
    },

    use: <T,>(key: ProviderKey<T>): T => {
      const provider = providerMap.get(key);

      if (provider) {
        return provider();
      }
      if (parentScope) {
        return parentScope.use(key);
      }

      if (key.defaultValue !== undefined) {
        return key.defaultValue;
      }

      throw Error(
        `No provider for this key. Key can be found in call stack entry before use() calls.`,
      );
    },

    listen: <T,>(key: ProviderKey<T>, fn: Listener<T>): Unlisten => {
      let ls = listeners.get(key);
      if (!ls) {
        ls = [];
        listeners.set(key, ls);
      }
      ls.push(fn);
      return () => {
        const ls = listeners.get(key)?.filter(l => l !== fn);
        if (ls && ls.length > 1) {
          listeners.set(key, ls);
        } else {
          listeners.delete(key);
        }
      };
    },
  };
}
