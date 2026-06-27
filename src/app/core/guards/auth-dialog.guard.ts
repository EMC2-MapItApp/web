import { inject } from '@angular/core';
import { CanActivateFn } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { CurrentUserService } from '../services/current-user.service';
import { AuthRequiredDialogComponent } from '../../shared/auth-required-dialog/auth-required-dialog';
import { TOKEN_KEY } from './auth.guard';
import { AUTH_REQUIRED_DIALOG_CONFIG } from '../constants/dialog.constants';

export const authDialogGuard: CanActivateFn = () => {
  const cu = inject(CurrentUserService);
  const dialog = inject(MatDialog);

  if (localStorage.getItem(TOKEN_KEY) && cu.user()) return true;

  dialog.open(AuthRequiredDialogComponent, AUTH_REQUIRED_DIALOG_CONFIG);
  return false;
};
