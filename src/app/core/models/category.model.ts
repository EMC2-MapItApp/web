/**
 * @file category.model.ts
 * @description Modelos que representan la jerarquía de categorías de MapIt.
 *
 * Estructura jerárquica:
 *   MainCategory  →  SubCategory  →  LocationType  →  MapLocation
 *
 * Ejemplo real:
 *   DEPORTES → CICLISMO → QUEDADAS   (un particular organiza una ruta en grupo)
 *   DEPORTES → CICLISMO → PROFESIONAL (una tienda de bicicletas)
 *
 * @remarks
 * Se obtienen del backend en tiempo real vía {@link CategoryService.getAll} (`GET
 * /api/v1/categories/tree`), no están hardcodeados en el cliente.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Tipo de localización (3er nivel)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Tipo de localización dentro de una subcategoría.
 *
 * @example
 * - QUEDADAS: evento organizado por un particular o grupo de usuarios.
 * - PROFESIONAL: negocio, servicio o entidad relacionada con la subcategoría.
 */
export interface LocationType {
  /** Identificador único. Debe ser único en todo el árbol. */
  id: number;
  /** Nombre visible al usuario (p.ej. "Quedadas", "Profesional"). */
  name: string;
  /** Descripción de qué tipo de puntos agrupa este tipo de localización. */
  description: string;
  /** Identificador de la subcategoría padre. */
  subcategoryId: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Subcategoría (2º nivel)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Subcategoría que agrupa tipos de localización relacionados.
 *
 * @example CICLISMO, RUNNING, FÚTBOL (dentro de DEPORTES)
 */
export interface SubCategory {
  /** Identificador único. */
  id: number;
  /** Nombre visible al usuario (p.ej. "Ciclismo"). */
  name: string;
  /** Emoji o identificador de icono representativo. */
  icon: string;
  /** Identificador de la categoría principal padre. */
  mainCategoryId: number;
  /** Lista de tipos de localización que cuelgan de esta subcategoría. */
  locationTypes: LocationType[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Categoría principal (1er nivel)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Categoría principal de primer nivel.
 * Define también el color que se usará para los markers del mapa.
 *
 * @example DEPORTES, CULTURA, GASTRONOMÍA, NATURALEZA
 */
export interface MainCategory {
  /** Identificador único. */
  id: number;
  /** Nombre visible al usuario (p.ej. "Deportes"). */
  name: string;
  /** Emoji o identificador de icono representativo. */
  icon: string;
  /**
   * Color HEX que identifica a esta categoría en el mapa.
   * Se aplica a los markers y badges de todas sus localizaciones.
   */
  color: string;
  /** Lista de subcategorías que pertenecen a esta categoría. */
  subcategories: SubCategory[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Helper de navegación plana (útil para lookups rápidos)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Vista plana de la jerarquía completa de una localización.
 * Se usa para mostrar breadcrumbs y resolver colores de markers fácilmente.
 */
export interface CategoryBreadcrumb {
  mainCategory: MainCategory;
  subCategory: SubCategory;
  locationType: LocationType;
}

