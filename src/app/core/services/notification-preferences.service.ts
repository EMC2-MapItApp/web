/**
 * @file notification-preferences.service.ts
 * @description Preferencias de email por tipo de notificación, contra
 * `GET/PATCH /api/v1/notifications/preferences...`. Mismo patrón de estado que
 * {@link NotificationService} (signal recalculado con un `effect()` ligado a
 * {@link CurrentUserService}). Solo el canal email es configurable aquí — el in-app se recibe
 * siempre y el push nativo está desactivado globalmente (ver `NoopPushProvider`).
 */
import { Injectable, effect, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '@env/environment';
import { CurrentUserService } from './current-user.service';
import { NotificationPreference, NotificationType } from '../models/notification.model';

@Injectable({ providedIn: 'root' })
export class NotificationPreferencesService {

  private readonly http = inject(HttpClient);
  private readonly cu = inject(CurrentUserService);
  private readonly baseUrl = `${environment.apiNotificationsUrl}/preferences`;

  private readonly _preferences = signal<NotificationPreference[]>([]);
  readonly preferences = this._preferences.asReadonly();

  constructor() {
    effect(() => {
      if (this.cu.user()) {
        this.refresh();
      } else {
        this._preferences.set([]);
      }
    });
  }

  refresh(): void {
    this.http.get<NotificationPreference[]>(this.baseUrl).subscribe({
      next: list => this._preferences.set(list),
      // Fallo silencioso: si no cargan las preferencias, Ajustes simplemente no muestra la lista.
      error: () => this._preferences.set([]),
    });
  }

  /** Activa/desactiva el email de un tipo, con actualización optimista revertida si falla. */
  toggleEmail(type: NotificationType): void {
    const previous = this._preferences();
    const current = previous.find(p => p.type === type);
    if (!current) return;

    const emailEnabled = !current.emailEnabled;
    this._preferences.update(list => list.map(p => (p.type === type ? { ...p, emailEnabled } : p)));

    this.http.patch<void>(`${this.baseUrl}/${type}`, { emailEnabled }).subscribe({
      error: () => this._preferences.set(previous),
    });
  }
}
