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

  /** Tipo de publicación temporal (evento o promoción). */
  publicationType?: 'event' | 'promotion';

  /** Fecha/hora de inicio de la publicación (ISO). */
  startDate?: string;

  /** Fecha/hora de fin de la publicación (ISO), null si indefinida. */
  endDate?: string | null;

  /** Nivel mínimo requerido para visualizar/interactuar. */
  requiredLevel?: number;

  /** Estado de activación persistido en backend. */
  active?: boolean;

  /** Número de personas apuntadas actualmente. Ausente si el backend lo enmascara (ver `Publication.occupiedSlots`). */
  occupiedSlots?: number;

  /** Visibilidad de la publicación (solo Publications). 'PUBLIC' si no aplica (p. ej. Places). */
  visibility?: 'PUBLIC' | 'PRIVATE_GROUP';

  /** Id del grupo al que está restringida. Solo si `visibility === 'PRIVATE_GROUP'`. */
  groupId?: string | null;

  /** Nombre del grupo. Solo presente en publicaciones `PRIVATE_GROUP`. */
  groupName?: string;

  /** Nº de miembros del grupo. Solo presente en publicaciones `PRIVATE_GROUP`. */
  groupMemberCount?: number;

  /** true si el usuario actual es miembro del grupo. Solo presente en publicaciones `PRIVATE_GROUP`. */
  isGroupMember?: boolean;

  /** true si el usuario actual tiene una solicitud de acceso pendiente para este grupo. */
  accessRequestPending?: boolean;
}
