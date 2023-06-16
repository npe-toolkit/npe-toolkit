import React, {useEffect, useState} from 'react';
import {KeyboardAvoidingView, StyleSheet, View} from 'react-native';
import {useNavigation} from '@react-navigation/native';
import {FirebaseRecaptchaBanner} from 'expo-firebase-recaptcha';
import {format, isValidPhoneNumber, parse} from 'libphonenumber-js';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {useAuth} from '@toolkit/core/api/Auth';
import {User} from '@toolkit/core/api/User';
import {useTheme} from '@toolkit/core/client/Theme';
import {LoginFlowBackButton} from '@toolkit/screens/login/LoginScreenParts';
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
  const {phone = ''} = props;
  const [isLoading, setIsLoading] = useState(false);
  const [phoneNumber, setPhoneNumber] = useState(phone);
  const [isValid, setIsValid] = useState(false);
  const {top} = useSafeAreaInsets();
  const auth = useAuth();
  const {textColor} = useTheme();
  const {navigate} = useNavigation<any>();
  const {backgroundColor} = useTheme();
  const {Button, TextInput, Body, Title} = useComponents();

  useEffect(() => {
    setIsValid(isValidPhoneNumber(phoneNumber, 'US'));
  }, [phoneNumber]);

  const onSubmit = async () => {
    setIsLoading(true);
    try {
      const normalizedPhoneNumber = format(
        parse(phoneNumber, 'US'),
        'INTERNATIONAL',
      );
      await auth.sendCode('phone', normalizedPhoneNumber);
      navigate('PhoneVerification', {...props, phone: normalizedPhoneNumber});
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={[S.root, {backgroundColor}]}
      behavior={'padding'}
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

          <TextInput
            label="Phone Number"
            type="primary"
            autoComplete="tel"
            value={phoneNumber}
            onChangeText={setPhoneNumber}
          />

          <Button
            type="primary"
            style={{width: '100%', alignSelf: 'center'}}
            disabled={!isValid}
            loading={isLoading}
            onPress={onSubmit}>
            Continue
          </Button>
        </View>
        <View>
          <FirebaseRecaptchaBanner
            textStyle={{
              opacity: 0.9,
              color: textColor,
              fontSize: 14,
              textAlign: 'center',
            }}
            linkStyle={{
              opacity: 0.9,
              color: textColor,
              fontSize: 14,
              fontWeight: '600',
            }}
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
    backgroundColor: '#FFF',
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
});
