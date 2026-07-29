import { AfterViewInit, Component, ElementRef, ViewChild, inject, signal, computed, effect } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { GoogleMapsService } from '@core/services/google-maps.service';
import { LocationService } from '@core/services/location.service';
import { CategoryService } from '@core/services/category.service';
import { MapLocation } from '@core/models/location.model';
import { MainCategory, SubCategory } from '@core/models/category.model';
import { MapSettingsService } from '@core/services/map-settings.service';
import { PublicationDetailInput, PublicationDetailComponent } from './publication-detail/publication-detail';
import { CategoryBreadcrumb } from '@core/models/category.model';
import { FieldContext } from '@core/models/location-field.model';
import { CurrentUserService } from '@core/services/current-user.service';
import { AuthRequiredDialogComponent } from '@shared/auth-required-dialog/auth-required-dialog';
import { AUTH_REQUIRED_DIALOG_CONFIG, withResponsiveDialogLayout } from '@core/constants/dialog.constants';
import { ThemeService } from '@core/services/theme.service';
import { GeoIpService } from '@core/services/geo-ip.service';
import { DeviceLocationService } from '@core/services/device-location.service';
import { PublicationService } from '@core/services/publication.service';
import { HttpErrorResponse } from '@angular/common/http';
import { ResponsiveService } from '@core/responsive/responsive.service';


/**
 * Componente de la página de mapas.
 *
 * @remarks
 * Carga la API de Google Maps, obtiene las localizaciones del {@link LocationService}
 * y renderiza un marker por cada una con el color de su categoría principal.
 *
 * Dispone de un panel de filtros lateral que permite al usuario filtrar los markers
 * por categoría principal, subcategoría y tipo de localización.
 */
@Component({
  selector: 'app-maps-page',
  standalone: true,
  imports: [MatIconModule, MatButtonModule, PublicationDetailComponent],
  templateUrl: './maps.html',
  styleUrl: './maps.scss'
})
export class MapsPageComponent implements AfterViewInit {

  /** Umbral de pulsación larga (táctil) para abrir el detalle de un POI, en ms. */
  private static readonly LONG_PRESS_MS = 1000;

  // ── Servicios ──────────────────────────────────────────────────────────────
  private mapsService = inject(GoogleMapsService);
  private mapSettingsService = inject(MapSettingsService);
  private locationService = inject(LocationService);
  readonly categoryService = inject(CategoryService);
  private currentUser = inject(CurrentUserService);
  private dialog = inject(MatDialog);
  private geoIpService = inject(GeoIpService);
  private deviceLocationService = inject(DeviceLocationService);
  private publicationService = inject(PublicationService);
  private responsiveService = inject(ResponsiveService);
  private snackBar = inject(MatSnackBar);

  // ── Propiedades ──────────────────────────────────────────────────────────────

  private themeService = inject(ThemeService);
  private currentLocations: MapLocation[] = [];  // track para re-render en cambio de tema


  // ── Estado del panel de filtros ───────────────────────────────────────────
  /** Árbol de categorías cargado desde el servicio. */
  categories = signal<MainCategory[]>([]);

  /** Categoría principal actualmente seleccionada (null = todas). */
  selectedMain = signal<MainCategory | null>(null);

  /** Subcategoría actualmente seleccionada (null = todas las de la categoría principal). */
  selectedSub = signal<SubCategory | null>(null);

  /** Id del tipo de localización seleccionado (null = todos). */
  selectedTypeId = signal<number | null>(null);

  /** Subcategorías visibles según la categoría principal elegida. */
  visibleSubs = computed(() => this.selectedMain()?.subcategories ?? []);

  /** Tipos visibles según la subcategoría elegida. */
  visibleTypes = computed(() => this.selectedSub()?.locationTypes ?? []);

  // Panel colapsado reactivo: se recalcula cuando el usuario cambia (login/logout)
  panelVisible = signal(this.resolveInitialPanelVisibility());

  /** Alterna la visibilidad del panel de categorías. */
  togglePanel(): void {
    this.panelVisible.update(v => !v);
  }

  /** Cierra el panel de categorías cuando se toca fuera de él. */
  closePanel(): void {
    this.panelVisible.set(false);
  }

  /**
   * Cierra categorías al pulsar fuera del panel, ignorando controles
   * interactivos (botones, enlaces y controles del mapa).
   */
  handleOutsidePanelClick(event: MouseEvent): void {
    const target = event.target as HTMLElement | null;
    if (!target) return;

    // Si el clic fue en el panel de filtros o controles interactivos, ignora
    if (target.closest('.filter-panel')) return;
    if (target.closest('button, a, input, select, textarea, [role="button"], [role="menuitem"], .gm-control-active')) {
      return;
    }

    // Si el clic fue dentro del detail-panel, ignora (stopPropagation no aplica siempre)
    if (target.closest('.detail-panel')) return;

    // Cierra el panel de filtros si está visible
    if (this.panelVisible()) {
      this.closePanel();
    }

    // Cierra el panel de detalle si está abierto
    if (this.selectedDetail()) {
      this.closeDetail();
    }
  }

  /** Determina si el viewport actual corresponde a mobile/tablet. */
  private isCompactViewport(): boolean {
    const state = this.responsiveService.state();
    return state.isMobile || state.isTablet;
  }

  /** Estado inicial del panel en funcion de viewport y perfil de usuario. */
  private resolveInitialPanelVisibility(): boolean {
    if (this.isCompactViewport()) return false;
    return !this.currentUser.isIndividual();
  }

  // ── Estado del mapa ────────────────────────────────────────────────────────
  /** Referencia al contenedor DOM del mapa. */
  @ViewChild('mapContainer', { static: true })
  mapContainer!: ElementRef<HTMLDivElement>;

  private map!: google.maps.Map;
  private infoWindow!: google.maps.InfoWindow;
  private allLocations: MapLocation[] = [];
  private markers: google.maps.Marker[] = [];

  /** Botón nativo "Usar mi ubicación", guardado para reflejar el estado de carga. */
  private locationControlButton?: HTMLButtonElement;

  /** true mientras hay una resolución de posición del dispositivo en vuelo. */
  locating = signal(false);


  // ── Estado del panel de detalle ───────────────────────────────────────────
  /** Localización seleccionada al hacer click en un marker. null = panel cerrado. */
  selectedDetail = signal<PublicationDetailInput | null>(null);

  /** Breadcrumb de la localización seleccionada. */
  selectedBreadcrumb = signal<CategoryBreadcrumb | null>(null);

  /** Contexto del panel de detalle. */
  selectedContext = signal<FieldContext>('place');

  /** Número de usuarios apuntados por localización (estado de sesión en cliente). */
  joinedByLocation = signal<Record<number, number>>({});

  /** Marca de apuntado por combinación usuario+localización (estado de sesión). */
  joinedByUserAndLocation = signal<Record<string, true>>({});

  /** Cierra el panel de detalle. */
  closeDetail(): void {
    this.selectedDetail.set(null);
  }

  /** Devuelve cuántos usuarios están apuntados en la localización indicada. */
  getJoinedCount(locationId: number): number {
    const fromState = this.joinedByLocation()[locationId];
    if (typeof fromState === 'number') return fromState;
    const location = this.allLocations.find(l => l.id === locationId);
    return location?.occupiedSlots ?? 0;
  }

  /** Indica si el usuario actual ya está apuntado a una localización. */
  hasJoined(locationId: number): boolean {
    return !!this.joinedByUserAndLocation()[this.buildJoinKey(locationId)];
  }

  /** Registra en backend el apuntado del detalle abierto respetando el máximo de plazas. */
  joinSelectedLocation(): void {
    if (!this.requireAuth()) return;

    const detail = this.selectedDetail();
    if (!detail) return;

    if (this.hasJoined(detail.id)) return;

    const current = this.getJoinedCount(detail.id);
    const maxSlots = this.resolveMaxSlots(detail);

    if (maxSlots !== null && current >= maxSlots) return;

    this.publicationService.enroll(detail.id).subscribe({
      next: response => {
        this.joinedByLocation.update(prev => ({
          ...prev,
          [detail.id]: response.occupiedSlots,
        }));

        this.joinedByUserAndLocation.update(prev => ({
          ...prev,
          [this.buildJoinKey(detail.id)]: true,
        }));
        // Recargar apuntados
        this.publicationService.getEnrollments(detail.id).subscribe(users => {
          this.selectedDetail.update(d => d ? { ...d, enrolledUsers: users } : null);
        });
      },
      error: (error: HttpErrorResponse) => {
        const message = error?.error?.error?.message ?? '';
        if (typeof message === 'string' && message.toLowerCase().includes('ya estás apuntado')) {
          this.joinedByUserAndLocation.update(prev => ({
            ...prev,
            [this.buildJoinKey(detail.id)]: true,
          }));
        }
      },
    });
  }

  /** Construye una clave estable de apuntado por usuario y localización. */
  private buildJoinKey(locationId: number): string {
    const userId = this.currentUser.user()?.id;
    return `${userId ?? 'anon'}:${locationId}`;
  }

  /** Extrae el máximo de plazas desde metadata.slots cuando está disponible. */
  private resolveMaxSlots(detail: PublicationDetailInput): number | null {
    const raw = detail.metadata?.['slots'];
    if (typeof raw !== 'number' || !Number.isFinite(raw) || raw <= 0) return null;
    return Math.floor(raw);
  }

  // ── Constructor ──────────────────────────────────────────────────────────

  constructor() {
    // effect() DEBE estar aquí: necesita contexto de inyección activo
    effect(() => {
      const styles = this.mapSettingsService.mapStyles();

      if (this.map) this.map.setOptions({ styles });
    });
    // Resetea la visibilidad del panel cuando el estado de usuario cambia
    effect(() => {
      if (this.isCompactViewport()) {
        this.panelVisible.set(false);
        return;
      }

      this.panelVisible.set(!this.currentUser.isIndividual());
    });
    // Se suscribe al cambio de tema y al login/logout (afecta a la animación de los POIs)
    effect(() => {
      this.themeService.isDark();
      this.currentUser.user();
      if (this.map) this.renderMarkers(this.currentLocations);
    });
  }

  /** Abre el dialog de auth si no hay usuario. Retorna true si puede continuar. */
  private requireAuth(): boolean {
    if (this.currentUser.user()) return true;

    const responsiveState = this.responsiveService.state();
    const compactViewport = responsiveState.isMobile || responsiveState.isTablet;
    this.dialog.open(
      AuthRequiredDialogComponent,
      withResponsiveDialogLayout(AUTH_REQUIRED_DIALOG_CONFIG, compactViewport),
    );
    return false;
  }

  // ── Ciclo de vida ──────────────────────────────────────────────────────────

  async ngAfterViewInit(): Promise<void> {
    this.categoryService.getAll().subscribe(cats => this.categories.set(cats));
    await this.mapsService.load();

    // Resolver centro por IP antes de crear el mapa ──────────────
    this.geoIpService.resolveCenter().subscribe(center => {
      this.map = new google.maps.Map(this.mapContainer.nativeElement, {
        center: { lat: center.lat, lng: center.lng },
        zoom: 12,
        styles: this.mapSettingsService.mapStyles(),
      });
      this.infoWindow = new google.maps.InfoWindow({ headerDisabled: true });

      // Control nativo "Usar mi ubicación", solo en dispositivos de input táctil.
      if (this.deviceLocationService.isTouchPrimaryDevice()) {
        const locationControl = this.mapsService.buildMyLocationControl(() => this.useMyLocation());
        this.locationControlButton = locationControl;
        this.map.controls[google.maps.ControlPosition.RIGHT_BOTTOM].push(locationControl);
      }

      // Cargar localizaciones
      this.locationService.getAll().subscribe(locations => {
        this.allLocations = locations;
        const occupancy = locations.reduce<Record<number, number>>((acc, location) => {
          acc[location.id] = location.occupiedSlots ?? 0;
          return acc;
        }, {});
        this.joinedByLocation.set(occupancy);

        const favorites = this.currentUser.favoriteTypeIds();
        if (favorites.length > 0) {
          const filtered = locations.filter(l => favorites.includes(l.locationTypeId));
          this.renderMarkers(filtered.length > 0 ? filtered : locations);
        } else {
          this.renderMarkers(locations);
        }
      });
    });
  }

  /**
   * Centra el mapa en la posición real del dispositivo (GPS/Wi-Fi/celda).
   *
   * @remarks
   * Si el permiso no estaba concedido, `getCurrentPosition()` dispara el diálogo nativo del SO
   * y esta llamada espera su resultado (sin timeout, ver {@link DeviceLocationService}): en caso
   * positivo centra el mapa con la posición real; en caso negativo cae a {@link fallbackToIpLocation}.
   * El spinner (`locating`) solo cubre esta llamada — la acción de geolocalizar en sí — no el
   * fallback por IP posterior, que es una operación aparte y no necesita ese feedback.
   */
  private useMyLocation(): void {
    if (this.locating()) return; // evita dobles pulsaciones que encolarían diálogos del SO

    this.setLocating(true);
    this.deviceLocationService.getCurrentPosition().subscribe({
      next: ({ lat, lng }) => {
        this.setLocating(false);
        this.map.panTo({ lat, lng });
        this.map.setZoom(15);
      },
      error: (error: { code: string }) => {
        this.setLocating(false);

        if (error.code === 'PERMISSION_DENIED') {
          this.fallbackToIpLocation();
          return;
        }

        this.snackBar.open(this.resolveLocationErrorMessage(error.code), 'Cerrar', {
          duration: 4000,
          horizontalPosition: 'center',
          verticalPosition: 'top',
        });
      },
    });
  }

  /**
   * Centra el mapa por IP cuando no se ha concedido el permiso de geolocalización del
   * dispositivo. Se ejecuta ya con el spinner apagado (ver {@link useMyLocation}): no es la
   * acción de geolocalizar, es un fallback aparte.
   */
  private fallbackToIpLocation(): void {
    this.snackBar.open(
      'No se ha concedido acceso a la ubicación del dispositivo. Se usará tu ubicación aproximada por IP, que puede no ser exacta.',
      'Cerrar',
      { duration: 5000, horizontalPosition: 'center', verticalPosition: 'top' },
    );

    this.geoIpService.resolveCenter().subscribe(center => {
      this.map.panTo({ lat: center.lat, lng: center.lng });
      this.map.setZoom(12);
    });
  }

  /** Refleja el estado de localización en curso en el signal y en el control nativo del mapa. */
  private setLocating(value: boolean): void {
    this.locating.set(value);
    this.locationControlButton?.classList.toggle('is-locating', value);
    this.locationControlButton?.toggleAttribute('disabled', value);
  }

  /** Traduce un código de error de geolocalización (no achacable a permiso) a un mensaje legible. */
  private resolveLocationErrorMessage(code: string): string {
    switch (code) {
      case 'TIMEOUT':
      case 'POSITION_UNAVAILABLE':
        return 'No se pudo obtener tu ubicación. Inténtalo de nuevo.';
      default:
        return 'Tu navegador no soporta geolocalización.';
    }
  }

  // ── Filtros ────────────────────────────────────────────────────────────────

  /** Selecciona / deselecciona una categoría principal. */
  selectMain(cat: MainCategory): void {
    const isSame = this.selectedMain()?.id === cat.id;
    this.selectedMain.set(isSame ? null : cat);
    this.selectedSub.set(null);
    this.selectedTypeId.set(null);
    this.applyFilter();
  }

  /** Selecciona / deselecciona una subcategoría. */
  selectSub(sub: SubCategory): void {
    if (!this.requireAuth()) return;

    const isSame = this.selectedSub()?.id === sub.id;
    this.selectedSub.set(isSame ? null : sub);
    this.selectedTypeId.set(null);
    this.applyFilter();
  }

  /** Selecciona / deselecciona un tipo de localización. */
  selectType(typeId: number): void {
    const isSame = this.selectedTypeId() === typeId;
    this.selectedTypeId.set(isSame ? null : typeId);
    this.applyFilter();

    if (!isSame) this.panelVisible.set(false);
  }

  /** Limpia todos los filtros y muestra todas las localizaciones. */
  clearFilters(): void {
    this.selectedMain.set(null);
    this.selectedSub.set(null);
    this.selectedTypeId.set(null);
    this.applyFilter();
  }

  /** Aplica los filtros activos y vuelve a pintar los markers. */
  private applyFilter(): void {
    let filtered = this.allLocations;

    const typeId = this.selectedTypeId();
    const sub = this.selectedSub();
    const main = this.selectedMain();

    if (typeId) {
      filtered = filtered.filter(l => l.locationTypeId === typeId);
    } else if (sub) {
      const typeIds = new Set(sub.locationTypes.map(t => t.id));
      filtered = filtered.filter(l => typeIds.has(l.locationTypeId));
    } else if (main) {
      const typeIds = new Set(
        main.subcategories.flatMap(s => s.locationTypes.map(t => t.id))
      );
      filtered = filtered.filter(l => typeIds.has(l.locationTypeId));
    }

    this.renderMarkers(filtered);
  }

  // ── Markers ────────────────────────────────────────────────────────────────

  /** Limpia los markers anteriores y pinta los nuevos. */
  private renderMarkers(locations: MapLocation[]): void {
    this.currentLocations = locations;
    this.markers.forEach(m => m.setMap(null));
    this.markers = [];

    const isDark = this.themeService.isDark();

    // Dispositivos sin hover real (táctiles): el mouseover/mouseout de escritorio nunca
    // llega a dispararse, así que el tooltip sustituye su gesto por pulsación corta y el
    // detalle por pulsación larga (ver attachPressHandlers).
    const canHover = this.responsiveService.state().hasHover;
    const showPressFeedback = !canHover && !!this.currentUser.user();

    locations.forEach(location => {
      const color = this.categoryService.resolveColor(location.locationTypeId);
      const icon = this.categoryService.resolveIcon(location.locationTypeId);
      const baseIcon = this.mapsService.buildMarkerIcon(color, icon, 36, isDark, false);

      const marker = new google.maps.Marker({
        position: { lat: location.lat, lng: location.lng },
        map: this.map,
        icon: baseIcon,
      });

      if (canHover) {
        marker.addListener('click', () => this.openLocationDetail(location));
        marker.addListener('mouseover', () => {
          this.infoWindow.setContent(this.buildTooltipContent(location, color));
          this.infoWindow.open({ map: this.map, anchor: marker });
        });
        marker.addListener('mouseout', () => this.infoWindow.close());
      } else {
        // El icono animado solo se aplica mientras dura la pulsación (ver
        // attachPressHandlers) — no se muestra de forma permanente.
        const pressIcon = showPressFeedback
          ? this.mapsService.buildMarkerIcon(color, icon, 36, isDark, true)
          : null;
        this.attachPressHandlers(marker, location, color, baseIcon, pressIcon);
      }

      this.markers.push(marker);
    });
  }

  /**
   * Abre el panel de detalle de una localización, cargando primero sus apuntados.
   *
   * @remarks
   * Compartido entre el click de escritorio y la pulsación larga táctil
   * (ver {@link MapsPageComponent.attachPressHandlers}).
   */
  private openLocationDetail(location: MapLocation): void {
    const bc = this.categoryService.resolveBreadcrumb(location.locationTypeId);
    if (!bc) return;
    this.publicationService.getEnrollments(location.id).subscribe(users => {

      // Actualizar estado local si el usuario actual está en la lista
      const currentUserId = this.currentUser.user()?.id?.toString();
      if (currentUserId && users.some(u => u.userId === currentUserId)) {
        this.joinedByUserAndLocation.update(prev => ({
          ...prev,
          [this.buildJoinKey(location.id)]: true,
        }));
      }

      this.selectedDetail.set({
        id: location.id,
        name: location.name,
        description: location.description,
        locationTypeId: location.locationTypeId,
        metadata: location.metadata,
        startDate: location.startDate,
        endDate: location.endDate,
        requiredLevel: location.requiredLevel,
        publicationType: location.publicationType,
        active: location.active,
        occupiedSlots: location.occupiedSlots,
        enrolledUsers: users,
      });
      this.selectedBreadcrumb.set(bc);
      this.selectedContext.set(location.publicationType ?? 'place');
    });
  }

  /**
   * Sustituye hover+click por pulsación corta/larga en dispositivos sin hover real.
   *
   * @remarks
   * Un marker de Google Maps no distingue táctil de ratón por sí mismo, pero sí reenvía
   * `mousedown`/`mouseup` para taps (el navegador los sintetiza a partir de
   * `touchstart`/`touchend`). Medimos la duración entre ambos con un temporizador: por
   * debajo de {@link MapsPageComponent.LONG_PRESS_MS} se interpreta como pulsación corta
   * (tooltip, el equivalente táctil del hover) y por encima como pulsación larga (detalle,
   * el equivalente táctil del click).
   */
  private attachPressHandlers(
    marker: google.maps.Marker,
    location: MapLocation,
    color: string,
    baseIcon: google.maps.Icon,
    pressIcon: google.maps.Icon | null,
  ): void {
    let pressTimer: ReturnType<typeof setTimeout> | null = null;
    let longPressTriggered = false;

    const clearPressTimer = (): void => {
      if (pressTimer) {
        clearTimeout(pressTimer);
        pressTimer = null;
      }
    };

    // El icono animado (pressIcon) solo está puesto entre mousedown y el
    // mouseup/timeout que le sigue — nunca queda activo en reposo.
    const stopPressFeedback = (): void => {
      if (pressIcon) marker.setIcon(baseIcon);
    };

    marker.addListener('mousedown', () => {
      longPressTriggered = false;
      clearPressTimer();
      if (pressIcon) marker.setIcon(pressIcon);
      pressTimer = setTimeout(() => {
        longPressTriggered = true;
        stopPressFeedback();
        this.infoWindow.close();
        this.openLocationDetail(location);
      }, MapsPageComponent.LONG_PRESS_MS);
    });

    marker.addListener('mouseup', () => {
      clearPressTimer();
      if (!longPressTriggered) {
        stopPressFeedback();
        this.infoWindow.setContent(this.buildTooltipContent(location, color));
        this.infoWindow.open({ map: this.map, anchor: marker });
      }
    });

    marker.addListener('mouseout', () => {
      clearPressTimer();
      stopPressFeedback();
    });

    // El navegador sintetiza un `click` nativo tras el `touchend` (corto o largo). Si no se
    // corta aquí, burbujea hasta `.maps-body` y `handleOutsidePanelClick` lo confunde con un
    // "click fuera", cerrando el detalle justo después de que la pulsación larga lo abriera.
    marker.addListener('click', (event: google.maps.MapMouseEvent) => {
      event.domEvent?.stopPropagation();
    });
  }

  /**
   * Genera el contenido HTML del tooltip del marker.
   *
   * @param location - Localización a mostrar.
   * @param color    - Color de la categoría principal para el badge.
   */
  private buildTooltipContent(location: MapLocation, color: string): string {
    const dark = this.themeService.isDark();
    const textColor = dark ? '#f1f5f9' : '#111827';
    const subColor = dark ? '#94a3b8' : '#888888';
    const descColor = dark ? '#cbd5e1' : '#555555';
    const approxColor = dark ? '#fbbf24' : '#b45309';

    const bc = this.categoryService.resolveBreadcrumb(location.locationTypeId);
    const breadcrumb = bc
      ? `<div style="font-size:11px;color:${subColor};margin-top:2px">
         ${bc.mainCategory.icon} ${bc.mainCategory.name}
         &rsaquo; ${bc.subCategory.name}
         &rsaquo; <strong>${bc.locationType.name}</strong>
       </div>`
      : '';

    const badge = bc
      ? `<span style="display:inline-block;margin-top:6px;padding:2px 8px;border-radius:12px;
                    font-size:11px;font-weight:600;color:#fff;background:${color}">
         ${bc.locationType.name}
       </span>`
      : '';

    const approximateNotice = location.metadata?.['exactLocation'] === false
      ? `<div style="margin-top:6px;font-size:11px;color:${approxColor};display:flex;align-items:center;gap:4px">
         <span class="material-icons" style="font-size:14px">gps_not_fixed</span>
         Esta ubicación es aproximada — zona de 5 km
       </div>`
      : '';

    return `
    <div style="max-width:220px;font-family:sans-serif;padding:4px">
      <strong style="font-size:14px;color:${textColor}">${location.name}</strong>
      ${breadcrumb}
      ${location.description
        ? `<p style="margin:4px 0 0;color:${descColor};font-size:13px">${location.description}</p>`
        : ''}
      ${badge}
      ${approximateNotice}
    </div>
  `;
  }

  /** Desapunta al usuario del detalle abierto. */
  leaveSelectedLocation(): void {
    const detail = this.selectedDetail();
    if (!detail) return;

    this.publicationService.unenroll(detail.id).subscribe({
      next: () => {
        this.joinedByLocation.update(prev => ({
          ...prev,
          [detail.id]: Math.max(0, (prev[detail.id] ?? 0) - 1),
        }));

        this.joinedByUserAndLocation.update(prev => {
          const key = this.buildJoinKey(detail.id);
          const newState = { ...prev };
          delete newState[key];
          return newState;
        });

        // Recargar apuntados
        this.publicationService.getEnrollments(detail.id).subscribe(users => {
          this.selectedDetail.update(d => d ? { ...d, enrolledUsers: users } : null);
        });
      },
      error: (error: HttpErrorResponse) => {
        console.error('Error al salir del evento', error);
      },
    });
  }
}
