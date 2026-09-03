/**
 * @file notification-bell.ts
 * @description Campana de notificaciones del header: badge de no-leídas + panel desplegable con
 * el histórico (ver {@link NotificationService}). Mismo patrón de "cosas pendientes con acción"
 * que ya existía para las invitaciones de grupo, pero genérico para cualquier tipo de evento.
 */
import { Component, ElementRef, HostListener, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { DatePipe } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatSnackBar } from '@angular/material/snack-bar';
import { NotificationService } from '@core/services/notification.service';
import { AppNotification } from '@core/models/notification.model';

/** Nº de notificaciones que se muestran en el desplegable antes de ofrecer "Ver todas". */
const PANEL_LIMIT = 8;

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
  private readonly snackBar = inject(MatSnackBar);

  readonly notificationService = inject(NotificationService);
  readonly open = signal(false);

  readonly visibleNotifications = computed(() =>
    this.notificationService.notifications().slice(0, PANEL_LIMIT),
  );
  readonly hasMore = computed(() => this.notificationService.notifications().length > PANEL_LIMIT);

  toggle(): void {
    this.open.update((v) => !v);
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

  deleteAll(event: MouseEvent): void {
    event.stopPropagation();
    this.notificationService.deleteAll();
  }

  toggleRead(event: MouseEvent, notification: AppNotification): void {
    event.stopPropagation();
    if (notification.read) {
      this.notificationService.markUnread(notification.id);
    } else {
      this.notificationService.markRead(notification.id);
    }
  }

  delete(event: MouseEvent, notification: AppNotification): void {
    event.stopPropagation();
    this.notificationService.delete(notification.id);
  }

  // TODO: navegar a un futuro componente de listado/gestión completo de notificaciones en lugar
  // de mostrar el snackbar.
  viewAll(event: MouseEvent): void {
    event.stopPropagation();
    this.snackBar.open('Próximamente...', 'Cerrar', {
      duration: 3000,
      horizontalPosition: 'center',
      verticalPosition: 'top',
    });
  }

  /** Sin más notificaciones que ver: enlaza directamente a Ajustes con el acordeón de
   *  Notificaciones ya abierto, en vez de un "ver todas" que no tendría nada nuevo que mostrar. */
  goToNotificationSettings(event: MouseEvent): void {
    event.stopPropagation();
    this.open.set(false);
    this.router.navigate(['/settings'], { queryParams: { section: 'notifications' } });
  }

  @HostListener('document:click', ['$event'])
  handleOutsideClick(event: MouseEvent): void {
    if (!this.open()) return;
    if (!this.elementRef.nativeElement.contains(event.target as Node)) {
      this.open.set(false);
    }
  }
}
