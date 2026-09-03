import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { MapSettingsService } from './map-settings.service';
import { ThemeService } from './theme.service';

const STORAGE_KEY = 'mapit_map_settings';

describe('MapSettingsService', () => {
  const darkSignal = signal(false);

  function configure(): MapSettingsService {
    darkSignal.set(false);
    TestBed.configureTestingModule({
      providers: [{ provide: ThemeService, useValue: { isDark: darkSignal.asReadonly() } }],
    });
    return TestBed.inject(MapSettingsService);
  }

  afterEach(() => localStorage.removeItem(STORAGE_KEY));

  describe('carga inicial', () => {
    it('sin datos en localStorage, usa DEFAULT_POI tal cual (park y transit visibles, el resto no)', () => {
      const service = configure();

      const byId = Object.fromEntries(service.settings().poi.map((p) => [p.id, p.visible]));
      expect(byId['poi.park']).toBe(true);
      expect(byId['transit']).toBe(true);
      expect(byId['poi.business']).toBe(false);
      expect(service.settings().poi).toHaveLength(9);
    });

    it('con datos guardados que faltan un POI nuevo, lo rellena con su valor por defecto en su posición', () => {
      const saved = {
        poi: [{ id: 'poi.park', label: 'x', icon: 'x', description: 'x', visible: false }],
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(saved));

      const service = configure();

      const ids = service.settings().poi.map((p) => p.id);
      // Mismo orden que DEFAULT_POI, no el del JSON guardado.
      expect(ids[4]).toBe('poi.park');
      expect(service.settings().poi.find((p) => p.id === 'poi.park')?.visible).toBe(false);
      expect(service.settings().poi.find((p) => p.id === 'transit')?.visible).toBe(true);
    });

    it('con JSON corrupto en localStorage, cae a los defaults sin lanzar', () => {
      localStorage.setItem(STORAGE_KEY, '{no-es-json-valido');

      let service!: MapSettingsService;
      expect(() => (service = configure())).not.toThrow();
      expect(service.settings().poi).toHaveLength(9);
    });
  });

  describe('togglePoi', () => {
    it('invierte solo el POI indicado y persiste en localStorage', () => {
      const service = configure();

      service.togglePoi('poi.business');
      TestBed.tick();

      expect(service.settings().poi.find((p) => p.id === 'poi.business')?.visible).toBe(true);
      expect(service.settings().poi.find((p) => p.id === 'poi.park')?.visible).toBe(true);

      const persisted = JSON.parse(localStorage.getItem(STORAGE_KEY)!);
      expect(persisted.poi.find((p: { id: string }) => p.id === 'poi.business').visible).toBe(true);
    });
  });

  describe('resetToDefaults', () => {
    it('restaura los valores por defecto tras haber modificado algo', () => {
      const service = configure();
      service.togglePoi('poi.business');
      TestBed.tick();

      service.resetToDefaults();
      TestBed.tick();

      expect(service.settings().poi.find((p) => p.id === 'poi.business')?.visible).toBe(false);
    });
  });

  describe('mapStyles', () => {
    it('en tema claro, no incluye la paleta oscura', () => {
      const service = configure();

      expect(service.mapStyles().some((s) => s.elementType === 'geometry' && !s.featureType)).toBe(
        false,
      );
    });

    it('en tema oscuro, antepone la paleta oscura', () => {
      const service = configure();
      darkSignal.set(true);

      expect(service.mapStyles().some((s) => s.elementType === 'geometry' && !s.featureType)).toBe(
        true,
      );
    });

    it('oculta la geometría/etiquetas de todos los POI como base, y reactiva solo los visibles', () => {
      const service = configure();

      const styles = service.mapStyles();
      expect(styles).toContainEqual({
        featureType: 'poi',
        elementType: 'geometry',
        stylers: [{ visibility: 'off' }],
      });
      expect(styles).toContainEqual({
        featureType: 'poi',
        elementType: 'labels',
        stylers: [{ visibility: 'off' }],
      });
      // poi.park está visible por defecto → se reactiva con elementType 'all'.
      expect(styles).toContainEqual({
        featureType: 'poi.park',
        elementType: 'all',
        stylers: [{ visibility: 'on' }],
      });
      // poi.business no está visible por defecto → ninguna regla propia en el array.
      expect(styles.some((s) => s.featureType === 'poi.business')).toBe(false);
    });

    it('transit se trata aparte (labels.icon, no featureType poi.*)', () => {
      const service = configure();

      expect(service.mapStyles()).toContainEqual({
        featureType: 'transit',
        elementType: 'labels.icon',
        stylers: [{ visibility: 'on' }],
      });
    });

    it('se recalcula cuando cambia el tema (computed reactivo)', () => {
      const service = configure();
      const lightCount = service.mapStyles().length;

      darkSignal.set(true);

      expect(service.mapStyles().length).toBeGreaterThan(lightCount);
    });
  });
});
