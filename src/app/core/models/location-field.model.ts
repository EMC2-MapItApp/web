/**
 * @file location-field.model.ts
 * @description Schema dinámico de campos para el detalle de Place y Publication.
 *
 * Cada `LocationFieldSchema` define qué campos extra renderiza el componente
 * de detalle para una combinación concreta de `locationTypeId` + `FieldContext`.
 *
 * Los valores reales se leen de:
 *   - `Place.metadata`       cuando context = 'place'
 *   - `Publication.metadata` cuando context = 'promotion' | 'event'
 *
 * Para añadir campos a una categoría existente o nueva:
 *   1. Añade una entrada en el registry de `LocationFieldService`.
 *   2. Añade los valores en `metadata` del mock correspondiente.
 *   3. Ningún componente ni modelo base necesita cambios.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Contexto
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Contexto que determina qué schema de campos se aplica.
 *
 *  - `place`     : campos del detalle de una sede permanente (Place)
 *  - `promotion` : campos del detalle de una promoción (Publication type=promotion)
 *  - `event`     : campos del detalle de un evento     (Publication type=event)
 */
export type FieldContext = 'place' | 'promotion' | 'event';

// ─────────────────────────────────────────────────────────────────────────────
// Tipo de campo
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Tipo de renderizado de un campo en el panel de detalle.
 *
 *  - `text`     : texto libre
 *  - `url`      : enlace clicable (abre en nueva pestaña)
 *  - `phone`    : enlace tel:
 *  - `date`     : fecha formateada (sin hora)
 *  - `datetime` : fecha + hora formateada
 *  - `number`   : valor numérico con unidad opcional
 *  - `badge`    : chip de color (p.ej. nivel de dificultad)
 *  - `boolean`  : muestra "Sí" / "No"
 *  - `code`     : texto con estilo monospace (p.ej. código de descuento)
 */
export type FieldType =
  'text' | 'url' | 'phone' | 'date' | 'datetime' | 'number' | 'badge' | 'boolean' | 'code';

// ─────────────────────────────────────────────────────────────────────────────
// Definición de campo
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Define un campo individual dentro del schema de un tipo de localización.
 */
export interface LocationFieldDef {
  /**
   * Clave que mapea con `Place.metadata[key]` o `Publication.metadata[key]`.
   */
  key: string;

  /** Etiqueta visible al usuario en el panel de detalle. */
  label: string;

  /** Tipo de renderizado del valor. */
  type: FieldType;

  /**
   * Unidad opcional que se muestra junto al valor numérico.
   * @example 'km' | '€' | 'plazas' | '€/persona' | 'm'
   */
  unit?: string;

  /**
   * Si true, el campo se renderiza aunque su valor sea null o undefined.
   * Útil para campos que deben aparecer siempre con un valor por defecto.
   */
  showIfEmpty?: boolean;

  /**
   * Para type='badge': mapa de valor → color HEX de fondo.
   * Si el valor no está en el mapa, se usa el color de acento de la categoría.
   *
   * @example
   * { 'Fácil': '#10b981', 'Medio': '#f59e0b', 'Difícil': '#ef4444' }
   */
  badgeColors?: Record<string, string>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Schema
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Schema completo de campos para una combinación locationTypeId + FieldContext.
 * Registrado internamente en `LocationFieldService`.
 */
export interface LocationFieldSchema {
  /**
   * Id del tipo de localización al que aplica este schema.
   * @example 'ciclismo-profesional' | 'museos-visita'
   */
  locationTypeId: string;

  /**
   * Contexto de uso: place, promotion o event.
   * La clave de registro en el servicio es `locationTypeId::context`.
   */
  context: FieldContext;

  /** Campos a mostrar en el panel de detalle, en el orden definido. */
  fields: LocationFieldDef[];
}
