/**
 * @file push-notification.service.ts
 * @description Orquesta el {@link PushProvider} inyectado (hoy `WebPushProvider`) con el
 * backend: pedir la clave pública VAPID, suscribir/desuscribir el dispositivo, y mantener el
 * registro/baja sincronizados con `/api/v1/notifications/push/subscriptions`.
 *
 * @remarks
 * No se auto-activa al iniciar sesión — requiere una acción explícita del usuario (banner de
 * bienvenida o el toggle de Ajustes), porque pedir permiso de notificaciones sin contexto reduce
 * mucho la tasa de aceptación.
 */
import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '@env/environment';
import { PUSH_PROVIDER, PushPermissionState } from '../notifications/push-provider';

@Injectable({ providedIn: 'root' })
export class PushNotificationService {

  private readonly http = inject(HttpClient);
  private readonly provider = inject(PUSH_PROVIDER);
  private readonly baseUrl = environment.apiNotificationsUrl;

  private readonly _permissionState = signal<PushPermissionState>(this.provider.permissionState());
  readonly permissionState = this._permissionState.asReadonly();

  /** Refleja si este dispositivo tiene ya una suscripción activa (se recalcula tras enable/disable). */
  private readonly _enabled = signal(false);
  readonly enabled = this._enabled.asReadonly();

  get isSupported(): boolean {
    return this.provider.isSupported();
  }

  constructor() {
    if (this.provider.isSupported()) {
      this.provider.hasActiveSubscription().then(active => this._enabled.set(active));
    }
  }

  /** Pide permiso, suscribe este dispositivo y registra la suscripción en el backend. */
  async enable(): Promise<boolean> {
    if (!this.provider.isSupported()) {
      this._permissionState.set('unsupported');
      return false;
    }

    const { publicKey } = await firstValueFrom(
      this.http.get<{ publicKey: string }>(`${this.baseUrl}/push/public-key`)
    );
    // Gateado por environment.production, igual que WebPushProvider.subscribe(): es solo
    // depuración de flujo, no un error.
    if (!environment.production) {
      console.log('[push] clave pública VAPID recibida:', publicKey ? '(configurada)' : '(VACÍA)');
    }

    // Backend sin claves VAPID configuradas (dev sin exportar MAPIT_VAPID_*): no hay nada a lo
    // que suscribirse todavía, aunque el navegador sí soporte push.
    if (!publicKey) return false;

    const subscription = await this.provider.subscribe(publicKey);
    this._permissionState.set(this.provider.permissionState());
    if (!subscription) {
      console.warn('[push] provider.subscribe() devolvió null — no se registra en el backend');
      return false;
    }

    try {
      await firstValueFrom(this.http.post<void>(`${this.baseUrl}/push/subscriptions`, subscription));
      if (!environment.production) console.log('[push] suscripción registrada en el backend OK');
    } catch (err) {
      console.error('[push] fallo al registrar la suscripción en el backend', err);
      throw err;
    }
    this._enabled.set(true);
    return true;
  }

  /** Da de baja la suscripción de este dispositivo, local y en el backend. */
  async disable(): Promise<void> {
    const endpoint = await this.provider.unsubscribe();
    this._permissionState.set(this.provider.permissionState());
    this._enabled.set(false);

    if (endpoint) {
      await firstValueFrom(this.http.delete<void>(`${this.baseUrl}/push/subscriptions`, { body: { endpoint } }));
    }
  }
}
