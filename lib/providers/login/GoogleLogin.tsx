import {useIdTokenAuthRequest} from 'expo-auth-session/providers/google';
import Constants from 'expo-constants';
import * as WebBrowser from 'expo-web-browser';
import {LoginCredential} from '@toolkit/core/api/Auth';
import {
  IdentityProvider,
  LoginError,
  UserCanceledLogin,
} from '@toolkit/core/api/Login';
import {usePersistentPromise} from '@toolkit/core/client/PersistentPromise';
import 'firebase/auth';
import * as React from 'react';

WebBrowser.maybeCompleteAuthSession();

export type GoogleLoginConfig = {
  expoClientId?: string;
  iosClientId?: string;
  webClientId?: string;
  expoId?: string;
  bundles?: Record<string, GoogleLoginConfig>;
};

export function googleAuthProvider(
  cfg: GoogleLoginConfig = {},
): IdentityProvider {
  // iOS needs a different ID per bundle (likely Android too...)
  const bundleId = Constants.expoConfig?.ios?.bundleIdentifier;
  if (bundleId && cfg.bundles?.[bundleId]) {
    cfg = {...cfg, ...cfg.bundles[bundleId]};
  }

  // Expo and web can use same client ID, so use web if Expo not set
  cfg.expoClientId = cfg.expoClientId || cfg.webClientId;
  const loginOpts = cfg.expoId ? {projectNameForProxy: cfg.expoId} : {};

  return {
    init: async () => {},

    useTryConnect: (product: string, scopes: string[]) => {
      const [_, fullResult, promptAsync] = useIdTokenAuthRequest(
        cfg,
        loginOpts,
      );
      const {resolve, reject, newPromise} =
        usePersistentPromise<LoginCredential>();
      const authResult = React.useRef<Promise<LoginCredential>>();

      if (fullResult !== null && fullResult.type === 'success') {
        // @ts-ignore
        const token = fullResult?.params?.id_token;
        resolve({type: 'google', token: token});
      }

      return async () => {
        authResult.current = newPromise();
        const resp = await promptAsync(loginOpts);
        const responseType = resp?.type;

        if (responseType === 'success') {
          // Annoyingly, the response here doesn't include the idToken - have to
          // wait for the fullResult state to be set. So return a `PersistentPromise`
          // that can be fulfilled on the ref that is returned.
          return authResult.current;
        }
        const error =
          responseType === 'error'
            ? resp.error!
            : responseType === 'dismiss'
            ? UserCanceledLogin()
            : LoginError(`Google login failure: ${responseType}`);
        reject(error);
        return authResult.current;
      };
    },

    getAuthInfo: async (product: string) => {
      return null;
    },

    disconnect: async (appId?: string) => {
      // TODO: Really disconnect
    },

    getType: () => 'google',
  };
}
