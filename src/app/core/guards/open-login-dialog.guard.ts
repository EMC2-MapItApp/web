/**
 * Intercepta la ruta /login, abre LoginDialogComponent sobre el mapa
 * y redirige a '/' para que el mapa quede visible detrás del dialog.
 */
import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { LOGIN_DIALOG_CONFIG, withResponsiveDialogLayout } from '../constants/dialog.constants';
import { ResponsiveService } from '../responsive/responsive.service';

export const openLoginDialogGuard: CanActivateFn = async (route) => {
  const dialog = inject(MatDialog);
  const router = inject(Router);
  const responsiveService = inject(ResponsiveService);

  // Import dinámico: el diálogo queda fuera del bundle inicial y solo se carga al visitar /login.
  const { LoginDialogComponent } = await import('@features/auth/login-dialog/login-dialog');

  // Evitar múltiples instancias si el guard se llama varias veces
  const alreadyOpen = dialog.openDialogs.some(
    d => d.componentInstance instanceof LoginDialogComponent
  );

  if (!alreadyOpen) {
    const responsiveState = responsiveService.state();
    const compactViewport = responsiveState.isMobile || responsiveState.isTablet;
    // returnUrl (p.ej. desde el enlace de invitación a un grupo): tras loguear,
    // LoginDialogComponent navega ahí en vez de dejar al mapa como destino por defecto.
    const returnUrl = route.queryParamMap.get('returnUrl');
    dialog.open(LoginDialogComponent, {
      ...withResponsiveDialogLayout(LOGIN_DIALOG_CONFIG, compactViewport),
      data: { returnUrl },
    });
  }

  return router.createUrlTree(['/']);
};
