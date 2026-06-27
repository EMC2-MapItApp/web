/**
 * @file location.model.ts
 * @description Modelos de localización geográfica de MapIt.
 *
 * Una localización puede ser de dos tipos:
 *   - {@link Place}       : sede permanente de un profesional o entidad.
 *   - {@link Publication} : contenido temporal (evento o promoción).
 *
 * Consultar:
 *   - place.model.ts       para sedes permanentes
 *   - publication.model.ts para eventos y promociones
 */

/**
 * Clasificación legacy de localización.
 * Sustituida por la jerarquía MainCategory → SubCategory → LocationType.
 */
export type LocationCategory = 'landmark' | 'leisure' | 'sport' | 'transport' | 'commercial';

/**
 * Representa una localización geográfica registrada en MapIt.
 * Sustituida por {@link Place} (sedes) y {@link Publication} (eventos/promociones).
 */
export interface MapLocation {
  /** Identificador único de la localización. */
  id: number;

  /** Nombre descriptivo del punto de interés. */
  name: string;

  /** Descripción opcional del lugar o evento. */
  description?: string;

  /**
   * Identificador del `LocationType` al que pertenece esta localización.
   * @example 'ciclismo-quedadas' | 'museos-visita'
   */
  locationTypeId: number;

  /** Latitud en grados decimales. */
  lat: number;

  /** Longitud en grados decimales. */
  lng: number;

  /**
   * Campos dinámicos específicos de la categoría.
   * En BD: columna JSONB.
   */
  metadata?: Record<string, unknown>;
}
