import {providerKeyFor, providesValue} from '@toolkit/core/providers/Providers';
import {Opt} from '@toolkit/core/util/Types';
import {Query} from './DataStore';

export type DataOp = 'add' | 'update' | 'remove' | 'load';
type Unlisten = () => void;
export type DataCallback = (id: string, op: DataOp) => void | Promise<void>;

export type DataCache<T> = {
  /** Gets from cache, or falls through to fn */
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
 * No-op cache provider (doesn't cache)
 */
export function noCache<T>(): DataCache<T> {
  return {
    get: (_, fn) => fn(),
    put: async () => {},
    remove: async () => {},
    has: async () => false,
    listen: () => () => {},
    invalidate: async () => {},
  };
}

type MemoryCacheData<T> = {
  cache: Record<string, T>;
  listeners: Record<string, DataCallback[]>;
};

const inMemoryCaches: Record<string, DataCache<any>> = {};

/**
 * Get the in-memory cache for a given namepace
 */
export function getInMemoryCache<T>(namespace: string): DataCache<T> {
  let cache = inMemoryCaches[namespace];
  if (!cache) {
    inMemoryCaches[namespace] = inMemoryCache<T>();
    cache = inMemoryCaches[namespace];
  }
  return cache;
}

/**
 * Create an in-memory cache.
 */
function inMemoryCache<T>(): DataCache<T> {
  const cache: Record<string, T> = {};
  const listeners: Record<string, DataCallback[]> = {};

  async function get(id: string, fn: () => Promise<Opt<T>>): Promise<Opt<T>> {
    const existing = cache[id] as Opt<T>;
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
      listeners[key] = listeners[key] ?? [];
      listeners[key].push(callback);
    }

    return () => {
      for (const key of ids) {
        listeners[key] = listeners[key].filter(cb => cb != callback);
        if (listeners[key].length == 0) {
          delete listeners[key];
        }
      }
    };
  }

  function trigger(key: string, op: DataOp) {
    const matches = listeners[key] ?? [];
    const wildcardMatches = listeners['*'] ?? [];

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
