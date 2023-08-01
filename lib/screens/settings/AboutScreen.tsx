import React from 'react';
import {Image, StyleSheet, Text, View} from 'react-native';
import Markdown, {
  RenderRules,
  hasParents,
  renderRules,
} from 'react-native-markdown-display';
import {useAppInfo} from '@toolkit/core/client/Theme';
import {Opt} from '@toolkit/core/util/Types';
import {useComponents} from '@toolkit/ui/components/Components';
import {useNav} from '@toolkit/ui/screen/Nav';

export type AboutScreenProps = {
  /** Title for the screen */
  title: string;

  /** Markdown for the body text */
  body: string;

  /** Markdown for optional note above Continue button */
  note?: Opt<string>;

  /** Whether to center text */
  center?: boolean;

  /** Whether to show the app icon */
  showIcon?: boolean;
};

/**
 * Create a basic About screen with a title and brief description.
 *
 * Good enough to get started with, but you'll likely want to create your
 * own customized About Screen at some point.
 */
export function simpleAboutScreen(props: AboutScreenProps) {
  return () => <SimpleAboutScreen {...props} />;
}

const SimpleAboutScreen = (props: AboutScreenProps) => {
  const {title, body, note, center, showIcon} = props;
  const {back, backOk} = useNav();
  const {Button} = useComponents();
  const {Title} = useComponents();
  const {appIcon} = useAppInfo();

  const bodyStyle = center
    ? {...BodyMarkdownStyle, ...CenterStyle}
    : BodyMarkdownStyle;
  const alignItems = center ? 'center' : undefined;

  return (
    <View style={S.container}>
      <View style={{alignItems}}>
        <Title style={S.title}>{title}</Title>
        {showIcon && <Image style={S.appLogo} source={appIcon} />}
        {/* @ts-ignore Markdown props don't have "children" yet */}
        <Markdown style={bodyStyle} rules={MarkdownRules}>
          {body}
        </Markdown>
      </View>

      <View style={{alignItems: 'center', marginTop: 24}}>
        {note && (
          /* @ts-ignore Markdown props don't have "children" yet */
          <Markdown style={NoteMarkdownStyle} rules={MarkdownRules}>
            {note}
          </Markdown>
        )}
        {backOk() && (
          <Button type="primary" onPress={back} style={{paddingHorizontal: 48}}>
            Continue
          </Button>
        )}
      </View>
    </View>
  );
};

const S = StyleSheet.create({
  container: {
    padding: 42,
    flex: 1,
    backgroundColor: '#FFF',
  },
  title: {
    fontWeight: '600',
    fontSize: 24,
    marginBottom: 12,
    alignSelf: 'center',
    textAlign: 'center',
    paddingBottom: 8,
  },
  appLogo: {
    width: 144,
    height: 144,
    marginTop: 16,
    marginBottom: 20,
    borderRadius: 23,
  },
});

const MarkdownRules: RenderRules = {
  list_item: (node, children, parent, styles) => {
    if (hasParents(parent, 'bullet_list')) {
      return (
        <View key={node.key} style={{flexDirection: 'row'}}>
          <Text style={{marginTop: 9, marginRight: 10}}>☆</Text>
          <View style={styles._VIEW_SAFE_bullet_list_content}>{children}</View>
        </View>
      );
    }

    return renderRules.list_item!(node, children, parent, styles);
  },
};

const BodyMarkdownStyle: StyleSheet.NamedStyles<any> = {
  text: {
    color: '#202020',
    fontSize: 18,
    lineHeight: 24,
  },
  body: {
    fontSize: 16,
  },
  strong: {
    fontWeight: '600',
  },
  heading3: {
    fontSize: 21,
    fontWeight: '600',
    paddingBottom: 0,
    paddingTop: 12,
  },
  paragraph: {
    marginTop: 4,
    marginBottom: 8,
  },
  link: {
    fontWeight: '500',
  },
};

const CenterStyle = {
  textgroup: {
    textAlign: 'center',
  },
  paragraph: {
    marginTop: 8,
    marginBottom: 12,
    justifyContent: 'center',
  },
};

const NoteMarkdownStyle = {
  ...BodyMarkdownStyle,
  ...CenterStyle,
  text: {
    fontSize: 12,
    color: '#828282',
  },
};
