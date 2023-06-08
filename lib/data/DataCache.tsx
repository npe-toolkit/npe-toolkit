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
  /** Returns the value from the cache if it exists */
  get(key: string): Opt<T>;

  /** Puts a value into the cache */
  put(key: string, op: DataOp, value: T): void;

  /** Removes a value from the cache */
  remove(key: string): void;

  /** Returns true if cache has this entry */
  has(key: string): boolean;

  /** Listen to changes in the by key. "*" listens to all changes in namespace */
  listen(key: string | string[], callback: DataCallback): Unlisten;

  /** Invalidate a cache entry without repopulating */
  invalidate(key: string): void;

  /** Convenience to get a key from cache, or populate if doesn't already exist */
  getOrPopulate(key: string, op: DataOp, fn: () => Promise<T>): Promise<T>;
};

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
    get: () => null,
    put: () => {},
    remove: () => {},
    has: () => false,
    listen: () => () => {},
    invalidate: () => {},
    getOrPopulate: async (_, __, fn) => fn(),
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

    function get(key: string): Opt<T> {
      const existing = cache[key];
      return existing != null ? {...existing} : null;
    }

    function put(key: string, op: DataOp, value: T) {
      let shouldTrigger;

      const inCache = get(key);
      if (inCache && op == 'update') {
        op = 'update';
        shouldTrigger = !areValuesEqual(inCache, value);
      } else if (op == 'add') {
        shouldTrigger = true;
      }

      cache[key] = value;
      if (shouldTrigger) {
        trigger(key, op);
      }
    }

    function remove(key: string) {
      const existing = get(key);
      delete cache[key];
      if (existing) {
        trigger(key, 'remove');
      }
    }

    function has(key: string): boolean {
      return cache[key] != null;
    }

    function invalidate(key: string) {
      delete cache[key];
    }

    async function getOrPopulate(
      key: string,
      op: DataOp,
      fn: () => Promise<T>,
    ): Promise<T> {
      const existing = get(key);
      if (existing) {
        return existing;
      }

      const value = await fn();
      put(key, op, value);
      return value;
    }

    function listen(keys: string | string[], callback: DataCallback): Unlisten {
      if (typeof keys == 'string') {
        keys = [keys];
      }
      for (const key of keys) {
        listeners[ns] = listeners[ns] ?? {};
        listeners[ns][key] = listeners[ns][key] ?? [];
        listeners[ns][key].push(callback);
      }

      return () => {
        for (const key of keys) {
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
      getOrPopulate,
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
