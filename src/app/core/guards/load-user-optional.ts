// load-user-optional.guard.ts
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
