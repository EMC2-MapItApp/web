/**
 * @file load-user.guard.ts
 * @description Resuelve el usuario autenticado antes de activar rutas protegidas.
 *
 * Si CurrentUserService ya tiene usuario cargado (navegación interna)
 * no vuelve a llamar a la API.
 *
 * Si la llamada falla (token expirado, error de red) limpia el token
 * y redirige al login.
 */
import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { catchError, map, of } from 'rxjs';
import { CurrentUserService } from '../services/current-user.service';
import { UserService } from '../services/user.service';
import { TOKEN_KEY } from './auth.guard';

export const loadUserGuard: CanActivateFn = () => {
  const cu      = inject(CurrentUserService);
  const userSvc = inject(UserService);
  const router  = inject(Router);

  // Usuario ya cargado → dejar pasar sin llamada extra
  if (cu.user() !== null) {
    return true;
  }

  return userSvc.loadMe().pipe(
    map(() => true),
    catchError(() => {
      // Token inválido o expirado → limpiar y volver al login
      localStorage.removeItem(TOKEN_KEY);
      cu.clear();
      return of(router.createUrlTree(['/']));
    })
  );
};
