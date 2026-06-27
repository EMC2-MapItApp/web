/**
 * @file auth.service.ts
 * @description Servicio de autenticación: registro e inicio de sesión.
 *
 * Endpoints:
 *   POST /auth/register  → registra usuario nuevo, devuelve token + usuario
 *   POST /auth/login     → autentica usuario, devuelve token + usuario
 *
 * Tras una respuesta exitosa:
 *   - Guarda el JWT en localStorage (clave TOKEN_KEY)
 *   - Carga el usuario en CurrentUserService
 */
import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AuthLoginRequest, AuthRegisterRequest, AuthResponse } from '../models/auth.model';
import { MapItUser } from '../models/user.model';
import { CurrentUserService } from './current-user.service';
import { TOKEN_KEY } from '../guards/auth.guard';

@Injectable({ providedIn: 'root' })
export class AuthService {

  private readonly http = inject(HttpClient);
  private readonly cu   = inject(CurrentUserService);
  private readonly base = environment.apiAuthUrl;

  private readonly TYPE_MAP: Record<string, string> = {
    PARTICULAR:   'individual',
    PROFESSIONAL: 'professional',
    ENTITY:       'entity',
  };

  /**
   * Registra un usuario nuevo.
   * @param payload - Datos de registro (name, email, password, userType)
   */
  register(payload: AuthRegisterRequest): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.base}/register`, payload).pipe(
      tap(res => this.handleAuthResponse(res))
    );
  }

  /**
   * Inicia sesión con email y contraseña.
   * @param payload - Credenciales de acceso
   */
  login(payload: AuthLoginRequest): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.base}/login`, payload).pipe(
      tap(res => this.handleAuthResponse(res))
    );
  }

  /** Limpia la sesión local (logout). */
  logout(): void {
    localStorage.removeItem(TOKEN_KEY);
    this.cu.clear();
  }

  private handleAuthResponse(res: AuthResponse): void {
    localStorage.setItem(TOKEN_KEY, res.token);
    const user: MapItUser = {
      ...res.user,
      userType: (this.TYPE_MAP[res.user.userType as string] ?? res.user.userType) as MapItUser['userType'],
    };
    this.cu.setUser(user);
  }
}
