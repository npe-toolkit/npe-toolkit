import * as React from 'react';
import {KeyboardAvoidingView, Platform, StyleSheet, View} from 'react-native';
import {useNavigation} from '@react-navigation/native';
import {FirebaseRecaptchaBanner} from 'expo-firebase-recaptcha';
import {format, isValidPhoneNumber, parse} from 'libphonenumber-js';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {useAuth} from '@toolkit/core/api/Auth';
import {User} from '@toolkit/core/api/User';
import {useAction} from '@toolkit/core/client/Action';
import {useTheme} from '@toolkit/core/client/Theme';
import {LoginFlowBackButton} from '@toolkit/screens/login/LoginScreenParts';
import {useTextInput} from '@toolkit/ui/UiHooks';
import {useComponents} from '@toolkit/ui/components/Components';
import {KeyboardDismissPressable} from '@toolkit/ui/components/Tools';
import {Screen} from '@toolkit/ui/screen/Screen';

export type PhoneLoginParams = {
  /**
   * Can pass in the ID of a screen to navigate to on completion.
   * Defaults to Home if not set and onComplete is not set
   */
  next?: string;

  /** Action to take after completing flow (alternative to `next`) */
  onLogin?: (user: User) => void;

  /** Phone # set in flow already */
  phone?: string;
};

const PhoneInput: Screen<PhoneLoginParams> = props => {
  const {top} = useSafeAreaInsets();
  const auth = useAuth();
  const {textColor} = useTheme();
  const {navigate} = useNavigation<any>();
  const {backgroundColor} = useTheme();
  const {Button, Body, Title} = useComponents();
  const [PhoneInput, phone] = useTextInput(props.phone ?? '');
  const [onSubmit, submitting] = useAction(sendCode);
  const isValid = isValidPhoneNumber(phone, 'US');

  async function sendCode() {
    const normalizedPhoneNumber = format(parse(phone, 'US'), 'INTERNATIONAL');
    await auth.sendCode('phone', normalizedPhoneNumber);
    navigate('PhoneVerification', {...props, phone: normalizedPhoneNumber});
  }

  return (
    <KeyboardAvoidingView
      style={[S.root, {backgroundColor}]}
      behavior={Platform.OS === 'android' ? 'height' : 'padding'}
      keyboardVerticalOffset={top}>
      <View style={S.padded}>
        <KeyboardDismissPressable />
        <LoginFlowBackButton />
        <View style={S.spaced}>
          <View>
            <Title mb={16}>Sign up or sign in</Title>
            <Body>
              We’ll text you to verify your number. Standard message and data
              rates apply.
            </Body>
          </View>
          <PhoneInput label="Phone Number" type="primary" autoComplete="tel" />
          <Button
            type="primary"
            disabled={!isValid}
            loading={submitting}
            onPress={onSubmit}>
            Continue
          </Button>
        </View>
        <View>
          <FirebaseRecaptchaBanner
            textStyle={[S.footerText, {color: textColor}]}
            linkStyle={[S.footerLink, {color: textColor}]}
          />
        </View>
      </View>
    </KeyboardAvoidingView>
  );
};

export default PhoneInput;

const S = StyleSheet.create({
  root: {
    flex: 1,
  },
  padded: {
    padding: 24,
    flex: 1,
  },
  spaced: {
    marginTop: 18,
    marginBottom: 12,
    flex: 1,
    justifyContent: 'space-between',
  },
  footerText: {
    opacity: 0.9,
    fontSize: 14,
    textAlign: 'center',
  },
  footerLink: {
    opacity: 0.9,
    fontSize: 14,
    fontWeight: '600',
  },
});
