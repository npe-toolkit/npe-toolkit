import {Opt} from '@toolkit/core/util/Types';
import {uuidv4} from '@toolkit/core/util/Util';
import {
  DataCache,
  DataCallback,
  DataOp,
  FromCache,
} from '@toolkit/data/DataCache';
import {
  BaseModel,
  DataStore,
  DataStoreFactory,
  EdgeSelector,
  GetAllOpts,
  GetOpts,
  ModelClass,
  ModelUtil,
  MutateOpts,
  QueryOpts,
  Updater,
  isArrayType,
  isInverseModelRefType,
  isModelRefType,
} from '@toolkit/data/DataStore';

// Supporting cast needed to implement a fully functional datastore
type DataStoreHelpers<T extends BaseModel> = {
  db: DataStore<T>;
  cache: DataCache<T>;
  factory: DataStoreFactory;
};

/**
 * Add key features to a storage layer-only implementation of a DataStore:
 * - Caching and optimistic updates
 * - Listening for client-side data changes
 * - Edge-walking in queries
 */
export function fullDataStore<T extends BaseModel>(
  entityType: ModelClass<T>,
  helpers: DataStoreHelpers<T>,
): DataStore<T> {
  const {db, cache, factory} = helpers;
  const modelName = ModelUtil.getName(entityType);

  async function get(id: string, opts?: GetOpts) {
    const edges = opts?.edges || [];
    const useCache = opts?.cache !== 'none';

    const value = await cache.get(id, () => db.get(id));

    if (value != null) {
      if (useCache) {
        cache.put(id, 'load', value);
      }
      await walkEdges([value], edges);
    }
    return value;
  }

  async function required(id: string, opts?: GetOpts) {
    const value = await get(id, opts);
    if (!value) {
      throw Error(`Item ID ${id} not found`);
    }
    return value;
  }

  async function getAll(opts?: GetAllOpts<T>): Promise<T[]> {
    return await query(opts);
  }

  async function query(opts: QueryOpts<T> = {}) {
    const results = await cache.query(opts, () => db.query(opts));
    results.forEach(v => cache.put(v.id, 'load', v));
    await walkEdges(results, opts?.edges || []);

    return results;
  }

  async function create(v: Updater<T>, opts: MutateOpts = {}) {
    // Run common logic in adapter - need ID before running backend
    const value = commonCreateLogic(v, modelName) as T;
    const id = value.id;

    if (opts.optimistic) {
      cache.put(id, 'add', value);
    }

    const newValue = await db.create(value);
    const op = opts.optimistic ? 'update' : 'add';
    cache.put(id, op, newValue);
    return newValue;
  }

  async function update(v: Updater<T>, opts: MutateOpts = {}) {
    const value = commonUpdateLogic(v);
    const id = value.id;

    if (opts.optimistic && (await cache.has(id))) {
      // TODO: Full update logic including deleting fields
      const cached = await cache.get(id, FromCache);
      if (cached) {
        const merged = {...cached, ...value};
        cache.put(id, 'update', merged);
      }
    }

    const newValue = await db.update(value);
    cache.put(id, 'update', newValue);
    return newValue;
  }

  async function remove(id: string, opts: MutateOpts = {}) {
    if (opts.optimistic) {
      cache.remove(id); // TODO: Handle optimistic failures
    }

    await db.remove(id);

    if (!opts.optimistic) {
      cache.remove(id);
    }
  }

  function listen(id: string, fn: DataCallback) {
    return cache.listen(id, fn);
  }

  async function putCache(id: string, op: DataOp, value: T) {
    await cache.put(id, op, value);
  }

  async function loadEdgesFromIds(
    entities: any[],
    key: string,
    thisEdge: ModelClass<any>,
    edges: EdgeSelector[],
  ): Promise<void> {
    const edgeStore = factory.get(thisEdge);

    // Load edge by the ID(s)
    const values = await Promise.all(
      entities.map(entity => {
        const edgeValue = entity[key];
        if (edgeValue?.id) {
          // Edge has already been loaded
          return edgeValue;
        } else if (Array.isArray(edgeValue)) {
          return Promise.all(edgeValue.map(id => edgeStore.get(id, {edges})));
        } else if (edgeValue != null) {
          return edgeStore.get(edgeValue, {edges});
        } else {
          return Promise.resolve();
        }
      }),
    );

    values.forEach((value, index) => {
      entities[index][key] = value;
    });
  }

  async function loadIncomingEdges(
    entities: any[],
    key: string,
    thisEdge: ModelClass<any>,
    edges: EdgeSelector[],
    isKeyFieldArray: boolean,
  ): Promise<T[]> {
    const edgeSchema = ModelUtil.getSchema(thisEdge);
    const edgeStore = factory.get(thisEdge);

    let fieldToMatch: string = '';
    for (const [key, val] of Object.entries(edgeSchema)) {
      const type = val.type;
      const isArray = isArrayType(type);
      // @ts-ignore
      const elemType = isArray ? type.getElementType() : type;
      if (isModelRefType(elemType)) {
        const edgeModelClass = elemType.getModelClass();
        if (edgeModelClass === entityType) {
          fieldToMatch = key;
        }
      }
    }
    if (fieldToMatch === '') {
      throw Error('No matching edge found');
    }

    const values: any[] = await Promise.all(
      entities.map(entity => {
        return edgeStore.query({
          where: [{field: fieldToMatch, op: '==', value: entity.id}],
          edges,
        });
      }),
    );

    values.forEach((value, index) => {
      if (isKeyFieldArray) {
        entities[index][key] = value;
      } else {
        entities[index][key] = value.shift();
      }
    });
    return values;
  }

  function deepCopyEdges(edges: EdgeSelector[]): EdgeSelector[] {
    return edges.map(edge => {
      if (Array.isArray(edge)) {
        return [...edge];
      } else {
        return edge;
      }
    });
  }

  function findEdge(
    edgeType: ModelClass<any>,
    edges: EdgeSelector[],
  ): Opt<ModelClass<any>> {
    if (edgeType == null) {
      throw Error(`Edge type is required: ${edgeType}`);
    }
    for (const edge of edges) {
      if (Array.isArray(edge)) {
        if (edge[0] === entityType && edge[1] === edgeType && edge[2] > 0) {
          edge[2] -= 1;
          return edge[1];
        }
      } else {
        if (edge === edgeType) {
          return edge;
        }
      }
    }
    return null;
  }
  async function walkEdges(entities: T[], edges: EdgeSelector[]) {
    const schema = ModelUtil.getSchema(entityType);

    const promises: Promise<any>[] = [];

    for (const [key, val] of Object.entries(schema)) {
      const type = val.type;
      const isArray = isArrayType(type);
      // @ts-ignore
      const elemType = isArray ? type.getElementType() : type;
      const edgeCopies = deepCopyEdges(edges);
      if (isModelRefType(elemType)) {
        const edgeModelClass = elemType.getModelClass();
        const thisEdge = findEdge(edgeModelClass, edgeCopies);
        if (!thisEdge) {
          continue;
        }
        promises.push(
          loadEdgesFromIds(entities, key, edgeModelClass, edgeCopies),
        );
      } else if (isInverseModelRefType(elemType)) {
        const edgeModelClass = elemType.getModelClass();
        const thisEdge = findEdge(edgeModelClass, edgeCopies);
        if (!thisEdge) {
          continue;
        }
        promises.push(
          loadIncomingEdges(entities, key, edgeModelClass, edgeCopies, isArray),
        );
      }
    }

    await Promise.all(promises);
  }

  return {
    get,
    required,
    create,
    update,
    remove,
    query,
    getAll,
    listen,
    putCache,
  };
}

export type UpdaterWithId<T extends BaseModel> = {id: string} & Updater<T>;

export function commonCreateLogic<T extends BaseModel>(
  fields: Updater<T>,
  modelName: string,
): UpdaterWithId<T> {
  const out = {...fields};

  out.id = fields.id ?? modelName + ':' + uuidv4();
  const now = Date.now();
  out.createdAt = fields.createdAt ?? now;
  out.updatedAt = fields.updatedAt ?? now;

  return out as UpdaterWithId<T>;
}

export function commonUpdateLogic<T extends BaseModel>(
  fields: Updater<T>,
): UpdaterWithId<T> {
  const out = {...fields};
  const id = out.id;

  if (id == null) {
    throw Error('Must have an ID to update');
  }
  const now = Date.now();
  out.updatedAt = out.updatedAt ?? now;

  return out as UpdaterWithId<T>;
}

function areValuesEqual(lhs: any, rhs: any, key: string = 'top'): boolean {
  if (Array.isArray(lhs) || Array.isArray(rhs)) {
    if (lhs.length !== rhs.length) {
      return false;
    }
    for (let i = 0; i < lhs.length; i++) {
      if (!areValuesEqual(lhs[i], rhs[i])) {
        return false;
      }
    }
    return true;
  }

  if (typeof lhs !== 'object' || typeof rhs !== 'object') {
    return lhs === rhs;
  }

  const lhsKeys = Object.keys(lhs);
  const rhsKeys = Object.keys(rhs);

  // Check if both objects have the same number of keys
  if (lhsKeys.length !== rhsKeys.length) {
    return false;
  }

  // Check if all keys in obj1 exist in obj2 and have the same value
  for (const key of lhsKeys) {
    // TODO: Move datastore specific logic to cache config option
    if (key !== 'updatedAt' && !areValuesEqual(lhs[key], rhs[key], key)) {
      return false;
    }
  }

  return true;
}
