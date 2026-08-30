/**
 * @file map-viewport.model.ts
 * @description Centro y zoom actuales del mapa, compartidos a nivel de aplicación
 *   por {@link MapViewportService}.
 */

/** Centro y nivel de zoom de un mapa en un momento dado. */
export interface MapViewport {
  lat: number;
  lng: number;
  zoom: number;
}
