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

/** Payload para POST /auth/login */
export interface AuthLoginRequest {
  email:    string;
  password: string;
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
