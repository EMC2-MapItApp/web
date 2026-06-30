import { inject } from '@angular/core';
import { CanActivateFn } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { CurrentUserService } from '../services/current-user.service';
import { AuthRequiredDialogComponent } from '../../shared/auth-required-dialog/auth-required-dialog';
import { TOKEN_KEY } from './auth.guard';
import { AUTH_REQUIRED_DIALOG_CONFIG, withResponsiveDialogLayout } from '../constants/dialog.constants';
import { ResponsiveService } from '../responsive/responsive.service';

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
