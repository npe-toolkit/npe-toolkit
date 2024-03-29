import * as React from 'react';
import {Platform} from 'react-native';
import {LoggedInUserKeyNoThrow} from '@toolkit/core/api/User';
import {
  providerKeyFor,
  provides,
  providesValue,
  use,
} from '@toolkit/core/providers/Providers';
import {CodedError} from '@toolkit/core/util/CodedError';
import {Opt} from '../util/Types';
import {defineFlag, useEnabled} from './Flags';

/**
 * For logging events, most clients should use either:
 * - `useLogEvent()` to log a single event at a point in time, or
 * - `useAction()` to log an async action (this includes other cross-cutting functionatily)
 * - `useLogPromise()` to log a promise when the Action API isn't suitable
 *
 * For configuring logging:
 * - Most apps will start using the `DevLogger` in their templates, which gives access to
 *   the log events in developer tools
 * - For production, there will be different options to log to the server,
 *   depending on what systems you are using to report your analytics
 */

/**
 * Simplest way to log an event, can use just a string.
 * The rest of the event payload will be inferred by the context.
 *
 * This is useful for events that are a single point in time - for
 * async actions, use `useLogPromise()`
 */
export function useLogEvent(): (name: string) => void {
  const createLogEvent = useCreateLogEvent();
  //console.log(use(LogApiKey));
  const logger = use(LogApiKey);

  return (name: string, where?: string) => {
    const event = createLogEvent(name);
    if (where != null) event.where = where;
    logger(event);
  };
}

/**
 * Create a log entry for a promise.
 * - Duration will be set for the duration of the promise
 * - status will be set based on the success or failure of the promise
 * - If promise is an error, debug will be set to the error stack.
 */
export function useLogPromise<T>(): (
  promise: Promise<T>,
  name: string,
) => void {
  const createLogEvent = useCreateLogEvent();
  const logger = use(LogApiKey);

  return async (promise: Promise<T>, name: string) => {
    const event = createLogEvent(name);

    try {
      await promise;
    } catch (e: any) {
      event.status = 'error';
      if (e instanceof CodedError) {
        event.statusCode = e.type;
      }
      event.errMsg = e.message;
      event.stack = e?.stack;
    } finally {
      event.duration = Date.now() - event.when!;
    }

    logger(event);
  };
}

/**
 * Type and context for a lower level event logger.
 */
type LogApi = (event: LogEvent) => void | Promise<void>;
type UseLogApi = () => LogApi;

export const LogApiKey = providerKeyFor<LogApi>({defaultValue: NullLogger()});

/**
 * Get the low level event logger. Most clients should *not* use this API directly,
 * as there are a large set of fields that need to be filled in, and the higher
 * level logging apis will do this automatically for you
 */
export function useLogApi(): LogApi {
  return use(LogApiKey);
}

/**
 * Default logger - does nothing.
 */
function NullLogger() {
  return () => {};
}

provides(LogApiKey, NullLogger);

/**
 * Logger that stores the last 500 log events in memory,
 * for display in developer tools.
 */
export function DevLogger() {
  return (event: LogEvent) => {
    DEV_LOG_EVENTS.push(event);
    if (DEV_LOG_EVENTS.length > MAX_DEV_LOG_EVENTS) {
      DEV_LOG_EVENTS.shift();
    }
  };
}
export function getDevLogs() {
  return DEV_LOG_EVENTS;
}

const DEV_LOG_EVENTS: LogEvent[] = [];
const MAX_DEV_LOG_EVENTS = 500;

provides(LogApiKey, DevLogger);

export const ConsoleLoggerEnabled = defineFlag('ConsoleLoggerEnabled', __DEV__);

let firstTime = true;
/**
 * Logger that writes to console.log
 */
export function ConsoleLogger() {
  const enabled = useEnabled(ConsoleLoggerEnabled);
  if (firstTime && enabled) {
    firstTime = false;
    console.log(
      'Developer console logging enabled.\n\n' +
        'You can disable in Dev Settings or enter ' +
        "_setFlag('ConsoleLoggerEnabled', false) in the Chrome debugger.",
    );
  }
  return (event: LogEvent) => {
    if (enabled) {
      const eventStr = eventToString(event);
      if (event.status === 'error') {
        console.error(`[Error] ${eventStr}`);
      } else {
        console.log(`[Log] ${eventStr}`);
      }
    }
  };
}
provides(LogApiKey, ConsoleLogger);

/**
 * Log to multiple sources. All of the loggers must support the same log payload,
 * or allow for `any` payloads.
 */
export function multiLogger<T>(useLogApis: UseLogApi[]): UseLogApi {
  return () => {
    const logEvents = useLogApis.map(useLogApi => useLogApi());
    return (event: LogEvent) => {
      try {
        logEvents.forEach(logEvent => logEvent(event));
      } catch (e) {
        console.error(e);
      }
    };
  };
}

/**
 * Convience wrapper to create a`MultiLogger` from a list of loggers.
 */
export function MultiLogger(useLogApis: UseLogApi[]) {
  return provides(LogApiKey, multiLogger(useLogApis));
}

function useCreateLogEvent(): (name: string) => LogEvent {
  // Ideally we want the version here that doesn't throw at startup. Hmm
  let userId: Opt<string> = null;
  const user = use(LoggedInUserKeyNoThrow);
  userId = user?.id;
  const {where} = useCallerId();

  return (name: string) => ({
    user: userId,
    name,
    where,
    when: Date.now(),
    status: 'ok',
    platform: Platform.OS,
  });
}

export function fullEventName(event: LogEvent) {
  return (event.where != null ? event.where + '::' : '') + event.name;
}

export function eventToString(event: LogEvent) {
  let str = fullEventName(event);

  if (event.when) {
    const d = new Date(event.when);
    const date = d.toLocaleString('en-US', {hour12: false}).replace(', ', '.');
    str += ` @${date}.${d.getMilliseconds()}`;
  }
  if (event.duration != null) {
    str += `, Duration Ms: ${event.duration}`;
  }

  if (event.status !== 'ok') {
    str += `, Status: ${event.status}`;
    if (event.statusCode != null) {
      str += ` [${event.statusCode}]`;
    }
    if (event.errMsg != null) {
      str += `, ${event.errMsg}`;
    }
  }

  return str;
}

type CallerId = {
  where: string;
};

/**
 * Logged events need to be associated with a place from which they were initiated.
 * This the name of a screen, a background process, or a server API endpoint.
 *
 * To allow logging from lower-level code that doesn't direct access to this information,
 * we are providing it via context.
 *
 * This uses `React.Context` instead of `AppContext` as there will be different
 * values per screen in the app. `AppContext` is for app-global values that
 * change infrequently.
 *
 * This may be useful for use cases beyond logging (e.g. rate limiting API calls separately
 * based on which screen called then).
 */
export function useCallerId(): CallerId {
  return use(CallerIdKey);
}

/**
 * Default caller ID is the 'App'.This is needed for logging events
 * that occur outside of the context of any specific screen.
 */
const DefaultCallerId: CallerId = {where: 'App'};

export const CallerIdKey = providerKeyFor<CallerId>({
  defaultValue: DefaultCallerId,
});

/**
 * Create a caller ID provider that can be passed into a scope
 */
export function provideCallerId(id: string) {
  return providesValue(CallerIdKey, {where: id});
}

/**
 * Low level event payload for sending log even data to logging systems.
 *
 * Most clients will only interact with a small set of these fields directly.
 */
export type LogEvent = {
  /** ID of the user at device or for whose data this is being executed */
  user?: Opt<string>;

  /** Event name */
  name: string;

  /** Where in the app the event took place. Can be a screen, or a logical background or server process */
  where?: string;

  /** When the event occurred */
  when?: number;

  /** Duration of the event. Will default to time event is processed if not set */
  duration?: number;

  /** Status of the event, defaults to 'ok' */
  status?: 'ok' | 'timeout' | 'error' | 'cancelled';

  /** Status code, for more information on error status results */
  statusCode?: string;

  /** Error message, when available */
  errMsg?: string;

  /** Full stack trace, when available */
  stack?: string;

  /** Platform from which this request came */
  platform?: typeof Platform.OS | 'server';

  /*
  To add:
  - session
  - source
  - deviceType
   */
};
