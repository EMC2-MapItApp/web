import { inject } from '@angular/core';
import { CanActivateFn } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { CurrentUserService } from '../services/current-user.service';
import { AuthRequiredDialogComponent } from '../../shared/auth-required-dialog/auth-required-dialog';
import { TOKEN_KEY } from './auth.guard';
import { AUTH_REQUIRED_DIALOG_CONFIG, withResponsiveDialogLayout } from '../constants/dialog.constants';
import { ResponsiveService } from '../responsive/responsive.service';

/**
 * Protege rutas que requieren sesión (dashboard, profile, settings, create-publication). Sin
 * token o sin usuario cargado, en vez de redirigir abre {@link AuthRequiredDialogComponent} sobre
 * la ruta actual y bloquea la navegación (`return false`) — el usuario nunca ve una página vacía
 * ni un salto de URL, solo un diálogo pidiendo login/registro.
 */
export const authDialogGuard: CanActivateFn = () => {
  const cu = inject(CurrentUserService);
  const dialog = inject(MatDialog);
  const responsiveService = inject(ResponsiveService);

  if (localStorage.getItem(TOKEN_KEY) && cu.user()) return true;

  // Mobile y tablet usan fullscreen; desktop mantiene layout actual.
  const responsiveState = responsiveService.state();
  const compactViewport = responsiveState.isMobile || responsiveState.isTablet;
  dialog.open(AuthRequiredDialogComponent, withResponsiveDialogLayout(AUTH_REQUIRED_DIALOG_CONFIG, compactViewport));
  return false;
};
