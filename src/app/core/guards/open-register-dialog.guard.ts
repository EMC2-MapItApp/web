import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { RegisterDialogComponent } from '../../register/register-dialog';
import { REGISTER_DIALOG_CONFIG, withResponsiveDialogLayout } from '../constants/dialog.constants';
import { ResponsiveService } from '../responsive/responsive.service';

export const openRegisterDialogGuard: CanActivateFn = () => {
  const dialog = inject(MatDialog);
  const router = inject(Router);
  const responsiveService = inject(ResponsiveService);

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
