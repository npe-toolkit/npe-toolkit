import {User} from '@toolkit/core/api/User';
import {useDataStore} from '@toolkit/data/DataStore';
import NotificationChannel from '@toolkit/services/notifications/NotificationChannel';
import {
  NotificationPref,
  StorageToken,
  UserNotifEndpoints,
} from '@toolkit/services/notifications/NotificationTypes';
import {NotificationsSendAPI} from '@toolkit/services/notifications/NotificationsClient';

export const getFirebaseNotificationsSendAPI = (): NotificationsSendAPI => {
  const userStore = useDataStore(User);
  const tokenStore = useDataStore(StorageToken);
  const prefsStore = useDataStore(NotificationPref);

  const getUserNotfEndpoints = async (
    userId: string,
  ): Promise<Record<string, UserNotifEndpoints>> => {
    const endpoints: UserNotifEndpoints = {
      pushTokens: [],
      emails: [],
      phoneNumbers: [],
    };

    const user = await userStore.get(userId);
    if (user == null) {
      return {[userId]: endpoints};
    }

    if (
      user.emailVerified != null &&
      user.emailVerified &&
      user.email != null
    ) {
      endpoints.emails = [user.email];
    }

    if (
      user.phoneVerified != null &&
      user.phoneVerified &&
      user.phone != null
    ) {
      endpoints.phoneNumbers = [user.phone];
    }

    const tokens = await tokenStore.query({
      where: [{field: 'user', op: '==', value: userId}],
    });

    endpoints.pushTokens = tokens
      .map(token => token.fcmToken)
      .filter(token => token != null);

    return {[userId]: endpoints};
  };

  const getUserPrefs = async (
    userIds: string[],
    channel: NotificationChannel,
  ) => {
    // This will be an array of Record<userId, NotificationPref>
    const prefs = await Promise.all(
      userIds.map(async userId => {
        return {[userId]: await prefsStore.get(`${userId}:${channel.id}`)};
      }),
    );

    // Combine the array of Record<userId, NotificationPref> into
    // a single object
    return prefs.reduce((prev, curr) => {
      return {...prev, ...curr};
    }, {});
  };

  return {
    getPreferredSendDestinations: async (userIds, channel) => {
      // This will be an array of Record<userId, UserNotifEndpoints>
      const endpointsList = await Promise.all(
        userIds.map(userId => getUserNotfEndpoints(userId)),
      );

      // Combine the array of Record<userId, UserNotifEndpoints> into
      // a single object
      const endpoints = endpointsList.reduce((prev, curr) => {
        return {...prev, ...curr};
      }, {});
      const prefs = await getUserPrefs(userIds, channel);

      // Filter endpoints with user preferences
      for (const userId in endpoints) {
        // Get the user's preference
        const pref = prefs[userId];
        const deliveryMethods =
          pref != null ? pref.deliveryMethods : [channel.defaultDeliveryMethod];

        // If the user doesn't want to recieve notifs for this channel via
        // a specific method, remove that method's endpoints.
        if (!deliveryMethods.includes('PUSH')) {
          endpoints[userId].pushTokens = [];
        }
        if (!deliveryMethods.includes('EMAIL')) {
          endpoints[userId].emails = [];
        }
        if (!deliveryMethods.includes('SMS')) {
          endpoints[userId].phoneNumbers = [];
        }
      }

      return endpoints;
    },
  };
};
