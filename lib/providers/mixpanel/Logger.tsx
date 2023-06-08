import {LogApiKey, LogEvent, fullEventName} from '@toolkit/core/api/Log';
import {provides} from '@toolkit/core/providers/Providers';
import {uuidv4} from '@toolkit/core/util/Util';

/**
 * Using the mixpanel HTTP endpoint to avoid native dependencies.
 */
async function mixpanelRequest(endpoint: string, json: any) {
  const resp = await fetch(`https://api.mixpanel.com/${endpoint}`, {
    method: 'POST',
    headers: {'Content-Type': 'application/x-www-form-urlencoded'},
    referrerPolicy: 'strict-origin-when-cross-origin',
    body: `data=${JSON.stringify(json)}`,
  });
  const isError = (await resp.text()) === '0';
  if (isError) {
    throw new Error('Mixpanel request failed');
  }
}

export function MixpanelLogger(token: string) {
  function useMixpanelLogger() {
    return async (event: LogEvent) => {
      const {user, when, ...rest} = event;
      const insert_id = uuidv4();
      try {
        const mixpanelEvent = {
          event: fullEventName(event),
          properties: {
            distinct_id: user || 'anonymous',
            $insert_id: insert_id,
            time: when,
            token,
            ...rest,
          },
        };
        await mixpanelRequest('track', [mixpanelEvent]);
        const identityEvent = {
          $set: {dev: __DEV__},
          $distinct_id: user || 'anonymous',
          $token: token,
        };
        await mixpanelRequest('engage', [identityEvent]);
      } catch (e) {
        console.error(e);
      }
    };
  }

  return useMixpanelLogger;
}

export function mixpanelLogContext(token: string) {
  return provides(LogApiKey, MixpanelLogger(token));
}
