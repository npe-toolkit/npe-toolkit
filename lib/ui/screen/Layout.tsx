import * as React from 'react';
import {Text} from 'react-native';
import {CallerIdKey, provideCallerId} from '@toolkit/core/api/Log';
import {useReloadBoundary} from '@toolkit/core/client/Reload';
import {ErrorHandler} from '@toolkit/core/client/TriState';
import {Scope} from '@toolkit/core/providers/Client';
import {
  providerKeyFor,
  providesValue,
  use,
} from '@toolkit/core/providers/Providers';
import {PropsFor} from '@toolkit/core/util/Loadable';
import {useWithLoad} from '@toolkit/core/util/UseLoad';
import {Screen, ScreenProps} from '@toolkit/ui/screen/Screen';
import {useNavState} from './Nav';

export type LayoutProps = ScreenProps & {
  children?: React.ReactNode;
  onError?: ErrorHandler;
};

export type LayoutComponent = React.ComponentType<LayoutProps>;

type Props<S extends Screen<any>> = {
  layout: LayoutComponent;
  screen: S;
  params: PropsFor<S>;
};

export function ApplyLayout<S extends Screen<any>>(props: Props<S>) {
  const {layout: Layout, screen, params} = props;
  const baseScreenProps: ScreenProps = {
    title: screen.title || '',
    mainAction: screen.mainAction,
    actions: screen.actions || [],
    style: screen.style || {nav: 'full'},
    loading: screen.loading,
    parent: screen.parent,
    id: screen.id,
  };

  console.log('ApplyLayout', screen.name);

  const screenPropsRef = React.useRef<ScreenProps>(baseScreenProps);
  const Component = useWithLoad(screen);
  const {location} = useNavState();
  const [refresh, setRefesh] = React.useState(0);
  useReloadBoundary();

  const getScreenState = () => {
    return screenPropsRef.current;
  };
  function setScreenProps(props: ScreenProps) {
    screenPropsRef.current = props;
    setRefesh(refresh + 1);
  }

  const setScreenState = (props: Partial<ScreenProps>) => {
    // Get current props inside callback to use latest value
    const screenProps = screenPropsRef.current;
    let dirty = false;
    for (const k in props) {
      const key = k as keyof ScreenProps;
      if (props[key] !== screenProps[key]) {
        dirty = true;
      }
    }
    if (dirty) {
      setTimeout(() => setScreenProps({...screenProps, ...props}), 0);
    }
  };

  const screenApi = {getScreenState, setScreenState};

  // TODO: Find a way to memoize when putting in values... maybe
  providesValue(ScreenApiKey, screenApi);

  const callerId = providesValue(CallerIdKey, {
    where: screenPropsRef.current.id ?? location.route ?? 'Unknown',
  });

  return (
    <Scope name="screen" providers={[callerId, screenApi]}>
      <Layout {...screenPropsRef.current}>
        {Component ? (
          <Component {...params} />
        ) : (
          <Text>No Screen for ${location.route}</Text>
        )}
      </Layout>
    </Scope>
  );
}

type ScreenApi = {
  getScreenState: () => ScreenProps;
  setScreenState: (props: Partial<ScreenProps>) => void;
};

const ScreenApiKey = providerKeyFor<ScreenApi>({name: 'screen-api'});

export function useScreenState(): ScreenApi {
  return use(ScreenApiKey);
}
