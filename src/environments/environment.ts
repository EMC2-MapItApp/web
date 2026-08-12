import { Capacitor } from '@capacitor/core';

// Dentro del emulador/dispositivo Android, "localhost" apunta al propio dispositivo, no a la
// máquina que ejecuta el backend de dev. 10.0.2.2 es el alias especial que el emulador oficial
// de Android Studio (AVD) resuelve al loopback del host — solo vale para el AVD; un dispositivo
// físico o Genymotion necesitarían en su lugar la IP LAN del host.
const apiHost = Capacitor.isNativePlatform() ? '10.0.2.2' : 'localhost';

export const environment = {
  production: false,
  googleMapsApiKey: 'AIzaSyAOwbLlp49Cc84yawE0vLu1BIZUi2JLZgk',
  apiAuthUrl: `http://${apiHost}:8081/api/v1/auth`,
  apiUsersUrl: `http://${apiHost}:8081/api/v1/users`,
  apiCategoriesUrl: `http://${apiHost}:8081/api/v1/categories`,
  apiPublicationsUrl: `http://${apiHost}:8081/api/v1/publications`,
  apiGeoUrl: `http://${apiHost}:8081/api/v1/geo`,
  apiGroupsUrl: `http://${apiHost}:8081/api/v1/groups`,
  apiNotificationsUrl: `http://${apiHost}:8081/api/v1/notifications`,
  apiFeedbackUrl: `http://${apiHost}:8081/api/v1/feedback`,
  devSimIp: '',
};
