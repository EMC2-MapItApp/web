/**
 * @file unauthorized.interceptor.ts
 * @description Intercepta los 401 de "sesión requerida" y abre el diálogo "Acceso restringido"
 * ({@link AuthRequiredDialogComponent}), como red de seguridad para llamadas que no comprueban
 * la sesión antes de disparase (p. ej. cargar los apuntados de una publicación al abrir su
 * detalle desde el mapa sin estar logado).
 *
 * Distingue por `code`, no por status ni por endpoint: el backend reserva
 * `error.code === 'UNAUTHORIZED'` en exclusiva para "no hay sesión válida" (ver
 * `GlobalExceptionHandler`/`SecurityConfig` en el backend); cualquier error de dominio que
 * reutilice el status 401 (credenciales incorrectas en login, contraseña actual errónea al
 * cambiarla) debe usar su propio `code` y así queda excluido automáticamente, sin necesidad de
 * mantener una lista de endpoints a mano.
 *
 * Las peticiones marcadas con {@link SKIP_UNAUTHORIZED_DIALOG} quedan excluidas aparte: son casos
 * donde el 401 sí es "sesión requerida" mismo, pero la pantalla ya lo gestiona con su propia UI en
 * vez de este diálogo (la página de invitación a grupo, que pide login inline; los guards que
 * cargan el usuario en silencio al arrancar con un token caducado).
 */
import { HttpContextToken, HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { catchError, throwError } from 'rxjs';
import { AuthRequiredDialogComponent } from '@shared/auth-required-dialog/auth-required-dialog';
import { AUTH_REQUIRED_DIALOG_CONFIG, withResponsiveDialogLayout } from '@core/constants/dialog.constants';
import { ResponsiveService } from '@core/responsive/responsive.service';

/** Contexto para excluir una petición del diálogo global de "Acceso restringido" en 401. */
export const SKIP_UNAUTHORIZED_DIALOG = new HttpContextToken<boolean>(() => false);

export const unauthorizedInterceptor: HttpInterceptorFn = (req, next) => {
  const dialog = inject(MatDialog);
  const responsiveService = inject(ResponsiveService);

  return next(req).pipe(
    catchError((err: HttpErrorResponse) => {
      const alreadyOpen = dialog.openDialogs.some(ref => ref.componentInstance instanceof AuthRequiredDialogComponent);
      const isAuthRequired = err.status === 401 && err.error?.error?.code === 'UNAUTHORIZED';

      if (isAuthRequired && !req.context.get(SKIP_UNAUTHORIZED_DIALOG) && !alreadyOpen) {
        const responsiveState = responsiveService.state();
        const compactViewport = responsiveState.isMobile || responsiveState.isTablet;
        dialog.open(
          AuthRequiredDialogComponent,
          withResponsiveDialogLayout(AUTH_REQUIRED_DIALOG_CONFIG, compactViewport),
        );
      }

      return throwError(() => err);
    }),
  );
};
