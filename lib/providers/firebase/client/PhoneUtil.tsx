import {FirebaseRecaptchaVerifierModal} from 'expo-firebase-recaptcha';
import firebase from 'firebase/app';
import 'firebase/auth';
import React, {ComponentType, useRef} from 'react';
import {Platform} from 'react-native';

type SendVerificationCode = (phoneNumber: string) => Promise<string>;

export const useFirebasePhoneAuth = (): [
  ComponentType,
  SendVerificationCode,
] => {
  patchReactNativeWebViewCrash();
  const [instanceId, setInstanceId] = React.useState(0);

  const recaptchaVerifier = useRef<FirebaseRecaptchaVerifierModal>(null);

  const auth = firebase.auth();

  const sendVerificationCode = async (phoneNumber: string) => {
    const phoneProvider = new firebase.auth.PhoneAuthProvider(auth);

    const verifier = recaptchaVerifier.current!;

    // TODO: Catch any backend errors and rethrow CodedError
    const verificationId = await phoneProvider.verifyPhoneNumber(
      phoneNumber,
      verifier,
    );

    // This updates the instsace, which clears out the recaptcha overlay
    // without this call it will stay on screen ~forever.
    setInstanceId(instanceId + 1);
    return verificationId;
  };
  recaptchaVerifier.current?.cancel;

  const FirebaseRecaptcha = () => {
    return (
      <>
        <FirebaseRecaptchaVerifierModal
          key={instanceId}
          ref={recaptchaVerifier}
          firebaseConfig={firebase.app().options}
          attemptInvisibleVerification={true}
        />
      </>
    );
  };

  return [FirebaseRecaptcha, sendVerificationCode];
};

/**
 * Hacky workaround for 'react-native-webview' crashing app when JS is unloaded,
 * if the web view is currently active.
 *
 * `onContentProcessDidTerminate` bridge is always called when view is unloaded and
 * if JS engine is already stopped this will terminate the app, as the event callback
 * fires and React force quits.
 *
 * This happens in Expo Go and dev client apps, and seems likely it would also occur
 * when updating RN JavaScript in a standalone app.
 *
 * Temporary fix is to patch to set onContentProcessDidTerminate in bridge when the prop is
 * passed into the React Component.
 *
 * Patch is currently in PhoneUtil becasue `FirebaseRecaptchaVerifierModal` keeps a
 * persistent webview, but the issue isn't specific to this component and the logic
 * might e useful elewhere in future.
 */

let reactNativeWebViewCrashPatched = false;

function patchReactNativeWebViewCrash() {
  if (Platform.OS !== 'web') {
    try {
      if (!reactNativeWebViewCrashPatched) {
        const WebViewShared = require('react-native-webview/lib/WebViewShared');
        const useWebWiewLogic = WebViewShared.useWebWiewLogic;
        /** @ts-ignore */
        WebViewShared.useWebWiewLogic = props => {
          const result = useWebWiewLogic(props);
          if (!props.onContentProcessDidTerminateProp && result) {
            /** @ts-ignore */
            delete result['onContentProcessDidTerminate'];
          }
          return result;
        };
        reactNativeWebViewCrashPatched = true;
      }
    } catch (ignored) {}
  }
}
