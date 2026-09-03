import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { DeviceLocationService } from './device-location.service';

/** Construye un GeolocationPositionError falso, con los mismos códigos que el real. */
function fakeGeoError(code: 1 | 2 | 3): GeolocationPositionError {
  return {
    code,
    message: 'x',
    PERMISSION_DENIED: 1,
    POSITION_UNAVAILABLE: 2,
    TIMEOUT: 3,
  } as GeolocationPositionError;
}

describe('DeviceLocationService', () => {
  let service: DeviceLocationService;
  const originalGeolocation = navigator.geolocation;
  const originalPermissions = navigator.permissions;
  const originalMaxTouchPoints = navigator.maxTouchPoints;
  const originalMatchMedia = window.matchMedia;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(DeviceLocationService);
  });

  afterEach(() => {
    Object.defineProperty(navigator, 'geolocation', {
      value: originalGeolocation,
      configurable: true,
    });
    Object.defineProperty(navigator, 'permissions', {
      value: originalPermissions,
      configurable: true,
    });
    Object.defineProperty(navigator, 'maxTouchPoints', {
      value: originalMaxTouchPoints,
      configurable: true,
    });
    window.matchMedia = originalMatchMedia;
  });

  describe('isSupported', () => {
    it('true si el navegador expone navigator.geolocation', () => {
      Object.defineProperty(navigator, 'geolocation', { value: {}, configurable: true });
      expect(service.isSupported()).toBe(true);
    });

    it('false si no existe navigator.geolocation', () => {
      // 'geolocation' in navigator sigue siendo true si solo se pone value: undefined (la clave
      // existe igual) — hay que borrar la propiedad de verdad para simular su ausencia.
      Reflect.deleteProperty(navigator, 'geolocation');
      expect(service.isSupported()).toBe(false);
    });
  });

  describe('isTouchPrimaryDevice', () => {
    function mockPointerCoarse(matches: boolean): void {
      window.matchMedia = vi.fn(
        () => ({ matches }) as MediaQueryList,
      ) as unknown as typeof window.matchMedia;
    }

    it('true si pointer:coarse coincide y hay puntos táctiles', () => {
      mockPointerCoarse(true);
      Object.defineProperty(navigator, 'maxTouchPoints', { value: 5, configurable: true });

      expect(service.isTouchPrimaryDevice()).toBe(true);
    });

    it('false si pointer:coarse coincide pero maxTouchPoints es 0 (p. ej. algunos híbridos)', () => {
      mockPointerCoarse(true);
      Object.defineProperty(navigator, 'maxTouchPoints', { value: 0, configurable: true });

      expect(service.isTouchPrimaryDevice()).toBe(false);
    });

    it('false si el puntero primario es fino (ratón/trackpad), aunque haya soporte táctil', () => {
      mockPointerCoarse(false);
      Object.defineProperty(navigator, 'maxTouchPoints', { value: 5, configurable: true });

      expect(service.isTouchPrimaryDevice()).toBe(false);
    });
  });

  describe('checkPermissionState', () => {
    it('sin navigator.permissions, emite "unknown"', async () => {
      Object.defineProperty(navigator, 'permissions', { value: undefined, configurable: true });

      const result = await new Promise((resolve) =>
        service.checkPermissionState().subscribe(resolve),
      );

      expect(result).toBe('unknown');
    });

    it('con permissions.query disponible, emite el estado real', async () => {
      Object.defineProperty(navigator, 'permissions', {
        configurable: true,
        value: { query: vi.fn().mockResolvedValue({ state: 'granted' }) },
      });

      const result = await new Promise((resolve) =>
        service.checkPermissionState().subscribe(resolve),
      );

      expect(result).toBe('granted');
    });

    it('si permissions.query falla (p. ej. Safari), emite "unknown" en vez de propagar el error', async () => {
      Object.defineProperty(navigator, 'permissions', {
        configurable: true,
        value: { query: vi.fn().mockRejectedValue(new Error('no soportado')) },
      });

      const result = await new Promise((resolve) =>
        service.checkPermissionState().subscribe(resolve),
      );

      expect(result).toBe('unknown');
    });
  });

  describe('getCurrentPosition', () => {
    it('sin soporte de geolocalización, falla con UNSUPPORTED sin llamar a la API nativa', () => {
      // 'geolocation' in navigator sigue siendo true si solo se pone value: undefined (la clave
      // existe igual) — hay que borrar la propiedad de verdad para simular su ausencia.
      Reflect.deleteProperty(navigator, 'geolocation');

      let error: unknown;
      service.getCurrentPosition().subscribe({ error: (e) => (error = e) });

      expect(error).toEqual({ code: 'UNSUPPORTED' });
    });

    it('con éxito, emite lat/lng y completa', () => {
      const getCurrentPosition = vi.fn((success: PositionCallback) =>
        success({ coords: { latitude: 40.4, longitude: -3.7 } } as GeolocationPosition),
      );
      Object.defineProperty(navigator, 'geolocation', {
        value: { getCurrentPosition },
        configurable: true,
      });

      let result: unknown;
      service.getCurrentPosition().subscribe((r) => (result = r));

      expect(result).toEqual({ lat: 40.4, lng: -3.7 });
    });

    it('pasa enableHighAccuracy=true y maximumAge=0 por defecto a la API nativa', () => {
      const getCurrentPosition = vi.fn();
      Object.defineProperty(navigator, 'geolocation', {
        value: { getCurrentPosition },
        configurable: true,
      });

      service.getCurrentPosition().subscribe();

      expect(getCurrentPosition.mock.calls[0][2]).toEqual({
        enableHighAccuracy: true,
        maximumAge: 0,
      });
    });

    it('respeta las opciones explícitas pasadas por el llamante', () => {
      const getCurrentPosition = vi.fn();
      Object.defineProperty(navigator, 'geolocation', {
        value: { getCurrentPosition },
        configurable: true,
      });

      service.getCurrentPosition({ enableHighAccuracy: false, maximumAge: 60000 }).subscribe();

      expect(getCurrentPosition.mock.calls[0][2]).toEqual({
        enableHighAccuracy: false,
        maximumAge: 60000,
      });
    });

    it.each([
      [1, 'PERMISSION_DENIED'],
      [2, 'POSITION_UNAVAILABLE'],
      [3, 'TIMEOUT'],
    ] as const)('mapea el código nativo %i a %s', (code, expected) => {
      const getCurrentPosition = vi.fn((_success: PositionCallback, error: PositionErrorCallback) =>
        error(fakeGeoError(code)),
      );
      Object.defineProperty(navigator, 'geolocation', {
        value: { getCurrentPosition },
        configurable: true,
      });

      let result: unknown;
      service.getCurrentPosition().subscribe({ error: (e) => (result = e) });

      expect(result).toEqual({ code: expected });
    });
  });
});
