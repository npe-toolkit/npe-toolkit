import * as React from 'react';
import {StyleSheet, Text, View, useWindowDimensions} from 'react-native';
import {useRoute} from '@react-navigation/core';
import {SafeAreaView} from 'react-native-safe-area-context';
import {StatusBar, StatusContainer} from '@toolkit/core/client/Status';
import TriState from '@toolkit/core/client/TriState';
import {routeKey} from '@toolkit/providers/navigation/ReactNavigation';
import {
  IconButton,
  LayoutConfig,
  LoadingView,
  NavItem,
  WaitForAppLoad,
  getIcon,
  logError,
} from '@toolkit/ui/layout/LayoutBlocks';
import {LayoutComponent, LayoutProps} from '@toolkit/ui/screen/Layout';
import {useNav, useNavState} from '@toolkit/ui/screen/Nav';

/**
 * Create a tab-based layout where main nav is on the top left of the top bar
 */
export function topbarLayout(layoutConfig: LayoutConfig): LayoutComponent {
  const {main: tabs} = layoutConfig;

  // Top level Tabs must use style.type = 'top to play nicely in navigation
  tabs.forEach(tab => {
    tab.screen.style = tab.screen.style || {};
    tab.screen.style.type = 'top';
  });

  return (layoutProps: LayoutProps) => (
    <TopbarLayout {...layoutConfig} {...layoutProps} />
  );
}
const TopbarLayout = (props: LayoutProps & LayoutConfig) => {
  const {children, style} = props;
  const loadingView = props.loading ?? LoadingView;
  const onError = props.onError ?? logError;
  const {height: maxHeight} = useWindowDimensions();

  const route = useRoute();
  const key = route.key;

  const navStyle = style?.nav ?? 'full';

  return (
    <StatusContainer>
      <SafeAreaView style={[S.top, {maxHeight}]}>
        <View style={{flex: 1}}>
          {navStyle !== 'none' && <TopHeader {...props} />}
          <StatusBar style={{alignItems: 'center'}} />
          <View style={{flex: 1}}>
            <TriState key={key} onError={onError} loadingView={loadingView}>
              <WaitForAppLoad>
                <View style={{flex: 1}}>{children}</View>
              </WaitForAppLoad>
            </TriState>
          </View>
        </View>
      </SafeAreaView>
    </StatusContainer>
  );
};

const TopHeader = (props: LayoutProps & LayoutConfig) => {
  const {main: tabs, extra, title, style} = props;
  const {location, routes} = useNavState();
  const nav = useNav();
  const navStyle = style?.nav ?? 'full';

  function styleFor(tab: NavItem) {
    const bottomWidthStyle = isCurrent(tab) ? {borderBottomWidth: 3} : {};
    return [S.topTab, bottomWidthStyle];
  }

  function isCurrent(item: NavItem) {
    return routeKey(item.screen, routes) === location.route;
  }

  const rights = extra?.filter(item => !isCurrent(item)) || [];
  const iconCount = Math.max(tabs.length, rights.length);
  const actionsStyle = [S.topNavActions, {flexBasis: iconCount * 60}];
  const containerStyle = navStyle == 'full' ? S.fullNav : S.overlayNav;

  return (
    <View style={containerStyle}>
      <View style={S.topTabs}>
        <View style={actionsStyle}>
          {tabs.map((tab, idx) => (
            <View style={styleFor(tab)} key={idx}>
              <IconButton
                name={getIcon(tab)}
                disabled={isCurrent(tab)}
                size={28}
                onPress={() => nav.reset(tab.screen)}
                style={{alignItems: 'center', justifyContent: 'center'}}
              />
            </View>
          ))}
        </View>

        {navStyle == 'full' && <Text style={[S.title]}>{title}</Text>}
        <View style={[actionsStyle, {justifyContent: 'flex-end'}]}>
          {rights.map((item, idx) => (
            <IconButton
              name={getIcon(item)}
              size={28}
              style={S.topTab}
              onPress={() => nav.navTo(item.screen)}
              key={idx}
            />
          ))}
        </View>
      </View>
    </View>
  );
};

const S = StyleSheet.create({
  top: {
    flex: 1,
    alignSelf: 'stretch',
    backgroundColor: '#FFF',
  },
  title: {
    fontSize: 26,
    fontWeight: '600',
    paddingHorizontal: 8,
    textAlign: 'center',
  },
  topTabs: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  topNavActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexShrink: 0,
  },
  topTab: {
    height: 50,
    width: 60,
    justifyContent: 'center',
    alignItems: 'center',
    borderColor: 'green',
  },
  fullNav: {
    backgroundColor: '#FFF',
  },
  overlayNav: {
    left: 0,
    right: 0,
    position: 'absolute',
    zIndex: 5,
  },
});
