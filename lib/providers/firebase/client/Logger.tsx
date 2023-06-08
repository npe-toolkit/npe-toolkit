//

import * as Analytics from 'expo-firebase-analytics';
import {LogApiKey, LogEvent, fullEventName} from '@toolkit/core/api/Log';
import {provides} from '@toolkit/core/providers/Providers';

function FirebaseLogger() {
  // TODO: Hook into account information
  // TODO: Log current screen
  // TODO: Fork FirebaseAnalytics so we don't have to use global firebase analytics config.
  // (or determine that it's OK to use initFirebase() fields

  return (event: LogEvent): void => {
    // TODO: Verify that payload params all fit into Firebase log fields
    Analytics.logEvent(fullEventName(event), event);
  };
}

provides(LogApiKey, FirebaseLogger);
