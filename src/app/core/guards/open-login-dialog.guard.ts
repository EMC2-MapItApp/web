/**
 * Intercepta la ruta /login, abre LoginDialogComponent sobre el mapa
 * y redirige a '/' para que el mapa quede visible detrás del dialog.
 */
import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { LoginDialogComponent } from '../../login/login-dialog';
import { LOGIN_DIALOG_CONFIG } from '../constants/dialog.constants';

export const openLoginDialogGuard: CanActivateFn = () => {
  const dialog = inject(MatDialog);
  const router = inject(Router);

  // Evitar múltiples instancias si el guard se llama varias veces
  const alreadyOpen = dialog.openDialogs.some(
    d => d.componentInstance instanceof LoginDialogComponent
  );

  if (!alreadyOpen) {
    dialog.open(LoginDialogComponent, LOGIN_DIALOG_CONFIG);
  }

  return router.createUrlTree(['/']);
};
