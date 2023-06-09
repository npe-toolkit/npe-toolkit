import {
  providerKeyFor,
  providesValue,
  use,
} from '@toolkit/core/providers/Providers';
import {Opt} from '@toolkit/core/util/Types';

export type DataOp = 'add' | 'update' | 'remove' | 'load';
type Unlisten = () => void;
export type DataCallback = (id: string, op: DataOp) => void | Promise<void>;

export type DataCache<T> = {
  /** Gets a cache, or falls through to fn */
  get(id: string, fn: () => Promise<Opt<T>>): Promise<Opt<T>>;

  /** Puts a value into the cache */
  put(id: string, op: DataOp, value: T): Promise<void>;

  /** Removes a value from the cache */
  remove: (id: string) => Promise<void>;

  /** Returns true if cache has this entry */
  has(id: string): Promise<boolean>;

  /** Listen to changes in the by id. "*" listens to all changes*/
  listen(ids: string | string[], callback: DataCallback): Unlisten;

  /** Invalidate a cache entry without repopulating */
  invalidate(id: string): Promise<void>;
};

// const for passing into get to only get the cached value.
export const FromCache = async () => null;

/**
 * Provide a cache for a specific type of data, identified by string namespace.
 */
export type DataCacheProvider = <T>(ns: string) => DataCache<T>;

export const DataCacheProviderKey = providerKeyFor<DataCacheProvider>(
  noCacheProvider(),
);

/**
 * No-op cache provider (doesn't cache)
 */
export function noCacheProvider(): <T>(ns: string) => DataCache<T> {
  return () => ({
    get: (_, fn) => fn(),
    put: async () => {},
    remove: async () => {},
    has: async () => false,
    listen: () => () => {},
    invalidate: async () => {},
  });
}

/**
 * Simple in-memory data cache. Doesn't limit storage, which
 * will lead to RAM issues if used with datastores returning results
 * that are large or have 10s of thousands of entries.
 */
export function memoryCacheProvider(): <T>(ns: string) => DataCache<T> {
  const caches: Record<string, Record<string, any>> = {};
  const listeners: Record<string, Record<string, DataCallback[]>> = {};

  return <T,>(ns: string): DataCache<T> => {
    const cache = getCache(ns);

    async function get(id: string, fn: () => Promise<Opt<T>>): Promise<Opt<T>> {
      const existing = cache[id];
      if (existing) {
        return {...existing};
      }

      const value = await fn();
      if (value != null) {
        await put(id, 'load', value);
      }
      return value;
    }

    async function put(id: string, op: DataOp, value: T) {
      let shouldTrigger;

      const inCache = await get(id, async () => null);
      if (inCache && op == 'update') {
        op = 'update';
        shouldTrigger = !areValuesEqual(inCache, value);
      } else if (op == 'add') {
        shouldTrigger = true;
      }

      cache[id] = value;
      if (shouldTrigger) {
        trigger(id, op);
      }
    }

    async function remove(id: string) {
      const existing = cache[id] != null;
      delete cache[id];
      if (existing) {
        trigger(id, 'remove');
      }
    }

    async function has(id: string): Promise<boolean> {
      return cache[id] != null;
    }

    async function invalidate(id: string) {
      delete cache[id];
    }

    function listen(ids: string | string[], callback: DataCallback): Unlisten {
      if (typeof ids == 'string') {
        ids = [ids];
      }
      for (const key of ids) {
        listeners[ns] = listeners[ns] ?? {};
        listeners[ns][key] = listeners[ns][key] ?? [];
        listeners[ns][key].push(callback);
      }

      return () => {
        for (const key of ids) {
          listeners[ns][key] = listeners[ns][key].filter(cb => cb != callback);
          if (listeners[ns][key].length == 0) {
            delete listeners[ns][key];
          }
        }
      };
    }

    function trigger(key: string, op: DataOp) {
      if (!listeners[ns]) {
        return;
      }
      const matches = listeners[ns][key] ?? [];
      const wildcardMatches = listeners[ns]['*'] ?? [];

      const callbacks = [...matches, ...wildcardMatches];
      for (const callback of callbacks) {
        callback(key, op);
      }
    }

    return {
      get,
      put,
      remove,
      has,
      listen,
      invalidate,
    };
  };

  function getCache(ns: string): Record<string, any> {
    let cache = caches[ns];
    if (!cache) {
      caches[ns] = {};
      cache = caches[ns];
    }
    return cache;
  }
}

/**
 * Check if the non-object values of two items in cache are equal.
 * TODO: Possibly support comparision function for object values.
 */
function areValuesEqual(lhs: any, rhs: any): boolean {
  if (typeof lhs !== 'object' || typeof rhs !== 'object') {
    return lhs === rhs;
  }
  const lhsKeys = Object.keys(lhs).filter(key => typeof lhs[key] !== 'object');
  const rhsKeys = Object.keys(rhs).filter(key => typeof lhs[key] !== 'object');
  // Check if both objects have the same number of keys

  if (lhsKeys.length !== rhsKeys.length) {
    return false;
  }

  // Check if all keys in obj1 exist in obj2 and have the same value
  for (const key of lhsKeys) {
    // TODO: Move datastore specific logic to cache config option
    if (key !== 'updatedAt' && lhs[key] !== rhs[key]) {
      return false;
    }
  }

  return true;
}

export const InMemoryDataCache = providesValue(
  DataCacheProviderKey,
  memoryCacheProvider(),
);
