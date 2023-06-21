import {requireLoggedInUser} from '@toolkit/core/api/User';
import {Opt} from '@toolkit/core/util/Types';
import {useDataStore} from '@toolkit/data/DataStore';
import NotificationChannel, {
  useNotificationChannels,
} from '@toolkit/services/notifications/NotificationChannel';
import {
  NotificationPref,
  PushToken,
  StorageToken,
  UserNotifEndpoints,
} from '@toolkit/services/notifications/NotificationTypes';

export const useNotifications = (): NotificationsAPI => {
  const user = requireLoggedInUser();
  const tokenStore = useDataStore(StorageToken);
  const prefsStore = useDataStore(NotificationPref);
  const channels = useNotificationChannels();

  function defaultPrefForChannel(channel: NotificationChannel) {
    return {
      id: 'new',
      channelId: channel.id,
      user,
      deliveryMethods: [channel.defaultDeliveryMethod],
      enabled: true,
    };
  }

  return {
    registerPushToken: async (token): Promise<void> => {
      const id = `${user.id}:${token.token}`;
      const existing = await tokenStore.get(id);

      // Token already registered.
      if (existing != null) {
        return;
      }

      await tokenStore.create({
        id,
        user: {id: user.id},
        ...token,
      });
    },

    unregisterPushToken: async token => {
      const storedToken = await tokenStore.query({
        where: [{field: 'token', op: '==', value: token}],
      });

      // There should only be one if it exists because the key is userId:token
      if (storedToken.length > 0) {
        await tokenStore.remove(storedToken[0].id);
      }
    },

    getNotificationPrefs: async () => {
      const prefs = await prefsStore.query({
        where: [{field: 'user', op: '==', value: user.id}],
      });

      return Object.keys(channels).map(key => ({
        channel: channels[key],
        pref:
          prefs.find(pref => pref.channelId === channels[key].id) ??
          defaultPrefForChannel(channels[key]),
      }));
    },

    updatePref: async pref => {
      const newPref: Partial<NotificationPref> = {...pref};
      if (newPref.id === 'new') {
        delete newPref['id'];
        return await prefsStore.create(newPref);
      } else {
        return await prefsStore.update(newPref);
      }
    },
  };
};

export type ChannelAndPref = {
  channel: NotificationChannel;
  pref: NotificationPref;
};

/**
 * All methods in this API operate on
 * - The currently logged in user in the client
 * - The user making the request on the server
 *
 * Apps should implement these functions using their user and data models
 * (or just use the FCM implementation built into NPE Toolkit).
 * // TODO: Add links to FCM implementation here and below.
 */
export type NotificationsAPI = {
  /**
   * Register a push token for the logged in user.
   *
   * The token passed here will be converted to a StorageToken and stored
   */
  registerPushToken: (token: PushToken) => Promise<void>;

  /**
   * Invalidate a push token for the logged in user
   */
  unregisterPushToken: (tokenId: string) => Promise<void>;

  /**
   * Get the logged in user's notification prefernces,
   * which are the channel ID mapped to an array of delivery methods.
   *
   * If the user has disabled this notification, this will return
   * an empty array.
   */
  getNotificationPrefs: () => Promise<ChannelAndPref[]>;

  /**
   * Set the logged in user's preferred delivery methods for a channel.
   * This will override the default delivery method set for a channel.
   */
  updatePref: (pref: NotificationPref) => Promise<NotificationPref>;
};

/**
 * This is a server-only API will use an admin or all-powerful VC
 */
export type NotificationsSendAPI = {
  /**
   * Get the list of preferred and valid endpoints where notifications
   * should be sent for the given list of users.
   *
   * If a user has opted out of notifications for this channel,
   * all endpoints will be empty.
   *
   * If a user has opted out of recieving notifications from a specific delivery
   * method for this channel, the endpoints for that method will be empty.
   */
  getPreferredSendDestinations: (
    userIds: string[],
    channel: NotificationChannel,
  ) => Promise<Record<string, UserNotifEndpoints>>;
};
