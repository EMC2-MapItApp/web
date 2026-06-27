/**
 * @file auth.guard.ts
 * @description Protege las rutas que requieren autenticación.
 *
 * Comprueba la existencia del JWT en localStorage.
 * Si no hay token redirige a '/' (login).
 *
 * La clave TOKEN_KEY se exporta para que auth.service.ts y login.ts
 * la usen al guardar/borrar el token, evitando strings duplicados.
 */
import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

export const TOKEN_KEY = 'token';

export const authGuard: CanActivateFn = () => {
  const router = inject(Router);
  if (localStorage.getItem(TOKEN_KEY)) {

    return true;
  }

  return router.createUrlTree(['/login']);
};
