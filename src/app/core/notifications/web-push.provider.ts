/**
 * @file web-push.provider.ts
 * @description Implementación de {@link PushProvider} vía el protocolo Web Push estándar
 * (VAPID) + el Service Worker dedicado en `public/push-sw.js`. Es la única pieza del frontend
 * que toca `navigator.serviceWorker`/`PushManager`/`Notification` directamente.
 */
import { Injectable } from '@angular/core';
import { environment } from '@env/environment';
import { PushPermissionState, PushProvider, PushSubscriptionData } from './push-provider';

@Injectable({ providedIn: 'root' })
export class WebPushProvider implements PushProvider {
  private readonly swPath = '/push-sw.js';

  isSupported(): boolean {
    return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
  }

  permissionState(): PushPermissionState {
    if (!this.isSupported()) return 'unsupported';
    return Notification.permission;
  }

  async hasActiveSubscription(): Promise<boolean> {
    if (!('serviceWorker' in navigator)) return false;
    const registration = await navigator.serviceWorker.getRegistration(this.swPath);
    const subscription = await registration?.pushManager.getSubscription();
    return !!subscription;
  }

  async subscribe(vapidPublicKey: string): Promise<PushSubscriptionData | null> {
    if (!this.isSupported()) return null;

    const permission = await Notification.requestPermission();
    // TODO(debug-push): logs temporales — quitar una vez confirmado el flujo end-to-end.
    // Gateados por environment.production: el endpoint de la suscripción es un identificador
    // estable del canal push del dispositivo y no debe quedar en la consola de producción.
    if (!environment.production) console.log('[push] permiso:', permission);
    if (permission !== 'granted') return null;

    const registration = await navigator.serviceWorker.register(this.swPath);
    await navigator.serviceWorker.ready;
    if (!environment.production) {
      console.log(
        '[push] service worker registrado, scope:',
        registration.scope,
        'estado:',
        registration.active?.state,
      );
    }

    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: this.urlBase64ToUint8Array(vapidPublicKey),
    });
    if (!environment.production) {
      console.log('[push] suscripción del navegador creada, endpoint:', subscription.endpoint);
    }

    const json = subscription.toJSON();
    const p256dh = json.keys?.['p256dh'];
    const auth = json.keys?.['auth'];
    if (!json.endpoint || !p256dh || !auth) {
      // Solo qué campos faltan, nunca el objeto json completo: p256dh/auth son claves de
      // cifrado de la suscripción push del dispositivo.
      console.warn('[push] suscripción sin endpoint/keys completos', {
        endpoint: !!json.endpoint,
        p256dh: !!p256dh,
        auth: !!auth,
      });
      return null;
    }

    return { endpoint: json.endpoint, keys: { p256dh, auth } };
  }

  async unsubscribe(): Promise<string | null> {
    if (!('serviceWorker' in navigator)) return null;

    const registration = await navigator.serviceWorker.getRegistration(this.swPath);
    const subscription = await registration?.pushManager.getSubscription();
    if (!subscription) return null;

    const endpoint = subscription.endpoint;
    await subscription.unsubscribe();
    return endpoint;
  }

  /** El navegador exige la clave VAPID como `Uint8Array`, no como el base64url que da el backend. */
  private urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const rawData = atob(base64);
    const output = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; i++) {
      output[i] = rawData.charCodeAt(i);
    }
    return output;
  }
}
