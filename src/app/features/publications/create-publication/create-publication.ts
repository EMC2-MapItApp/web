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
  AfterViewInit, ViewChild, ElementRef, effect, DestroyRef,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { Subject, debounceTime, distinctUntilChanged, switchMap } from 'rxjs';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatDialog } from '@angular/material/dialog';
import { ActivatedRoute, Router } from '@angular/router';
import { GoogleMapsService } from '@core/services/google-maps.service';
import { CategoryService } from '@core/services/category.service';
import { CurrentUserService } from '@core/services/current-user.service';
import { MainCategory, SubCategory } from '@core/models/category.model';
import { Publication, PublicationVisibility } from '@core/models/publication.model';
import { Group, GroupSearchUser } from '@core/models/group.model';
import { GroupService } from '@core/services/group.service';
import { MatExpansionModule } from '@angular/material/expansion';
import { MapSettingsService } from '@core/services/map-settings.service';
import { ThemeService } from '@core/services/theme.service';
import { GeoIpService } from '@core/services/geo-ip.service';
import { DeviceLocationService } from '@core/services/device-location.service';
import { PublicationService } from '@core/services/publication.service';
import { ResponsiveService } from '@core/responsive/responsive.service';
import { LocationService } from '@core/services/location.service';
import { MapLocation } from '@core/models/location.model';
import { CONFIRM_DIALOG_CONFIG, withResponsiveDialogLayout } from '@core/constants/dialog.constants';
import { ConfirmDialogComponent, ConfirmDialogData } from '@shared/confirm-dialog/confirm-dialog';
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
  imports: [FormsModule, MatIconModule, MatButtonModule, MatProgressSpinnerModule, MatExpansionModule],
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

  /** Servicio de grupos, para el selector de visibilidad privada. */
  private readonly groupService = inject(GroupService);

  /** Servicio que expone el resto de publicaciones para pintarlas como POIs en el mapa */
  private readonly locationService = inject(LocationService);

  /** Servicio de usuario actual (usado para validaciones de tipo PARTICULAR) */
  readonly cu = inject(CurrentUserService);

  /** Toast/snack bar para feedback de creación y errores. */
  private readonly snackBar = inject(MatSnackBar);

  /** Diálogo de confirmación (aviso al crear una publicación privada sin invitados). */
  private readonly dialog = inject(MatDialog);

  private readonly mapSettingsService = inject(MapSettingsService);

  private readonly themeService = inject(ThemeService);

  private readonly geoIpService = inject(GeoIpService);
  private readonly deviceLocationService = inject(DeviceLocationService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly responsiveService = inject(ResponsiveService);

  /** Indica si el formulario está en modo repetición de actividad. */
  isRepeatMode = signal(false);

  /**
   * True si se llegó desde una publicación todavía activa (no caducada) para editarla.
   * Solo afecta al texto de la UI: en ambos casos `submitForm()` crea una publicación nueva.
   */
  isEditingActive = signal(false);

  routeMapCapture = signal<string | null>(null);

  /** True mientras se genera la captura de la ruta (muestra spinner). */
  capturingRoute = signal(false);

  /** Estado derivado para detectar viewport compacto (mobile/tablet). */
  readonly isCompactViewport = computed(() => {
    const state = this.responsiveService.state();
    return state.isMobile || state.isTablet;
  });

  /**
   * True solo en móvil/tablet en vertical: único caso sin ancho útil para
   * mostrar el mapa junto al formulario, así que este ocupa toda la pantalla.
   * En horizontal (aunque sea móvil/tablet) se usa el modo panel lateral,
   * igual que en escritorio.
   */
  readonly isFullscreenFormMode = computed(() => {
    const state = this.responsiveService.state();
    return (state.isMobile || state.isTablet) && state.isPortrait;
  });

  /**
   * En modo pantalla completa el formulario arranca oculto para priorizar el mapa.
   * En modo panel lateral (escritorio, o táctil en horizontal) permanece visible.
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

  /** Halo que resalta la publicación en foco (recién creada o en edición). */
  private highlightMarker: google.maps.Marker | null = null;

  /**
   * Id de la publicación en foco (recién creada o cargada para editar/repetir).
   * Se excluye de los markers POI planos porque ya se muestra resaltada aparte.
   */
  private focusedPublicationId = signal<number | null>(null);

  /** Última lista de publicaciones ajenas cargada para pintarlas como POIs no interactivos. */
  private otherLocations: MapLocation[] = [];

  /** Markers POI (no interactivos, sin listeners) del resto de publicaciones. */
  private poiMarkers: google.maps.Marker[] = [];

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

  // ── Visibilidad ────────────────────────────────────────────────────────────
  /** Visibilidad elegida: pública (por defecto) o privada (solo invitados). */
  visibility = signal<PublicationVisibility>('PUBLIC');

  // ── Invitados ──────────────────────────────────────────────────────────────
  /** Todos los grupos del usuario (organizador o miembro), para el atajo "invitar a todo el grupo". */
  myGroups = signal<Group[]>([]);

  /** true mientras se cargan los grupos del usuario (atajo "invitar a todo el grupo"). */
  loadingGroups = signal(true);

  /** Texto del buscador de usuarios a invitar. */
  inviteSearchQuery = '';

  /** true mientras se busca en el backend tras el debounce. */
  searchingInviteUsers = signal(false);

  /** Resultados de la última búsqueda de usuarios a invitar. */
  inviteSearchResults = signal<GroupSearchUser[]>([]);

  /**
   * Cola de usuarios invitados individualmente al evento, independiente de la visibilidad
   * elegida — se envía junto con la publicación al crearla (no hay invitación "en el momento"
   * porque la publicación todavía no existe, a diferencia del modo edición de grupos).
   */
  invitedUsers = signal<GroupSearchUser[]>([]);

  private readonly inviteSearchQuery$ = new Subject<string>();
  private readonly destroyRef = inject(DestroyRef);

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

  /**
   * true mientras la petición de creación está en curso. Bloquea el botón "Crear publicación"
   * (y su re-entrada en `submitForm()`) para que un doble click no dispare dos publicaciones —
   * más fácil de gatillar cuando hay invitados, aunque el envío de invitaciones ya no bloquea la
   * respuesta del backend (ver `PublicationInvitationDispatcher`), la creación en sí sigue
   * tardando lo normal de una petición HTTP.
   */
  submitting = signal(false);

  // ── Control de paneles expandidos ──────────────────────────────────────────
  /**
   * Estado de expansión de los acordeones.
   * Por defecto, el panel de información básica está abierto para guiar al usuario.
   */
  expandedPanels = {
    info: true,        // Información básica: abierto por defecto
    visibility: false, // Visibilidad e invitados: cerrado
    category: false,   // Categoría: cerrado
    location: false,   // Ubicación y ruta: cerrado
    dates: false,      // Fechas: cerrado
    details: false,    // Detalles: cerrado
  };

  /** @returns True si hay una ubicación seleccionada en el mapa */
  get locationSelected(): boolean {
    return this.lat() !== null && this.lng() !== null;
  }

  /**
   * @returns True si el formulario puede ser enviado
   * Requiere: título, fecha inicio, tipo de ubicación y coordenadas.
   *
   * No exige grupo ni invitados para publicaciones privadas: ambos son opcionales al crear
   * (se podrá invitar más adelante desde la edición) — si se envía sin ninguno de los dos,
   * `submitForm()` avisa con un diálogo de confirmación en vez de bloquear el botón.
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

    // Carga eager de los grupos del usuario (organizador o miembro), para el atajo "invitar a
    // todo el grupo" — la privacidad de la publicación ya no depende de ningún grupo, invitar
    // desde uno es solo una forma rápida de rellenar la cola de invitados individuales.
    this.groupService.getMyGroups().subscribe(groups => {
      this.myGroups.set(groups);
      this.loadingGroups.set(false);
    });

    // Buscador de usuarios a invitar al evento — mismo patrón que GroupFormPageComponent.
    this.inviteSearchQuery$.pipe(
      debounceTime(300),
      distinctUntilChanged(),
      switchMap(query => {
        this.searchingInviteUsers.set(true);
        return this.groupService.searchUsers(query ?? '');
      }),
      takeUntilDestroyed(this.destroyRef),
    ).subscribe(results => {
      this.searchingInviteUsers.set(false);
      this.inviteSearchResults.set(results);
    });

    // Sincroniza visibilidad del formulario según el modo.
    // En pantalla completa se prioriza el mapa; en panel lateral se mantiene visible.
    effect(() => {
      this.showFormPanel.set(!this.isFullscreenFormMode());
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

    // Repinta los POIs (sin fetch) cuando cambia la publicación en foco, para
    // que no se dupliquen con el marcador resaltado en el mismo punto.
    effect(() => {
      this.focusedPublicationId();
      if (this.map) this.renderPoiMarkers();
    });
  }

  /** Muestra el formulario desde la pestaña de toggle. */
  openFormPanel(): void {
    this.showFormPanel.set(true);
  }

  /** Oculta/colapsa el formulario desde la pestaña de toggle. */
  closeFormPanel(): void {
    this.showFormPanel.set(false);
  }

  // ── Visibilidad ────────────────────────────────────────────────────────────

  /** Elige la visibilidad de la publicación (tarjetas "Pública"/"Privada"). */
  selectVisibility(value: PublicationVisibility): void {
    this.visibility.set(value);
  }

  // ── Invitados ──────────────────────────────────────────────────────────────

  /** Dispara la búsqueda (con debounce) al escribir en el buscador de usuarios a invitar. */
  onInviteSearchInput(value: string): void {
    this.inviteSearchQuery$.next(value);
  }

  /** true si el usuario ya está en la cola de invitados. */
  isAlreadyInvited(userId: string): boolean {
    return this.invitedUsers().some(u => u.id === userId);
  }

  /** Añade un usuario encontrado por búsqueda a la cola de invitados. */
  queueInvite(user: GroupSearchUser): void {
    if (this.isAlreadyInvited(user.id)) return;
    this.invitedUsers.update(list => [...list, user]);
  }

  /** Quita un usuario de la cola de invitados. */
  removeInvite(userId: string): void {
    this.invitedUsers.update(list => list.filter(u => u.id !== userId));
  }

  /**
   * Atajo: añade a todos los miembros de un grupo (propio o del que se es miembro) a la cola de
   * invitados, sin necesidad de buscarlos uno a uno. No ata la publicación al grupo ni implica
   * pertenencia a él — es solo una forma rápida de rellenar la cola de invitación individual con
   * gente que ya conoces de otro contexto.
   */
  inviteGroupMembers(group: Group): void {
    const myId = this.cu.user()?.id;
    const alreadyQueued = new Set(this.invitedUsers().map(u => u.id));
    const toAdd: GroupSearchUser[] = group.members
      .filter(member => member.userId !== myId && !alreadyQueued.has(member.userId))
      .map(member => ({
        id: member.userId,
        name: member.name,
        nick: member.nick,
        email: '',
        avatarUrl: member.avatarUrl,
      }));

    if (toAdd.length === 0) return;
    this.invitedUsers.update(list => [...list, ...toAdd]);
  }

  /**
   * Etiqueta del botón principal según modo del formulario.
   */
  get submitButtonText(): string {
    if (!this.isRepeatMode()) return 'Crear publicación';
    return this.isEditingActive() ? 'Guardar cambios' : 'Repetir publicación';
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

      // Control nativo "Usar mi ubicación", solo en dispositivos de input táctil.
      if (this.deviceLocationService.isTouchPrimaryDevice()) {
        const locationControl = this.mapsService.buildMyLocationControl(() => this.useMyLocation());
        this.map.controls[google.maps.ControlPosition.RIGHT_BOTTOM].push(locationControl);
      }

      // listener de click igual que antes
      this.map.addListener('click', (e: google.maps.MapMouseEvent) => {
        if (!e.latLng) return;
        if (this.isAddingRoute) {
          this.addRoutePoint(e.latLng);
        } else {
          // Nuevo punto elegido a mano: ya no es la publicación en foco.
          this.focusedPublicationId.set(null);
          this.clearHighlight();
          this.lat.set(e.latLng.lat());
          this.lng.set(e.latLng.lng());
          this.placeMarker(e.latLng);
        }
      });

      this.loadOtherPublicationsAsPois();
      this.loadRepeatDraftFromQueryParams();
    });
  }

  /**
   * Carga el resto de publicaciones activas y las pinta como markers POI:
   * solo referencia visual, sin listeners de click/hover.
   */
  private loadOtherPublicationsAsPois(): void {
    this.locationService.getAll().subscribe(locations => {
      this.otherLocations = locations;
      this.renderPoiMarkers();
    });
  }

  /** Repinta los markers POI a partir de la última lista cargada, excluyendo la publicación en foco. */
  private renderPoiMarkers(): void {
    this.poiMarkers.forEach(marker => marker.setMap(null));
    this.poiMarkers = [];

    const focusedId = this.focusedPublicationId();
    const isDark = this.themeService.isDark();

    this.otherLocations
      .filter(location => location.id !== focusedId)
      .forEach(location => {
        const color = this.categoryService.resolveColor(location.locationTypeId);
        const icon = this.categoryService.resolveIcon(location.locationTypeId);
        const marker = new google.maps.Marker({
          position: { lat: location.lat, lng: location.lng },
          map: this.map,
          icon: this.mapsService.buildMarkerIcon(color, icon, 26, isDark),
          clickable: false,
          zIndex: 1,
        });
        this.poiMarkers.push(marker);
      });
  }

  /** Resalta con un halo la ubicación de la publicación en foco (recién creada o en edición). */
  private setHighlight(position: google.maps.LatLng): void {
    this.clearHighlight();
    this.highlightMarker = new google.maps.Marker({
      position,
      map: this.map,
      icon: {
        path: google.maps.SymbolPath.CIRCLE,
        scale: 22,
        fillColor: this.selectedMain()?.color ?? '#3f51b5',
        fillOpacity: 0.22,
        strokeColor: this.selectedMain()?.color ?? '#3f51b5',
        strokeWeight: 2,
        strokeOpacity: 0.55,
      },
      clickable: false,
      zIndex: 5,
    });
  }

  /** Elimina el halo de resaltado si existe. */
  private clearHighlight(): void {
    if (this.highlightMarker) {
      this.highlightMarker.setMap(null);
      this.highlightMarker = null;
    }
  }

  /**
  * Carga un borrador desde una publicación existente si llega `repeatFrom` en query params.
   */
  private loadRepeatDraftFromQueryParams(): void {
    // El id es un ObjectId de Mongo (string hexadecimal), no un número: no se
    // puede validar con Number()/Number.isFinite (siempre daría NaN).
    const repeatFromRaw = this.route.snapshot.queryParamMap.get('repeatFrom');
    if (!repeatFromRaw) {
      this.isRepeatMode.set(false);
      return;
    }

    this.pubService.getById(repeatFromRaw).subscribe({
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
    this.focusedPublicationId.set(publication.id);

    const finished = publication.active === false ||
      (!!publication.endDate && new Date(publication.endDate).getTime() <= Date.now());
    this.isEditingActive.set(!finished);

    this.title = publication.title;
    this.description = publication.description ?? '';
    this.locationTypeId = publication.locationTypeId;
    this.requiredLevel = publication.requiredLevel ?? 0;
    this.visibility.set(publication.visibility ?? 'PUBLIC');
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
      this.setHighlight(point);
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
   * Autoselecciona el tipo de ubicación cuando solo hay uno disponible: de
   * momento el único tipo real es "Quedadas" (el "Profesional" está filtrado
   * en `visibleTypes` y aún no implementado), así que en la práctica siempre
   * queda preseleccionado sin que el usuario tenga que pulsarlo.
   *
   * @param sub - Subcategoría a seleccionar
   */
  selectSub(sub: SubCategory): void {
    const isSame = this.selectedSub()?.id === sub.id;
    this.selectedSub.set(isSame ? null : sub);
    const types = this.visibleTypes();
    this.locationTypeId = types.length === 1 ? types[0].id : null;
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
    this.clearHighlight();
    this.focusedPublicationId.set(null);
  }

  /** Centra el mapa en la posición real del dispositivo (GPS/Wi-Fi/celda). */
  private useMyLocation(): void {
    this.deviceLocationService.getCurrentPosition().subscribe({
      next: ({ lat, lng }) => {
        this.map.panTo({ lat, lng });
        this.map.setZoom(15);
      },
      error: (error: { code: string }) => {
        this.snackBar.open(this.resolveLocationErrorMessage(error.code), 'Cerrar', {
          duration: 4000,
          horizontalPosition: 'center',
          verticalPosition: 'top',
        });
      },
    });
  }

  /** Traduce un código de error de geolocalización a un mensaje legible para el usuario. */
  private resolveLocationErrorMessage(code: string): string {
    switch (code) {
      case 'PERMISSION_DENIED':
        return 'Activa el permiso de ubicación en el navegador para usar esta función.';
      case 'TIMEOUT':
      case 'POSITION_UNAVAILABLE':
        return 'No se pudo obtener tu ubicación. Inténtalo de nuevo.';
      default:
        return 'Tu navegador no soporta geolocalización.';
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
   * En modo pantalla completa inicia el trazado y vuelve al mapa automáticamente
   * (en modo panel lateral el mapa ya es visible, no hace falta cerrar nada).
   */
  onRoutePrimaryAction(): void {
    const fullscreenMode = this.isFullscreenFormMode();

    if (fullscreenMode && !this.isAddingRoute) {
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
    return bounds;
  }

  /** Finaliza el trazado de ruta desde el mapa y vuelve al formulario. */
  finishRouteFromMap(): void {
    if (this.isAddingRoute) {
      this.toggleRouteMode();
    }

        // Spinner activo desde que se pulsa "Finalizar".
    this.capturingRoute.set(true);

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
            scale: 0.6,
            logging: false,
            useCORS: true,
            imageTimeout: 0,
          });
          // JPEG/WebP codifica mucho más rápido que PNG y pesa menos
          this.routeMapCapture.set(canvas.toDataURL('image/webp', 0.7));
        } catch (error) {
          console.error('Error capturando mapa:', error);
        } finally {
          // Oculta el spinner tanto en éxito como en error.
          this.capturingRoute.set(false);
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
   * Si la publicación es privada y no hay invitados en cola, nadie podrá apuntarse todavía — se
   * avisa con un diálogo de confirmación en vez de bloquear el envío (se puede invitar más
   * adelante desde la edición).
   *
  * Tras crear la publicación:
   * - Muestra mensaje de éxito (5 segundos)
   * - Resetea el formulario
   */
  submitForm(): void {
    if (!this.canSubmit || this.submitting()) return;

    const noAccessYet = this.visibility() === 'PRIVATE' && this.invitedUsers().length === 0;

    if (noAccessYet) {
      const dialogRef = this.dialog.open(ConfirmDialogComponent, withResponsiveDialogLayout(
        {
          ...CONFIRM_DIALOG_CONFIG,
          data: {
            title: 'Publicación sin invitados',
            message: '¡No hay invitados en esta publicación! ¿Deseas continuar?',
            icon: 'group_off',
            acceptText: 'Crear de todos modos',
            acceptIcon: 'check',
          } satisfies ConfirmDialogData,
        },
        this.isCompactViewport(),
      ));

      dialogRef.afterClosed().subscribe(confirmed => {
        if (confirmed) this.performSubmit();
      });
      return;
    }

    this.performSubmit();
  }

  /** Construye el payload y lanza la petición de creación — ver {@link submitForm}. */
  private performSubmit(): void {
    const selectedLocationTypeId = this.locationTypeId;
    if (selectedLocationTypeId === null) return;

    this.submitting.set(true);

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
      visibility: this.visibility(),
      inviteUserIds: this.invitedUsers().length > 0 ? this.invitedUsers().map(u => u.id) : undefined,
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
        this.submitting.set(false);

        const snackText = this.isEditingActive()
          ? 'Cambios guardados correctamente'
          : this.isRepeatMode() ? 'Publicación repetida correctamente' : 'Publicación creada correctamente';
        this.snackBar.open(snackText, 'Cerrar', {
          duration: 3500,
          horizontalPosition: 'center',
          verticalPosition: 'top',
        });
        this.successMessage.set(
          this.isEditingActive()
            ? `✅ Cambios guardados en "${pub.title}". Aparecerá en el mapa.`
            : this.isRepeatMode()
              ? `✅ Publicación "${pub.title}" repetida. Aparecerá en el mapa.`
              : `✅ Publicación "${pub.title}" creada. Aparecerá en el mapa.`
        );

        // La publicación creada se queda resaltada en su ubicación; solo se
        // resetean los campos del formulario para poder iniciar otra.
        const createdPosition = this.marker?.getPosition() ?? null;
        this.focusedPublicationId.set(pub.id);
        if (createdPosition) {
          this.setHighlight(createdPosition);
          this.map.panTo(createdPosition);
        }
        this.resetFormFields();
        this.clearRepeatFromQueryParam();
        this.loadOtherPublicationsAsPois();

        this.closeFormPanel();
        setTimeout(() => this.successMessage.set(null), 5000);
      },
      error: () => {
        this.submitting.set(false);
        this.snackBar.open('No se pudo crear la publicación. Inténtalo de nuevo.', 'Cerrar', {
          duration: 4000,
          horizontalPosition: 'center',
          verticalPosition: 'top',
        });
      },
    });
  }

  /**
   * Resetea todos los campos del formulario a sus valores iniciales.
   * Limpia también la ubicación y deselecciona todas las categorías.
   */
  resetForm(): void {
    this.resetFormFields();
    this.clearLocation();
    this.clearRepeatFromQueryParam();
  }

  /** Resetea los campos de contenido del formulario, sin tocar la ubicación fijada en el mapa. */
  private resetFormFields(): void {
    this.isRepeatMode.set(false);
    this.isEditingActive.set(false);
    this.visibility.set('PUBLIC');
    this.invitedUsers.set([]);
    this.inviteSearchQuery = '';
    this.inviteSearchResults.set([]);
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
    this.clearRoute();
    this.selectedMain.set(null);
    this.selectedSub.set(null);
  }

  /** Quita el query param `repeatFrom` de la URL sin recargar la página. */
  private clearRepeatFromQueryParam(): void {
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { repeatFrom: null },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }
}
