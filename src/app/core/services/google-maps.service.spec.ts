import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { GoogleMapsService } from './google-maps.service';
import { environment } from '@env/environment';

/** Stub mínimo de la API real de Google Maps (Size/Point), no cargada en el entorno de test. */
class FakeSize { constructor(public width: number, public height: number) {} }
class FakePoint { constructor(public x: number, public y: number) {} }

describe('GoogleMapsService', () => {
  let service: GoogleMapsService;
  const originalGoogle = (window as unknown as { google?: unknown }).google;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(GoogleMapsService);
    (window as unknown as { google: unknown }).google = {
      maps: { Size: FakeSize, Point: FakePoint },
    };
  });

  afterEach(() => {
    (window as unknown as { google?: unknown }).google = originalGoogle;
    document.querySelectorAll('script[src*="maps.googleapis.com"]').forEach(el => el.remove());
  });

  describe('load', () => {
    it('si window.google.maps ya existe, resuelve sin inyectar ningún script', async () => {
      await service.load();

      expect(document.querySelectorAll('script[src*="maps.googleapis.com"]')).toHaveLength(0);
    });

    it('sin google.maps cargado, inyecta el script una vez con la API key de environment', async () => {
      Reflect.deleteProperty(window, 'google');

      const promise = service.load();
      const script = document.querySelector<HTMLScriptElement>('script[src*="maps.googleapis.com"]');
      expect(script).not.toBeNull();
      expect(script?.src).toContain(environment.googleMapsApiKey);
      script?.onload?.(new Event('load'));

      await expect(promise).resolves.toBeUndefined();
    });

    it('llamadas concurrentes reutilizan la misma promesa (un solo script inyectado)', async () => {
      Reflect.deleteProperty(window, 'google');

      const first = service.load();
      const second = service.load();
      expect(document.querySelectorAll('script[src*="maps.googleapis.com"]')).toHaveLength(1);

      document.querySelector<HTMLScriptElement>('script[src*="maps.googleapis.com"]')?.onload?.(new Event('load'));

      await expect(first).resolves.toBeUndefined();
      await expect(second).resolves.toBeUndefined();
    });

    it('si el script falla al cargar, la promesa se rechaza', async () => {
      Reflect.deleteProperty(window, 'google');

      const promise = service.load();
      document.querySelector<HTMLScriptElement>('script[src*="maps.googleapis.com"]')?.onerror?.(new Event('error'));

      await expect(promise).rejects.toThrow('No se pudo cargar Google Maps API');
    });
  });

  describe('buildMarkerIcon', () => {
    it('produce una url data:image/svg+xml con el tamaño pedido', () => {
      const icon = service.buildMarkerIcon('#ff0000', '🚴', 40);

      expect(icon.url).toContain('data:image/svg+xml');
      expect(icon.scaledSize).toEqual(new FakeSize(40, 40));
      expect(icon.anchor).toBeInstanceOf(FakePoint);
    });

    it('sin animate, no añade padding extra (canvas == size)', () => {
      const icon = service.buildMarkerIcon('#ff0000', '🚴', 40, false, false);
      expect(icon.scaledSize.width).toBe(40);
    });

    it('con animate, añade padding para que el anillo animado no se recorte', () => {
      const icon = service.buildMarkerIcon('#ff0000', '🚴', 40, false, true);
      expect(icon.scaledSize.width).toBeGreaterThan(40);
    });

    it('con dark=true, añade el filtro de sombra al SVG', () => {
      const icon = service.buildMarkerIcon('#ff0000', '🚴', 40, true);
      const decoded = decodeURIComponent(icon.url.replace('data:image/svg+xml;charset=UTF-8,', ''));
      expect(decoded).toContain('feDropShadow');
    });

    it('con accessBadge "locked", incluye el candado con anillo neutro', () => {
      const icon = service.buildMarkerIcon('#ff0000', '🚴', 40, false, false, 'locked');
      const decoded = decodeURIComponent(icon.url.replace('data:image/svg+xml;charset=UTF-8,', ''));
      expect(decoded).toContain('🔒');
      expect(decoded).toContain('#64748b'); // anillo neutro en modo claro
    });

    it('con accessBadge "granted", el candado usa el color de la categoría', () => {
      const icon = service.buildMarkerIcon('#123456', '🚴', 40, false, false, 'granted');
      const decoded = decodeURIComponent(icon.url.replace('data:image/svg+xml;charset=UTF-8,', ''));
      expect(decoded).toContain('#123456');
    });

    it('con accessBadge "none" (por defecto), no incluye ningún candado', () => {
      const icon = service.buildMarkerIcon('#ff0000', '🚴', 40);
      const decoded = decodeURIComponent(icon.url.replace('data:image/svg+xml;charset=UTF-8,', ''));
      expect(decoded).not.toContain('🔒');
    });
  });

  describe('buildMyLocationControl', () => {
    it('crea un botón accesible que invoca el callback al pulsarlo', () => {
      const onClick = vi.fn();
      const button = service.buildMyLocationControl(onClick);

      expect(button.tagName).toBe('BUTTON');
      expect(button.getAttribute('aria-label')).toBe('Usar mi ubicación');

      button.click();
      expect(onClick).toHaveBeenCalledTimes(1);
    });
  });
});
