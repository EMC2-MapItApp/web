/**
 * @file auth.guard.ts
 * @description Clave de localStorage del JWT, compartida por auth.service.ts,
 * auth.interceptor.ts y el resto de guards de sesión (auth-dialog.guard.ts,
 * load-user-optional.ts) para evitar strings duplicados.
 */
export const TOKEN_KEY = 'token';
