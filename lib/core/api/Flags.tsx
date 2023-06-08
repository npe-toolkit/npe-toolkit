/**
 * Utility to load saved flags on client at startup.
 *
 * Different implementations may handle loading behavior differently.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import {providerKeyFor, provides, use} from '@toolkit/core/providers/Providers';
import {Opt} from '@toolkit/core/util/Types';

/**
 * APIs for applicaion flags - configuration values that modify app behavior.
 *
 * Primary use case is for boolean toggles that can be flipped on/off at the
 * server level. However will also be used for devloper flags to test behavior in
 * app, and to control variants of UI.
 */

// Wrapper type for flag IDs. Not just a string to give
// future flexibility without changing client code.
export type Flag<T> = {id: string; defaultValue: Opt<T>};

export type Flags = {
  /** Whether a boolean flag is set and true. Most common use case for `get()` so has own PAI */
  enabled: (flag: Flag<boolean>) => boolean;

  /** Get a flag value, returns null if not set */
  get: <T>(flag: Flag<T>) => Opt<T>;

  /** Set a flag value. May throw if flag is not settable */
  set: <T>(flag: Flag<T>, value: Opt<T>) => Promise<void>;
};
export const FlagsApiKey = providerKeyFor<Flags>(nullFlags());

export function useFlags() {
  return use(FlagsApiKey);
}

export function defineFlag(id: string, defaultValue: boolean): Flag<boolean> {
  return {id, defaultValue};
}

/**
 * Shorthand to get a single flag value.
 *
 * Prefer this to useFlags().get() as we will add capabilty
 * for localized updates based only on flags used.
 */
export function useEnabled(flag: Flag<boolean>): boolean {
  const flags = useFlags();
  return flags.enabled(flag);
}

function nullFlags(): Flags {
  return {
    enabled: () => false,
    get: () => null,
    set: async () => {},
  };
}

let initialLoadPromise: Opt<Promise<void>>;

const FLAGS_KEY = '_flags';

async function loadSavedFlags(): Promise<Record<string, any>> {
  try {
    const savedFlags = await AsyncStorage.getItem(FLAGS_KEY);
    const parsed = JSON.parse(savedFlags ?? '{}');
    return parsed;
  } catch (e) {
    // Assume this means corrupted storage
    console.error('Saved flags corrupted, clearing');
    await AsyncStorage.removeItem(FLAGS_KEY);
    return {};
  }
}

/**
 * Local flags implementation without server support.
 */
function inMemoryFlags(): () => Flags {
  const flagValues: Record<string, any> = {};

  initialLoadPromise = loadSavedFlags().then(flags => {
    Object.keys(flags).forEach(key => {
      flagValues[key] = flags[key];
    });
  });

  async function saveFlags() {
    await AsyncStorage.setItem(FLAGS_KEY, JSON.stringify(flagValues));
  }
  // Developer util to set flags from console
  // @ts-ignore
  const globalScope = global as any;
  globalScope['_setFlag'] = (id: string, value: any) => {
    flagValues[id] = value;
    saveFlags();
    return {success: true};
  };

  return () => {
    return {
      enabled: (flag: Flag<boolean>) => {
        return flagValues[flag.id] ?? flag.defaultValue;
      },

      get: <T,>(flag: Flag<T>) => {
        return flagValues[flag.id] ?? flag.defaultValue;
      },

      set: async <T,>(flag: Flag<T>, value: Opt<T>) => {
        flagValues[flag.id] = value;
        await saveFlags();
      },
    };
  };
}

// Use this to delay rendering UI until flags are loaded
export function waitForFlagLoad(): Promise<void> {
  return initialLoadPromise ?? Promise.resolve();
}

export const LocalFlags = provides(FlagsApiKey, inMemoryFlags());
