import {Opt} from '@toolkit/core/util/Types';

export type ApiKey<I, O> = {id: string};
export type Api<I, O> = (input: I) => Promise<O>;

export function createApiKey<I, O>(id: string) {
  const key: ApiKey<I, O> = {id};
  return key;
}

export type UseApi<I, O> = (key: ApiKey<I, O>) => Api<I, O>;

const APIS: Record<string, UseApi<any, any>> = {};
const CLIENT_FALLBACKS: Record<string, UseApi<any, any>> = {};
let preferClientApis = false;

/**
 * For early development, it is convenient to run all possible logic on the client using Firestore APIs,
 * including, for example, creating users only on the client.
 *
 * For launch many of these calls need to be moved to the server so they are more robust and secure,
 * and many types functionality can't be safely exposed on the client even in early dev.
 */
export function setPreferClientApis(value: boolean) {
  preferClientApis = value;
}

/**
 * Register an async method that provides  that provides the data for a given key.
 *
 * ## Usage
 *
 * *Using Data*
 * ```
 * function MyComponent() {
 *   const doIt = useApi(DoIt);
 *
 *   async function onPress() {
 *     await doIt();
 *     ...
 *   }
 *
 *   return <Button onPress={onPress}/>
 * }
 * ```
 *
 * *Defining a Key*
 * ```
 *  const DoIt = api<InputType, OutputType>('doit', () => {
 *    // Hooks go here
 *    const dataStore = useDataStore(THING);
 *
 *    return async (input:InputType) => {
 *      // Call data store methods here or anything else async
 *    }
 *  });
 * ```
 */
export function useApi<I, O>(key: ApiKey<I, O>): Api<I, O> {
  let useDataFn = APIS[key.id] as Opt<UseApi<I, O>>;
  if (preferClientApis && CLIENT_FALLBACKS[key.id]) {
    useDataFn = CLIENT_FALLBACKS[key.id] as Opt<UseApi<I, O>>;
  }
  if (useDataFn == null) {
    throw Error(`Attempt to use unregistered API Key ${key.id}`);
  }
  return useDataFn(key);
}

/**
 * Register an API. Includes:
 * - Signature of the API: `api<string, void>`
 * - Unique string key for the API: `api<string, void>(key...`
 * - Implementation (can be local or remote):
 *   - Local: `api<string, void>(key, (in: string) => {...})`
 *   - Remote: `api<string, void>(key, firebaseFn)
 * - Optional fallback for remote APIs. These are only used in early
 *   iterations of the app and in local testing for client-only development:
 *   `api<string, void>(key, firebaseFn, (in: string) => {...})
 */
export function api<I = void, O = void>(
  id: string,
  fn: UseApi<I, O>,
  client?: UseApi<I, O>,
): ApiKey<I, O> {
  const key = createApiKey<I, O>(id);
  APIS[id] = fn;
  if (client) {
    CLIENT_FALLBACKS[id] = client;
  }
  return key;
}

/**
 * Create an API using the default server API implementation for the app.
 */
export function serverApi<I = void, O = void>(
  id: string,
  client?: UseApi<I, O>,
) {
  return api(id, useDefaultServerApi, client);
}

function useDefaultServerApi<I, O>(key: ApiKey<I, O>) {
  if (!defaultServerApi) {
    throw Error('No default server API set');
  }
  return defaultServerApi(key);
}

let defaultServerApi: Opt<UseApi<any, any>> = null;

export function setDefaultServerApi(api: Opt<UseApi<any, any>>) {
  defaultServerApi = api;
}

// No-op client fallback function, if you want app to degrade gracefully
// for a given server call not existing. The call must return `void` to use this
// as a fallback
export function noop() {
  return async () => {};
}
