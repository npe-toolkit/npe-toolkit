// TODO Implement FB Login using Expo (the commented out sections)

import * as Facebook from 'expo-facebook';
import {IdentityProvider} from '@toolkit/core/api/Login';
import {useAppConfig} from '@toolkit/core/util/AppConfig';

export function fbAuthProvider(): IdentityProvider {
  return {
    init: async () => {},

    useTryConnect: (product: string, scopes: string[]) => {
      const appConfig = useAppConfig();
      return async () => {
        const fbAppId = appConfig.fbAppId ?? '';
        await Facebook.initializeAsync({appId: fbAppId});
        const result = await Facebook.logInWithReadPermissionsAsync({
          permissions: scopes,
        });
        if (result.type === 'cancel') {
          // TODO: Make this a real error
          throw Error('User cancelled');
        }
        return {
          type: 'facebook',
          token: result.token,
          id: result.userId,
        };
      };
    },

    getAuthInfo: async (product: string) => {
      return null;
    },

    disconnect: async (appId?: string) => {
      throw Error('not implemented on Expo yet');
    },

    getType: () => 'facebook',
  };
}
