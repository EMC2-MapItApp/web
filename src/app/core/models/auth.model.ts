/**
 * @file auth.model.ts
 * @description DTOs de autenticación: registro, login y respuesta del servidor.
 */
import { MapItUser } from './user.model';

/** Payload para POST /auth/register */
export interface AuthRegisterRequest {
  name:     string;
  email:    string;
  password: string;
  /** El backend espera el enum en mayúsculas: PARTICULAR | PROFESSIONAL | ENTITY */
  userType: 'PARTICULAR' | 'PROFESSIONAL' | 'ENTITY';
}

/**
 * Payload para POST /auth/login. `identifier` acepta tanto un email como un nick
 * prefijado con `@` (p.ej. `@ana`); el backend decide cuál de los dos es.
 */
export interface AuthLoginRequest {
  identifier: string;
  password:   string;
}

/** Respuesta del endpoint /auth/login */
export interface AuthResponse {
  token: string;
  user:  MapItUser;
}

/**
 * Respuesta de POST /auth/register (Fase 1 auth). Sin token: el registro ya no
 * autentica, el usuario debe verificar su email antes de poder hacer login.
 */
export interface RegisterResponse {
  email: string;
}

/** Payload para POST /auth/verify-email */
export interface VerifyEmailRequest {
  token: string;
}

/** Payload para POST /auth/resend-verification */
export interface ResendVerificationRequest {
  email: string;
}

/** Respuesta de POST /auth/resend-verification: mensaje generico, exista o no el email. */
export interface ResendVerificationResponse {
  message: string;
}

/**
 * Payload para POST /auth/forgot-password ("olvidé mi contraseña"). A diferencia de
 * resend-verification, el backend sí distingue si el email existe (404 si no).
 */
export interface ForgotPasswordRequest {
  email: string;
}

/** Respuesta de POST /auth/forgot-password cuando el email existe. */
export interface ForgotPasswordResponse {
  message: string;
}

/** Payload para POST /auth/reset-password: token recibido por correo + contraseña nueva. */
export interface ResetPasswordRequest {
  token: string;
  newPassword: string;
}
