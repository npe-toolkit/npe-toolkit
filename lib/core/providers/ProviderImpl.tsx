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

// "app" and "screen" are well-known, but can use any string to name a scope
export type ScopeName = 'app' | 'screen' | string;

/** Internal scope API */
export type ProviderScope = {
  name(): ScopeName;
  parent(): Opt<ProviderScope>;
  provide<T>(key: ProviderKey<T>, provider: Provider<T>): void;
  provideValue<T>(key: ProviderKey<T>, value: T): void;
  use<T>(key: ProviderKey<T>): T;
  listen<T>(key: ProviderKey<T>, fn: Listener<T>): Unlisten;
};

/** Internal scope implementation */
export function scope(
  providers: any[] = [],
  name: ScopeName,
  parentScope?: Opt<ProviderScope>,
): ProviderScope {
  // Will have type-safe accessors
  const providerMap = new Map<ProviderKey<any>, Provider<any>>();
  const listeners = new Map<ProviderKey<any>, Map<number, Listener<any>>>();

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
    name(): ScopeName {
      return name;
    },

    parent(): Opt<ProviderScope> {
      return parentScope;
    },

    provide: <T,>(key: ProviderKey<T>, provider: Provider<T>): void => {
      providerMap.set(key, provider);
    },

    provideValue: <T,>(key: ProviderKey<T>, value: T): void => {
      providerMap.set(key, () => value);
      const ls = listeners.get(key) ?? new Map<number, Listener<any>>();
      for (const fn of ls.values()) {
        fn(value);
      }
    },

    use: <T,>(key: ProviderKey<T>): T => {
      const provider = providerMap.get(key);

      if (provider) {
        return provider();
      }

      if (parentScope) {
        return parentScope.use(key);
      }

      if (key.defaultProvider !== undefined) {
        return key.defaultProvider();
      }

      throw Error(
        `No provider for this key. Key can be found in call stack entry before use() calls.`,
      );
    },

    listen: <T,>(key: ProviderKey<T>, fn: Listener<T>): Unlisten => {
      let ls = listeners.get(key);
      if (!ls) {
        ls = new Map<number, Listener<any>>();
        listeners.set(key, ls);
      }

      const listenerKey = idcount++;
      ls.set(listenerKey, fn);

      return () => {
        ls!.delete(listenerKey);
        if (ls!.size === 0) {
          listeners.delete(key);
        }
      };
    },
  };
}

let idcount = 0;
