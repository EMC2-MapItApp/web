/**
 * @file user.model.ts
 * @description Modelo de usuario de MapIt.
 *
 * Tres perfiles con capacidades de publicación distintas:
 *
 *  professional → 1 Place (sede) + N Promotions sobre ella
 *  entity       → 1 Place (sede) + N Events sobre ella
 *  individual   → N Events libres (sin sede fija), gamificados por nivel
 *
 * El sistema de niveles (0–10) solo aplica a `individual`.
 * Las capacidades se desbloquean por XP acumulada (hitos) o micropagos.
 * La lista concreta de capacidades se define en CapabilityDefinition (BD).
 */

// ─────────────────────────────────────────────────────────────────────────────
// Enums / union types
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Tipo de perfil de usuario.
 * Determina qué puede publicar y qué controles ve en la UI.
 */
export type UserType = 'professional' | 'entity' | 'individual';

/**
 * Nivel numérico de un usuario individual (0 = básico, 10 = completo).
 * Se calcula automáticamente a partir de la XP acumulada.
 */
export type UserLevel = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;

// ─────────────────────────────────────────────────────────────────────────────
// Interfaz principal
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Usuario registrado en MapIt.
 */
export interface MapItUser {
  /** Identificador único (UUID en BD). */
  id: string;
  /** Nombre visible en la aplicación. */
  name: string;
  /** Email de acceso. */
  email: string;
  /** Tipo de perfil: determina capacidades de publicación. */
  userType: UserType;
  /** Nivel calculado (0–10). Solo relevante para `individual`. */
  level: UserLevel | null;
  /** Puntos de experiencia acumulados. Solo para `individual`. */
  xp: number | null;
  /** Ids de capacidades desbloqueadas. */
  unlockedCapabilities: string[];
  /** URL del avatar. Opcional. */
  avatarUrl?: string;
  /** Teléfono de contacto. */
  phone?: string;
  /** Ciudad de residencia. */
  city?: string;
  /** Provincia de residencia. */
  province?: string;
  /** Descripción biográfica. */
  bio?: string;
  /** Fecha de nacimiento (formato yyyy-MM-dd). */
  birthDate?: string;
  /** Ids de LocationType marcados como favoritos (solo individual). */
  favoriteLocationTypeIds?: number[];
  /** Fecha de creación ISO 8601 */
  createdAt?: string;
  /** Fecha de última actualización ISO 8601 */
  updatedAt?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// DTOs de la API de usuario
// ─────────────────────────────────────────────────────────────────────────────

/** Respuesta del endpoint GET /auth/me y GET /users/{id}. */
export type UserMeResponse = MapItUser;

/** Campos actualizables mediante PATCH /users/{id}. Todos opcionales. */
export interface UpdateUserProfileRequest {
  name?:                   string;
  avatarUrl?:              string;
  phone?:                  string;
  city?:                   string;
  province?:               string;
  bio?:                    string;
  /** Formato yyyy-MM-dd */
  birthDate?:              string;
  favoriteLocationTypeIds?: number[];
}

/** Respuesta del endpoint PATCH /users/{id}. */
export type UpdateUserProfileResponse = MapItUser;
