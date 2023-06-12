import {ImageSourcePropType} from 'react-native';
import {StatusBarStyle} from 'expo-status-bar';
import {providerKeyFor, use} from '@toolkit/core/providers/Providers';

/**
 * Least-common denominator set of themes for component rendering.
 *
 * Note: Unclear if this approach will scale, and may end up allowing customization
 * at the component level (e.g. customize the `<Button>` vs params for the buttons).
 */
export type BasicTheme = {
  backgroundColor: string;
  textColor: string;
  buttonColor: string;
  buttonTextColor: string;
  // TODO: Remove this, belongs in parent app config
  statusBarStyle?: StatusBarStyle;
};

const BASIC_BLACK: BasicTheme = {
  backgroundColor: '#FFF',
  textColor: '#000',
  buttonColor: '#000',
  buttonTextColor: '#FFF',
  statusBarStyle: 'light',
};

const BasicThemeKey = providerKeyFor<BasicTheme>({defaultValue: BASIC_BLACK});

export const useTheme = (): BasicTheme => {
  return use(BasicThemeKey);
};

/**
 * Common UI information about the app.
 *
 * Difference between this and themes - themes can be shared,
 * while `AppInfo` is different per app.
 */
export type AppInfo = {
  appName: string;
  appIcon: ImageSourcePropType;
};

export const AppInfoKey = providerKeyFor<AppInfo>();

export const useAppInfo = (): AppInfo => {
  return use(AppInfoKey);
};
