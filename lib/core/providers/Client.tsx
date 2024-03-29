import * as React from 'react';
import {
  ProviderScope,
  ScopeName,
  scope,
} from '@toolkit/core/providers/ProviderImpl';
import {
  ProviderKey,
  setUseProviderImpl,
} from '@toolkit/core/providers/Providers';
import {Opt} from '@toolkit/core/util/Types';

export type ScopeProps = {
  providers: any[];
  name?: ScopeName;
  children: React.ReactNode;
};

/**
 * In React, a scope containing a set of providers is tied to a `<Scope>`
 * React component.  To use, you pass in a list of providers:
 * ```
 * import {Scope} from '@toolkit/core/providers/Client';
 * import {FirebaseLogger} from '@toolkit/providers/firebase/FirebaseLogger';
 * import {OrangeAndPurple} '../somestylelib/Stylees';
 *
 * const providers = [FirebaseLogger, OrangeAndPurple, ...]
 *
 * <Scope providers={providers}>
 *   ... your app content here, eg
 *   <MainAppComponent/>
 * </Scope>
 *```
 *
 * Providers can also self-register in the current containing scope. This is useful for
 * imperative scope configuration as well as for implmentations that are tied to a
 * React component to provide the functionality.
 *
 * For example, Firesbase auth needs to render a recaptcha widget, so it will self-register
 * in the containing scope:
 * ```
 *  <Scope providers={providers}>
 *   <FirebaseAuthService />
 *   ... your app content here, eg
 *   <MainAppComponent/>
 * </Scope>
 * ```
 *
 * Scopes are hierarchical and can be nested, however we recommend using only an app-level scope and
 * a `Screen` level scope, as scopes work best and are easiest to reason about when
 * there are a small number of well-defined scopes. Consider passing down variables via
 * component props if these scopes don't work for a use case.
 */
export function Scope(props: ScopeProps) {
  const {providers, name = 'app', children} = props;
  const parentScope = React.useContext(ScopeContext);

  // Use same instance each time to avoid triggering re-renders
  const scopeRef = React.useRef<ProviderScope>(
    scope(providers, name, parentScope),
  );

  return (
    <ScopeContext.Provider value={scopeRef.current}>
      {children}
    </ScopeContext.Provider>
  );
}

// Client scope provider
const ScopeContext = React.createContext<Opt<ProviderScope>>(null);

export function useScope(name?: ScopeName) {
  const scope = React.useContext(ScopeContext);
  if (scope == null) {
    throw Error('To use scopes you need <Scope> in your component tree');
  }

  return findScope(scope, name);
}

export function findScope(scope: ProviderScope, name: Opt<ScopeName>) {
  if (name == null || name === scope.name()) {
    return scope;
  }
  const parentScope = scope.parent();

  if (parentScope == null) {
    throw Error(`No scope matching name "${name}"`);
  }

  return findScope(parentScope, name);
}

/**
 * Use a provided value on the client.
 *
 * Triggers a react state update when a provided value changes,
 * iff the value is set using `providesValue()`.
 */
function use<T>(key: ProviderKey<T>): T {
  const scope = useScope();
  const value = scope.use<T>(key);
  const [_, setRefresh] = React.useState(0);

  function updateValue(newValue: T) {
    // Update the state on a timeout to avoid changing state in
    // one React component while rendering a different one.
    // Value will be updated on `use()` on next render
    if (value !== newValue) {
      setTimeout(() => {
        setRefresh(val => val + 1);
      }, 0);
    }
  }

  // Trigger state change when scope value changes
  React.useEffect(() => {
    return scope.listen<T>(key, updateValue);
  }, [key, scope]);

  return value;
}

setUseProviderImpl(use);
