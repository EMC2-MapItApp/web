/**
 * @file notification.service.ts
 * @description Centro de notificaciones in-app: histórico persistido + contador de no-leídas,
 * contra `GET/PATCH/POST /api/v1/notifications/...`. Mismo patrón de estado que
 * {@link GroupService} (signals recalculados con un `effect()` ligado a `CurrentUserService`).
 */
import { Injectable, effect, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '@env/environment';
import { CurrentUserService } from './current-user.service';
import { AppNotification } from '../models/notification.model';

@Injectable({ providedIn: 'root' })
export class NotificationService {

  private readonly http = inject(HttpClient);
  private readonly cu = inject(CurrentUserService);
  private readonly baseUrl = environment.apiNotificationsUrl;

  private readonly _notifications = signal<AppNotification[]>([]);
  readonly notifications = this._notifications.asReadonly();

  private readonly _unreadCount = signal(0);
  readonly unreadCount = this._unreadCount.asReadonly();

  constructor() {
    effect(() => {
      if (this.cu.user()) {
        this.refresh();
      } else {
        this._notifications.set([]);
        this._unreadCount.set(0);
      }
    });
  }

  /** Recarga el histórico y el contador de no-leídas del usuario actual. */
  refresh(): void {
    this.http.get<AppNotification[]>(this.baseUrl).subscribe({
      next: list => this._notifications.set(list),
      // Fallo silencioso: el centro de notificaciones es una mejora de UX, no debe romper la navegación.
      error: () => this._notifications.set([]),
    });
    this.http.get<{ count: number }>(`${this.baseUrl}/unread-count`).subscribe({
      next: res => this._unreadCount.set(res.count),
      error: () => this._unreadCount.set(0),
    });
  }

  markRead(id: string): void {
    const notification = this._notifications().find(n => n.id === id);
    if (!notification || notification.read) return;

    this.http.patch<void>(`${this.baseUrl}/${id}/read`, {}).subscribe(() => {
      this._notifications.update(list => list.map(n => (n.id === id ? { ...n, read: true } : n)));
      this._unreadCount.update(count => Math.max(0, count - 1));
    });
  }

  markAllRead(): void {
    this.http.post<void>(`${this.baseUrl}/read-all`, {}).subscribe(() => {
      this._notifications.update(list => list.map(n => ({ ...n, read: true })));
      this._unreadCount.set(0);
    });
  }
}
