/**
 * @file map-settings.model.ts
 * @description Modelos de datos para la configuración del mapa (Ajustes → Mapa).
 * La estructura persiste en `localStorage` a través de {@link MapSettingsService}
 * y se consume en {@link MapsPageComponent} para aplicar estilos a Google Maps.
 */

// ─────────────────────────────────────────────────────────────────────────────
// POI individual
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Configuración de visibilidad de un tipo de POI (Point of Interest) nativo
 * de Google Maps.
 * @remarks El campo `id` corresponde directamente al `featureType` de la API de estilos
 * de Google Maps. Los valores válidos son, entre otros:
 * - `'poi.business'`       – negocios y comercios
 * - `'poi.park'`           – parques y zonas verdes
 * - `'poi.medical'`        – hospitales y farmacias
 * - `'poi.school'`         – centros educativos
 * - `'poi.attraction'`     – atracciones turísticas
 * - `'poi.government'`     – edificios gubernamentales
 * - `'poi.place_of_worship'` – lugares de culto
 * - `'poi.sports_complex'` – instalaciones deportivas
 * - `'transit'`            – transporte público (caso especial, no es un `poi.*`)
 * @example
 * ```typescript
 * const parque: PoiConfig = {
 *   id: 'poi.park',
 *   label: 'Parques',
 *   icon: 'park',
 *   description: 'Parques, jardines y zonas verdes',
 *   visible: true,
 * };
 * ```
 */

export interface PoiConfig {
  id: string;
  label: string;
  icon: string;
  description: string;
  visible: boolean;
}

export interface MapSettings {
  poi: PoiConfig[];
}
