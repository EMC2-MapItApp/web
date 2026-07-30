/**
 * @file app.config.ts
 * @description Configuración raíz de la aplicación (providers globales): locale es-ES,
 * estrategia de reuse de rutas, rutas y el cliente HTTP con el interceptor de auth.
 */
import { ApplicationConfig, provideBrowserGlobalErrorListeners, LOCALE_ID } from '@angular/core';
import { provideRouter } from '@angular/router';
import { RouteReuseStrategy } from '@angular/router';
import { MapItReuseStrategy } from './core/reuse-strategy';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { authInterceptor } from './core/interceptors/auth.interceptor';
import { unauthorizedInterceptor } from './core/interceptors/unauthorized.interceptor';
import { registerLocaleData } from '@angular/common';
import localeEs from '@angular/common/locales/es';
import { PUSH_PROVIDER } from './core/notifications/push-provider';
import { NoopPushProvider } from './core/notifications/noop-push.provider';

import { routes } from './app.routes';

registerLocaleData(localeEs);

export const appConfig: ApplicationConfig = {
  providers: [
    { provide: LOCALE_ID, useValue: 'es' },
    { provide: RouteReuseStrategy, useClass: MapItReuseStrategy },
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),
    provideHttpClient(withInterceptors([authInterceptor, unauthorizedInterceptor])),
    // Push nativo desactivado temporalmente (kill-switch de producto, ver
    // mapit.push.enabled en el backend): NoopPushProvider no registra el Service Worker ni pide
    // permiso. Revertir es volver a `useClass: WebPushProvider` — esa clase y push-sw.js quedan
    // intactos. Único punto de acoplamiento al canal de push concreto — cambiar a Capacitor en
    // el futuro también es reemplazar este binding, sin tocar PushNotificationService ni la UI.
    { provide: PUSH_PROVIDER, useClass: NoopPushProvider },
  ]
};
