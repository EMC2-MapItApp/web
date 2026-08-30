/**
 * @file place.model.ts
 * @description Modelo de sede permanente de MapIt.
 *
 * Un `Place` representa la ubicación física fija de un profesional o entidad.
 * Cada usuario de tipo `professional` o `entity` puede tener máximo 1 Place.
 * Los usuarios `individual` no tienen Place.
 *
 * Jerarquía de categorías:
 *   MainCategory → SubCategory → LocationType → Place
 *
 * En BD: tabla `places`, con columna `metadata` de tipo JSONB.
 */

/**
 * Sede permanente registrada por un profesional o entidad.
 */
export interface Place {
  /** Identificador único — ObjectId de Mongo (string), no un número. */
  id: string;

  /** Id del usuario propietario (professional o entity). FK → users.id */
  ownerId: string;

  /** Nombre del lugar (tienda, museo, asociación, ayuntamiento…). */
  name: string;

  /** Descripción general del lugar. */
  description?: string;

  /**
   * Tipo de localización en la jerarquía de categorías.
   * FK → location_types.id en BD.
   * @example 'ciclismo-profesional' | 'museos-visita'
   */
  locationTypeId: string;

  /** Latitud en grados decimales. */
  lat: number;

  /** Longitud en grados decimales. */
  lng: number;

  /**
   * Dirección postal legible.
   * Campo universal para todos los Place.
   */
  address?: string;

  /**
   * Campos específicos del tipo de lugar.
   * En BD: columna JSONB.
   * Schema definido en LocationFieldService con context='place'.
   *
   * Campos comunes para professional:
   *   phone, web, schedule
   *
   * Campos comunes para entity:
   *   phone, web, schedule, admissionFee
   *
   * @example professional
   * { phone: '910111222', web: 'https://bicicletaslopez.es', schedule: 'L-V 9-20h' }
   *
   * @example entity
   * { phone: '917741000', web: 'https://museodelprado.es', schedule: 'L-S 10-20h', admissionFee: 15 }
   */
  metadata: Record<string, unknown>;
}
