/**
 * @file app.routes.spec.ts
 * @description Verifica la configuración de rutas tras la reorganización por features:
 * cada ruta lazy debe resolver su `loadComponent` a una clase real (detecta paths de
 * `import()` rotos que el type-checker no siempre ve) y los guards deben seguir declarados.
 */
import { Route } from '@angular/router';
import { routes } from './app.routes';
import { openLoginDialogGuard } from '@core/guards/open-login-dialog.guard';
import { openRegisterDialogGuard } from '@core/guards/open-register-dialog.guard';
import { authDialogGuard } from '@core/guards/auth-dialog.guard';
import { loadUserOptionalGuard } from '@core/guards/load-user-optional';

/** Aplana el árbol de rutas (padres + hijas) en una lista. */
function flatten(rs: Route[]): Route[] {
  return rs.flatMap(r => [r, ...(r.children ? flatten(r.children) : [])]);
}

describe('app.routes', () => {
  const all = flatten(routes);
  const lazy = all.filter(r => r.loadComponent);

  it('declara las 10 páginas lazy esperadas', () => {
    const paths = lazy.map(r => r.path).sort();
    expect(paths).toEqual([
      '', // maps (hija por defecto del shell)
      'about',
      'changelog',
      'create-publication',
      'dashboard',
      'profile',
      'reset-password',
      'settings',
      'stack',
      'verify-email',
    ]);
  });

  it('cada loadComponent resuelve a una clase de componente', async () => {
    for (const route of lazy) {
      const cmp = await route.loadComponent!();
      // Si el path del import() está roto, la promesa rechaza; si el nombre exportado
      // no existe, `cmp` es undefined — ambos casos hacen fallar esta aserción.
      expect(typeof cmp, `ruta '${route.path}'`).toBe('function');
    }
  });

  it('login y register abren diálogo vía guard sobre el shell', () => {
    const login = routes.find(r => r.path === 'login')!;
    const register = routes.find(r => r.path === 'register')!;
    expect(login.canActivate).toContain(openLoginDialogGuard);
    expect(register.canActivate).toContain(openRegisterDialogGuard);
    // Ambas rutas renderizan el shell (el diálogo se abre encima).
    expect(login.component).toBe(routes.find(r => r.path === '')!.component);
  });

  it('las rutas privadas llevan authDialogGuard y las informativas no', () => {
    const shell = routes.find(r => r.path === '')!;
    expect(shell.canActivate).toContain(loadUserOptionalGuard);

    const guardOf = (path: string) =>
      shell.children!.find(r => r.path === path)?.canActivate ?? [];

    for (const priv of ['dashboard', 'profile', 'settings', 'create-publication']) {
      expect(guardOf(priv), `ruta privada '${priv}'`).toContain(authDialogGuard);
    }
    for (const open of ['', 'about', 'changelog', 'stack']) {
      expect(guardOf(open), `ruta pública '${open}'`).not.toContain(authDialogGuard);
    }
  });
});
