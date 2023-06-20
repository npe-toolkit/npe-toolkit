import React from 'react';
import {
  AppleAuthenticationButton,
  AppleAuthenticationButtonStyle,
  AppleAuthenticationButtonType,
} from 'expo-apple-authentication';
import {useAuth} from '@toolkit/core/api/Auth';
import {User} from '@toolkit/core/api/User';
import {useAction} from '@toolkit/core/client/Action';

type Props = {
  onLogin: (user: User) => void | Promise<void>;
};

const APPLE_SCOPES = {scopes: []};

export function AppleButton(props: Props) {
  const {onLogin} = props;
  const auth = useAuth();
  const [tryLogin] = useAction('AppleLogin', onPress);

  async function onPress() {
    const tryConnect = auth.useTryConnect('apple', APPLE_SCOPES);
    const creds = await tryConnect();
    const user = await auth.login(creds);
    onLogin(user);
  }

  return (
    <AppleAuthenticationButton
      buttonType={AppleAuthenticationButtonType.SIGN_IN}
      buttonStyle={AppleAuthenticationButtonStyle.WHITE_OUTLINE}
      cornerRadius={40}
      style={{height: 40}}
      onPress={tryLogin}
    />
  );
}
