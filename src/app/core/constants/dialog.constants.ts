import { MatDialogConfig } from '@angular/material/dialog';

/** Configuración base para todos los dialogs de la app. */
const DIALOG_BASE: MatDialogConfig = {
  backdropClass: 'blurred-backdrop',
  disableClose: false,
};

/** Configuración específica del diálogo de bienvenida. */
export const WELCOME_DIALOG_CONFIG: MatDialogConfig = {
  ...DIALOG_BASE,
  panelClass: 'welcome-panel',
  width: '380px',
};

/** Configuración específica del diálogo de login. */
export const LOGIN_DIALOG_CONFIG: MatDialogConfig = {
  ...DIALOG_BASE,
  panelClass: 'login-panel',
  width: '420px',
};

/** Configuración específica del diálogo de registro. */
export const REGISTER_DIALOG_CONFIG: MatDialogConfig = {
  ...DIALOG_BASE,
  panelClass: 'register-panel',
  width: '520px',
  maxHeight: '90vh',
};

/** Configuración específica del diálogo de autenticación requerida. */
export const AUTH_REQUIRED_DIALOG_CONFIG: MatDialogConfig = {
  ...DIALOG_BASE,
  panelClass: 'auth-required-panel',
  width: '420px',
};

/** Configuración base para todos los dialogs (deprecated, usar las específicas). */
export const DIALOG_CONFIG: MatDialogConfig = {
  ...DIALOG_BASE,
  panelClass: 'welcome-panel',
  width: '420px',
};

/** Variante ancha (deprecated, usar REGISTER_DIALOG_CONFIG). */
export const DIALOG_CONFIG_WIDE: MatDialogConfig = {
  ...DIALOG_BASE,
  panelClass: 'register-panel',
  width: '520px',
  maxHeight: '90vh',
};
