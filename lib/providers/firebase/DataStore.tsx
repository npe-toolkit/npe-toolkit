/**
 * Firestore based implmentation of DataStore API, that works on both client and server.
 *
 * Implementation notes:
 * Firebase has same APIs on client and server, but in different namespaces. It made
 * sense to share the library code, but needed a little hackery to do so:
 * - Import firebase (the client library) for the type definitions (`Query`, `CollectionReference`)
 *   on both client and server
 * - This adds overhead to the server code, as this code is unused at runtime, but adding
 *   one library dependency to the server deployment didn't seeem to be significant overhead
 * - Actual instantiation of the firestore instance uses `require` statement on server to use
 *   the server specific library
 *     - Having the code `require('firebase-admin')` always imported, even when the code path
 *       wasn't triggered ("smart" compilation step), but using an alias for "require"
 *       prevented automatic importing
 */

import firebase from 'firebase/app';
import {provides, use} from '@toolkit/core/providers/Providers';
import {useAppConfig} from '@toolkit/core/util/AppConfig';
import {Opt} from '@toolkit/core/util/Types';
import {uuidv4} from '@toolkit/core/util/Util';
import {DataCallback} from '@toolkit/data/DataCache';
import {
  BaseModel,
  DataStore,
  DataStoreFactory,
  DataStoreFactoryKey,
  EdgeSelector,
  GetAllOpts,
  GetOpts,
  ModelClass,
  ModelUtil,
  MutateOpts,
  Query,
  QueryOpts,
  Updater,
  isArrayType,
  isInverseModelRefType,
  isModelRefType,
} from '@toolkit/data/DataStore';
import {StorageData, modelToStorage} from '@toolkit/data/pads/model';
import {getFirebaseLib, getFirestore} from '@toolkit/providers/firebase/Config';
import {
  getFirestorePathPrefix,
  getInstanceFor,
} from '@toolkit/providers/firebase/Instance';
import 'firebase/firestore';

let DevUtil: any;
try {
  DevUtil = require('@toolkit/core/util/DevUtil');
} catch (e) {}

type FirestoreQuery<T> = firebase.firestore.Query<T>;
type CollectionReference<T> = firebase.firestore.CollectionReference<T>;
type DocumentData = firebase.firestore.DocumentData;
type SnapshotOptions = firebase.firestore.SnapshotOptions;
type Firestore = firebase.firestore.Firestore;
type DocumentSnapshot<T> = firebase.firestore.DocumentSnapshot<T>;
const FirestoreFieldValue = firebase.firestore.FieldValue;

// TODO: Use app/firestore from context
function useFirestore() {
  return getFirestore();
}

function useFirestoreContext() {
  const appConfig = useAppConfig();
  const firestore = useFirestore();

  return {
    firestore,
    instance: getInstanceFor(appConfig),
  };
}

export type FirestoreContext = {
  /**
   * Factory for creating DataStores for different entity types.
   */
  dataStores: DataStoreFactory;

  /**
   * Firestore isntance to use.
   * NOTE: Could be of type `firebase.firestore` or `firebase-admin.firestore`
   */
  firestore: Firestore;

  /**
   * Data can be organized into different `instance`s to map to different environments
   * (prod, staging, etc). This is used as a top level folder in Firestore for all content.
   */
  instance: Opt<string>;
};

export function firebaseStore<T extends BaseModel>(
  entityType: ModelClass<T>,
  ctx: FirestoreContext,
): DataStore<T> {
  const {firestore, dataStores} = ctx;
  const prefix = getFirestorePathPrefix(ctx.instance);
  const modelName = ModelUtil.getName(entityType);

  async function get(id: string, opts?: GetOpts) {
    const edges = opts?.edges || [];
    const collection = await getCollection();
    const doc = collection.doc(id);

    let value: Opt<T>;
    value = (await doc.get()).data();

    if (value != null) {
      value.id = id;
      await walkEdges([value], edges);
    }

    return value;
  }

  async function required(id: string, opts: GetOpts = {}) {
    const value = await get(id, opts);
    if (!value) {
      throw Error(`Item ID ${id} not found`);
    }
    return value;
  }

  async function getAll(opts?: GetAllOpts<T>): Promise<T[]> {
    return await query(opts);
  }

  function applyQuery(collection: FirestoreQuery<T>, query: Query<T>) {
    let result = collection;
    if (query.where) {
      for (const where of query?.where) {
        result = result.where(where.field, where.op, where.value);
      }
    }
    if (query.order) {
      for (const order of query.order) {
        result = result.orderBy(order.field, order.dir);
      }
    }
    if (query.limit) {
      if (query.limit.after) {
        if (!query.order)
          throw Error('Can not set `limit.after` without `order`');
        // @ts-ignore
        let vals = query.order.map(order => query.limit.after[order.field]);
        // NOTE: does not support (Edge) id offsets and should have `orderby` fields
        result = result.startAfter(...vals);
      }
      if (query.limit.size) {
        result = result.limit(query.limit.size);
      }
    }
    return result;
  }

  async function query(opts: QueryOpts<T> = {}) {
    const collection = await getCollection();
    const query = applyQuery(collection, opts);
    return await getFirebaseDocs(query, opts?.edges || []);
  }

  async function create(v: Updater<T>, opts: MutateOpts = {}) {
    const value = {...v} as T;

    // If value.id is undefined, create our own ID
    const id = value.id ?? modelName + ':' + uuidv4();
    const doc = await getDocumentRef(id);
    const now = Date.now();
    value.createdAt = value.createdAt ?? now;
    value.updatedAt = value.updatedAt ?? now;

    await doc.set(value);
    const newValue = await required(id, {cache: 'none'});
    const op = opts.optimistic ? 'update' : 'add';
    return newValue;
  }

  async function update(v: Updater<T>, opts: MutateOpts = {}) {
    const value = {...v};

    if (!value.id) {
      throw Error('Must have an ID to update');
    }
    const now = Date.now();
    value.updatedAt = value.updatedAt ?? now;
    const doc = await getDocumentRef(value.id);

    // TODO: Recovery if optimistic update fails
    await doc.set(value as Partial<T>, {merge: true});
    const newValue = await required(value.id, {cache: 'none'});
    return newValue;
  }

  async function remove(id: string, opts: MutateOpts = {}) {
    const doc = await getDocumentRef(id);

    await doc.delete();
  }

  function listen() {
    return () => {};
  }

  async function getCollection(): Promise<CollectionReference<T>> {
    DevUtil && (await DevUtil.networkDelay());

    return firestore
      .collection(prefix + modelName)
      .withConverter(converter) as CollectionReference<T>;
  }

  const converter = {
    toFirestore(t: Updater<T>): DocumentData {
      return modelToFirebase(t, entityType);
    },
    fromFirestore(snapshot: DocumentSnapshot<any>, opts: SnapshotOptions): T {
      const data = snapshot.data(opts)!;
      return firestoreDocToModel(data, snapshot.id, entityType);
    },
  };

  async function loadEdgesFromIds(
    entities: any[],
    key: string,
    thisEdge: ModelClass<any>,
    edges: EdgeSelector[],
  ): Promise<void> {
    const edgeStore = dataStores.get(thisEdge);

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
    const edgeStore = dataStores.get(thisEdge);

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

  async function getDocumentRef(id: string) {
    const collection = await getCollection();
    return collection.doc(id);
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
  async function getFirebaseDocs(
    query: FirestoreQuery<T>,
    edges: EdgeSelector[],
  ): Promise<T[]> {
    const docList = await query.get();

    const results = docList.docs.map(docSnapshotToModel);
    await walkEdges(results, edges);

    return results;
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
  };
}

function provideDataStores(): DataStoreFactory {
  const ctx = useFirestoreContext();

  const dataStores = {get: getStore};

  function getStore<T extends BaseModel>(
    dataType: ModelClass<T>,
  ): DataStore<T> {
    const store = firebaseStore(dataType, {...ctx, dataStores});
    return store;
  }

  return dataStores;
}

export const FirestoreDatastore = provides(
  DataStoreFactoryKey,
  provideDataStores,
);

export function storageToFirebase<T extends BaseModel>(
  data: StorageData<T>,
): FirestoreDoc<T> {
  for (const key in data) {
    const value = data[key];
    if (value == null) {
      data[key] = FirestoreFieldValue.delete();
    }
    // For repo=>datastore compatibility, store `id` directly
    // @ts-ignore
    else if (value?.type === 'ModelRef') {
      data[key] = value.id;
    } else if (Array.isArray(value)) {
      data[key] = value.map(v => {
        if (v.type === 'ModelRef') return v.id;
        else if (v.type === 'FirebaseStorageRef') return v.fullPath;
        else return v;
      });
    }
  }
  return data;
}

type FirestoreDoc<T> = Omit<Updater<T>, 'id'>;

function modelToFirebase<T extends BaseModel>(
  value: Updater<T>,
  model: ModelClass<T>,
): FirestoreDoc<T> {
  const {id, ...rest} = value;
  return storageToFirebase(modelToStorage(model, rest as Partial<T>));
}

function docSnapshotToModel<T extends BaseModel>(doc: DocumentSnapshot<T>): T {
  const value = doc.data();
  value!.id = doc.id;
  return value!;
}

function firestoreDocToModel<T extends BaseModel>(
  m: FirestoreDoc<T>,
  id: string,
  entityType: ModelClass<T>,
): T {
  if (!m) return m;
  const schema = ModelUtil.getSchema(entityType);
  const data = {id} as T;
  for (const key in m) {
    const type = schema[key]?.type;
    if (type) {
      // @ts-ignore
      data[key] = m[key];
    }
  }

  return data;
}
