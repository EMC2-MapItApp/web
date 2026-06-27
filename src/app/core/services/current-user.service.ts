/**
 * @file current-user.service.ts
 * @description Servicio que provee el usuario actualmente autenticado.
 *
 * @remarks
 * Actualmente devuelve datos mock. En producción se sustituirá por
 * la respuesta del endpoint de autenticación (/api/auth/me).
 *
 * Al migrar a auth real:
 *   - Sustituir MOCK_USER por la respuesta del token JWT decodificado
 *     o por una llamada HttpClient.get<MapItUser>('/api/auth/me').
 *   - Ningún componente consumidor necesita cambios.
 */
import { Injectable, signal, computed } from '@angular/core';
import { MapItUser, UserType } from '../models/user.model';

// ─────────────────────────────────────────────────────────────────────────────
// Servicio
// ─────────────────────────────────────────────────────────────────────────────

@Injectable({ providedIn: 'root' })
export class CurrentUserService {

  /** Usuario activo. Signal reactivo: los componentes se actualizan automáticamente. */
  private readonly _user = signal<MapItUser | null>(null);

  /** Solo lectura para los consumidores. */
  readonly user = this._user.asReadonly();

  /** Shortcuts computados para uso frecuente en templates. */
  readonly userType   = computed(() => this._user()?.userType);
  readonly userName   = computed(() => this._user()?.name);
  readonly userLevel  = computed(() => this._user()?.level);
  readonly userXp     = computed(() => this._user()?.xp);
  readonly isIndividual   = computed(() => this._user()?.userType === 'individual');
  readonly isProfessional = computed(() => this._user()?.userType === 'professional');
  readonly isEntity       = computed(() => this._user()?.userType === 'entity');

  /**
   * Comprueba si el usuario tiene una capacidad desbloqueada.
   * @param capabilityId - Id de la capacidad a comprobar.
   */
  hasCapability(capabilityId: string): boolean {
    return this._user()?.unlockedCapabilities.includes(capabilityId) ?? false;
  }

  /**
   * Establece el usuario activo (usado tras login o carga desde la API).
   * @param user - Usuario completo recibido de la API.
   */
  setUser(user: MapItUser): void {
    this._user.set(user);
  }

  /**
   * Actualiza parcialmente el usuario activo.
   * Usado tras editar el perfil o desbloquear una capacidad.
   * @param partial - Campos a actualizar.
   */
  patch(partial: Partial<MapItUser>): void {
    const current = this._user();
    if (current) this._user.set({ ...current, ...partial });
  }

  /** Limpia el usuario activo (logout o token inválido). */
  clear(): void {
    this._user.set(null);
  }

  /** Ids de tipos favoritos del usuario. Array vacío si no tiene o no es individual. */
  readonly favoriteTypeIds = computed(() =>
    this._user()?.favoriteLocationTypeIds ?? []
  );
}
