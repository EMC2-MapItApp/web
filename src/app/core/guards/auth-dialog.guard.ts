/**
 * @file auth-dialog.guard.ts
 * @description Protege rutas que requieren sesión (dashboard, profile, settings,
 * create-publication). Sin token o sin usuario cargado, en vez de redirigir abre
 * `AuthRequiredDialogComponent` sobre la ruta actual y bloquea la navegación (`return false`) —
 * el usuario nunca ve una página vacía ni un salto de URL, solo un diálogo pidiendo login/registro.
 */
import { inject } from '@angular/core';
import { CanActivateFn } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { CurrentUserService } from '../services/current-user.service';
import { TOKEN_KEY } from './auth.guard';
import {
  AUTH_REQUIRED_DIALOG_CONFIG,
  withResponsiveDialogLayout,
} from '../constants/dialog.constants';
import { ResponsiveService } from '../responsive/responsive.service';

export const authDialogGuard: CanActivateFn = async () => {
  const cu = inject(CurrentUserService);
  const dialog = inject(MatDialog);
  const responsiveService = inject(ResponsiveService);

  if (localStorage.getItem(TOKEN_KEY) && cu.user()) return true;

  // Import dinámico: el diálogo solo se carga cuando de verdad hay que mostrarlo.
  const { AuthRequiredDialogComponent } =
    await import('@shared/auth-required-dialog/auth-required-dialog');

  // Mobile y tablet usan fullscreen; desktop mantiene layout actual.
  dialog.open(
    AuthRequiredDialogComponent,
    withResponsiveDialogLayout(AUTH_REQUIRED_DIALOG_CONFIG, responsiveService.isCompact()),
  );
  return false;
};
