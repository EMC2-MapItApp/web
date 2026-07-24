/**
 * @file notification-bell.ts
 * @description Campana de notificaciones del header: badge de no-leídas + panel desplegable con
 * el histórico (ver {@link NotificationService}). Mismo patrón de "cosas pendientes con acción"
 * que ya existía para las invitaciones de grupo, pero genérico para cualquier tipo de evento.
 */
import { Component, ElementRef, HostListener, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { DatePipe } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { NotificationService } from '@core/services/notification.service';
import { AppNotification } from '@core/models/notification.model';

@Component({
  selector: 'app-notification-bell',
  standalone: true,
  imports: [DatePipe, MatIconModule, MatButtonModule],
  templateUrl: './notification-bell.html',
  styleUrl: './notification-bell.scss',
})
export class NotificationBellComponent {

  private readonly router = inject(Router);
  private readonly elementRef = inject(ElementRef<HTMLElement>);

  readonly notificationService = inject(NotificationService);
  readonly open = signal(false);

  toggle(): void {
    this.open.update(v => !v);
  }

  select(notification: AppNotification): void {
    this.notificationService.markRead(notification.id);
    this.open.set(false);
    if (notification.link) {
      this.router.navigateByUrl(notification.link);
    }
  }

  markAllRead(event: MouseEvent): void {
    event.stopPropagation();
    this.notificationService.markAllRead();
  }

  @HostListener('document:click', ['$event'])
  handleOutsideClick(event: MouseEvent): void {
    if (!this.open()) return;
    if (!this.elementRef.nativeElement.contains(event.target as Node)) {
      this.open.set(false);
    }
  }
}
