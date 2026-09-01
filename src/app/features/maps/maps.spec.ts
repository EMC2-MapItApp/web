import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { of } from 'rxjs';
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

    await TestBed.configureTestingModule({
      imports: [MapsPageComponent],
      providers: [
        { provide: LocationService, useValue: locationService },
        { provide: CategoryService, useValue: categoryService },
        { provide: MatDialog, useValue: dialog },
        {
          provide: GeoIpService,
          useValue: {
            resolveCenter: vi.fn().mockReturnValue(
              of({ lat: 40.4, lng: -3.7, city: null, country: null, resolvedIp: '', source: 'fallback' }),
            ),
          },
        },
        { provide: MapViewportService, useValue: mapViewport },
        { provide: DeviceLocationService, useValue: deviceLocation },
        { provide: PublicationService, useValue: publicationService },
        { provide: ResponsiveService, useValue: { state: () => responsiveState } },
        { provide: MatSnackBar, useValue: { open: vi.fn() } },
        { provide: ThemeService, useValue: { isDark: darkSignal.asReadonly() } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(MapsPageComponent);
    component = fixture.componentInstance;
    TestBed.inject(CurrentUserService).clear();
  });

  afterEach(() => {
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
});
