/**
 * @file load-user-optional.ts
 * @description Guard de la ruta raíz (`HomeShellComponent`): resuelve el usuario actual sin bloquear
 * el acceso a invitados. A diferencia de {@link authDialogGuard}, esta ruta es pública (el mapa
 * es visible sin sesión) — el guard solo intenta poblar {@link CurrentUserService} de fondo
 * cuando hay token, y siempre deja pasar la navegación.
 */
import { inject } from '@angular/core';
import { CanActivateFn } from '@angular/router';
import { catchError, map, of } from 'rxjs';
import { CurrentUserService } from '../services/current-user.service';
import { UserService } from '../services/user.service';
import { TOKEN_KEY } from './auth.guard';

export const loadUserOptionalGuard: CanActivateFn = () => {
  const cu      = inject(CurrentUserService);
  const userSvc = inject(UserService);

  // Sin token → guest real, dejar pasar sin llamada
  if (!localStorage.getItem(TOKEN_KEY)) return true;

  // Usuario ya cargado → dejar pasar sin llamada extra
  if (cu.user() !== null) return true;

  // Hay token pero no usuario → cargar y dejar pasar siempre
  return userSvc.loadMe().pipe(
    map(() => true),
    catchError(() => {
      // Token expirado/inválido → limpiar pero dejar pasar como guest
      localStorage.removeItem(TOKEN_KEY);
      cu.clear();
      return of(true);
    })
  );
};
