import {providerKeyFor, providesValue} from '@toolkit/core/providers/Providers';
import {Opt} from '@toolkit/core/util/Types';
import {Query} from './DataStore';

export type DataOp = 'add' | 'update' | 'remove' | 'load';
type Unlisten = () => void;
export type DataCallback = (id: string, op: DataOp) => void | Promise<void>;

export type DataCache<T> = {
  /** Gets from cache, or falls through to fn */
  get(id: string, fn: () => Promise<Opt<T>>): Promise<Opt<T>>;

  /** Gets from server first then usually from cache */
  query(query: Query<T>, fn: () => Promise<T[]>): Promise<T[]>;

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
    query: async (_: Query<T>, fn: () => Promise<any[]>) => fn(),
  };
}

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
  const queryLoaded: Record<string, boolean> = {};

  async function get(id: string, fn: () => Promise<Opt<T>>): Promise<Opt<T>> {
    const existing = cache[id] as Opt<T>;
    if (existing) {
      if (Array.isArray(existing)) {
        return [...existing] as any as T;
      } else {
        return {...existing};
      }
    }

    const value = await fn();
    if (value != null) {
      await put(id, 'load', value);
    }
    return value;
  }

  async function query(query: Query<T>, fn: () => Promise<T[]>): Promise<T[]> {
    const key = keyFor(query);
    if (queryLoaded[key]) {
      const matcher = toPredicate(query);
      const matches = Object.values(cache).filter(v => matcher(v));
      return matches.map(match => ({...match} as T));
    } else {
      const results = await fn();
      for (const item of results) {
        // @ts-ignore TODO: Likely need to have T extend HasId or BaseModel
        const id = item.id as string;
        await put(id, 'load', item);
      }
      queryLoaded[key] = true;
      return results;
    }
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

    const copy = (Array.isArray(value) ? [...value] : {...value}) as T;
    cache[id] = copy;
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
    query,
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

function keyFor(query: Query<any>) {
  // TODO: Stable string, using only known keys
  return JSON.stringify({where: query.where});
}

function toPredicate<T>(query: Query<any>): (item: T) => boolean {
  const wheres = query.where ?? [];

  return (item: T) => {
    const asAny = item as any;
    for (const where of wheres) {
      const matcher = matchers[where.op];
      if (!matcher(asAny[where.field], where.value)) {
        return false;
      }
    }
    return true;
  };
}

const matchers = {
  '==': (a: any, b: any) => a == b,
  '!=': (a: any, b: any) => a != b,
  '<': (a: any, b: any) => a < b,
  '<=': (a: any, b: any) => a <= b,
  '>': (a: any, b: any) => a > b,
  '>=': (a: any, b: any) => a >= b,
  in: (a: any, b: any) => b.includes(a),
  'not-in': (a: any, b: any) => !b.includes(a),
};
