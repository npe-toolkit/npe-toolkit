import * as React from 'react';
import {StyleSheet, Text, View} from 'react-native';
import {useRoute} from '@react-navigation/core';
import {SafeAreaView} from 'react-native-safe-area-context';
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
import {NavType, Screen} from '@toolkit/ui/screen/Screen';

/**
 * Create a tab-based layout. Allows customizing the tabs and the items
 * on the top-right header.
 *
 * Most apps will gwant to customize this component - instead of creating
 * more options and knobs, when you want to do something not supported by
 * the default options, just make a copy `TabLayout.tsx` in your app directory
 * and customize at will!
 */
export function bottomTabLayout(layoutConfig: LayoutConfig): LayoutComponent {
  const {main: tabs} = layoutConfig;

  // Top level Tabs must use style.type = 'top to play nicely in navigation
  tabs.forEach(tab => {
    tab.screen.style = tab.screen.style || {};
    tab.screen.style.type = 'top';
  });

  return (layoutProps: LayoutProps) => (
    <TabLayout {...layoutConfig} {...layoutProps} />
  );
}

type TabLayoutProps = LayoutProps &
  LayoutConfig & {
    home?: Screen<any>;
  };

const TabLayout = (props: TabLayoutProps) => {
  const {title = '', children, style, main, extra, home} = props;
  const loadingView = props.loading ?? LoadingView;
  const onError = props.onError ?? logError;

  const route = useRoute();
  const key = route.key;

  const navStyle = style?.nav ?? 'full';
  const navType = style?.type ?? 'std';
  const showBack = navType !== 'top';
  const showTabs = navType === 'top' && navStyle !== 'none';
  const backgroundColor = props.backgroundColor ?? '#F0F0F0';

  return (
    <SafeAreaView style={S.top}>
      <View style={[S.innerTop, {backgroundColor}]}>
        {navStyle !== 'none' && (
          <Header
            title={title}
            navItems={extra}
            home={home}
            showBack={showBack}
            navStyle={navStyle}
          />
        )}
        <View style={S.content}>
          <TriState key={key} onError={onError} loadingView={loadingView}>
            <WaitForAppLoad>
              <View style={{flex: 1}}>{children}</View>
            </WaitForAppLoad>
          </TriState>
        </View>
        {showTabs && <BottomTabs tabs={main} />}
      </View>
    </SafeAreaView>
  );
};

type HeaderProps = {
  title: string;
  home?: Screen<any>;
  navItems?: NavItem[];
  showBack: boolean;
  navStyle: NavType;
};

const Header = ({
  title,
  home,
  navItems = [],
  showBack,
  navStyle,
}: HeaderProps) => {
  const {location, routes} = useNavState();
  const nav = useNav();

  function visible(item: NavItem) {
    return routeKey(item.screen, routes) !== location.route;
  }

  function goBack() {
    if (nav.backOk()) {
      nav.back();
    } else if (home) {
      nav.reset(home);
    }
  }

  const canBack = showBack && (nav.backOk() || home);
  const navs = navItems.filter(item => visible(item));

  const headerStyle = navStyle === 'full' ? S.header : S.headerOverlay;
  const titleToShow = navStyle === 'full' ? title : ' ';

  return (
    <View style={headerStyle}>
      <View style={S.headerActions}>
        {canBack && (
          <IconButton
            name="ion:chevron-back-outline"
            size={28}
            onPress={goBack}
          />
        )}
        <View style={{flexGrow: 1}} />
        {navs.map((item, idx) => (
          <IconButton
            name={getIcon(item)}
            size={28}
            style={S.headerRight}
            onPress={() => nav.navTo(item.screen)}
            key={idx}
          />
        ))}
      </View>
      <View style={S.titleBox}>
        <Text style={S.title} numberOfLines={1}>
          {titleToShow}
        </Text>
      </View>
    </View>
  );
};

type TabBarProps = {
  tabs: NavItem[];
};

const BottomTabs = ({tabs}: TabBarProps) => {
  const nav = useNav();
  const {routes, location} = useNavState();

  function enabled(item: NavItem) {
    return routeKey(item.screen, routes) !== location.route;
  }

  function styleFor(tab: NavItem) {
    return [S.bottomTab, {opacity: enabled(tab) ? 0.5 : 1}];
  }

  return (
    <View style={S.tabs}>
      {tabs.map((tab, idx) => (
        <View style={styleFor(tab)} key={idx}>
          <IconButton
            name={getIcon(tab)}
            disabled={!enabled(tab)}
            size={28}
            title={tab.title}
            onPress={() => nav.reset(tab.screen)}
            style={{alignItems: 'center'}}
          />
        </View>
      ))}
    </View>
  );
};

const S = StyleSheet.create({
  top: {
    flex: 1,
    alignSelf: 'stretch',
    backgroundColor: '#000',
  },
  innerTop: {
    flex: 1,
    overflow: 'hidden',
  },
  content: {
    flex: 1,
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: 400,
  },
  header: {
    left: 0,
    right: 0,
    paddingHorizontal: 8,
    paddingVertical: 12,
    backgroundColor: '#FFF',
  },
  headerOverlay: {
    width: '100%',
    paddingHorizontal: 8,
    paddingVertical: 12,
    position: 'absolute',
    zIndex: 5,
    left: 0,
    right: 0,
  },
  headerActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    zIndex: 2,
    position: 'absolute',
    left: 12,
    right: 12,
    top: 14,
  },
  titleBox: {
    alignItems: 'center',
    marginHorizontal: 40,
  },
  title: {
    fontSize: 26,
    fontWeight: '600',
    paddingHorizontal: 8,
    textAlign: 'center',
  },
  tabs: {
    backgroundColor: 'white',
    flexDirection: 'row',
    alignItems: 'center',
  },
  bottomTab: {
    flexGrow: 1,
    paddingTop: 8,
    paddingBottom: 2,
    alignItems: 'center',
  },
  headerRight: {
    opacity: 0.65,
    marginRight: 8,
  },
});

export default TabLayout;
