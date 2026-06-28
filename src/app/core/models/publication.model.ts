/**
 * @file publication.model.ts
 * @description Modelo de publicación temporal de MapIt.
 *
 * Una `Publication` es contenido con fecha de inicio/fin visible en el mapa.
 *
 * Quién puede publicar qué:
 *   professional → type='promotion', anclada a su Place
 *   entity       → type='event',     anclada a su Place
 *   individual   → type='event',     coordenadas libres (sin Place)
 *
 * En BD: tabla `publications`, con columna `metadata` de tipo JSONB.
 */

/**
 * Tipo de publicación temporal.
 *  - `promotion`: oferta/descuento de un profesional sobre su sede.
 *  - `event`:     evento de una entidad (sobre su sede) o de un particular (libre).
 */
export type PublicationType = 'promotion' | 'event';

/**
 * Publicación temporal visible en el mapa.
 */
export interface Publication {
  /** Identificador único (PK en BD). */
  id: number;

  /** Id del usuario autor. FK → users.id */
  authorId: string;

  /** Tipo de publicación. */
  publicationType: PublicationType;

  /**
   * Id de la Place a la que está anclada.
   * - professional / entity : obligatorio (su sede).
   * - individual            : null (usa lat/lng propios).
   * FK → places.id
   */
  placeId: number | null;

  /**
   * Tipo de localización en la jerarquía de categorías.
   * - Si placeId != null: hereda el locationTypeId del Place.
   * - Si placeId == null: definido explícitamente por el individual.
   */
  locationTypeId: number;

  /** Título de la publicación. */
  title: string;

  /** Descripción extendida. */
  description?: string;

  /** Fecha y hora de inicio (ISO 8601). */
  startDate: string;

  /**
   * Fecha y hora de fin (ISO 8601).
   * null = sin fecha de caducidad (promotion indefinida).
   */
  endDate: string | null;

  /**
   * Latitud. Solo si placeId es null (individual).
   * Si placeId != null, se resuelve desde el Place.
   */
  lat: number | null;

  /** Longitud. Solo si placeId es null. */
  lng: number | null;

  /**
   * Nivel mínimo de usuario individual necesario para ver esta publicación.
   * 0 = visible para todos (incluido anónimos).
   * Permite reservar contenido premium a usuarios con nivel suficiente.
   */
  requiredLevel: number;

  /**
   * Campos específicos del tipo de publicación.
   * En BD: columna JSONB.
   * Schema definido en LocationFieldService con context='promotion' o 'event'.
   *
   * Para `promotion`:
   *   { discountCode, discountPercent, conditions, validUntil, maxUses }
   *
   * Para `event`:
   *   { slots, price, registrationUrl, isOnline }
   *
   * @example promotion
   * { discountCode: 'VERANO20', discountPercent: 20, conditions: 'Mín. 50€ en compra' }
   *
   * @example event (entity)
   * { slots: 20, price: 0, registrationUrl: 'https://museo.es/inscripcion' }
   *
   * @example event (individual)
   * { slots: 8, price: 0 }
   */
  metadata: Record<string, unknown>;

  /**
   * Estado de vigencia de la publicación.
   * `false` indica actividad finalizada/terminada.
   */
  active: boolean;

  /** Número de personas apuntadas actualmente. */
  occupiedSlots?: number;
}

export interface PublicationEnrollmentResponse {
  publicationId: number;
  userId: string;
  occupiedSlots: number;
  maxSlots: number | null;
  full: boolean;
}

/**
 * Payload para crear una publicación desde frontend.
 *
 * `id`, `authorId` y `active` son campos gestionados por backend.
 */
export type PublicationCreateRequest = Omit<Publication, 'id' | 'authorId' | 'active'>;
