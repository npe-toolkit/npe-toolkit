import React, {useState} from 'react';
import {KeyboardAvoidingView, Platform, StyleSheet, View} from 'react-native';
import {useNavigation} from '@react-navigation/native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {useAuth} from '@toolkit/core/api/Auth';
import {useAction} from '@toolkit/core/client/Action';
import {useTheme} from '@toolkit/core/client/Theme';
import {toUserMessage} from '@toolkit/core/util/CodedError';
import {getWebDeviceType} from '@toolkit/core/util/Environment';
import {LoginFlowBackButton} from '@toolkit/screens/login/LoginScreenParts';
import {useTextInput} from '@toolkit/ui/UiHooks';
import {useComponents} from '@toolkit/ui/components/Components';
import {KeyboardDismissPressable} from '@toolkit/ui/components/Tools';
import {Screen} from '@toolkit/ui/screen/Screen';
import {PhoneLoginParams} from './PhoneInput';

const PhoneVerification: Screen<PhoneLoginParams> = props => {
  const {next = 'Home', onLogin, phone} = props;
  const {navigate} = useNavigation<any>();
  const {top} = useSafeAreaInsets();
  const [error, setError] = useState<string | null>(null);
  const auth = useAuth();
  const {backgroundColor} = useTheme();
  const {Button, Title, Body, Error} = useComponents();
  const [CodeInput, code, setCode] = useTextInput('');
  const [onSubmit, submitting] = useAction(login);

  async function login() {
    try {
      const user = await auth.login({type: 'phone', id: phone, token: code});
      if (onLogin) {
        onLogin(user);
      } else {
        navigate(next);
      }
    } catch (e) {
      setCode('');
      setError(toUserMessage(e));
    }
  }

  const heightStyle =
    Platform.OS === 'web' && getWebDeviceType() === 'mobile'
      ? {maxHeight: 400}
      : {};

  return (
    <KeyboardAvoidingView
      style={[S.root, {backgroundColor}]}
      behavior={Platform.OS === 'android' ? 'height' : 'padding'}
      keyboardVerticalOffset={top}>
      <View style={[S.padded, heightStyle]}>
        <KeyboardDismissPressable />
        <LoginFlowBackButton />

        <View style={S.spaced}>
          <View>
            <Title mb={16}>Verification</Title>
            <Body>
              Verify your number with the six-digit code we just sent you.
            </Body>
          </View>

          <View>
            <CodeInput
              label="Code"
              type="primary"
              keyboardType="number-pad"
              maxLength={6}
            />
            {error != null && (
              <View style={{paddingLeft: 10}}>
                <Error>Error - {error}</Error>
              </View>
            )}
            <View style={S.row}>
              <Button
                type="secondary"
                labelStyle={{fontSize: 14}}
                onPress={() => navigate('PhoneInput')}>
                Resend Code
              </Button>
            </View>
          </View>

          <Button
            type="primary"
            style={{width: '100%', alignSelf: 'center'}}
            loading={submitting}
            disabled={code.length === 0}
            onPress={onSubmit}>
            Verify
          </Button>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
};

export default PhoneVerification;

const S = StyleSheet.create({
  root: {
    flex: 1,
  },
  padded: {
    padding: 24,
    flex: 1,
  },
  row: {
    paddingVertical: 16,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  spaced: {
    marginTop: 18,
    flex: 1,
    justifyContent: 'space-between',
  },
});
