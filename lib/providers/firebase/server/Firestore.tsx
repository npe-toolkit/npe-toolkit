import {noCacheProvider} from '@toolkit/data/DataCache';
import {BaseModel, DataStore, ModelClass} from '@toolkit/data/DataStore';
import {initializeOnce} from '@toolkit/providers/firebase/Config';
import {
  FirestoreContext,
  firebaseStore,
} from '@toolkit/providers/firebase/DataStore';
import {getInstanceFor} from '@toolkit/providers/firebase/Instance';
import {
  getAdminApp,
  getApp,
  getAppConfig,
} from '@toolkit/providers/firebase/server/Config';
import 'firebase/auth';
import 'firebase/firestore';

let alwaysUseAdminDatastore: boolean;

/**
 * By default, server requests operate in the context of the currently
 * logged in user and not as the "admin" role, which provides safer access to data.
 * This can be overridden at a callsite by using `getAdminDataStore()` but if you are
 * prototyping only or are sure it is safe to always run in the admin context, you can
 * call `setAlwaysUseAdminDatastore(true)`.
 * 
  // TODO: Add Github Wiki for enforcing Firebase security in functions
 */
export function setAlwaysUseAdminDatastore(value: boolean) {
  alwaysUseAdminDatastore = value;
}

export async function getDataStore<T extends BaseModel>(
  entityType: ModelClass<T>,
): Promise<DataStore<T>> {
  if (alwaysUseAdminDatastore) {
    return getAdminDataStore(entityType);
  }

  const appConfig = getAppConfig();
  const app = await getApp();

  const ctx = {
    firestore: initializeOnce(app.firestore()),
    instance: getInstanceFor(appConfig),
    cacheProvider: noCacheProvider(),
  };

  function getFirebaseStore<T extends BaseModel>(
    type: ModelClass<T>,
  ): DataStore<T> {
    return firebaseStore(type, {...ctx, dataStores: {get: getFirebaseStore}});
  }

  return getFirebaseStore(entityType);
}

export function getAdminDataStore<T extends BaseModel>(
  entityType: ModelClass<T>,
  ctx?: Partial<FirestoreContext>,
): DataStore<T> {
  const appConfig = getAppConfig();
  const app = getAdminApp();

  const fullCtx: FirestoreContext = {
    /* @ts-ignore Client and server have same API but are different types */
    firestore: initializeOnce(app.firestore()),
    instance: getInstanceFor(appConfig),
    cacheProvider: noCacheProvider(),
    dataStores: {get: getAdminDataStore},
    ...ctx,
  };

  return firebaseStore(entityType, fullCtx);
}
