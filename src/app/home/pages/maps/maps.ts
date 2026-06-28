import { AfterViewInit, Component, ElementRef, ViewChild, inject, signal, computed, effect } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { GoogleMapsService } from '../../../core/services/google-maps.service';
import { LocationService } from '../../../core/services/location.service';
import { CategoryService } from '../../../core/services/category.service';
import { MapLocation } from '../../../core/models/location.model';
import { MainCategory, SubCategory } from '../../../core/models/category.model';
import { MapSettingsService } from '../../../core/services/map-settings.service';
import { PublicationDetailInput, PublicationDetailComponent } from '../maps/publication-detail/publication-detail';
import { CategoryBreadcrumb } from '../../../core/models/category.model';
import { FieldContext } from '../../../core/models/location-field.model';
import { CurrentUserService } from '../../../core/services/current-user.service';
import { AuthRequiredDialogComponent } from '../../../shared/auth-required-dialog/auth-required-dialog';
import { AUTH_REQUIRED_DIALOG_CONFIG } from '../../../core/constants/dialog.constants';
import { ThemeService } from '../../../core/services/theme.service';
import { GeoIpService } from '../../../core/services/geo-ip.service';
import { PublicationService } from '../../../core/services/publication.service';
import { HttpErrorResponse } from '@angular/common/http';
import { ResponsiveService } from '../../../core/responsive/responsive.service';


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

  // ── Servicios ──────────────────────────────────────────────────────────────
  private mapsService = inject(GoogleMapsService);
  private mapSettingsService = inject(MapSettingsService);
  private locationService = inject(LocationService);
  readonly categoryService = inject(CategoryService);
  private currentUser = inject(CurrentUserService);
  private dialog = inject(MatDialog);
  private geoIpService = inject(GeoIpService);
  private publicationService = inject(PublicationService);
  private responsiveService = inject(ResponsiveService);

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
    if (!this.panelVisible()) return;

    const target = event.target as HTMLElement | null;
    if (!target) return;

    if (target.closest('.filter-panel')) return;
    if (target.closest('button, a, input, select, textarea, [role="button"], [role="menuitem"], .gm-control-active')) {
      return;
    }

    this.closePanel();
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
    // se suscribe al cambio de tema
    effect(() => {
      this.themeService.isDark();
      if (this.map) this.renderMarkers(this.currentLocations);
    });
  }

  /** Abre el dialog de auth si no hay usuario. Retorna true si puede continuar. */
  private requireAuth(): boolean {
    if (this.currentUser.user()) return true;
    this.dialog.open(AuthRequiredDialogComponent, AUTH_REQUIRED_DIALOG_CONFIG);
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

    locations.forEach(location => {
      const color = this.categoryService.resolveColor(location.locationTypeId);
      const icon = this.categoryService.resolveIcon(location.locationTypeId);

      const marker = new google.maps.Marker({
        position: { lat: location.lat, lng: location.lng },
        map: this.map,
        title: location.name,
        icon: this.mapsService.buildMarkerIcon(color, icon, 36, isDark),
      });

      marker.addListener('click', () => {
        const bc = this.categoryService.resolveBreadcrumb(location.locationTypeId);
        if (!bc) return;
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
        });
        this.selectedBreadcrumb.set(bc);
        this.selectedContext.set(location.publicationType ?? 'place');
      });

      marker.addListener('mouseover', () => {
        this.infoWindow.setContent(this.buildTooltipContent(location, color));
        this.infoWindow.open({ map: this.map, anchor: marker });
      });
      marker.addListener('mouseout', () => this.infoWindow.close());

      this.markers.push(marker);
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

    return `
    <div style="max-width:220px;font-family:sans-serif;padding:4px">
      <strong style="font-size:14px;color:${textColor}">${location.name}</strong>
      ${breadcrumb}
      ${location.description
        ? `<p style="margin:4px 0 0;color:${descColor};font-size:13px">${location.description}</p>`
        : ''}
      ${badge}
    </div>
  `;
  }
}
