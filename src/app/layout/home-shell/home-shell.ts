import { Component, inject, signal } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatListModule } from '@angular/material/list';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { CurrentUserService } from '@core/services/current-user.service';
import { GroupService } from '@core/services/group.service';
import { SlicePipe } from '@angular/common';
import { WelcomeDialogComponent } from '@shared/welcome-dialog/welcome-dialog';
import { MatDialog } from '@angular/material/dialog';
import { WELCOME_DIALOG_CONFIG, withResponsiveDialogLayout } from '@core/constants/dialog.constants';
import { ResponsiveService } from '@core/responsive/responsive.service';
import { PushNotificationService } from '@core/services/push-notification.service';
import { NotificationBellComponent } from './notification-bell/notification-bell';

@Component({
  selector: 'app-home-shell',
  standalone: true,
  imports: [
    RouterOutlet,
    RouterLink,
    RouterLinkActive,
    MatSidenavModule,
    MatToolbarModule,
    MatListModule,
    MatIconModule,
    MatButtonModule,
    SlicePipe,
    NotificationBellComponent
  ],
  templateUrl: './home-shell.html',
  styleUrls: ['./home-shell.scss']
})
export class HomeShellComponent {
  private router = inject(Router);
  private dialog = inject(MatDialog);
  private responsiveService = inject(ResponsiveService);

  readonly currentUser = inject(CurrentUserService);
  private readonly groupService = inject(GroupService);
  private readonly pushNotificationService = inject(PushNotificationService);

  /** Invitaciones de grupo pendientes, para el badge del ítem "Grupos" del menú. */
  readonly pendingGroupInvitations = this.groupService.pendingInvitationsCount;

  readonly collapsed = signal(true);

  ngOnInit(): void {
    const alreadyShown = sessionStorage.getItem('welcome-dialog-shown');
    if (!this.currentUser.user() && !alreadyShown) {
      sessionStorage.setItem('welcome-dialog-shown', '1');
      const responsiveState = this.responsiveService.state();
      const compactViewport = responsiveState.isMobile || responsiveState.isTablet;
      this.dialog.open(WelcomeDialogComponent, withResponsiveDialogLayout(WELCOME_DIALOG_CONFIG, compactViewport));
    }
  }

  toggleSidenav(): void {
    this.collapsed.update((v) => !v);
  }

  /** Cierra el menú al pulsar cualquier opción del propio menú lateral. */
  handleMenuActionClick(event: MouseEvent): void {
    const target = event.target as HTMLElement | null;
    if (!target) return;

    if (target.closest('a, .menu-item')) {
      this.closeSidenav();
    }
  }

  /** Cierra el menú lateral. */
  closeSidenav(): void {
    this.collapsed.set(true);
  }

  /**
   * Cierra el menú solo al pulsar fuera y evita cerrar si el click
   * proviene de un control interactivo.
   */
  handleOutsideMenuClick(event: MouseEvent): void {
    if (this.collapsed()) return;

    const target = event.target as HTMLElement | null;
    if (!target) return;

    if (target.closest('.app-sidenav')) return;
    if (target.closest('button, a, input, select, textarea, [role="button"], [role="menuitem"]')) return;

    this.closeSidenav();
  }

  /**
   * Da de baja la suscripción push de este dispositivo ANTES de borrar el token: si se borrara
   * antes, la baja en el backend (`DELETE /push/subscriptions`, autenticada) fallaría en
   * silencio con 401. Necesario para no dejar la suscripción "viva" en un dispositivo
   * compartido, donde el siguiente usuario que la active se la robaría sin saberlo.
   */
  async logout(): Promise<void> {
    try {
      await this.pushNotificationService.disable();
    } catch {
      // Best-effort: un fallo al dar de baja el push no debe impedir cerrar sesión.
    }

    localStorage.removeItem('token');
    this.currentUser.clear();
    this.router.navigate(['/']);
  }
}

