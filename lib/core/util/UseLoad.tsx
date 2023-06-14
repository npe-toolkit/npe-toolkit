import * as React from 'react';
import {useReloadState} from '@toolkit/core/client/Reload';
import Promised from '@toolkit/core/util/Promised';
import {withAsyncLoad} from './Loadable';

/**
 * Pattern for React Components that load their own data.
 * (note: This replaces `Loadable` which is being deprecated)
 *
 * Main component rendering logic can assume the data is loaded.
 *
 * Loading rendering and error rendering is deferred to a parent component,
 * using React Suspense and error boundary semantics. These can be easily
 * implemented using a `<TriState>`, which often is associated with a specific
 * layout so apps can have consistent loading and error UI.
 *
 * Under the hood, the load function can return any promise, for async data
 * both from remote or on-device / in-borwser sources.
 *
 * The standard pattern is to return a JSON object with a key per distinct async
 * data source - this makes it easy to load in parallel using `Promise.all`.
 *
 * To use, you need to create a higher order component (HOC) that wraps the
 * main component. Ideally this wouldn't have been needed, but it ended up
 * being needed to keep persistent component state, as React Suspense resets
 * state in the component that throws.
 *
 * Usage:
 *
 * ```
 * function MyComponent(props: Props) {
 *   const {items, user} = useLoad(props, load);
 *
 *   async function load() {
 *     const [items, user] = await Promise.all([
 *       getItems(),
 *       getUser(),
 *     ]);
 *     return {items, user}
 *   }
 * }
 *
 * export default withLoad(MyComponent);
 *```
 * Alternately you can use `useWithLoad` to create a hook that returns the
 * wrapped component if you have an unknown component that might need a loader.
 *
 * Screens by default will have `withLoad()` called on them and do not need
 * to be wrapped.
 *
 * By default, successive renders of the same component with the same props
 * will return a cached version of the data and not execute the `load()` function again.
 *
 * To update data on the page,
 * - Call `const reload = useReload()` to get a function that will force a reload, OR
 * - Call `setData()` to manually update the data for load and trigger a component re-render
 *    - setData is a prop on the returned value from `load()` function
 *    - `setData()` only works if you have returned a JSON object from `load()`
 */
export function useLoad<T>(props: ComponentProps, load: Loader<T>): WithSet<T> {
  // _loadkey and _loadstates are props used by the HOC to pass down results and status
  const {_loadkey: propsKey, _loadstate} = props;

  if (!propsKey) {
    throw Error(
      'useLoad requires components to be wrapped with withLoad() HOC',
    );
  }

  // Get the existing promise, indexed by props key
  const loadState = _loadstate as LoadState;
  const promises = loadState.promises;
  let promised = promises[propsKey];

  // If no existing promise, call the load function
  if (!promised) {
    const newPromised = new Promised<T>(load());
    promised = newPromised;
    promises[propsKey] = promised;
  }

  // Set the current value in React State so that you can manually update using `setData()`
  const [value, setValue] = React.useState(promised.getValue());

  // If the props key changes, update the value
  const lastKey = React.useRef(propsKey);
  if (lastKey.current !== propsKey) {
    setValue(promised.getValue());
    lastKey.current = propsKey;
  }

  // setData() lets you partially update the returned data by key
  function setData(newValues: Partial<T>) {
    const newData = {...value, ...newValues};
    promises[propsKey] = new Promised(newData);
    setValue(newData);
  }

  return {...value, setData};
}

/**
 * Return a HOC that allows the wrapped component to use `useLoad()`.
 *
 * This is required to preserve state across renders where the component throws
 * React.Suspense or an error, as state is lost.
 *
 * Tried using a global cache, but found that race conditions made it infeasible -
 * you really needed to know which component instance triggered the render
 */
export function withLoad<Props>(Component: React.ComponentType<Props>) {
  const ComponentWithLoad = (props: Props) => {
    const loadCount = useReloadState();

    const propsForKey = {...props, _count: loadCount} as Record<string, any>;

    // Currenltly we caches on all props (except for legacy `async`).
    // Likely will need to make this configurable
    const loadKey = propsToKey(propsForKey, ['async']);

    // Load state is state that is passed to the child component via props.
    // Includes both a persistent set of promises as well as methods
    // and future state / methods that will be updated on every render.
    const initialState: LoadState = {key: loadKey, promises: {}};

    // Currently we reset the load state when keys change, becasue
    // we don't have a way to update the cache for previously loaded items
    // when the component using this data isn't mounted (`setData()` only
    // operates a currently mounted component).
    // TODO: Dynamic load state that is able to update the cached value
    const loadState = React.useRef<LoadState>(initialState);
    if (loadKey !== loadState.current.key) {
      loadState.current = initialState;
    }

    return (
      <Component
        {...props}
        key={loadKey}
        _loadstate={loadState.current}
        _loadkey={loadKey}
      />
    );
  };

  return ComponentWithLoad;
}

/**
 * The persistent state stored in the parent HOC
 */
type LoadState = {
  key: string;
  promises: Record<string, Promised<any>>;
};

/**
 * Propse for an unknown component
 */
type ComponentProps = Record<string, any>;

/**
 * Type for the return value of load that adds the `setData` prop
 */
type WithSet<T> = T & {
  setData: (value: Partial<T>) => void;
};

/**
 * A function for loading data
 */
type Loader<T> = () => T | Promise<T>;

/**
 * Components that call `useLoad()` need to be wrapped using this method to create a HOC
 */
export function useWithLoad<Props>(Component: React.ComponentType<Props>) {
  // @ts-ignore Hook for legacy `Loadable` components until all are converted to `useLoad()`
  if (Component.load) {
    return React.useMemo(() => withAsyncLoad(Component as any), [Component]);
  }
  return React.useMemo(() => withLoad(Component), [Component]);
}

/**
 * Turn component props into a key for caching.
 */
function propsToKey(props: ComponentProps, exclude: string[] = [], depth = 0) {
  if (depth > 5) {
    throw new Error('Maximum depth exceeded');
  }

  function isValidProp(key: string) {
    const value = props[key];
    return (
      !exclude.includes(key) &&
      !React.isValidElement(value) &&
      typeof value !== 'function'
    );
  }

  const keys = Object.keys(props).filter(isValidProp).sort();

  const result: string = keys
    .map(key => {
      const value = props[key];
      if (typeof value === 'object' && value !== null) {
        return `${key}:${propsToKey(value, [], depth + 1)}`;
      } else {
        return `${key}:${JSON.stringify(value)}`;
      }
    })
    .join(',');

  return result;
}
