/**
 * @file create-publication.ts
 * @description Componente para creación de actividades/eventos por usuarios PARTICULAR.
 *
 * Proporciona un formulario con acordeones y un mapa interactivo para:
 * - Definir información básica (título, descripción)
 * - Seleccionar categoría en cascada (3 niveles)
 * - Establecer fechas y detalles (plazas, precio, nivel requerido)
 * - Fijar ubicación mediante click en el mapa
 *
 * Las publicaciones se persisten en backend mediante PublicationService.
 */
import {
  Component, inject, signal, computed,
  AfterViewInit, ViewChild, ElementRef, effect,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatSnackBar } from '@angular/material/snack-bar';
import { ActivatedRoute, Router } from '@angular/router';
import { GoogleMapsService } from '../../../core/services/google-maps.service';
import { CategoryService } from '../../../core/services/category.service';
import { CurrentUserService } from '../../../core/services/current-user.service';
import { MainCategory, SubCategory } from '../../../core/models/category.model';
import { Publication } from '../../../core/models/publication.model';
import { MatExpansionModule } from '@angular/material/expansion';
import { MapSettingsService } from '../../../core/services/map-settings.service';
import { ThemeService } from '../../../core/services/theme.service';
import { GeoIpService } from '../../../core/services/geo-ip.service';
import { PublicationService } from '../../../core/services/publications.service';
import { ResponsiveService } from '../../../core/responsive/responsive.service';
import html2canvas from 'html2canvas';

/**
 * Componente de página para crear actividades (eventos) para usuarios particulares.
 *
 * Layout split: formulario con acordeones a la izquierda, mapa interactivo a la derecha.
 *
 * @implements {AfterViewInit} - Inicializa el mapa de Google tras renderizar la vista
 */
@Component({
  selector: 'app-create-publication-page',
  standalone: true,
  imports: [FormsModule, MatIconModule, MatButtonModule, MatExpansionModule],
  templateUrl: './create-publication.html',
  styleUrl: './create-publication.scss',
})
export class CreatePublicationPageComponent implements AfterViewInit {

  // ── Servicios ──────────────────────────────────────────────────────────────
  /** Servicio para cargar Google Maps API de forma lazy */
  private readonly mapsService = inject(GoogleMapsService);

  /** Servicio con árbol de categorías (MainCategory → SubCategory → LocationType) */
  private readonly categoryService = inject(CategoryService);

  /** Servicio de almacenamiento en memoria para publicaciones */
  private readonly pubService = inject(PublicationService);

  /** Servicio de usuario actual (usado para validaciones de tipo PARTICULAR) */
  readonly cu = inject(CurrentUserService);

  /** Toast/snack bar para feedback de creación y errores. */
  private readonly snackBar = inject(MatSnackBar);

  private readonly mapSettingsService = inject(MapSettingsService);

  private readonly themeService = inject(ThemeService);

  private readonly geoIpService = inject(GeoIpService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly responsiveService = inject(ResponsiveService);

  /** Indica si el formulario está en modo repetición de actividad. */
  isRepeatMode = signal(false);

  routeMapCapture = signal<string | null>(null);

  /** Estado derivado para detectar viewport compacto (mobile/tablet). */
  readonly isCompactViewport = computed(() => {
    const state = this.responsiveService.state();
    return state.isMobile || state.isTablet;
  });

  /**
   * En mobile/tablet el formulario arranca oculto para priorizar el mapa.
   * En desktop permanece visible para mantener la experiencia actual.
   */
  readonly showFormPanel = signal(false);

  // ── Mapa ───────────────────────────────────────────────────────────────────
  /** Referencia al contenedor DOM del mapa */
  @ViewChild('mapContainer', { static: true })
  mapContainer!: ElementRef<HTMLDivElement>;

  /** Instancia del mapa de Google Maps */
  private map!: google.maps.Map;

  /** Marcador actual en el mapa (null si no hay ubicación seleccionada) */
  marker: google.maps.Marker | null = null;

  // ── Categorías ─────────────────────────────────────────────────────────────
  /** Lista completa de categorías principales */
  categories = signal<MainCategory[]>([]);

  /** Categoría principal seleccionada actualmente */
  selectedMain = signal<MainCategory | null>(null);

  /** Subcategoría seleccionada actualmente */
  selectedSub = signal<SubCategory | null>(null);

  /** Subcategorías visibles según la categoría principal seleccionada */
  visibleSubs = computed(() => this.selectedMain()?.subcategories ?? []);

  /** Indicaciones para llegar al punto de encuentro (opcional) */
  directions = '';

  /** Si true, se muestra la ubicación exacta; si false, solo aproximada */
  exactLocation = true;

  /** Array de puntos que forman la ruta en el mapa */
  private routePoints = signal<google.maps.LatLng[]>([]);

  /** Array de markers de los puntos de la ruta */
  private routeMarkers: google.maps.Marker[] = [];

  /** Polyline de Google Maps que dibuja la ruta */
  private routePolyline: google.maps.Polyline | null = null;

  /** Modo edición de ruta activado (click añade puntos en lugar de mover el marcador) */
  isAddingRoute = false;


  /**
   * Tipos de ubicación visibles según la subcategoría seleccionada.
   * Filtra los tipos profesionales por nombre.
   */
  visibleTypes = computed(() =>
    (this.selectedSub()?.locationTypes ?? []).filter(t => t.name.toLowerCase() !== 'profesional')
  );

  // ── Campos formulario ──────────────────────────────────────────────────────
  /** Título de la actividad (obligatorio) */
  title = '';

  /** Descripción extendida de la actividad (opcional) */
  description = '';

  /** ID del tipo de ubicación seleccionado (obligatorio) */
  locationTypeId: number | null = null;

  /** Fecha de la actividad en formato YYYY-MM-DD (obligatorio) */
  activityDate = this.getTodayDate();

  /** Si es true, la actividad ocupa todo el día */
  allDay = true;

  /** Hora de inicio del rango (HH:MM, solo si !allDay) */
  startTime = '';

  /** Hora de fin del rango (HH:MM, solo si !allDay) */
  endTime = '';

  /** Número máximo de plazas disponibles (opcional, null = sin límite) */
  slots: number | null = null;

  /** Precio en euros (0 = gratis) */
  // price = 0;

  /** Nivel mínimo requerido (mapeado a escala 0–10 del modelo) */
  requiredLevel = 0;

  /** Niveles de actividad predefinidos */
  readonly ACTIVITY_LEVELS = [
    { label: 'Básico', description: 'Apto para todos', value: 0 },
    { label: 'Iniciado', description: 'Algo de experiencia', value: 3 },
    { label: 'Intermedio', description: 'Bastante experiencia y preparación', value: 5 },
    { label: 'Avanzado', description: 'Alta preparación y experiencia', value: 7 },
    { label: 'Experto', description: 'Máximo nivel', value: 10 },
  ];


  /** Latitud de la ubicación (obligatorio, se establece al hacer click en el mapa) */
  lat = signal<number | null>(null);

  /** Longitud de la ubicación (obligatorio, se establece al hacer click en el mapa) */
  lng = signal<number | null>(null);

  // ── Estado UI ──────────────────────────────────────────────────────────────
  /** Mensaje de éxito mostrado tras crear una actividad (null si no hay mensaje) */
  successMessage = signal<string | null>(null);

  // ── Control de paneles expandidos ──────────────────────────────────────────
  /**
   * Estado de expansión de los acordeones.
   * Por defecto, el panel de información básica está abierto para guiar al usuario.
   */
  expandedPanels = {
    info: true,      // Información básica: abierto por defecto
    category: false, // Categoría: cerrado
    location: false, // Ubicación y ruta: cerrado
    dates: false,    // Fechas: cerrado
    details: false,  // Detalles: cerrado
  };

  /** @returns True si hay una ubicación seleccionada en el mapa */
  get locationSelected(): boolean {
    return this.lat() !== null && this.lng() !== null;
  }

  /**
   * @returns True si el formulario puede ser enviado
   * Requiere: título, fecha inicio, tipo de ubicación y coordenadas
   */
  get canSubmit(): boolean {
    return !!this.title.trim() && !!this.activityDate &&
      this.locationTypeId !== null && this.locationSelected;
  }

  /**
   * @returns Etiqueta legible del nivel mínimo requerido
   * @example "Todos" para nivel 0, "Nivel 5+" para nivel 5
   */
  get levelLabel(): string {
    return this.ACTIVITY_LEVELS.find(l => l.value === this.requiredLevel)?.label ?? 'Básico';
  }

  /**
   * Constructor del componente.
   * Carga las categorías disponibles del servicio.
   */
  constructor() {
    this.categoryService.getAll().subscribe(cats => this.categories.set(cats));

    // Sincroniza visibilidad del formulario según viewport.
    // En compact se prioriza el mapa; en desktop se mantiene visible.
    effect(() => {
      this.showFormPanel.set(!this.isCompactViewport());
    });

    // Aplica estilos del mapa reactivamente (dark mode + POIs)
    effect(() => {
      if (this.map) this.map.setOptions({ styles: this.mapSettingsService.mapStyles() });
    });

    // Actualiza el icono del marcador cuando cambia el tema
    effect(() => {
      const isDark = this.themeService.isDark();
      if (this.marker) {
        this.marker.setIcon(this.mapsService.buildMarkerIcon(
          this.selectedMain()?.color ?? '#3f51b5',
          this.selectedSub()?.icon ?? '📍',
          40,
          isDark,
        ));
      }
    });
  }

  /** Muestra el formulario en mobile/tablet desde el botón flotante. */
  openFormPanel(): void {
    this.showFormPanel.set(true);
  }

  /** Cierra el formulario en mobile/tablet para volver al mapa completo. */
  closeFormPanel(): void {
    if (!this.isCompactViewport()) return;
    this.showFormPanel.set(false);
  }

  /**
   * Etiqueta del botón principal según modo del formulario.
   */
  get submitButtonText(): string {
    return this.isRepeatMode() ? 'Repetir publicación' : 'Crear publicación';
  }


  private getTodayDate(): string {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  /**
   * Hook de ciclo de vida ejecutado tras inicializar la vista.
   * Inicializa el mapa de Google Maps y configura el listener de clicks.
   *
   * @async
   */
  async ngAfterViewInit(): Promise<void> {
    await this.mapsService.load();

    this.geoIpService.resolveCenter().subscribe(center => {
      this.map = new google.maps.Map(this.mapContainer.nativeElement, {
        center: { lat: center.lat, lng: center.lng },
        zoom: 12,
        disableDefaultUI: true,
        zoomControl: true,
        clickableIcons: true,
        styles: this.mapSettingsService.mapStyles(),
      });

      // listener de click igual que antes
      this.map.addListener('click', (e: google.maps.MapMouseEvent) => {
        if (!e.latLng) return;
        if (this.isAddingRoute) {
          this.addRoutePoint(e.latLng);
        } else {
          this.lat.set(e.latLng.lat());
          this.lng.set(e.latLng.lng());
          this.placeMarker(e.latLng);
        }
      });

      this.loadRepeatDraftFromQueryParams();
    });
  }

  /**
  * Carga un borrador desde una publicación existente si llega `repeatFrom` en query params.
   */
  private loadRepeatDraftFromQueryParams(): void {
    const repeatFromRaw = this.route.snapshot.queryParamMap.get('repeatFrom');
    if (!repeatFromRaw) {
      this.isRepeatMode.set(false);
      return;
    }

    const publicationId = Number(repeatFromRaw);
    if (!Number.isFinite(publicationId)) {
      this.isRepeatMode.set(false);
      return;
    }

    this.pubService.getById(publicationId).subscribe({
      next: publication => {
        this.applyRepeatDraft(publication);
      },
      error: () => {
        this.isRepeatMode.set(false);
        this.snackBar.open('No se pudo cargar la publicación a repetir', 'Cerrar', {
          duration: 3000,
          horizontalPosition: 'center',
          verticalPosition: 'top',
        });
      }
    });
  }

  /**
  * Precarga el formulario con una publicación existente para repetirla/editarla.
   *
   * La fecha se actualiza a la del día actual para iniciar una nueva convocatoria.
   */
  private applyRepeatDraft(publication: Publication): void {
    this.isRepeatMode.set(true);
  
    this.title = publication.title;
    this.description = publication.description ?? '';
    this.locationTypeId = publication.locationTypeId;
    this.requiredLevel = publication.requiredLevel ?? 0;
    this.activityDate = this.getTodayDate();
  
    const start = new Date(publication.startDate);
    const end = publication.endDate ? new Date(publication.endDate) : null;
    const looksAllDay = !!end &&
      start.getHours() === 0 && start.getMinutes() === 0 &&
      end.getHours() === 23 && end.getMinutes() >= 59;
  
    this.allDay = looksAllDay || !end;
    this.startTime = this.allDay ? '' : this.toHHmm(start);
    this.endTime = this.allDay || !end ? '' : this.toHHmm(end);
  
    const meta = publication.metadata ?? {};
    this.slots = typeof meta['slots'] === 'number' ? meta['slots'] : null;
    this.exactLocation = typeof meta['exactLocation'] === 'boolean' ? meta['exactLocation'] : true;
    this.directions = typeof meta['directions'] === 'string' ? meta['directions'] : '';
  
    if (publication.lat !== null && publication.lng !== null) {
      this.lat.set(publication.lat);
      this.lng.set(publication.lng);
      const point = new google.maps.LatLng(publication.lat, publication.lng);
      this.placeMarker(point);
      this.map.panTo(point);
    }
  
    this.restoreRouteFromMetadata(meta['route']);
    
    // Restaurar captura si existe
    if (typeof meta['routeMapCapture'] === 'string') {
      this.routeMapCapture.set(meta['routeMapCapture']);
    }
  
    const breadcrumb = this.categoryService.resolveBreadcrumb(publication.locationTypeId);
    this.selectedMain.set(breadcrumb?.mainCategory ?? null);
    this.selectedSub.set(breadcrumb?.subCategory ?? null);
  }

  /**
   * Convierte una fecha a texto HH:mm.
   */
  private toHHmm(value: Date): string {
    const hh = String(value.getHours()).padStart(2, '0');
    const mm = String(value.getMinutes()).padStart(2, '0');
    return `${hh}:${mm}`;
  }

  /**
   * Reconstruye la ruta desde el metadata persistido.
   */
  private restoreRouteFromMetadata(routeMetadata: unknown): void {
    this.clearRoute();

    if (!Array.isArray(routeMetadata)) {
      return;
    }

    for (const point of routeMetadata) {
      if (!point || typeof point !== 'object') {
        continue;
      }

      const lat = Number((point as Record<string, unknown>)['lat']);
      const lng = Number((point as Record<string, unknown>)['lng']);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
        continue;
      }

      this.addRoutePoint(new google.maps.LatLng(lat, lng));
    }

    if (this.routePointsCount() > 0) {
      this.routePolyline?.setOptions({
        strokeColor: this.selectedMain()?.color ?? '#3f51b5',
        strokeWeight: 4,
      });

      this.routeMarkers.forEach(marker => {
        marker.setIcon({
          path: google.maps.SymbolPath.CIRCLE,
          scale: 6,
          fillColor: '#16a34a',
          fillOpacity: 1,
          strokeColor: '#fff',
          strokeWeight: 2,
        });
      });
    }
  }

  // ── Selector de categorías ─────────────────────────────────────────────────

  /**
   * Selecciona o deselecciona una categoría principal.
   * Resetea la subcategoría y el tipo de ubicación.
   *
   * @param cat - Categoría principal a seleccionar
   */
  selectMain(cat: MainCategory): void {
    const isSame = this.selectedMain()?.id === cat.id;
    this.selectedMain.set(isSame ? null : cat);
    this.selectedSub.set(null);
    this.locationTypeId = null;
  }

  /**
   * Selecciona o deselecciona una subcategoría.
   * Resetea el tipo de ubicación.
   *
   * @param sub - Subcategoría a seleccionar
   */
  selectSub(sub: SubCategory): void {
    const isSame = this.selectedSub()?.id === sub.id;
    this.selectedSub.set(isSame ? null : sub);
    this.locationTypeId = null;
  }

  /**
   * Selecciona o deselecciona un tipo de ubicación.
   * Actualiza el icono del marcador si existe.
   *
   * @param typeId - ID del tipo de ubicación a seleccionar
   */
  selectLocationType(typeId: number): void {
    this.locationTypeId = this.locationTypeId === typeId ? null : typeId;
    if (this.marker && this.lat !== null) {
      this.marker.setIcon(this.mapsService.buildMarkerIcon(
        this.selectedMain()?.color ?? '#3f51b5',
        this.selectedSub()?.icon ?? '📍',
        40,
        this.themeService.isDark(),
      ));
    }
  }

  /**
   * Limpia la ubicación seleccionada.
   * Elimina el marcador del mapa y resetea las coordenadas.
   */
  clearLocation(): void {
    this.lat.set(null);
    this.lng.set(null);
    if (this.marker) {
      this.marker.setMap(null);
      this.marker = null;
    }
  }

  // ── Mapa ───────────────────────────────────────────────────────────────────

  /**
   * Coloca un marcador en el mapa en la posición indicada.
   * Si ya existe un marcador, lo elimina antes de crear uno nuevo.
   *
   * @param position - Posición donde colocar el marcador
   * @private
   */
  private placeMarker(position: google.maps.LatLng): void {
    if (this.marker) this.marker.setMap(null);
    this.marker = new google.maps.Marker({
      position,
      map: this.map,
      icon: this.mapsService.buildMarkerIcon(
        this.selectedMain()?.color ?? '#3f51b5',
        this.selectedSub()?.icon ?? '📍',
        40,
        this.themeService.isDark(),
      ),
      title: this.title || 'Nueva publicación',
      animation: google.maps.Animation.DROP,
    });
  }

  /**
   * Añade un punto a la ruta y actualiza la polyline.
   * Los markers son draggables para poder ajustar la ruta.
   *
   * @param point - Coordenadas del nuevo punto de la ruta
   * @private
   */
  private addRoutePoint(point: google.maps.LatLng): void {
    const currentPoints = this.routePoints();
    const index = currentPoints.length;

    // Añadir punto al signal
    this.routePoints.set([...currentPoints, point]);

    // Crear marcador circular para este punto (draggable)
    const marker = new google.maps.Marker({
      position: point,
      map: this.map,
      draggable: true,
      icon: {
        path: google.maps.SymbolPath.CIRCLE,
        scale: 6,
        fillColor: '#f59e0b',
        fillOpacity: 1,
        strokeColor: '#fff',
        strokeWeight: 2,
      },
    });

    // Listener: actualizar ruta cuando se arrastra el marker
    marker.addListener('drag', () => {
      const newPosition = marker.getPosition();
      if (newPosition) {
        // Actualizar el punto en el array
        const points = [...this.routePoints()];
        points[index] = newPosition;
        this.routePoints.set(points);
        // Actualizar la polyline en tiempo real
        this.routePolyline?.setPath(points);
      }
    });

    // Efecto visual al arrastrar
    marker.addListener('dragstart', () => {
      marker.setIcon({
        path: google.maps.SymbolPath.CIRCLE,
        scale: 7,
        fillColor: '#f59e0b',
        fillOpacity: 0.7,
        strokeColor: '#fff',
        strokeWeight: 2,
      });
    });

    marker.addListener('dragend', () => {
      marker.setIcon({
        path: google.maps.SymbolPath.CIRCLE,
        scale: 6,
        fillColor: '#f59e0b',
        fillOpacity: 1,
        strokeColor: '#fff',
        strokeWeight: 2,
      });
    });

    // Guardar referencia del marker
    this.routeMarkers.push(marker);

    if (!this.routePolyline) {
      // Crear la polyline en el primer punto
      this.routePolyline = new google.maps.Polyline({
        map: this.map,
        path: this.routePoints(),
        strokeColor: '#f59e0b',
        strokeOpacity: 0.8,
        strokeWeight: 4,
        geodesic: true,
      });
    } else {
      // Actualizar el path con el nuevo punto
      this.routePolyline.setPath(this.routePoints());
    }
  }

  /**
   * Activa/desactiva el modo de añadir ruta.
   * En modo ruta, los clicks añaden puntos en lugar de mover el marcador.
   */
  toggleRouteMode(): void {
    this.isAddingRoute = !this.isAddingRoute;

    // Mientras se dibuja ruta, desactiva clicks de POIs nativos de Google.
    if (this.map) {
      this.map.setOptions({ clickableIcons: !this.isAddingRoute });
    }

    if (!this.isAddingRoute && this.routePolyline) {
      // Al desactivar, aplicar estilo final a la ruta
      this.routePolyline.setOptions({
        strokeColor: this.selectedMain()?.color ?? '#3f51b5',
        strokeWeight: 4,
      });

      // Opcional: cambiar color de los markers a verde (ruta finalizada)
      this.routeMarkers.forEach(marker => {
        marker.setIcon({
          path: google.maps.SymbolPath.CIRCLE,
          scale: 6,
          fillColor: '#16a34a',  // Verde
          fillOpacity: 1,
          strokeColor: '#fff',
          strokeWeight: 2,
        });
      });
    }
  }

  /**
   * Acción principal de ruta desde formulario.
   * En mobile/tablet inicia el trazado y vuelve al mapa automáticamente.
   */
  onRoutePrimaryAction(): void {
    const compactViewport = this.isCompactViewport();

    if (compactViewport && !this.isAddingRoute) {
      this.toggleRouteMode();
      this.closeFormPanel();
      return;
    }

    this.toggleRouteMode();
  }

  /** Finaliza el trazado de ruta desde el mapa y vuelve al formulario. */
  // finishRouteFromMap(): void {
  //   if (this.isAddingRoute) {
  //     this.toggleRouteMode();
  //   }
  //   this.openFormPanel();
  // }

  /**
   * Elimina la ruta del mapa y limpia todos los puntos.
   */
  clearRoute(): void {
    // Eliminar polyline
    if (this.routePolyline) {
      this.routePolyline.setMap(null);
      this.routePolyline = null;
    }

    // Eliminar todos los markers de puntos
    this.routeMarkers.forEach(marker => marker.setMap(null));

    // Limpiar arrays
    this.routePoints.set([]);
    this.routeMarkers = [];
    this.isAddingRoute = false;

    // Asegura restaurar POIs clicables al salir del modo dibujo.
    if (this.map) {
      this.map.setOptions({ clickableIcons: true });
    }
  }

  /**
   * Elimina el último punto añadido a la ruta.
   * Útil para corregir errores sin borrar toda la ruta.
   */
  undoLastRoutePoint(): void {
    const currentPoints = this.routePoints();
    if (currentPoints.length === 0) return;

    // Eliminar último punto del array
    const newPoints = [...currentPoints];
    newPoints.pop();
    this.routePoints.set(newPoints);

    // Eliminar último marker del mapa
    const lastMarker = this.routeMarkers.pop();
    if (lastMarker) {
      lastMarker.setMap(null);
    }

    if (newPoints.length === 0) {
      // Si no quedan puntos, eliminar la polyline
      this.clearRoute();
    } else {
      // Actualizar el path con los puntos restantes
      this.routePolyline?.setPath(newPoints);
    }
  }

  /**
   * @returns Número de puntos en la ruta actual
   */
  routePointsCount = computed(() => this.routePoints().length);

  /** Puntos normalizados para renderizar una mini captura SVG de la ruta. */
  readonly routePreviewPolyline = computed(() => {
    const tile = this.routePreviewTile();
    return tile?.polylinePoints ?? '';
  });

  /**
   * Calcula la tesela y los puntos en coordenadas de tesela para que
   * la ruta se alinee con la captura de mapa sin desfases de zoom/proyección.
   */
  private readonly routePreviewTile = computed(() => {
    const points = this.routePoints();
    if (points.length === 0) return null;

    const tileSize = 256;
    const padding = 20;
    const maxZoom = this.isCompactViewport() ? 16 : 17;

    for (let zoom = maxZoom; zoom >= 1; zoom--) {
      const projected = points.map(point => this.projectToWorldPixels(point.lat(), point.lng(), zoom));
      const xs = projected.map(point => point.x);
      const ys = projected.map(point => point.y);

      const minX = Math.min(...xs);
      const maxX = Math.max(...xs);
      const minY = Math.min(...ys);
      const maxY = Math.max(...ys);

      const tileMinX = Math.floor(minX / tileSize);
      const tileMaxX = Math.floor(maxX / tileSize);
      const tileMinY = Math.floor(minY / tileSize);
      const tileMaxY = Math.floor(maxY / tileSize);

      const fitsSingleTile = tileMinX === tileMaxX && tileMinY === tileMaxY;
      const fitsPadding =
        maxX - minX <= tileSize - padding * 2
        && maxY - minY <= tileSize - padding * 2;

      if (!fitsSingleTile || !fitsPadding) continue;

      const tileX = tileMinX;
      const tileY = tileMinY;
      const polylinePoints = projected
        .map(point => {
          const x = point.x - tileX * tileSize;
          const y = point.y - tileY * tileSize;
          return `${x.toFixed(1)},${y.toFixed(1)}`;
        })
        .join(' ');

      return { zoom, tileX, tileY, polylinePoints };
    }

    // Fallback seguro si no cabe en una sola tesela a zoom alto.
    const zoom = 1;
    const first = points[0];
    const firstProjected = this.projectToWorldPixels(first.lat(), first.lng(), zoom);
    const tileX = Math.floor(firstProjected.x / tileSize);
    const tileY = Math.floor(firstProjected.y / tileSize);
    const polylinePoints = points
      .map(point => this.projectToWorldPixels(point.lat(), point.lng(), zoom))
      .map(point => `${(point.x - tileX * tileSize).toFixed(1)},${(point.y - tileY * tileSize).toFixed(1)}`)
      .join(' ');

    return { zoom, tileX, tileY, polylinePoints };
  });

  /** Proyección Web Mercator a píxeles de mundo para un zoom dado. */
  private projectToWorldPixels(lat: number, lng: number, zoom: number): { x: number; y: number } {
    const tileSize = 256;
    const sinLat = Math.sin((lat * Math.PI) / 180);
    const clamped = Math.min(Math.max(sinLat, -0.9999), 0.9999);
    const scale = Math.pow(2, zoom) * tileSize;

    const x = ((lng + 180) / 360) * scale;
    const y = (0.5 - Math.log((1 + clamped) / (1 - clamped)) / (4 * Math.PI)) * scale;
    return { x, y };
  }

  /** URL de una tesela OSM para mostrar una base de mapa real en la captura. */
  readonly routeStaticMapUrl = computed(() => {
    const tile = this.routePreviewTile();
    if (!tile) return '';
    return `https://tile.openstreetmap.org/${tile.zoom}/${tile.tileX}/${tile.tileY}.png`;
  });

  /**
   * @returns True si hay al menos un punto en la ruta
   */
  hasRoute = computed(() => this.routePoints().length > 0);

    /**
   * Calcula el bounding box (extent) de los puntos de la ruta
   */
  private calculateRouteExtent(): google.maps.LatLngBounds | null {
    const points = this.routePoints();
    if (points.length === 0) return null;
  
    const bounds = new google.maps.LatLngBounds();
    points.forEach(point => bounds.extend(point));
    console.log('Calculated route extent:', bounds.toString());
    return bounds;
  }
  
/** Finaliza el trazado de ruta desde el mapa y vuelve al formulario. */
finishRouteFromMap(): void {
  if (this.isAddingRoute) {
    this.toggleRouteMode();
  }

  const bounds = this.calculateRouteExtent();
  this.openFormPanel();
  
  if (!bounds || !this.map) return;
  
  // Usar ResizeObserver para detectar cuando el contenedor cambia de tamaño
  const resizeObserver = new ResizeObserver(async () => {
    resizeObserver.disconnect();
    
    google.maps.event.trigger(this.map, 'resize');
    
    const center = bounds.getCenter();
    const ne = bounds.getNorthEast();
    const sw = bounds.getSouthWest();
    const maxZoom = 17;
    const padding = 50;
    
    let zoom = maxZoom;
    for (let z = maxZoom; z >= 1; z--) {
      const nwWorldCoord = this.latlngToPoint(sw, z);
      const seWorldCoord = this.latlngToPoint(ne, z);
      
      const worldWidth = seWorldCoord.x - nwWorldCoord.x;
      const worldHeight = seWorldCoord.y - nwWorldCoord.y;
      
      if (worldWidth < this.mapContainer.nativeElement.offsetWidth - padding &&
          worldHeight < this.mapContainer.nativeElement.offsetHeight - padding) {
        zoom = z;
        break;
      }
    }
    
    this.map.setCenter(center);
    this.map.setZoom(zoom);

    // Esperar a que el mapa termine de renderizar
    const idleListener = google.maps.event.addListenerOnce(this.map, 'idle', async () => {
      // Pequeño delay adicional para asegurar renderización completa
      // await new Promise(resolve => setTimeout(resolve, 500));
      
      try {
        const canvas = await html2canvas(this.mapContainer.nativeElement, {
          backgroundColor: null,
          scale: 1,
          logging: false,
          useCORS: true,
        });
        this.routeMapCapture.set(canvas.toDataURL('image/png'));
        console.info('Map captured successfully');
      } catch (error) {
        console.error('Error capturando mapa:', error);
      }
    });
    
    console.info('Map adjusted to route center:', center.toString(), 'zoom:', zoom);
  });
  
  resizeObserver.observe(this.mapContainer.nativeElement);
}

/** Convierte lat/lng a coordenadas de mundo para calcular zoom */
private latlngToPoint(latlng: google.maps.LatLng, zoom: number): { x: number; y: number } {
  return this.projectToWorldPixels(latlng.lat(), latlng.lng(), zoom);
}

  // ── Acciones ───────────────────────────────────────────────────────────────

  /**
  * Envía el formulario y crea la publicación.
   *
   * Validaciones:
   * - Título no vacío
   * - Fecha de inicio presente
   * - Tipo de ubicación seleccionado
   * - Coordenadas establecidas
   *
  * Tras crear la publicación:
   * - Muestra mensaje de éxito (5 segundos)
   * - Resetea el formulario
   */
  submitForm(): void {
    if (!this.canSubmit) return;
  
    const selectedLocationTypeId = this.locationTypeId;
    if (selectedLocationTypeId === null) return;
  
    this.pubService.add({
      publicationType: 'event',
      placeId: null,
      locationTypeId: selectedLocationTypeId,
      title: this.title.trim(),
      description: this.description.trim() || undefined,
      startDate: this.allDay
        ? `${this.activityDate}T00:00`
        : `${this.activityDate}T${this.startTime || '00:00'}`,
      endDate: this.allDay
        ? `${this.activityDate}T23:59`
        : (this.endTime ? `${this.activityDate}T${this.endTime}` : null),
      lat: this.lat(),
      lng: this.lng(),
      requiredLevel: this.requiredLevel,
      metadata: {
        exactLocation: this.exactLocation,
        // price: this.price,
        ...(this.slots !== null ? { slots: this.slots } : {}),
        // Guardar la ruta si existe
        ...(this.hasRoute() ? {
          route: this.routePoints().map(p => ({
            lat: p.lat(),
            lng: p.lng()
          }))
        } : {}),
        // Guardar la captura del mapa si existe
        ...(this.routeMapCapture() ? {
          routeMapCapture: this.routeMapCapture()
        } : {}),
        // Guardar indicaciones si existen
        ...(this.directions.trim() ? { directions: this.directions.trim() } : {})
      },
    }).subscribe({
      next: pub => {
        this.snackBar.open(
          this.isRepeatMode() ? 'Publicación repetida correctamente' : 'Publicación creada correctamente',
          'Cerrar',
          {
            duration: 3500,
            horizontalPosition: 'center',
            verticalPosition: 'top',
          }
        );
        this.successMessage.set(
          this.isRepeatMode()
            ? `✅ Publicación "${pub.title}" repetida. Aparecerá en el mapa.`
            : `✅ Publicación "${pub.title}" creada. Aparecerá en el mapa.`
        );
        this.resetForm();
        this.closeFormPanel();
        setTimeout(() => this.successMessage.set(null), 5000);
      }
    });
  }

  /**
   * Resetea todos los campos del formulario a sus valores iniciales.
   * Limpia la ubicación y deselecciona todas las categorías.
   */
  resetForm(): void {
    this.isRepeatMode.set(false);
    this.title = '';
    this.description = '';
    this.directions = '';
    this.locationTypeId = null;
    this.exactLocation = true;
    this.activityDate = this.getTodayDate();
    this.allDay = true;
    this.startTime = '';
    this.endTime = '';
    this.slots = null;
    // this.price = 0;
    this.requiredLevel = 0;
    this.clearLocation();
    this.clearRoute();
    this.selectedMain.set(null);
    this.selectedSub.set(null);

    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { repeatFrom: null },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }
}
