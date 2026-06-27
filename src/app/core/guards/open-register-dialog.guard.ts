import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { RegisterDialogComponent } from '../../register/register-dialog';
import { REGISTER_DIALOG_CONFIG } from '../constants/dialog.constants';

export const openRegisterDialogGuard: CanActivateFn = () => {
  const dialog = inject(MatDialog);
  const router = inject(Router);

  const alreadyOpen = dialog.openDialogs.some(
    d => d.componentInstance instanceof RegisterDialogComponent
  );

  if (!alreadyOpen) {
    dialog.open(RegisterDialogComponent, REGISTER_DIALOG_CONFIG);
  }

  return router.createUrlTree(['/']);
};
