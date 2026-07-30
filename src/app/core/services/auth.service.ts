/**
 * @file auth.service.ts
 * @description Servicio de autenticación: registro, verificación de email e inicio de sesión.
 *
 * Endpoints:
 *   POST /auth/register            → registra usuario nuevo (Fase 1: no autentica, hay que verificar el email)
 *   POST /auth/verify-email        → confirma el email con el token recibido por correo
 *   POST /auth/resend-verification → reenvia el correo de verificacion
 *   POST /auth/forgot-password     → solicita el restablecimiento de contraseña ("olvidé mi contraseña")
 *   POST /auth/reset-password      → fija una contraseña nueva con el token recibido por correo
 *   POST /auth/login               → autentica usuario, devuelve token + usuario
 *
 * Tras un login exitoso:
 *   - Guarda el JWT en localStorage (clave TOKEN_KEY)
 *   - Carga el usuario en CurrentUserService
 */
import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap } from 'rxjs';
import { environment } from '@env/environment';
import {
  AuthLoginRequest, AuthRegisterRequest, AuthResponse,
  ForgotPasswordResponse, RegisterResponse, ResendVerificationResponse,
} from '../models/auth.model';
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
   * Registra un usuario nuevo. No autentica: la cuenta queda sin verificar hasta
   * que el usuario confirme su email (ver {@link verifyEmail}).
   * @param payload - Datos de registro (name, email, password, userType)
   */
  register(payload: AuthRegisterRequest): Observable<RegisterResponse> {
    console.log('Register payload:', payload);
    console.log('Register URL:', `${this.base}/register`);
    return this.http.post<RegisterResponse>(`${this.base}/register`, payload);
  }

  /** Confirma el email a partir del token recibido por correo. */
  verifyEmail(token: string): Observable<void> {
    return this.http.post<void>(`${this.base}/verify-email`, { token });
  }

  /** Solicita el reenvio del correo de verificacion. Siempre resuelve igual (anti-enumeración). */
  resendVerification(email: string): Observable<ResendVerificationResponse> {
    return this.http.post<ResendVerificationResponse>(`${this.base}/resend-verification`, { email });
  }

  /**
   * Solicita el restablecimiento de contraseña ("olvidé mi contraseña"). A diferencia de
   * {@link resendVerification}, el backend responde 404 si el email no existe.
   */
  forgotPassword(email: string): Observable<ForgotPasswordResponse> {
    return this.http.post<ForgotPasswordResponse>(`${this.base}/forgot-password`, { email });
  }

  /** Fija una contraseña nueva a partir del token recibido por correo. */
  resetPassword(token: string, newPassword: string): Observable<void> {
    return this.http.post<void>(`${this.base}/reset-password`, { token, newPassword });
  }

  /**
   * Inicia sesión con email y contraseña.
   * @param payload - Credenciales de acceso
   */
  login(payload: AuthLoginRequest): Observable<AuthResponse> {
    // El backend responde 401 con code INVALID_CREDENTIALS (no UNAUTHORIZED) para credenciales
    // incorrectas, así que el interceptor global de "Acceso restringido" lo ignora solo.
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
