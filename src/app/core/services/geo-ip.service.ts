/**
 * @file geo-ip.service.ts
 * @description Servicio que resuelve la ubicación geográfica inicial del mapa
 *   consultando el endpoint /api/v1/geo/me del backend.
 *
 * En entorno de desarrollo permite simular una IP distinta de dos formas:
 *   1. Query param en la URL del navegador: ?simIp=81.2.69.142
 *   2. Propiedad `devSimIp` en environment.ts
 *
 * Si la llamada al backend falla, aplica un fallback local (Madrid).
 */
import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { environment } from '@env/environment';
import { GeoIpCenter } from '../models/geo-ip.model';

/** Coordenadas de fallback local cuando el backend no responde. */
const FALLBACK: GeoIpCenter = {
    lat: 40.4168,
    lng: -3.7038,
    city: 'Madrid',
    country: 'ES',
    resolvedIp: '127.0.0.1',
    source: 'fallback',
};

@Injectable({ providedIn: 'root' })
export class GeoIpService {

    private readonly http = inject(HttpClient);
    private readonly baseUrl = environment.apiGeoUrl;

    /**
     * Resuelve las coordenadas iniciales del mapa para la conexión actual.
     *
     * @remarks
     * - En producción llama a `/api/v1/geo/me` sin parámetros extra.
     * - En desarrollo, si hay `simIp` en query params de la URL o en
     *   `environment.devSimIp`, lo añade como query param al backend.
     * - Si el backend falla por cualquier motivo devuelve el fallback local
     *   para no bloquear la carga del mapa.
     *
     * @returns Observable que siempre emite un {@link GeoIpCenter} (nunca error).
     */
    resolveCenter(): Observable<GeoIpCenter> {
        let params = new HttpParams();

        if (!environment.production) {
            const simIp = this.getSimIp();
            if (simIp) {
                params = params.set('simIp', simIp);
            }
        }

        return this.http
            .get<GeoIpCenter>(`${this.baseUrl}/me`, { params })
            .pipe(
                map(res => ({ ...res })),
                catchError(err => {
                    console.warn('[GeoIpService] Fallo al resolver ubicación por IP, usando fallback.', err);
                    return of(FALLBACK);
                })
            );
    }

    /**
     * Obtiene la IP de simulación desde query params de la URL o desde
     * la propiedad de entorno, en ese orden de prioridad.
     *
     * @returns IP de simulación o cadena vacía si no hay ninguna.
     */
    private getSimIp(): string {
        const fromUrl = new URLSearchParams(window.location.search).get('simIp');
        if (fromUrl && fromUrl.trim()) return fromUrl.trim();

        const fromEnv = (environment as any).devSimIp;
        if (fromEnv && fromEnv.trim()) return fromEnv.trim();

        return '';
    }
}