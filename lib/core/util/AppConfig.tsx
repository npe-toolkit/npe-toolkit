import {providerKeyFor, use} from '@toolkit/core/providers/Providers';

/**
 * Utilities for having central config keyed off of a logical "product" key for the app.
 * Has typed config common fields as well as arbitrary key values.
 *
 * This allows utilities at all levels of the code to operate just by knowing the
 * "product", and
 *
 * Note: Didn't call this appId because that was overloaded, but "product" feels maybe confusing
 * TODO: Possibly switch to appKey or similar
 */

// All fields are optional, as not all apps use all features
// and configuration might be set from multiple places
export type AppConfig = {
  /** String product ID */
  product: string;

  /**
   * The data environment to use for this app. Different data environments should have siloed storage.
   *
   * By convention, 'prod' data environment will map to `product` above when naming silos, and
   * the `staging` environment will map to `${product}-staging`.
   *
   * Arbitrary strings environments may also be supported by your backend datastore and filestore
   * systems, but are not guaranteed to be supported by all implementations.
   */
  dataEnv: 'prod' | 'staging' | string;

  /**
   * App ID in the FB developer console @ https://developers.facebook.com/apps/
   *
   * Onlhy needed if you are logging in with Facebook auth.
   */
  fbAppId?: string;
};

export const AppConfigKey = providerKeyFor<AppConfig>({name: 'appconfig'});

export function useAppConfig(): AppConfig {
  return use(AppConfigKey);
}
