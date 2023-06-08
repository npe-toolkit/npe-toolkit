import React from 'react';
import {DataCallback} from '@toolkit/data/DataCache';
import {BaseModel, ModelClass, useDataStore} from '@toolkit/data/DataStore';

export function useListen<T extends BaseModel>(
  type: ModelClass<T>,
  id: string,
  fn: DataCallback,
) {
  const dataStore = useDataStore(type);
  React.useEffect(() => {
    return dataStore.listen(id, fn);
  }, [id, fn]);
}

export type UpdateCallback<T> = (value: T) => void | Promise<void>;

export function useDataListen<T extends BaseModel>(
  type: ModelClass<T>,
  id: string,
  fn: UpdateCallback<T>,
) {
  const dataStore = useDataStore(type);
  React.useEffect(() => {
    return dataStore.listen(id, async (_, op) => {
      if (op === 'update') {
        const value = await dataStore.get(id);
        if (value != null) {
          await fn(value);
        }
      }
    });
  }, [id, fn]);
}
