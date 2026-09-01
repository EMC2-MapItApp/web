import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { Observable, of, throwError } from 'rxjs';
import { vi } from 'vitest';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MapsPageComponent } from './maps';
import { LocationService } from '@core/services/location.service';
import { CategoryService } from '@core/services/category.service';
import { CurrentUserService } from '@core/services/current-user.service';
import { GeoIpService } from '@core/services/geo-ip.service';
import { MapViewportService } from '@core/services/map-viewport.service';
import { DeviceLocationService } from '@core/services/device-location.service';
import { PublicationService } from '@core/services/publication.service';
import { ResponsiveService } from '@core/responsive/responsive.service';
import { ThemeService } from '@core/services/theme.service';
import { ResponsiveState } from '@core/responsive/responsive.model';
import { MapLocation } from '@core/models/location.model';
import { MainCategory, CategoryBreadcrumb } from '@core/models/category.model';
import { MapItUser } from '@core/models/user.model';
import { PublicationDetailInput } from './publication-detail/publication-detail';

// ─────────────────────────────────────────────────────────────────────────────
// Stub de la API nativa de google.maps — no cargada en el entorno de test.
// Amplía el patrón de FakeSize/FakePoint de google-maps.service.spec.ts con
// las clases que maps.ts instancia directamente (Map/Marker/InfoWindow).
// ─────────────────────────────────────────────────────────────────────────────

class FakeSize {
  constructor(
    public width: number,
    public height: number,
  ) {}
}
class FakePoint {
  constructor(
    public x: number,
    public y: number,
  ) {}
}

class FakeLatLng {
  constructor(
    private _lat: number,
    private _lng: number,
  ) {}
  lat(): number {
    return this._lat;
  }
  lng(): number {
    return this._lng;
  }
}

type Listener = (...args: unknown[]) => void;

/** Registro a nivel de módulo de instancias creadas — permite assertar "se
 *  crearon N markers" sin acceder a propiedades privadas del componente. */
let createdMaps: FakeMap[] = [];
let createdMarkers: FakeMarker[] = [];
let createdInfoWindows: FakeInfoWindow[] = [];

class FakeMap {
  center: { lat: number; lng: number };
  zoom: number;
  styles: unknown;
  listeners: Record<string, Listener[]> = {};
  /** Indexable por ControlPosition.* con .push(), como el real google.maps.Map.controls. */
  controls = new Proxy({} as Record<string, HTMLElement[]>, {
    get: (target, key: string) => (target[key] ??= []),
  });

  constructor(
    _el: HTMLElement,
    opts: { center: { lat: number; lng: number }; zoom: number; styles?: unknown },
  ) {
    this.center = opts.center;
    this.zoom = opts.zoom;
    this.styles = opts.styles;
    createdMaps.push(this);
  }

  addListener(event: string, cb: Listener) {
    (this.listeners[event] ??= []).push(cb);
    return { remove: () => undefined };
  }

  /** Dispara manualmente un listener registrado (p. ej. 'idle' para ejercitar syncViewport). */
  trigger(event: string, ...args: unknown[]) {
    (this.listeners[event] ?? []).forEach((cb) => cb(...args));
  }

  setOptions(opts: { styles?: unknown }) {
    this.styles = opts.styles;
  }
  panTo(latLng: { lat: number; lng: number }) {
    this.center = latLng;
  }
  setZoom(zoom: number) {
    this.zoom = zoom;
  }
  getCenter() {
    return new FakeLatLng(this.center.lat, this.center.lng);
  }
  getZoom() {
    return this.zoom;
  }
}

class FakeMarker {
  position: unknown;
  map: unknown;
  icon: unknown;
  listeners: Record<string, Listener[]> = {};

  constructor(opts: { position: unknown; map: unknown; icon: unknown }) {
    this.position = opts.position;
    this.map = opts.map;
    this.icon = opts.icon;
    createdMarkers.push(this);
  }

  addListener(event: string, cb: Listener) {
    (this.listeners[event] ??= []).push(cb);
    return { remove: () => undefined };
  }

  trigger(event: string, ...args: unknown[]) {
    (this.listeners[event] ?? []).forEach((cb) => cb(...args));
  }

  setMap(map: unknown) {
    this.map = map;
  }
  setIcon(icon: unknown) {
    this.icon = icon;
  }
}

class FakeInfoWindow {
  content: unknown;
  opened = false;
  lastOpenOpts: unknown;
  constructor() {
    createdInfoWindows.push(this);
  }
  setContent(html: unknown) {
    this.content = html;
  }
  open(opts: unknown) {
    this.opened = true;
    this.lastOpenOpts = opts;
  }
  close() {
    this.opened = false;
  }
}

const clearInstanceListeners = vi.fn();
const originalGoogle = (window as unknown as { google?: unknown }).google;

function installGoogleMapsStub(): void {
  createdMaps = [];
  createdMarkers = [];
  createdInfoWindows = [];
  clearInstanceListeners.mockClear();
  (window as unknown as { google: unknown }).google = {
    maps: {
      Size: FakeSize,
      Point: FakePoint,
      LatLng: FakeLatLng,
      Map: FakeMap,
      Marker: FakeMarker,
      InfoWindow: FakeInfoWindow,
      ControlPosition: { RIGHT_BOTTOM: 'RIGHT_BOTTOM' },
      event: { clearInstanceListeners },
    },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Datos de prueba
// ─────────────────────────────────────────────────────────────────────────────

const MAIN: MainCategory = {
  id: 'main-1',
  name: 'Deportes',
  icon: '🏃',
  color: '#3f51b5',
  subcategories: [
    {
      id: 'sub-1',
      name: 'Ciclismo',
      icon: '🚴',
      mainCategoryId: 'main-1',
      locationTypes: [{ id: 'type-1', name: 'Quedadas', description: '', subcategoryId: 'sub-1' }],
    },
  ],
};

const BREADCRUMB: CategoryBreadcrumb = {
  mainCategory: MAIN,
  subCategory: MAIN.subcategories[0],
  locationType: MAIN.subcategories[0].locationTypes[0],
};

const LOCATIONS: MapLocation[] = [
  { id: 'loc-1', name: 'Ruta en bici', locationTypeId: 'type-1', lat: 40.4, lng: -3.7, visibility: 'PUBLIC' },
  { id: 'loc-2', name: 'Quedada MTB', locationTypeId: 'type-1', lat: 40.5, lng: -3.8, visibility: 'PUBLIC' },
];

const USER: MapItUser = {
  id: 'u1',
  name: 'Ana',
  nick: 'ana',
  email: 'ana@example.com',
  userType: 'individual',
  level: 0,
  xp: 0,
  unlockedCapabilities: [],
};

describe('MapsPageComponent', () => {
  let fixture: ComponentFixture<MapsPageComponent>;
  let component: MapsPageComponent;
  let darkSignal: ReturnType<typeof signal<boolean>>;
  let responsiveState: ResponsiveState;
  let mapViewport: {
    resolveInitialViewport: ReturnType<typeof vi.fn>;
    setViewport: ReturnType<typeof vi.fn>;
  };
  let deviceLocation: {
    isTouchPrimaryDevice: ReturnType<typeof vi.fn>;
    getCurrentPosition: ReturnType<typeof vi.fn>;
  };
  let locationService: { getAll: ReturnType<typeof vi.fn> };
  let categoryService: {
    getAll: ReturnType<typeof vi.fn>;
    resolveColor: ReturnType<typeof vi.fn>;
    resolveIcon: ReturnType<typeof vi.fn>;
    resolveBreadcrumb: ReturnType<typeof vi.fn>;
    getLocationTypeById: ReturnType<typeof vi.fn>;
    getSubCategoryById: ReturnType<typeof vi.fn>;
    getMainCategoryById: ReturnType<typeof vi.fn>;
  };
  let publicationService: {
    enroll: ReturnType<typeof vi.fn>;
    unenroll: ReturnType<typeof vi.fn>;
    requestAccess: ReturnType<typeof vi.fn>;
    getEnrollments: ReturnType<typeof vi.fn>;
    getById: ReturnType<typeof vi.fn>;
  };
  let dialog: { open: ReturnType<typeof vi.fn> };
  let geoIpService: { resolveCenter: ReturnType<typeof vi.fn> };
  let snackBar: { open: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    installGoogleMapsStub();

    darkSignal = signal(false);
    responsiveState = {
      deviceClass: 'desktop',
      isMobile: false,
      isTablet: false,
      isDesktop: true,
      isPortrait: false,
      isLandscape: true,
      width: 1280,
      height: 800,
      hasHover: true,
      pointerCoarse: false,
    };
    mapViewport = {
      resolveInitialViewport: vi.fn().mockReturnValue(of({ lat: 40.0, lng: -3.7, zoom: 12 })),
      setViewport: vi.fn(),
    };
    deviceLocation = {
      isTouchPrimaryDevice: vi.fn().mockReturnValue(false),
      getCurrentPosition: vi.fn().mockReturnValue(of({ lat: 41.0, lng: -4.0 })),
    };
    locationService = { getAll: vi.fn().mockReturnValue(of(LOCATIONS)) };
    categoryService = {
      getAll: vi.fn().mockReturnValue(of([MAIN])),
      resolveColor: vi.fn().mockReturnValue('#3f51b5'),
      resolveIcon: vi.fn().mockReturnValue('🚴'),
      resolveBreadcrumb: vi.fn().mockReturnValue(BREADCRUMB),
      // Consumidos indirectamente por LocationFieldService (real, inyectado dentro de
      // PublicationDetailComponent) al no encontrar un schema directo para 'type-1'.
      getLocationTypeById: vi.fn().mockReturnValue(undefined),
      getSubCategoryById: vi.fn().mockReturnValue(undefined),
      getMainCategoryById: vi.fn().mockReturnValue(undefined),
    };
    publicationService = {
      enroll: vi.fn(),
      unenroll: vi.fn(),
      requestAccess: vi.fn(),
      getEnrollments: vi.fn().mockReturnValue(of([])),
      getById: vi.fn(),
    };
    dialog = { open: vi.fn() };
    geoIpService = {
      resolveCenter: vi.fn().mockReturnValue(
        of({ lat: 40.4, lng: -3.7, city: null, country: null, resolvedIp: '', source: 'fallback' }),
      ),
    };
    snackBar = { open: vi.fn() };

    await TestBed.configureTestingModule({
      imports: [MapsPageComponent],
      providers: [
        { provide: LocationService, useValue: locationService },
        { provide: CategoryService, useValue: categoryService },
        { provide: MatDialog, useValue: dialog },
        { provide: GeoIpService, useValue: geoIpService },
        { provide: MapViewportService, useValue: mapViewport },
        { provide: DeviceLocationService, useValue: deviceLocation },
        { provide: PublicationService, useValue: publicationService },
        { provide: ResponsiveService, useValue: { state: () => responsiveState } },
        { provide: MatSnackBar, useValue: snackBar },
        { provide: ThemeService, useValue: { isDark: darkSignal.asReadonly() } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(MapsPageComponent);
    component = fixture.componentInstance;
    TestBed.inject(CurrentUserService).clear();
  });

  afterEach(() => {
    // Destruir explícitamente ANTES de restaurar window.google: el ngOnDestroy real del
    // componente llama a google.maps.event.clearInstanceListeners, y el teardown automático
    // de TestBed (registrado aparte) también destruye la fixture — si el stub ya no está
    // montado en ese punto, ngOnDestroy revienta con "Cannot read properties of undefined".
    fixture.destroy();
    (window as unknown as { google?: unknown }).google = originalGoogle;
    document.querySelectorAll('script[src*="maps.googleapis.com"]').forEach((el) => el.remove());
  });

  // ── Filtros de categoría (signals puros, sin detectChanges) ────────────────

  describe('filtros de categoría', () => {
    it('selectMain selecciona una categoría y recalcula visibleSubs', () => {
      component.selectMain(MAIN);

      expect(component.selectedMain()).toEqual(MAIN);
      expect(component.visibleSubs()).toEqual(MAIN.subcategories);
    });

    it('selectMain con la misma categoría ya seleccionada la deselecciona', () => {
      component.selectMain(MAIN);
      component.selectMain(MAIN);

      expect(component.selectedMain()).toBeNull();
      expect(component.visibleSubs()).toEqual([]);
    });

    it('selectMain resetea selectedSub y selectedTypeId', () => {
      component.selectMain(MAIN);
      TestBed.inject(CurrentUserService).setUser(USER);
      component.selectSub(MAIN.subcategories[0]);
      component.selectType('type-1');

      component.selectMain(MAIN); // deselecciona
      component.selectMain(MAIN); // vuelve a seleccionar

      expect(component.selectedSub()).toBeNull();
      expect(component.selectedTypeId()).toBeNull();
    });

    it('selectSub sin usuario logueado abre el dialog de auth y no cambia el filtro', () => {
      component.selectMain(MAIN);

      component.selectSub(MAIN.subcategories[0]);

      expect(dialog.open).toHaveBeenCalledTimes(1);
      expect(component.selectedSub()).toBeNull();
    });

    it('selectSub con usuario logueado selecciona la subcategoría y recalcula visibleTypes', () => {
      TestBed.inject(CurrentUserService).setUser(USER);
      component.selectMain(MAIN);

      component.selectSub(MAIN.subcategories[0]);

      expect(component.selectedSub()).toEqual(MAIN.subcategories[0]);
      expect(component.visibleTypes()).toEqual(MAIN.subcategories[0].locationTypes);
      expect(dialog.open).not.toHaveBeenCalled();
    });

    it('selectType selecciona un tipo y colapsa el panel', () => {
      component.panelVisible.set(true);

      component.selectType('type-1');

      expect(component.selectedTypeId()).toBe('type-1');
      expect(component.panelVisible()).toBe(false);
    });

    it('selectType con el mismo tipo ya seleccionado lo deselecciona sin colapsar el panel', () => {
      component.selectType('type-1');
      component.panelVisible.set(true);

      component.selectType('type-1');

      expect(component.selectedTypeId()).toBeNull();
      expect(component.panelVisible()).toBe(true);
    });

    it('clearFilters resetea los tres niveles de selección', () => {
      TestBed.inject(CurrentUserService).setUser(USER);
      component.selectMain(MAIN);
      component.selectSub(MAIN.subcategories[0]);
      component.selectType('type-1');

      component.clearFilters();

      expect(component.selectedMain()).toBeNull();
      expect(component.selectedSub()).toBeNull();
      expect(component.selectedTypeId()).toBeNull();
    });
  });

  // ── Arranque del mapa (ngAfterViewInit) ─────────────────────────────────────

  describe('arranque del mapa', () => {
    it('crea el mapa con el viewport resuelto y carga categorías/localizaciones', async () => {
      fixture.detectChanges();
      await fixture.whenStable();

      expect(createdMaps).toHaveLength(1);
      expect(createdMaps[0].center).toEqual({ lat: 40.0, lng: -3.7 });
      expect(createdMaps[0].zoom).toBe(12);
      expect(component.categories()).toEqual([MAIN]);
      expect(createdMarkers).toHaveLength(2);
    });

    it('en dispositivo táctil primario añade el control nativo "Usar mi ubicación"', async () => {
      deviceLocation.isTouchPrimaryDevice.mockReturnValue(true);

      fixture.detectChanges();
      await fixture.whenStable();

      expect(createdMaps[0].controls['RIGHT_BOTTOM']).toHaveLength(1);
    });

    it('en dispositivo no táctil no añade el control nativo', async () => {
      fixture.detectChanges();
      await fixture.whenStable();

      expect(createdMaps[0].controls['RIGHT_BOTTOM']).toHaveLength(0);
    });

    it('suscribe el listener idle del mapa para mantener el viewport sincronizado', async () => {
      fixture.detectChanges();
      await fixture.whenStable();

      expect(createdMaps[0].listeners['idle']).toHaveLength(1);
    });
  });

  // ── renderMarkers ────────────────────────────────────────────────────────

  describe('renderMarkers', () => {
    it('pinta un marker por localización con color resuelto por CategoryService', async () => {
      fixture.detectChanges();
      await fixture.whenStable();

      expect(categoryService.resolveColor).toHaveBeenCalledWith('type-1');
      expect(createdMarkers).toHaveLength(2);
      expect(createdMarkers[0].position).toEqual({ lat: 40.4, lng: -3.7 });
      expect(createdMarkers[0].map).toBe(createdMaps[0]);
    });

    it('un re-render (p. ej. al filtrar) limpia los markers anteriores', async () => {
      fixture.detectChanges();
      await fixture.whenStable();
      const firstBatch = [...createdMarkers];
      clearInstanceListeners.mockClear();

      component.selectMain(MAIN); // dispara applyFilter -> renderMarkers de nuevo

      firstBatch.forEach((m) => expect(clearInstanceListeners).toHaveBeenCalledWith(m));
      firstBatch.forEach((m) => expect(m.map).toBeNull());
    });

    it('filtrar por tipo solo re-pinta las localizaciones de ese tipo', async () => {
      const otherTypeLocation: MapLocation = {
        id: 'loc-3',
        name: 'Museo',
        locationTypeId: 'type-other',
        lat: 40.6,
        lng: -3.9,
        visibility: 'PUBLIC',
      };
      locationService.getAll.mockReturnValue(of([...LOCATIONS, otherTypeLocation]));

      fixture.detectChanges();
      await fixture.whenStable();
      expect(createdMarkers).toHaveLength(3); // sin filtro: las 3 localizaciones

      component.selectType('type-1');

      const visible = createdMarkers.filter((m) => m.map === createdMaps[0]);
      expect(visible).toHaveLength(2); // solo las 2 de 'type-1'
    });
  });

  // ── ngOnDestroy ──────────────────────────────────────────────────────────
  // El propio comentario de maps.ts explicita que esta limpieza evita una fuga de memoria
  // real: la página se destruye/recrea cada vez que el usuario navega fuera y vuelve (ruta
  // lazy, no singleton), y google.maps.event no libera los listeners solo con perder la
  // referencia del objeto.

  describe('ngOnDestroy', () => {
    it('limpia los listeners del mapa y de cada marker, y cierra el InfoWindow', async () => {
      fixture.detectChanges();
      await fixture.whenStable();
      const map = createdMaps[0];
      const markers = [...createdMarkers];
      const infoWindow = createdInfoWindows[0];
      clearInstanceListeners.mockClear();

      fixture.destroy();

      expect(clearInstanceListeners).toHaveBeenCalledWith(map);
      markers.forEach((m) => expect(clearInstanceListeners).toHaveBeenCalledWith(m));
      expect(infoWindow.opened).toBe(false);
    });

    it('sin haber llegado a crear el mapa (sin detectChanges), no lanza ningún error', () => {
      expect(() => fixture.destroy()).not.toThrow();
      expect(clearInstanceListeners).not.toHaveBeenCalled();
    });
  });

  // ── Click en marker → detalle (openLocationDetail, rama hover) ─────────────

  describe('click en marker (rama hover)', () => {
    it('mouseover abre el InfoWindow con el tooltip de la localización', async () => {
      fixture.detectChanges();
      await fixture.whenStable();

      createdMarkers[0].trigger('mouseover');

      const infoWindow = createdInfoWindows[0];
      expect(infoWindow.opened).toBe(true);
      expect(String(infoWindow.content)).toContain('Ruta en bici');
    });

    it('mouseout cierra el InfoWindow', async () => {
      fixture.detectChanges();
      await fixture.whenStable();
      createdMarkers[0].trigger('mouseover');

      createdMarkers[0].trigger('mouseout');

      expect(createdInfoWindows[0].opened).toBe(false);
    });

    it('click sin usuario logueado abre el dialog de auth y no puebla el detalle', async () => {
      fixture.detectChanges();
      await fixture.whenStable();

      createdMarkers[0].trigger('click');

      expect(dialog.open).toHaveBeenCalledTimes(1);
      expect(component.selectedDetail()).toBeNull();
    });

    it('click con usuario logueado carga enrollments y puebla selectedDetail/selectedBreadcrumb', async () => {
      TestBed.inject(CurrentUserService).setUser(USER);
      publicationService.getEnrollments.mockReturnValue(
        of([{ userId: 'other', userName: 'Otro', enrolledAt: '2026-01-01' }]),
      );
      fixture.detectChanges();
      await fixture.whenStable();

      createdMarkers[0].trigger('click');

      expect(publicationService.getEnrollments).toHaveBeenCalledWith('loc-1');
      expect(component.selectedDetail()?.id).toBe('loc-1');
      expect(component.selectedDetail()?.enrolledUsers).toEqual([
        { userId: 'other', userName: 'Otro', enrolledAt: '2026-01-01' },
      ]);
      expect(component.selectedBreadcrumb()).toEqual(BREADCRUMB);
    });

    it('publicación privada sin acceso: puebla el detalle sin pedir enrollments', async () => {
      const privateLocation: MapLocation = {
        ...LOCATIONS[0],
        visibility: 'PRIVATE',
        hasAccess: false,
      };
      locationService.getAll.mockReturnValue(of([privateLocation]));
      TestBed.inject(CurrentUserService).setUser(USER);
      fixture.detectChanges();
      await fixture.whenStable();

      createdMarkers[0].trigger('click');

      expect(publicationService.getEnrollments).not.toHaveBeenCalled();
      expect(component.selectedDetail()?.id).toBe('loc-1');
    });
  });

  // ── Rama táctil de markers (attachPressHandlers, hasHover: false) ──────────
  // Un dispositivo sin hover real nunca dispara mouseover/mouseout de escritorio: el gesto
  // equivalente es pulsación corta (tooltip) / pulsación larga >= 1000ms (detalle).

  describe('rama táctil de markers (sin hover)', () => {
    beforeEach(async () => {
      responsiveState = { ...responsiveState, hasHover: false };
      TestBed.inject(CurrentUserService).setUser(USER);
      fixture.detectChanges();
      await fixture.whenStable();
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('pulsación corta (< 1000ms) abre el tooltip y no abre el detalle', () => {
      const marker = createdMarkers[0];

      marker.trigger('mousedown');
      vi.advanceTimersByTime(200);
      marker.trigger('mouseup');

      expect(component.selectedDetail()).toBeNull();
      expect(createdInfoWindows[0].opened).toBe(true);
    });

    it('pulsación larga (>= 1000ms) abre el detalle y no dispara el tooltip de pulsación corta', () => {
      const marker = createdMarkers[0];

      marker.trigger('mousedown');
      vi.advanceTimersByTime(1000);

      expect(component.selectedDetail()?.id).toBe('loc-1');

      // El mouseup posterior al long-press ya no debe reabrir el tooltip.
      createdInfoWindows[0].close();
      marker.trigger('mouseup');
      expect(createdInfoWindows[0].opened).toBe(false);
    });

    it('mouseout durante la pulsación cancela el temporizador (no abre el detalle)', () => {
      const marker = createdMarkers[0];

      marker.trigger('mousedown');
      vi.advanceTimersByTime(500);
      marker.trigger('mouseout');
      vi.advanceTimersByTime(600);

      expect(component.selectedDetail()).toBeNull();
    });

    it('el listener click del marker corta la propagación del click sintetizado por el navegador', () => {
      const marker = createdMarkers[0];
      const stopPropagation = vi.fn();

      marker.trigger('click', { domEvent: { stopPropagation } });

      expect(stopPropagation).toHaveBeenCalledTimes(1);
    });
  });

  // ── Geolocalización ("Usar mi ubicación") ───────────────────────────────────
  // Solo alcanzable a través del control nativo (real, GoogleMapsService.buildMyLocationControl),
  // que solo se añade al mapa cuando isTouchPrimaryDevice() es true.

  describe('"Usar mi ubicación"', () => {
    async function renderWithLocationControl(): Promise<HTMLButtonElement> {
      deviceLocation.isTouchPrimaryDevice.mockReturnValue(true);
      fixture.detectChanges();
      await fixture.whenStable();
      return createdMaps[0].controls['RIGHT_BOTTOM'][0] as HTMLButtonElement;
    }

    it('centra el mapa en la posición real del dispositivo con zoom 15', async () => {
      const button = await renderWithLocationControl();

      button.click();

      expect(createdMaps[0].center).toEqual({ lat: 41.0, lng: -4.0 });
      expect(createdMaps[0].zoom).toBe(15);
      expect(component.locating()).toBe(false);
    });

    it('permiso denegado: cae al fallback por IP con zoom 12', async () => {
      deviceLocation.getCurrentPosition.mockReturnValue(
        throwError(() => ({ code: 'PERMISSION_DENIED' })),
      );
      const button = await renderWithLocationControl();

      button.click();

      expect(geoIpService.resolveCenter).toHaveBeenCalled();
      expect(createdMaps[0].center).toEqual({ lat: 40.4, lng: -3.7 });
      expect(createdMaps[0].zoom).toBe(12);
    });

    it('error distinto de permiso denegado muestra un snackbar y no cae al fallback por IP', async () => {
      deviceLocation.getCurrentPosition.mockReturnValue(throwError(() => ({ code: 'TIMEOUT' })));
      const button = await renderWithLocationControl();

      button.click();

      expect(geoIpService.resolveCenter).not.toHaveBeenCalled();
      expect(component.locating()).toBe(false);
    });

    it('una segunda pulsación mientras la primera está en curso no dispara una nueva petición', async () => {
      // getCurrentPosition que nunca emite, para simular una petición todavía en vuelo.
      deviceLocation.getCurrentPosition.mockReturnValue(new Observable(() => undefined));
      const button = await renderWithLocationControl();

      button.click();
      expect(component.locating()).toBe(true);
      button.click();

      expect(deviceLocation.getCurrentPosition).toHaveBeenCalledTimes(1);
    });
  });

  // ── syncViewport (listener idle del mapa) ───────────────────────────────────

  describe('syncViewport', () => {
    it('el evento idle del mapa vuelca centro/zoom al MapViewportService', async () => {
      fixture.detectChanges();
      await fixture.whenStable();

      createdMaps[0].panTo({ lat: 41.5, lng: -3.9 });
      createdMaps[0].setZoom(14);
      createdMaps[0].trigger('idle');

      expect(mapViewport.setViewport).toHaveBeenCalledWith({ lat: 41.5, lng: -3.9 }, 14);
    });
  });

  // ── Join / leave / solicitud de acceso ──────────────────────────────────────
  // Sin google.maps en absoluto: se puebla selectedDetail directamente para aislar la
  // lógica de negocio del renderizado (no requiere detectChanges/ngAfterViewInit).

  describe('join / leave / solicitud de acceso', () => {
    function openDetail(overrides: Partial<PublicationDetailInput> = {}) {
      component.selectedDetail.set({
        id: 'loc-1',
        name: 'Ruta en bici',
        locationTypeId: 'type-1',
        visibility: 'PUBLIC',
        ...overrides,
      });
    }

    describe('joinSelectedLocation', () => {
      it('sin usuario logueado abre el dialog de auth y no llama a enroll', () => {
        openDetail();

        component.joinSelectedLocation();

        expect(dialog.open).toHaveBeenCalledTimes(1);
        expect(publicationService.enroll).not.toHaveBeenCalled();
      });

      it('con aforo lleno, aborta sin llamar a enroll', () => {
        TestBed.inject(CurrentUserService).setUser(USER);
        openDetail({ metadata: { slots: 2 } });
        // getJoinedCount lee joinedByLocation() (estado de sesión), no detail.occupiedSlots —
        // se puebla normalmente desde loadLocations(), aquí a mano por estar aislado del mapa.
        component.joinedByLocation.set({ 'loc-1': 2 });

        component.joinSelectedLocation();

        expect(publicationService.enroll).not.toHaveBeenCalled();
      });

      it('éxito actualiza joinedByLocation/joinedByUserAndLocation y recarga enrollments', () => {
        TestBed.inject(CurrentUserService).setUser(USER);
        publicationService.enroll.mockReturnValue(
          of({ publicationId: 'loc-1', userId: 'u1', occupiedSlots: 1, maxSlots: null, full: false }),
        );
        openDetail();

        component.joinSelectedLocation();

        expect(component.joinedByLocation()['loc-1']).toBe(1);
        expect(component.hasJoined('loc-1')).toBe(true);
        expect(publicationService.getEnrollments).toHaveBeenCalledWith('loc-1');
      });

      it('ya apuntado (hasJoined), aborta sin volver a llamar a enroll', () => {
        TestBed.inject(CurrentUserService).setUser(USER);
        publicationService.enroll.mockReturnValue(
          of({ publicationId: 'loc-1', userId: 'u1', occupiedSlots: 1, maxSlots: null, full: false }),
        );
        openDetail();
        component.joinSelectedLocation();
        publicationService.enroll.mockClear();

        component.joinSelectedLocation();

        expect(publicationService.enroll).not.toHaveBeenCalled();
      });
    });

    describe('requestAccessToSelectedLocation', () => {
      it('éxito marca la solicitud como pendiente y muestra un snackbar', () => {
        TestBed.inject(CurrentUserService).setUser(USER);
        publicationService.requestAccess.mockReturnValue(
          of({
            id: 'req-1', publicationId: 'loc-1', publicationTitle: 'Ruta en bici',
            requestedByUserId: 'u1', requestedByName: 'Ana', requestedByNick: 'ana',
            status: 'pending', createdAt: '2026-01-01',
          }),
        );
        openDetail({ visibility: 'PRIVATE', hasAccess: false });

        component.requestAccessToSelectedLocation();

        expect(component.accessRequestedByLocation()['loc-1']).toBe(true);
        expect(component.selectedDetail()?.accessRequestPending).toBe(true);
        expect(snackBar.open).toHaveBeenCalledTimes(1);
      });

      it('error ALREADY_REQUESTED marca la solicitud como pendiente igualmente', () => {
        TestBed.inject(CurrentUserService).setUser(USER);
        publicationService.requestAccess.mockReturnValue(
          throwError(() => ({ error: { error: { code: 'ALREADY_REQUESTED' } } })),
        );
        openDetail({ visibility: 'PRIVATE', hasAccess: false });

        component.requestAccessToSelectedLocation();

        expect(component.accessRequestedByLocation()['loc-1']).toBe(true);
        expect(component.selectedDetail()?.accessRequestPending).toBe(true);
      });

      it('error ALREADY_HAS_ACCESS recarga el detalle completo', () => {
        TestBed.inject(CurrentUserService).setUser(USER);
        publicationService.requestAccess.mockReturnValue(
          throwError(() => ({ error: { error: { code: 'ALREADY_HAS_ACCESS' } } })),
        );
        publicationService.getById.mockReturnValue(
          of({ id: 'loc-1', title: 'Ruta en bici', hasAccess: true } as never),
        );
        openDetail({ visibility: 'PRIVATE', hasAccess: false });

        component.requestAccessToSelectedLocation();

        expect(publicationService.getById).toHaveBeenCalledWith('loc-1');
        expect(component.selectedDetail()?.hasAccess).toBe(true);
      });
    });

    describe('leaveSelectedLocation', () => {
      it('éxito decrementa el contador y limpia joinedByUserAndLocation', () => {
        TestBed.inject(CurrentUserService).setUser(USER);
        publicationService.unenroll.mockReturnValue(of(undefined));
        openDetail({ occupiedSlots: 1 });
        component.joinedByLocation.set({ 'loc-1': 1 });
        component.joinedByUserAndLocation.set({ 'u1:loc-1': true });

        component.leaveSelectedLocation();

        expect(component.joinedByLocation()['loc-1']).toBe(0);
        expect(component.hasJoined('loc-1')).toBe(false);
        expect(publicationService.getEnrollments).toHaveBeenCalledWith('loc-1');
      });
    });
  });
});
