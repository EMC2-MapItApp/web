/**
 * @file capability.model.ts
 * @description Modelos del sistema de capacidades y gamificación de MapIt.
 *
 * Las capacidades controlan qué puede hacer cada usuario individual.
 * Se desbloquean de dos formas:
 *   1. Orgánica : al alcanzar un nivel concreto (vía XP de hitos)
 *   2. Micropago: compra directa independiente del nivel
 *
 * Toda la configuración (qué desbloquea qué, precios, XP de hitos)
 * vive en BD para poder modificarse sin deploy.
 *
 * @remarks
 * En el frontend estos modelos se usan como contratos de lectura.
 * La evaluación de si un usuario tiene una capacidad concreta
 * se delega a `UserCapabilityService`.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Capacidad
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Ids de capacidades conocidas.
 * Extender esta lista al añadir nuevas capacidades al sistema.
 *
 * Se usa como string literal type para autocompletar y evitar typos.
 */
export type CapabilityId =
  | 'max_publications_2'       // hasta 2 publicaciones activas simultáneas (nivel 0 base)
  | 'max_publications_5'       // hasta 5 publicaciones activas simultáneas
  | 'max_publications_10'      // hasta 10 publicaciones activas simultáneas
  | 'weekly_limit_3'           // hasta 3 publicaciones nuevas por semana (nivel 0 base)
  | 'weekly_limit_7'           // hasta 7 publicaciones nuevas por semana
  | 'weekly_limit_unlimited'   // sin límite semanal
  | 'access_premium_categories'// acceso a categorías marcadas como premium
  | 'featured_marker'          // marker destacado en el mapa (mayor tamaño/borde)
  | 'weekly_stats'             // acceso a estadísticas semanales de sus publicaciones
  | 'rich_description'         // descripción con formato enriquecido (markdown)
  | 'photo_upload';            // subida de fotos a la publicación

/**
 * Definición de una capacidad del sistema.
 * Leída desde BD / config. No se modifica en código.
 */
export interface CapabilityDefinition {
  /** Identificador único de la capacidad. */
  id: CapabilityId;

  /** Nombre legible para mostrar en UI (perfil, tienda de capacidades). */
  label: string;

  /** Descripción de qué desbloquea esta capacidad. */
  description: string;

  /**
   * Nivel mínimo al que se desbloquea orgánicamente.
   * `null` = no se desbloquea por nivel, solo por micropago.
   */
  unlocksAtLevel: number | null;

  /** Si true, puede comprarse directamente con micropago. */
  purchasable: boolean;

  /**
   * Precio en euros si `purchasable` es true.
   * `null` si no es comprable.
   */
  priceEur: number | null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Nivel
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Definición de un nivel del sistema de gamificación.
 * Leída desde BD / config.
 */
export interface LevelDefinition {
  /** Valor numérico del nivel (0–10). */
  level: number;

  /** Nombre visible del nivel (p.ej. "Explorador", "Embajador"). */
  label: string;

  /** XP mínima acumulada necesaria para alcanzar este nivel. */
  requiredXp: number;

  /** Descripción de las ventajas que otorga este nivel. */
  perksDescription: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Hito
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Hito que un usuario puede completar para ganar XP.
 * Definido en BD / config.
 */
export interface MilestoneDefinition {
  /** Identificador único del hito. */
  id: string;

  /** Descripción del hito para mostrar al usuario. */
  description: string;

  /** XP que otorga al completarse. */
  xpReward: number;

  /**
   * Tipo de condición que dispara el hito.
   * Se evalúa en backend al registrar acciones del usuario.
   *
   * @example 'first_publication' | 'publications_count' | 'profile_complete'
   */
  conditionType: string;

  /**
   * Valor asociado a la condición.
   * @example conditionType='publications_count', conditionValue=5 → "publica 5 eventos"
   */
  conditionValue: number | null;
}

/**
 * Estado de un hito para un usuario concreto.
 * Guardado en BD como relación user_milestones.
 */
export interface UserMilestone {
  userId: string;
  milestoneId: string;
  completedAt: string; // ISO 8601
}
