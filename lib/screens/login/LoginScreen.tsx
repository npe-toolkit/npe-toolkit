import React, {useState} from 'react';
import {Image, Platform, StyleSheet, View} from 'react-native';
import {useNavigation, useRoute} from '@react-navigation/native';
import Markdown from 'react-native-markdown-display';
import {AuthType, useAuth} from '@toolkit/core/api/Auth';
import {User} from '@toolkit/core/api/User';
import {useAction} from '@toolkit/core/client/Action';
import {StatusBar, StatusContainer} from '@toolkit/core/client/Status';
import {useAppInfo, useTheme} from '@toolkit/core/client/Theme';
import {Opt} from '@toolkit/core/util/Types';
import {
  FacebookButton,
  GoogleButton,
  LoginFlowBackButton,
  PhoneButton,
} from '@toolkit/screens/login/LoginScreenParts';
import {useComponents} from '@toolkit/ui/components/Components';
import {AppleButton} from './AppleButton';

// Note: Separate config is only needed because SimpleLoginScreen can supports multiple apps.
// If you branch this and create your own screen, you can just edit the content inline.
export type SimpleLoginScreenConfig = {
  // Title to show on page
  title?: string;

  // Text to show below title
  subtitle?: string;

  // Auth flows to show - currently only supports `google`, `facebook` and `phone`
  authTypes: AuthType[];

  // React nav screen to go to after logging in if no "next" param is specified
  // Defaults to 'Home'
  home?: string;

  // React nav screen to go to if 'onboarding' response type is returned from login attempt
  onboarding?: string;

  // Markdown for terms of service and privacy policy links. It is important
  // to have well defined policies for production applications, and you should
  // get legal advice for terms of service before launching.
  tos?: string;
};

/**
 * Basic login screen with buttons for each authType in the config.
 */
export function SimpleLoginScreen(props: {config: SimpleLoginScreenConfig}) {
  let {title, subtitle, tos} = props.config;
  const {appIcon} = useAppInfo();
  let {backgroundColor} = useTheme();
  const {Title, Subtitle} = useComponents();

  return (
    <StatusContainer>
      <View style={[S.root, {backgroundColor}]}>
        <LoginFlowBackButton />
        <View style={S.header}>
          <Image style={S.appLogo} source={appIcon} />
          <Title mb={8} center>
            {title}
          </Title>
          <Subtitle center>{subtitle}</Subtitle>
        </View>
        <StatusBar style={S.statusBox} errorStyle={S.error} />
        <AuthenticationButtons config={props.config} />
        <View style={S.tos}>
          {tos != null && (
            // @ts-ignore Markdown props don't have "children" yet
            <Markdown style={MARKDOWN_STYLE}>{tos}</Markdown>
          )}
        </View>
      </View>
    </StatusContainer>
  );
}

const MARKDOWN_STYLE: StyleSheet.NamedStyles<any> = {
  body: {textAlign: 'center'},
  link: {fontWeight: 'bold', textDecorationLine: 'none'},
};

/**
 * Utility to create `<SimpleLoginScreen>` component bound to config.
 */
export function simpleLoginScreen(config: SimpleLoginScreenConfig) {
  return () => <SimpleLoginScreen config={config} />;
}

const FB_SCOPES = {scopes: ['public_profile', 'email']};
const GOOGLE_SCOPES = {scopes: ['email']};

export function AuthenticationButtons(props: {
  config: SimpleLoginScreenConfig;
}) {
  let {authTypes, home, onboarding} = props.config;
  const auth = useAuth();
  const {navigate} = useNavigation<any>();
  const route: any = useRoute();
  const next = route?.params?.next || home || 'Home';
  const [loginErrorMessage, setLoginErrorMessage] = useState<Opt<string>>();
  const tryFacebookLogin = auth.useTryConnect('facebook', FB_SCOPES);
  const tryGoogleLogin = auth.useTryConnect('google', GOOGLE_SCOPES);
  const {Body, Error} = useComponents();
  const [tryLoginAction, loggingIn] = useAction('TryLogin', tryLogin);

  if (Platform.OS !== 'ios') {
    authTypes = authTypes.filter(v => v !== 'apple');
  }

  async function tryLogin(type: AuthType): Promise<void> {
    setLoginErrorMessage(null);
    const tryConnect = type === 'google' ? tryGoogleLogin : tryFacebookLogin;
    const creds = await tryConnect();
    // console.log(creds);
    const user = await auth.login(creds);
    // console.log(user);
    onLogin(user);
  }

  function onLogin(user: User) {
    console.log('onLogin', user);
    if (user.canLogin) {
      navigate(next);
    } else if (user.cantLoginReason === 'onboarding' && onboarding != null) {
      navigate(onboarding, {user});
    }
  }

  // TODO: Add loading state
  const buttons = authTypes.map((type, idx) => {
    if (type === 'facebook') {
      return (
        <FacebookButton
          onPress={() => tryLoginAction('facebook')}
          loading={loggingIn}
        />
      );
    } else if (type === 'google') {
      return (
        <GoogleButton
          onPress={() => tryLoginAction('google')}
          loading={loggingIn}
        />
      );
    } else if (type === 'phone') {
      return <PhoneButton onPress={() => navigate('PhoneInput', {onLogin})} />;
    } else if (type === 'apple') {
      return <AppleButton onLogin={onLogin} />;
    }

    return null;
  });

  return (
    <>
      {loginErrorMessage && <Error center>{loginErrorMessage}</Error>}
      {buttons.map((button, index) => (
        <View key={index} style={{marginTop: 12}}>
          {authTypes.length > 1 && index === authTypes.length - 1 && (
            <Body center style={S.orText}>
              Or
            </Body>
          )}
          {button}
        </View>
      ))}
    </>
  );
}
const S = StyleSheet.create({
  root: {
    flex: 1,
    padding: 16,
  },
  header: {
    alignItems: 'center',
    justifyContent: 'center',
    flexGrow: 1,
    flexBasis: 200,
  },
  appLogo: {
    width: 144,
    height: 144,
    marginVertical: 16,
    borderRadius: 23,
  },
  statusBox: {
    backgroundColor: 'transparent',
    justifyContent: 'center',
  },
  error: {
    color: 'red',
    textAlign: 'center',
  },
  orText: {
    opacity: 0.6,
    fontWeight: '600',
    marginBottom: 12,
  },
  tos: {
    alignSelf: 'center',
    textAlign: 'center',
    maxWidth: 400,
    marginVertical: 20,
  },
});
