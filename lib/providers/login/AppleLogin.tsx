import {AppleAuthenticationScope, signInAsync} from 'expo-apple-authentication';
import {IdentityProvider} from '@toolkit/core/api/Login';
import 'firebase/auth';

export function appleAuthProvider(): IdentityProvider {
  return {
    init: async () => {},

    useTryConnect: () => {
      return async () => {
        const cred = await signInAsync({
          requestedScopes: [
            AppleAuthenticationScope.FULL_NAME,
            AppleAuthenticationScope.EMAIL,
          ],
        });
        return {type: 'apple', token: cred.identityToken!};
      };
    },

    getAuthInfo: async () => {
      return null;
    },

    disconnect: async () => {},

    getType: () => 'apple',
  };
}
