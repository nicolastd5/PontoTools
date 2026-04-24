/**
 * @format
 */

import {AppRegistry} from 'react-native';
import messaging from '@react-native-firebase/messaging';
import App from './App';
import {name as appName} from './app.json';

// Handler de mensagens em background/killed. FCM exibe a notificação
// automaticamente quando o payload tem 'notification'; esse handler
// apenas garante que o JS engine acorde e processe data-only messages.
messaging().setBackgroundMessageHandler(async () => {
  // sem side-effects — o display é feito pelo próprio FCM
});

AppRegistry.registerComponent(appName, () => App);
