import {Platform} from 'react-native';
import {setUseFirestoreLongPolling} from '@toolkit/providers/firebase/Config';

// We needed a separate client-only file for this init
// to avoid adding react-native dependency on the server.
export function initializeFirestore() {
  setUseFirestoreLongPolling(Platform.OS === 'android');
}
