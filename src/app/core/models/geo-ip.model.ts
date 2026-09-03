/**
 * @file geo-ip.model.ts
 * @description Modelo de respuesta de geolocalización por IP.
 *
 * Refleja el contrato del endpoint GET /api/v1/geo/me del backend.
 */

/**
 * Resultado normalizado de geolocalización por IP devuelto por el backend.
 */
export interface GeoIpCenter {
  /** Latitud en grados decimales. */
  lat: number;

  /** Longitud en grados decimales. */
  lng: number;

  /** Ciudad aproximada asociada a la IP. Puede ser nula. */
  city: string | null;

  /** Código ISO del país asociado a la IP. Puede ser nulo. */
  country: string | null;

  /** IP finalmente usada en la consulta (real o simulada). */
  resolvedIp: string;

  /** Origen del resultado: geoip | simulated | fallback. */
  source: 'geoip' | 'simulated' | 'fallback';
}
