import firebase from 'firebase/app';
import {providerKeyFor, provides} from '@toolkit/core/providers/Providers';

type Firestore = firebase.firestore.Firestore;

// Global variable for now
let firebaseConfig: FirebaseConfig;

// Tempoary fix for process definition in globals.ts not being picked up
declare var process: any;

export const DEFAULT_FUNCTIONS_REGION = 'us-central1';

export type FirebaseConfig = {
  projectId: string;
  appId: string;
  apiKey: string;
  authDomain: string;
  storageBucket?: string;
  messagingSenderId?: string;
  measurementId?: string;
  emulators?: {
    functions?: {
      useEmulator: boolean;
      host?: string;
      port?: number;
    };
    firestore?: {
      useEmulator: boolean;
      host?: string;
      port?: number;
    };
  };
  defaultFunctionsRegion?: string;
};

export const initializeFirebase = (config: FirebaseConfig) => {
  firebaseConfig = config;
  if (firebase.apps.length === 0) {
    const IS_SERVER = (process as any).env.GCLOUD_PROJECT != null;
    if (!IS_SERVER) {
      firebase.initializeApp(firebaseConfig);
    }
  }
};

export function getFirebaseConfig(): FirebaseConfig {
  if (!firebaseConfig) {
    // TODO: typed error
    throw Error('Firebase is not initialized');
  }
  return firebaseConfig;
}

export const getFirebaseApp = (): firebase.app.App => {
  if (firebase.apps.length === 0) {
    // TODO: typed error
    throw Error('Firebase is not initialized');
  }
  return firebase.app();
};

export function getFirebaseLib(type?: 'default' | 'admin') {
  let firebaseLib = firebase;
  const IS_SERVER = (process as any).env.GCLOUD_PROJECT != null;
  if (type === 'admin' || IS_SERVER) {
    const requireAlias = require;
    const adminPackage = 'firebase-admin';
    firebaseLib = requireAlias(adminPackage);
  }
  return firebaseLib;
}

const EMULATOR_FIRESTORE_HOST = '127.0.0.1';
const EMULATOR_FIRESTORE_PORT = 8080;

/**
 * Supports a scoped Firestore instance, which enables shared
 * client and server code for the implementation of the DataStore.
 * - Client uses Firebase 8.0 client libraries
 * - Server uses firebase-admin datastore, or client libraries when
 *   calls are scoped to a specific user credential
 */
export const FirestoreKey = providerKeyFor<Firestore>({
  name: 'firestore',
  defaultProvider: useFirestore,
});

export function useFirestore() {
  let firestore = getFirebaseLib().firestore();
  initializeOnce(firestore);
  return firestore;
}
provides(FirestoreKey, useFirestore);

// @deprecated Temporary alias while deprecating
export const getFirestore = useFirestore;

const initializedFirestores = new Map<Firestore, boolean>();

export function initializeOnce(firestore: Firestore) {
  if (!initializedFirestores.get(firestore)) {
    initializedFirestores.set(firestore, true);

    const emulatorConfig = firebaseConfig?.emulators?.firestore;
    if (emulatorConfig?.useEmulator) {
      firestore.useEmulator(
        emulatorConfig?.host ?? EMULATOR_FIRESTORE_HOST,
        emulatorConfig?.port ?? EMULATOR_FIRESTORE_PORT,
      );
    } else if (useFirestoreLongPolling) {
      firestore.settings({experimentalForceLongPolling: true, merge: true});
    }
  }

  return firestore;
}

// TODO: Use app from context (TBD: server context)
export function useFirebaseApp(): firebase.app.App {
  return getFirebaseApp();
}

let useFirestoreLongPolling = false;

export function setUseFirestoreLongPolling(value: boolean) {
  useFirestoreLongPolling = value;
}
