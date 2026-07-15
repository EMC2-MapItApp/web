import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { REGISTER_DIALOG_CONFIG, withResponsiveDialogLayout } from '../constants/dialog.constants';
import { ResponsiveService } from '../responsive/responsive.service';

/**
 * Activado por la ruta `/register`: abre `RegisterDialogComponent` (si no está ya abierto)
 * y redirige de vuelta a `/` — el registro es un diálogo sobre el mapa, no una página propia, así
 * que la URL `/register` nunca llega a "quedarse" en el navegador tras abrir el diálogo.
 */
export const openRegisterDialogGuard: CanActivateFn = async () => {
  const dialog = inject(MatDialog);
  const router = inject(Router);
  const responsiveService = inject(ResponsiveService);

  // Import dinámico: el diálogo queda fuera del bundle inicial y solo se carga al visitar /register.
  const { RegisterDialogComponent } = await import('@features/auth/register-dialog/register-dialog');

  const alreadyOpen = dialog.openDialogs.some(
    d => d.componentInstance instanceof RegisterDialogComponent
  );

  if (!alreadyOpen) {
    const responsiveState = responsiveService.state();
    const compactViewport = responsiveState.isMobile || responsiveState.isTablet;
    dialog.open(RegisterDialogComponent, withResponsiveDialogLayout(REGISTER_DIALOG_CONFIG, compactViewport));
  }

  return router.createUrlTree(['/']);
};
