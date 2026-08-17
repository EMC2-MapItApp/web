/**
 * @file dialog.constants.ts
 * @description Configuraciones de `MatDialogConfig` por diálogo de la app, más
 * {@link withResponsiveDialogLayout} para ajustar ancho/alto en mobile/tablet sin
 * duplicar reglas responsive en cada componente/guard que abre un diálogo.
 */
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

/** Configuración específica del diálogo "revisa tu correo" (Fase 1 auth, tras registro). */
export const CHECK_EMAIL_DIALOG_CONFIG: MatDialogConfig = {
  ...DIALOG_BASE,
  panelClass: 'check-email-panel',
  width: '420px',
  disableClose: true,
};

/** Configuración específica del diálogo "olvidé mi contraseña" (Fase 1 auth). */
export const FORGOT_PASSWORD_DIALOG_CONFIG: MatDialogConfig = {
  ...DIALOG_BASE,
  panelClass: 'forgot-password-panel',
  width: '420px',
};

/** Configuración específica del diálogo "avisar al organizador" (Grupos). */
export const NOTIFY_ORGANIZER_DIALOG_CONFIG: MatDialogConfig = {
  ...DIALOG_BASE,
  panelClass: 'notify-organizer-panel',
  width: '420px',
};

/** Configuración específica del diálogo "contacta con todos" (Grupos). */
export const CONTACT_MEMBERS_DIALOG_CONFIG: MatDialogConfig = {
  ...DIALOG_BASE,
  panelClass: 'contact-members-panel',
  width: '480px',
  maxHeight: '90vh',
};

/** Configuración del diálogo de confirmación genérico y reutilizable. */
export const CONFIRM_DIALOG_CONFIG: MatDialogConfig = {
  ...DIALOG_BASE,
  panelClass: 'confirm-dialog-panel',
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

/**
 * Ajusta el ancho/alto máximo en mobile/tablet sin alterar desktop.
 *
 * El diálogo ocupa solo lo que su contenido necesita (con scroll interno si
 * no cabe), nunca la pantalla completa — se usa como capa común para que
 * todos los diálogos mantengan coherencia responsive sin duplicar reglas en
 * cada componente/guard.
 */
export function withResponsiveDialogLayout(
  baseConfig: MatDialogConfig,
  compactViewport: boolean,
): MatDialogConfig {
  if (!compactViewport) return baseConfig;

  return {
    ...baseConfig,
    width: 'auto',
    maxWidth: '94vw',
    maxHeight: '90dvh',
  };
}
