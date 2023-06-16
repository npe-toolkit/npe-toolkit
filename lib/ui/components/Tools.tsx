// TODO: moti breaks chrome debugging
// We need to disable/override this when using the debugger

import React from 'react';
import {
  Alert,
  Keyboard,
  Platform,
  Pressable,
  StyleProp,
  StyleSheet,
  ViewStyle,
} from 'react-native';
import {MotiView} from 'moti';

export function KeyboardDismissPressable() {
  return (
    <Pressable
      style={StyleSheet.absoluteFill}
      onPress={() => Keyboard.dismiss()}
    />
  );
}

type Props = {
  children?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  pressableStyle?: StyleProp<ViewStyle>;
  delay?: number;
} & React.ComponentProps<typeof Pressable>;

export function PressableSpring({
  style,
  pressableStyle,
  children,
  onPressIn,
  onPressOut,
  delay = 0,
  ...props
}: Props) {
  const isPressed = React.useRef(false);
  const [displayPressed, setDisplayPressed] = React.useState(false);

  return (
    <Pressable
      style={pressableStyle}
      {...props}
      onPressIn={e => {
        isPressed.current = true;
        setTimeout(() => {
          if (isPressed.current) {
            setDisplayPressed(true);
          }
        }, delay);
        onPressIn && onPressIn(e);
      }}
      onPressOut={e => {
        isPressed.current = false;
        setDisplayPressed(false);
        onPressOut && onPressOut(e);
      }}>
      <MotiView
        style={style}
        animate={{scale: displayPressed ? 0.9 : 1}}
        transition={{type: 'spring', stiffness: 200, mass: 0.25}}>
        {children}
      </MotiView>
    </Pressable>
  );
}

/**
 * RN Alert (https://reactnative.dev/docs/alert) is not supported in
 * react-native-web yet (https://github.com/necolas/react-native-web#modules).
 *
 * This seems reasonable to fill the gap for now.
 * Based on https://github.com/necolas/react-native-web/issues/1026#issuecomment-679102691
 */

const _alert = (
  title: string,
  message?: string,
  buttons?: any[] | null,
): void => {
  const result = window.confirm([title, message].filter(Boolean).join('\n'));
  if (buttons == null) {
    return;
  }
  if (result) {
    const confirmOption = buttons.find(({style}) => style !== 'cancel');
    confirmOption &&
      typeof confirmOption.onPress === 'function' &&
      confirmOption.onPress();
  } else {
    const cancelOption = buttons.find(({style}) => style === 'cancel');
    cancelOption &&
      typeof cancelOption.onPress === 'function' &&
      cancelOption.onPress();
  }
};

// $FlowIgnore
export const alert = Platform.OS === 'web' ? _alert : Alert.alert;
