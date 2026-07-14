/**
 * @file device-location.service.ts
 * @description Envuelve la Geolocation API del navegador para obtener la posición real
 *   del dispositivo (GPS/Wi-Fi/celda), a diferencia de {@link GeoIpService} que resuelve
 *   por IP. Se usa desde un control explícito en el mapa ("Usar mi ubicación"); nunca se
 *   dispara automáticamente.
 */
import { Injectable } from '@angular/core';
import { Observable, from, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';

/** Coordenadas resueltas por el dispositivo. */
export interface DeviceLocation {
    lat: number;
    lng: number;
}

/** Motivo de fallo al resolver la posición del dispositivo. */
export type DeviceLocationErrorCode =
    | 'UNSUPPORTED'
    | 'PERMISSION_DENIED'
    | 'POSITION_UNAVAILABLE'
    | 'TIMEOUT';

export interface DeviceLocationError {
    code: DeviceLocationErrorCode;
}

/** Estado de permiso de geolocalización para el origen actual. */
export type GeolocationPermissionState = 'granted' | 'denied' | 'prompt' | 'unknown';

@Injectable({ providedIn: 'root' })
export class DeviceLocationService {

    /** Feature detection: la Geolocation API existe en este navegador. */
    isSupported(): boolean {
        return 'geolocation' in navigator;
    }

    /**
     * Detecta si el input primario del dispositivo es táctil (dedo, no ratón/trackpad),
     * independientemente del ancho de viewport. Más fiable que un breakpoint de pantalla:
     * un desktop con ventana estrecha sigue dando `pointer: fine`, y una tablet en
     * landscape con viewport ancho sigue dando `pointer: coarse`.
     */
    isTouchPrimaryDevice(): boolean {
        return window.matchMedia('(pointer: coarse)').matches && navigator.maxTouchPoints > 0;
    }

    /**
     * Consulta el estado de permiso de geolocalización sin disparar el diálogo nativo.
     *
     * @remarks
     * Safari no soporta `permissions.query('geolocation')` y resuelve siempre `'unknown'`;
     * en ese caso solo se puede saber el estado real intentando {@link getCurrentPosition}.
     */
    checkPermissionState(): Observable<GeolocationPermissionState> {
        if (!navigator.permissions?.query) {
            return of('unknown');
        }

        return from(navigator.permissions.query({ name: 'geolocation' as PermissionName })).pipe(
            map(status => status.state as GeolocationPermissionState),
            catchError(() => of('unknown' as GeolocationPermissionState)),
        );
    }

    /**
     * Resuelve la posición actual del dispositivo vía GPS/Wi-Fi/celda.
     *
     * @returns Observable que emite una vez las coordenadas o falla con un
     * {@link DeviceLocationError} tipado (nunca lanza una excepción sin capturar).
     */
    getCurrentPosition(): Observable<DeviceLocation> {
        return new Observable(subscriber => {
            if (!this.isSupported()) {
                subscriber.error({ code: 'UNSUPPORTED' } satisfies DeviceLocationError);
                return;
            }

            navigator.geolocation.getCurrentPosition(
                position => {
                    subscriber.next({
                        lat: position.coords.latitude,
                        lng: position.coords.longitude,
                    });
                    subscriber.complete();
                },
                error => {
                    subscriber.error({ code: this.mapGeolocationError(error) } satisfies DeviceLocationError);
                },
                { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 },
            );
        });
    }

    private mapGeolocationError(error: GeolocationPositionError): DeviceLocationErrorCode {
        switch (error.code) {
            case error.PERMISSION_DENIED: return 'PERMISSION_DENIED';
            case error.TIMEOUT: return 'TIMEOUT';
            default: return 'POSITION_UNAVAILABLE';
        }
    }
}
