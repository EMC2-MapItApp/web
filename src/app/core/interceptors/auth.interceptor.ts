/**
 * @file auth.interceptor.ts
 * @description Añade el token JWT en el header Authorization de cada petición HTTP.
 *
 * Si no hay token en localStorage la petición sale sin header (rutas públicas).
 */
import { HttpInterceptorFn } from '@angular/common/http';
import { TOKEN_KEY } from '../guards/auth.guard';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const token = localStorage.getItem(TOKEN_KEY);
  if (!token) return next(req);

  return next(
    req.clone({
      setHeaders: { Authorization: `Bearer ${token}` },
    }),
  );
};
