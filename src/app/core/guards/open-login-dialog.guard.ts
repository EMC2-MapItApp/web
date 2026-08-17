/**
 * @file open-login-dialog.guard.ts
 * @description Intercepta la ruta `/login`, abre `LoginDialogComponent` sobre el mapa y redirige
 * a `/` para que el mapa quede visible detrás del diálogo.
 */
import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { LOGIN_DIALOG_CONFIG, withResponsiveDialogLayout } from '../constants/dialog.constants';
import { ResponsiveService } from '../responsive/responsive.service';

/**
 * Solo rutas internas relativas: rechaza esquema absoluto (`https://...`) y URL
 * protocol-relative (`//dominio-externo.com`, que el navegador trata como salida real de
 * la SPA) — evita que un `returnUrl` de la query string se use como open redirect tras el login.
 */
function isSafeReturnUrl(returnUrl: string | null): returnUrl is string {
  return (
    !!returnUrl &&
    returnUrl.startsWith('/') &&
    !returnUrl.startsWith('//') &&
    !returnUrl.includes('://')
  );
}

export const openLoginDialogGuard: CanActivateFn = async (route) => {
  const dialog = inject(MatDialog);
  const router = inject(Router);
  const responsiveService = inject(ResponsiveService);

  // Import dinámico: el diálogo queda fuera del bundle inicial y solo se carga al visitar /login.
  const { LoginDialogComponent } = await import('@features/auth/login-dialog/login-dialog');

  // Evitar múltiples instancias si el guard se llama varias veces
  const alreadyOpen = dialog.openDialogs.some(
    (d) => d.componentInstance instanceof LoginDialogComponent,
  );

  if (!alreadyOpen) {
    // returnUrl (p.ej. desde el enlace de invitación a un grupo): tras loguear,
    // LoginDialogComponent navega ahí en vez de dejar al mapa como destino por defecto.
    const rawReturnUrl = route.queryParamMap.get('returnUrl');
    const returnUrl = isSafeReturnUrl(rawReturnUrl) ? rawReturnUrl : null;
    dialog.open(LoginDialogComponent, {
      ...withResponsiveDialogLayout(LOGIN_DIALOG_CONFIG, responsiveService.isCompact()),
      data: { returnUrl },
    });
  }

  return router.createUrlTree(['/']);
};
