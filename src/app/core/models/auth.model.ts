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

/** Respuesta de los endpoints /auth/register y /auth/login */
export interface AuthResponse {
  token: string;
  user:  MapItUser;
}
