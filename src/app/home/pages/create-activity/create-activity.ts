/**
 * @file create-activity.ts
 * @description Componente para creación de actividades/eventos por usuarios PARTICULAR.
 *
 * Proporciona un formulario con acordeones y un mapa interactivo para:
 * - Definir información básica (título, descripción)
 * - Seleccionar categoría en cascada (3 niveles)
 * - Establecer fechas y detalles (plazas, precio, nivel requerido)
 * - Fijar ubicación mediante click en el mapa
 *
 * Las publicaciones se guardan en memoria (PublicationService).
 */
import {
  Component, inject, signal, computed,
  AfterViewInit, ViewChild, ElementRef, effect,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { GoogleMapsService } from '../../../core/services/google-maps.service';
import { CategoryService } from '../../../core/services/category.service';
import { PublicationService } from '../../../core/services/publication.service';
import { CurrentUserService } from '../../../core/services/current-user.service';
import { MainCategory, SubCategory } from '../../../core/models/category.model';
import { MatExpansionModule } from '@angular/material/expansion';
import { MapSettingsService } from '../../../core/services/map-settings.service';
import { ThemeService } from '../../../core/services/theme.service';

/**
 * Componente de página para crear actividades (eventos) para usuarios particulares.
 *
 * Layout split: formulario con acordeones a la izquierda, mapa interactivo a la derecha.
 *
 * @implements {AfterViewInit} - Inicializa el mapa de Google tras renderizar la vista
 */
@Component({
  selector: 'app-create-activity-page',
  standalone: true,
  imports: [FormsModule, MatIconModule, MatButtonModule, MatExpansionModule],
  templateUrl: './create-activity.html',
  styleUrl: './create-activity.scss',
})
export class CreateActivityPageComponent implements AfterViewInit {

  // ── Servicios ──────────────────────────────────────────────────────────────
  /** Servicio para cargar Google Maps API de forma lazy */
  private readonly mapsService = inject(GoogleMapsService);

  /** Servicio con árbol de categorías (MainCategory → SubCategory → LocationType) */
  private readonly categoryService = inject(CategoryService);

  /** Servicio de almacenamiento en memoria para publicaciones */
  private readonly pubService = inject(PublicationService);

  /** Servicio de usuario actual (usado para validaciones de tipo PARTICULAR) */
  readonly cu = inject(CurrentUserService);

  private readonly mapSettingsService = inject(MapSettingsService);

  private readonly themeService = inject(ThemeService);

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
    this.map = new google.maps.Map(this.mapContainer.nativeElement, {
      center: { lat: 40.4168, lng: -3.7038 },
      zoom: 12,
      disableDefaultUI: true,
      zoomControl: true,
      styles: this.mapSettingsService.mapStyles(),  // ← añadir
    });

    // Listener: click en el mapa establece la ubicación de la actividad o la ruta
    this.map.addListener('click', (e: google.maps.MapMouseEvent) => {
      if (!e.latLng) return;

      if (this.isAddingRoute) {
        // Modo ruta: añadir punto a la ruta
        this.addRoutePoint(e.latLng);
      } else {
        // Modo normal: establecer ubicación del marcador
        this.lat.set(e.latLng.lat());
        this.lng.set(e.latLng.lng());
        this.placeMarker(e.latLng);
      }
    });
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
      title: this.title || 'Nueva actividad',
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

  /**
   * @returns True si hay al menos un punto en la ruta
   */
  hasRoute = computed(() => this.routePoints().length > 0);

  // ── Acciones ───────────────────────────────────────────────────────────────

  /**
   * Envía el formulario y crea la actividad.
   *
   * Validaciones:
   * - Título no vacío
   * - Fecha de inicio presente
   * - Tipo de ubicación seleccionado
   * - Coordenadas establecidas
   *
   * Tras crear la actividad:
   * - Muestra mensaje de éxito (5 segundos)
   * - Resetea el formulario
   */
  submitForm(): void {
    if (!this.canSubmit) return;

    const selectedLocationTypeId = this.locationTypeId;
    if (selectedLocationTypeId === null) return;

    const pub = this.pubService.add({
      publicationType: 'event',
      placeId: null,
      locationTypeId: selectedLocationTypeId,
      title: this.title.trim(),
      description: this.description.trim() || undefined,
      startDate: this.allDay
        ? `${this.activityDate}T00:00`
        : `${this.activityDate}T${this.startTime || '00:00'}`,
      endDate: this.allDay
        ? null
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
        // Guardar indicaciones si existen
        ...(this.directions.trim() ? { directions: this.directions.trim() } : {})
      },
    });

    this.successMessage.set(`✅ Actividad "${pub.title}" creada. Aparecerá en el mapa.`);
    this.resetForm();
    setTimeout(() => this.successMessage.set(null), 5000);
  }

  /**
   * Resetea todos los campos del formulario a sus valores iniciales.
   * Limpia la ubicación y deselecciona todas las categorías.
   */
  resetForm(): void {
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
  }
}
