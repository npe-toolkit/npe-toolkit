// This file is the client API, and references React-specific constructs

import * as React from 'react';
import {providerKeyFor, use} from '@toolkit/core/providers/Providers';
import {CodedError} from '@toolkit/core/util/CodedError';
import {Opt} from '@toolkit/core/util/Types';
import {BaseModel, ModelClass} from '@toolkit/data/pads/model';
import {DataCallback, DataOp} from './DataCache';

// Export for convenience
export {
  BaseModel,
  DeletedBy,
  Field,
  InverseField,
  Model,
  ModelUtil,
  Ref,
  type DeletedByTTL,
  type ModelClass,
  type R,
} from '@toolkit/data/pads/model';
export * from '@toolkit/data/pads/schema';

export type DataStore<T extends BaseModel> = {
  get: (id: string, opts?: GetOpts) => Promise<Opt<T>>;
  required: (id: string, opts?: GetOpts) => Promise<T>;
  create: (value: Updater<T>, opts?: MutateOpts) => Promise<T>;
  update: (value: Updater<T>, opts?: MutateOpts) => Promise<T>;
  remove: (id: string, opts?: MutateOpts) => Promise<void>;
  query: (opts?: QueryOpts<T>) => Promise<T[]>;
  getAll: (opts?: GetAllOpts<T>) => Promise<T[]>;
  listen: (id: string, fn: DataCallback) => UnsubscribeFn;
  putCache: (id: string, op: DataOp, value: T) => Promise<void>;
  // listenQuery: (query: Query<T>, fn: DataCallback) => UnsubscribeFn;
};

export type GetOpts = {
  /** Which edges to load */
  edges?: EdgeSelector[];

  /** Cache strategy to use. Default is 'local' */
  cache?: 'none' | 'local';
};

export type EdgeSelector =
  | ModelClass<any>
  | [ModelClass<any>, ModelClass<any>, number];

export type MutateOpts = {
  /** Whether the new value should be reflected immediately in cache */
  optimistic?: boolean;
};

export type QueryOpts<T> = GetOpts & Query<T>;

export type GetAllOpts<T> = GetOpts & Omit<Query<T>, 'where'>;

export type Query<T> = {
  where?: Where[];
  order?: Order[];
  limit?: Limit<T>;
};

export type Where = {
  field: string;
  op: '<' | '<=' | '==' | '!=' | '>=' | '>' | 'in' | 'not-in';
  value: string | number | boolean | string[] | number[];
};

export type Order = {
  field: string;
  dir: 'asc' | 'desc';
};

export type Limit<T> = {
  size?: number;
  // Last doc from a previous query
  after?: T;
};

export type UnsubscribeFn = () => void;
export type SubscribeCallbackFn<D> = (resp: {data?: D; error?: Error}) => void;

export type HasId = {
  id: string;
};

// For now, field deletion is just a null value
export const FieldDelete = null;

// Used for creating / updating edges
// All fields of type, as optional, with edges being expressed as {id: EDGE_ID}
export type Updater<T> = Partial<
  {
    [K in keyof Omit<T, 'id'>]?: T[K] | {id: string} | typeof FieldDelete;
  } & HasId
>;

/**
 * DataStoreFactory gives you and instance of a `DataStore` for a given model.
 *
 * Don't like having we have a "factory" concept from Providers, but there
 * are clearly distinct needs.
 *
 * Providers:
 * - Can call hooks
 * - Have no-arg functions for getting an instance
 *
 * But when getting an instance of a DataStore, we needed to call hooks
 * and take in a model type as an argument.
 */
export type DataStoreFactory = {
  get: <T extends BaseModel>(dataType: ModelClass<T>) => DataStore<T>;
};

export const DataStoreFactoryKey = providerKeyFor<DataStoreFactory>({
  name: 'datastore',
});

/**
 *
 * Most uses cases will want to use `useDataStore()` to avoid an extra lookup.
 */
export function useDataStoreFactory(): DataStoreFactory {
  return use(DataStoreFactoryKey);
}

/**
 * Get a `DataStore` for a given model.
 */
export function useDataStore<T extends BaseModel>(
  dataType: ModelClass<T>,
): DataStore<T> {
  const dataStores = useDataStoreFactory();
  return dataStores.get(dataType);
}

// Testing this out as a separate function outside of dataStore API.
// If usage is widespread will likely move into the API
export async function getRequired<T extends BaseModel>(
  store: DataStore<T>,
  id: string,
  opts?: GetOpts,
) {
  const value = await store.get(id, opts);
  if (value == null) {
    // TODO: Expose data type from dataStore and include in developer message
    throw new CodedError('dev.not_found', 'Item not found');
  }
  return value;
}
