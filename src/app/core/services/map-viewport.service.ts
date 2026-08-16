/**
 * @file map-viewport.service.ts
 * @description Fuente única de verdad del centro/zoom del mapa a nivel de aplicación.
 *
 * El mapa principal ({@link MapsPageComponent}) y el mapa de nueva publicación
 * ({@link CreatePublicationPageComponent}) son dos instancias independientes de
 * `google.maps.Map`, pero deben mostrar siempre la misma ubicación: si el usuario
 * mueve uno, el otro debe abrir en esa misma posición la próxima vez, en vez de
 * volver a resolverla por IP cada vez. Este servicio guarda ese estado compartido
 * mientras dura la sesión de la app (no sobrevive a un F5, igual que el resto de
 * estado en memoria de `core/`).
 */
import { Injectable, inject, signal } from '@angular/core';
import { Observable, of } from 'rxjs';
import { map, tap } from 'rxjs/operators';
import { GeoIpService } from './geo-ip.service';
import { MapViewport } from '../models/map-viewport.model';

/** Zoom por defecto al resolver el centro inicial por IP. */
const DEFAULT_ZOOM = 12;

@Injectable({ providedIn: 'root' })
export class MapViewportService {
  private readonly geoIpService = inject(GeoIpService);

  /** Último viewport conocido de la app, o `null` si ningún mapa lo ha resuelto todavía. */
  private readonly viewport = signal<MapViewport | null>(null);

  /**
   * Resuelve el centro/zoom con el que debe abrirse un mapa.
   *
   * @remarks
   * Si ya hay un viewport guardado (otro mapa lo dejó al navegar o al moverse), lo
   * reutiliza directamente. Si es el primero de la sesión, lo resuelve por IP vía
   * {@link GeoIpService} y lo guarda como estado inicial de la app.
   */
  resolveInitialViewport(): Observable<MapViewport> {
    const existing = this.viewport();
    if (existing) return of(existing);

    return this.geoIpService.resolveCenter().pipe(
      map((center) => ({ lat: center.lat, lng: center.lng, zoom: DEFAULT_ZOOM })),
      tap((viewport) => this.viewport.set(viewport)),
    );
  }

  /**
   * Actualiza el viewport compartido de la app.
   *
   * @remarks
   * Cada mapa debe llamarlo cuando su centro/zoom cambia (pan, zoom, "usar mi
   * ubicación"...) para que el resto de mapas de la app reabran en la misma posición.
   */
  setViewport(center: { lat: number; lng: number }, zoom: number): void {
    this.viewport.set({ lat: center.lat, lng: center.lng, zoom });
  }
}
