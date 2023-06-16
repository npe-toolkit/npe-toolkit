/**
 * Firestore based implmentation of DataStore API. Works on both client and server.
 *
 * Note that you need logic in `./Config.tsx` in order to load the correct library implementation -
 * Firebase API is the same but the implementations are different imports.
 */

import firebase from 'firebase/app';
import {provides, use} from '@toolkit/core/providers/Providers';
import {useAppConfig} from '@toolkit/core/util/AppConfig';
import {Opt} from '@toolkit/core/util/Types';
import {getInMemoryCache, noCache} from '@toolkit/data/DataCache';
import {
  BaseModel,
  DataStore,
  DataStoreFactory,
  DataStoreFactoryKey,
  FieldDelete,
  GetAllOpts,
  ModelClass,
  ModelUtil,
  Query,
  QueryOpts,
  Updater,
  isModelRefType,
} from '@toolkit/data/DataStore';
import {
  commonCreateLogic,
  commonUpdateLogic,
  fullDataStore,
} from '@toolkit/data/DataStoreImpl';
import {Type as SchemaType} from '@toolkit/data/pads/schema';
import {FirestoreKey} from '@toolkit/providers/firebase/Config';
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
type Firestore = firebase.firestore.Firestore;
const FieldValue = firebase.firestore.FieldValue;

// Not excited we have a "factory"... although I guess the providers we have are similar
export function firestoreBackend<T extends BaseModel>(
  dataType: ModelClass<T>,
  firestore: Firestore,
  namespace: Opt<string>,
): DataStore<T> {
  const prefix = getFirestorePathPrefix(namespace);
  const modelName = ModelUtil.getName(dataType);
  const collection = firestore.collection(
    prefix + modelName,
  ) as CollectionReference<FirestoreDoc<T>>;
  // TODO: Move this to a nice wrapper util
  const schema = ModelUtil.getSchema(dataType) as unknown as TypedSchema<T>;

  async function get(id: string) {
    const doc = collection.doc(id);
    const value = (await doc.get()).data() as FirestoreDoc<T>;
    if (value == null) {
      return null;
    }
    return toModel(id, value, schema);
  }

  async function required(id: string) {
    const value = await get(id);
    if (!value) {
      throw Error(`Item ID ${id} not found`);
    }
    return value;
  }

  async function create(v: Updater<T>) {
    const fields = commonCreateLogic(v, modelName);
    const doc = collection.doc(fields.id);
    const firestoreFields = toFirestoreFields<T>(fields, schema, true);
    await doc.set(firestoreFields);
    return await required(fields.id);
  }

  async function update(v: Updater<T>) {
    const fields = commonUpdateLogic(v);
    const doc = collection.doc(fields.id);
    const firestoreFields = toFirestoreFields<T>(fields, schema, false);
    await doc.set(firestoreFields, {merge: true});
    return await required(fields.id);
  }

  async function remove(id: string) {
    const doc = collection.doc(id);
    await doc.delete();
  }

  async function query(opts: QueryOpts<T> = {}) {
    const docList = await firestoreQuery(collection, opts).get();
    const results = docList.docs.map(doc =>
      toModel(doc.id, doc.data(), schema),
    );
    return results;
  }

  async function getAll(opts: GetAllOpts<T> = {}) {
    return query(opts);
  }

  function listen() {
    // Not implemented for the backend
    return () => {};
  }
  async function putCache() {}

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

const FirestoreDelete = FieldValue.delete();

function isFirestoreField(value: any) {
  return value instanceof FieldValue;
}

function toModel<T extends BaseModel>(
  id: string,
  doc: FirestoreDoc<T>,
  schema: TypedSchema<T>,
): T {
  const out = {id} as T;
  for (const key in schema) {
    const value = doc[key];
    if (key == 'id' || isFirestoreField(value)) {
      continue;
    }
    if (key in doc) {
      out[key] = value as any;
    }
  }
  return out;
}

function toFirestoreFields<T extends BaseModel>(
  fields: Updater<T>,
  schema: TypedSchema<T>,
  isCreate: boolean,
): FirestoreDoc<T> {
  const out = {} as FirestoreDoc<T>;
  for (const key in schema) {
    const value = fields[key as keyof Updater<T>];
    const schemaType = schema[key];

    if (key == 'id' || !(key in fields)) {
      continue;
    } else if (value == FieldDelete) {
      if (!isCreate) {
        out[key] = FirestoreDelete;
      }
    }
    // @ts-ignore TODO: Make this typesafe
    else if (isModelRefType(schemaType?.type)) {
      const id = (value as BaseModel)?.id;
      if (id !== null) {
        // @ts-ignore
        out[key] = id;
      }
    } else {
      // @ts-ignore
      out[key] = value;
    }
  }

  return out;
}

function firestoreQuery<T extends BaseModel>(
  collection: FirestoreQuery<FirestoreDoc<T>>,
  query: Query<T>,
) {
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
      result = result.startAfter(...vals);
    }
    if (query.limit.size) {
      result = result.limit(query.limit.size);
    }
  }
  return result;
}

type FirestoreDoc<T> = {
  [K in keyof T]:
    | typeof FirestoreDelete
    | (T[K] extends ModelClass<any> ? string : T[K]);
};

export type TypedSchema<T extends BaseModel> = {
  [P in keyof T]: SchemaType | undefined;
};

function firestoreDatastore(useCache: boolean): () => DataStoreFactory {
  function useDataStoreFactory() {
    // TODO: Use app/firestore from context
    const firestore = use(FirestoreKey);
    const appConfig = useAppConfig();
    const namespace = getInstanceFor(appConfig);
    const factory = {get};

    function get<T extends BaseModel>(dataType: ModelClass<T>): DataStore<T> {
      const modelName = ModelUtil.getName(dataType);
      const db = firestoreBackend(dataType, firestore, namespace);
      const cacheNs = `${namespace}/${modelName}`;
      const cache = useCache ? getInMemoryCache<T>(cacheNs) : noCache<T>();
      const helpers = {cache, db, factory};

      return fullDataStore(dataType, helpers);
    }
    return factory;
  }

  return useDataStoreFactory;
}

export const FirestoreDatastoreWithCaching = provides(
  DataStoreFactoryKey,
  firestoreDatastore(true),
);

export const FirestoreDatastore = provides(
  DataStoreFactoryKey,
  firestoreDatastore(false),
);
