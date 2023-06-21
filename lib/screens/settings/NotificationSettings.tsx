import * as React from 'react';
import {View} from 'react-native';
import {List, Switch} from 'react-native-paper';
import {useUserMessaging} from '@toolkit/core/client/Status';
import {Opt} from '@toolkit/core/util/Types';
import {useLoad} from '@toolkit/core/util/UseLoad';
import NotificationChannel, {
  useNotificationChannels,
} from '@toolkit/services/notifications/NotificationChannel';
import {
  DeliveryMethod,
  NotificationPref,
} from '@toolkit/services/notifications/NotificationTypes';
import {
  ChannelAndPref,
  useNotifications,
} from '@toolkit/services/notifications/NotificationsClient';
import {Screen} from '@toolkit/ui/screen/Screen';

export const NotificationAccordion = (props: ChannelAndPref) => {
  const {channel, pref} = props;
  const [enabled, setEnabled] = React.useState(pref.enabled ?? true);
  const [deliveryMethods, setDeliveryMethods] = React.useState(
    pref.deliveryMethods,
  );

  const {updatePref} = useNotifications();
  const {showError} = useUserMessaging();

  async function setDeliveryMethodEnabled(
    method: DeliveryMethod,
    enabled: boolean,
  ) {
    const newMethods = enabled
      ? deliveryMethods.concat(method)
      : deliveryMethods.filter(m => m !== method);

    pref.deliveryMethods = newMethods;

    const newPrefs = await updatePref(pref);

    // Update UI with server values. These can be different if the user is
    // setting these on two different devices.
    setDeliveryMethods(newPrefs.deliveryMethods);
  }

  async function setNotificationEnabled(isEnabled: boolean) {
    setEnabled(isEnabled);
    try {
      pref.enabled = isEnabled;
      await updatePref(pref);
    } catch (e) {
      setEnabled(!isEnabled);
      showError('Something went wrong. Please try again');
    }
  }

  return (
    <List.Accordion
      title={channel.name}
      description={channel.description}
      left={lprops => (
        <List.Icon {...lprops} icon="ion:notifications-outline" />
      )}>
      <List.Item
        title="Allow this notification"
        left={() => <List.Icon icon="ion:checkbox-outline" />}
        right={() => (
          <Switch
            value={enabled}
            color="#228"
            onValueChange={setNotificationEnabled}
            style={{alignSelf: 'center'}}
          />
        )}
      />
      <List.Item
        title="Push"
        left={() => <List.Icon icon="ion:phone-portrait-sharp" />}
        right={() => (
          <Switch
            value={deliveryMethods.includes('PUSH')}
            color={enabled ? '#228' : 'grey'}
            style={{alignSelf: 'center'}}
            disabled={!enabled}
            onValueChange={is_enabled =>
              setDeliveryMethodEnabled('PUSH', is_enabled)
            }
          />
        )}
      />
      <List.Item
        title="Email"
        left={() => <List.Icon icon="ion:mail-outline" />}
        right={() => (
          <Switch
            value={deliveryMethods.includes('EMAIL')}
            color={enabled ? '#228' : 'grey'}
            style={{alignSelf: 'center'}}
            disabled={!enabled}
            onValueChange={is_enabled =>
              setDeliveryMethodEnabled('EMAIL', is_enabled)
            }
          />
        )}
      />
      <List.Item
        title="SMS"
        left={() => <List.Icon icon="ion:chatbubble-outline" />}
        right={() => (
          <Switch
            value={deliveryMethods.includes('SMS')}
            color={enabled ? '#228' : 'grey'}
            style={{alignSelf: 'center'}}
            disabled={!enabled}
            onValueChange={is_enabled =>
              setDeliveryMethodEnabled('SMS', is_enabled)
            }
          />
        )}
      />
    </List.Accordion>
  );
};

type Props = {};

export const NotificationSettings: Screen<Props> = props => {
  const {getNotificationPrefs} = useNotifications();
  const {channelPrefs} = useLoad(props, load);

  const pref_accordions = channelPrefs.map((channelPref, i) => {
    return <NotificationAccordion {...channelPref} key={i} />;
  });

  return (
    <View style={{backgroundColor: 'white', flex: 1}}>
      <List.Section>{pref_accordions}</List.Section>
    </View>
  );

  async function load() {
    return {channelPrefs: await getNotificationPrefs()};
  }
};

NotificationSettings.title = 'Notifications';
