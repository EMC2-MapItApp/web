/**
 * @file noop-push.provider.ts
 * @description Implementación de {@link PushProvider} que no hace nada — usada mientras el canal
 * de push nativo está desactivado temporalmente (ver binding en `app.config.ts`). No toca
 * `navigator.serviceWorker`/`PushManager`/`Notification` en ningún momento, así que ni se
 * registra `push-sw.js` ni se pide permiso de notificaciones. `WebPushProvider` queda intacto y
 * listo para reactivarse el día que se revierta: basta con cambiar el binding en `app.config.ts`.
 */
import { Injectable } from '@angular/core';
import { PushPermissionState, PushProvider, PushSubscriptionData } from './push-provider';

@Injectable({ providedIn: 'root' })
export class NoopPushProvider implements PushProvider {

  isSupported(): boolean {
    return false;
  }

  permissionState(): PushPermissionState {
    return 'unsupported';
  }

  async hasActiveSubscription(): Promise<boolean> {
    return false;
  }

  async subscribe(): Promise<PushSubscriptionData | null> {
    return null;
  }

  async unsubscribe(): Promise<string | null> {
    return null;
  }
}
