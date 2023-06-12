/**
 * Lightweight Javascript DI that:
 * - Works on both client and server
 * - Works inside and outside of React components
 * - Doesn't require a top-level React Component for each provided value.
 *
 * Types of variables to provide:
 * - Current user and other infrequently changing application-level state (e.g. locale)
 * - Implementations of core APIs (logging, data access)
 * - Configuration: API Keys, URLs, etc
 *
 * **Usage**
 *
 * By convention, most providers will be wrapped in a `useXXX()` function:
 * ```
 * function MyComponent() {
 *   const logger = useLogger();
 *   const user = useLoggedInUser();
 * }
 * ```
 *
 * Provided values are identified by ProviderKeys. The underlying API is `use<T>(key: ProviderKey<T>)`.
 * How this implementation works
 * ```
 * function useTheme() {
 *   return use(ATheme); // ATheme is a provider key
 * }
 * ```
 *
 * Provider keys are generally defined next to the types they provide.
 * ```
 * type Theme = {primaryColor: string, secondaryColor: string};
 * const ATheme = providerKey<Theme>();
 * ```
 *
 * `use()` can be used in any Javascript code, not just React components.
 *
 * Guidelines for using `use()`:
 * * In React components, `use()` uses hooks and should follow rules of hooks when calling.
 * * In server code, `use()` can be called from any async process initiated by the server,
 *   but by convention we recommend getting all provided values at the top of a request handler
 *   and passing them to async processes by using the outer scope of the request or explicitly
 *   passing them in
 * * In non-React client code, a scope will be created for the duration of a function call,
 *   and `use()` must be called during that synchronous funciton exeution.
 * * In code meant be be usable across multiple environments, we recommend defining a
 *   hook-style API that is provided. This allows your code to call `use()` to get other
 *   provided values.
 *
 * Provided values are identified by a `ProviderKey`, which is a typed key
 * that can be used to look up the value.
 *
 * `ProviderKey`s are attached to instances of the type they provide, so
 * you an pass in the instance to configuration utilities.  See `ClientProviders`
 * and `ServerProviders` for platform-specific initialization docs.
 *
 * Most providers will be availble or configured as part of common libraries. If you
 * need to define your own provider, call `provides()` on an instance of the type
 * you want to provide.
 *
 * ```
 * const MyTheme = {primary: 'red', secondary: 'blue'};
 * // ATheme is a ProviderKey<Theme>
 * provides(ATheme, MyTheme);
 *
 * ...
 * platformSpecificInitCodeWith(MyTheme)
 * ```
 */

import {Opt} from '@toolkit/core/util/Types';

/**
 * Function that provides a value.
 */
export type Provider<T> = () => T;

/**
 * Key used to look up a provider.
 *
 * Note: Need a nested symbol to get type safety when using the key
 */
export type ProviderKey<T> = {id: Symbol; defaultValue?: T};

type ProviderKeyProps<T> = {
  name?: string;
  defaultValue?: T;
};
/**
 * Creates a key for providing values of type T.
 * The `name` parameter is optional and may be helpful for debugging.
 */
export function providerKeyFor<T>(
  props: ProviderKeyProps<T> = {},
): ProviderKey<T> {
  const {name, defaultValue} = props;
  return {id: Symbol(name), defaultValue};
}

/**
 * Mark an object as being a provider of a given key.
 *
 * Uses a symbol property on the object to store the key.
 */
export function provides<T>(key: ProviderKey<T>, provider: Provider<T>) {
  (provider as any)[KeyForProvides] = key;
  return provider;
}

/**
 * Mark an object as being a value that can be provided by a given key.
 *
 * Provided values have the property on the client that they can trigger
 * reactive UI changes directly. Providers need to trigger any state changes
 * in the provides() function.
 */
export function providesValue<T>(key: ProviderKey<T>, value: T) {
  (value as any)[KeyForProvidesValue] = key;
  return value;
}

/**
 * Get a provided value
 */
export function use<T>(key: ProviderKey<T>): T {
  if (useProviderImpl == null) {
    throw Error('Providers have not been initialized');
  }

  return useProviderImpl(key);
}

/**
 * Internal APIs to allow client and server to have different implementations.
 */
type UseProviderImpl = <T>(key: ProviderKey<T>) => T;
let useProviderImpl: Opt<UseProviderImpl> = null;

export function setUseProviderImpl(fn: UseProviderImpl) {
  useProviderImpl = fn;
}

// Symbols used to store the provider key on the object
export const KeyForProvides = Symbol('provides');
export const KeyForProvidesValue = Symbol('providesValue');
