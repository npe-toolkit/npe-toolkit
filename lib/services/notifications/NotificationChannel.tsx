import {providerKeyFor, use} from '@toolkit/core/providers/Providers';
import {DeliveryMethod} from './NotificationTypes';

type NotificationChannelParams = {
  id: string;
  name: string;
  description: string;
  titleFormat: string;
  bodyFormat: string;
  defaultDeliveryMethod: DeliveryMethod;
};

export default class NotificationChannel {
  id: string;
  name: string;
  description: string;
  titleFormat: string;
  bodyFormat: string;
  defaultDeliveryMethod: DeliveryMethod;

  constructor(params: NotificationChannelParams) {
    this.id = params.id;
    this.name = params.name;
    this.description = params.description;
    this.titleFormat = params.titleFormat;
    this.bodyFormat = params.bodyFormat;
    this.defaultDeliveryMethod = params.defaultDeliveryMethod;
  }

  getTitle(titleParams: Record<string, string> | null): string {
    return interpolate(this.titleFormat, titleParams);
  }

  getBody(bodyParams: Record<string, string> | null): string {
    return interpolate(this.bodyFormat, bodyParams);
  }
}

const interpolate = (
  format: string,
  params: Record<string, string> | null,
): string => {
  if (params == null) {
    return format;
  }
  const names = Object.keys(params);
  const vals = Object.values(params);
  // @ts-ignore Global check
  return new Function(...names, `return \`${format}\`;`)(...vals);
};

type NotificationChannels = Record<string, NotificationChannel>;
export const NotificationChannelsKey = providerKeyFor<NotificationChannels>();

export const useNotificationChannels = (): Record<
  string,
  NotificationChannel
> => {
  return use(NotificationChannelsKey);
};
