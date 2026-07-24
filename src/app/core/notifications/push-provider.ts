/**
 * @file push-provider.ts
 * @description Abstracción del canal de entrega del push nativo del SO. Hoy solo existe
 * {@link WebPushProvider} (Web Push estándar vía VAPID + Service Worker), pero el resto de la
 * app depende únicamente de esta interfaz — nunca de `navigator.serviceWorker`/`PushManager`
 * directamente. Cuando se empaquete con Capacitor, un `CapacitorPushProvider` (FCM/APNs)
 * implementará el mismo contrato y solo cambiará el binding del token `PUSH_PROVIDER` en
 * `app.config.ts`, sin tocar {@link PushNotificationService} ni la UI.
 */
import { InjectionToken } from '@angular/core';

/** Estado del permiso de notificaciones del navegador/SO para este dispositivo. */
export type PushPermissionState = 'default' | 'granted' | 'denied' | 'unsupported';

/** Forma que el backend espera al registrar una suscripción (`PushSubscriptionRequest`). */
export interface PushSubscriptionData {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}

export interface PushProvider {
  /** El navegador/dispositivo actual soporta este canal de push. */
  isSupported(): boolean;

  /** Estado actual del permiso, sin solicitarlo. */
  permissionState(): PushPermissionState;

  /** Este dispositivo tiene ya una suscripción activa (persiste entre recargas de página). */
  hasActiveSubscription(): Promise<boolean>;

  /**
   * Pide permiso (si hace falta) y suscribe este dispositivo. `null` si el usuario deniega el
   * permiso o el canal no está soportado.
   */
  subscribe(vapidPublicKey: string): Promise<PushSubscriptionData | null>;

  /**
   * Da de baja la suscripción activa de este dispositivo, si la hay.
   *
   * @returns el `endpoint` que se ha dado de baja, para poder desregistrarlo también en el
   *          backend; `null` si no había ninguna suscripción activa.
   */
  unsubscribe(): Promise<string | null>;
}

export const PUSH_PROVIDER = new InjectionToken<PushProvider>('PUSH_PROVIDER');
