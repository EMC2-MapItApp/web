/**
 * @file user.service.ts
 * @description Operaciones sobre el perfil del usuario autenticado.
 *
 * Endpoints:
 *   GET  /auth/me              → cargar usuario autenticado
 *   GET  /users/{id}           → obtener perfil público de cualquier usuario
 *   PATCH /users/{id}          → actualizar perfil (datos personales + favoritos)
 */
import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpContext } from '@angular/common/http';
import { Observable, tap } from 'rxjs';
import { environment } from '@env/environment';
import {
  UserMeResponse,
  UpdateUserProfileRequest,
  UpdateUserProfileResponse,
} from '../models/user.model';
import { CurrentUserService } from './current-user.service';
import { SKIP_UNAUTHORIZED_DIALOG } from '../interceptors/unauthorized.interceptor';

@Injectable({ providedIn: 'root' })
export class UserService {

  private readonly http = inject(HttpClient);
  private readonly cu   = inject(CurrentUserService);
  private readonly baseUrlUsers = environment.apiUsersUrl;
  private readonly baseUrlAuth  = environment.apiAuthUrl;

  loadMe(): Observable<UserMeResponse> {
    // 401 aquí es un token expirado/inválido detectado por los guards de carga de usuario
    // (ver load-user.guard.ts / load-user-optional.ts), que ya lo gestionan (limpian el token y
    // redirigen o degradan a invitado en silencio) — se excluye del diálogo global.
    const context = new HttpContext().set(SKIP_UNAUTHORIZED_DIALOG, true);
    return this.http.get<UserMeResponse>(`${this.baseUrlAuth}/me`, { context }).pipe(
      tap(user => this.cu.setUser(user))
    );
  }

  /**
   * Recupera el perfil completo de cualquier usuario por su UUID.
   * Equivale a GET /users/{id}
   */
  getById(id: string): Observable<UserMeResponse> {
    return this.http.get<UserMeResponse>(`${this.baseUrlUsers}/${id}`);
  }

  updateProfile(payload: UpdateUserProfileRequest): Observable<UpdateUserProfileResponse> {
    const userId = this.cu.user()?.id;
    if (!userId) throw new Error('No hay usuario autenticado');

    return this.http.patch<UpdateUserProfileResponse>(
      `${this.baseUrlUsers}/${userId}`,
      payload
    ).pipe(
      tap(updated => this.cu.setUser(updated))
    );
  }

  /**
   * Cambia la contraseña del usuario autenticado.
   * Requiere la contraseña actual para verificar la identidad.
   */
  changePassword(currentPassword: string, newPassword: string): Observable<void> {
    const userId = this.cu.user()?.id;
    if (!userId) throw new Error('No hay usuario autenticado');

    // El backend responde 401 con code WRONG_CURRENT_PASSWORD (no UNAUTHORIZED) para la
    // contraseña actual incorrecta, así que el interceptor global lo ignora solo.
    return this.http.patch<void>(
      `${this.baseUrlUsers}/${userId}/password`,
      { currentPassword, newPassword },
    );
  }
}
