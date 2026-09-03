import { ActivatedRouteSnapshot, DetachedRouteHandle, RouteReuseStrategy } from '@angular/router';

/**
 * Estrategia de reutilización de rutas para MapIt.
 *
 * @remarks
 * Mantiene vivo el componente de Maps entre navegaciones para evitar
 * recargas billables de la API de Google Maps.
 * El resto de rutas (dashboard, settings, login) siguen el comportamiento
 * por defecto de Angular (destruir/recrear).
 */
export class MapItReuseStrategy implements RouteReuseStrategy {
  /** Almacén interno de handles de rutas reutilizadas. */
  private _handles = new Map<string, DetachedRouteHandle>();

  /** Rutas que se conservan en memoria al navegar fuera de ellas. */
  private readonly REUSE_ROUTES = new Set(['maps']);

  shouldDetach(route: ActivatedRouteSnapshot): boolean {
    return this.REUSE_ROUTES.has(route.routeConfig?.path ?? '');
  }

  store(route: ActivatedRouteSnapshot, handle: DetachedRouteHandle): void {
    const key = route.routeConfig?.path ?? '';
    if (this.REUSE_ROUTES.has(key)) this._handles.set(key, handle);
  }

  shouldAttach(route: ActivatedRouteSnapshot): boolean {
    const key = route.routeConfig?.path ?? '';
    return this._handles.has(key);
  }

  retrieve(route: ActivatedRouteSnapshot): DetachedRouteHandle | null {
    return this._handles.get(route.routeConfig?.path ?? '') ?? null;
  }

  shouldReuseRoute(future: ActivatedRouteSnapshot, curr: ActivatedRouteSnapshot): boolean {
    return future.routeConfig === curr.routeConfig;
  }
}
