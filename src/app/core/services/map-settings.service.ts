/**
 * @file map-settings.service.ts
 * @description Servicio reactivo que gestiona la configuración visual del mapa:
 *   visibilidad de POIs nativos de Google Maps y tema oscuro del mapa.
 *
 * Flujo de datos:
 *   `localStorage`          → {@link MapSettingsService.settings}  (signal)
 *   {@link ThemeService}    → {@link MapSettingsService.mapStyles}  (computed)
 *                           → `google.maps.Map.setOptions({ styles })`
 *
 * El computed {@link MapSettingsService.mapStyles} combina dos capas de estilos:
 *   1. {@link DARK_MAP_STYLES} — cuando el modo oscuro está activo.
 *   2. {@link buildMapStyles}  — visibilidad de cada POI configurado por el usuario.
 */

import {Injectable, computed, effect, signal, inject} from '@angular/core';
import {MapSettings, PoiConfig} from '../models/map-settings.model';
import {ThemeService} from './theme.service';

// ─────────────────────────────────────────────────────────────────────────────
// Constantes de módulo
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Configuración por defecto de los POIs.
 * Solo `poi.park` y `transit` están activados inicialmente para reducir
 * el ruido visual del mapa y destacar los marcadores de MapIt.
 *
 * @remarks
 * Esta lista define también el orden en que se muestran los ítems
 * en la pantalla de Ajustes.
 */
const DEFAULT_POI: PoiConfig[] = [
  {
    id: 'poi.business',
    label: 'Negocios',
    icon: 'store',
    description: 'Tiendas, restaurantes y servicios de Google',
    visible: false
  },
  {
    id: 'poi.attraction',
    label: 'Atracciones',
    icon: 'attractions',
    description: 'Lugares turísticos y monumentos',
    visible: false
  },
  {
    id: 'poi.government',
    label: 'Edificios oficiales',
    icon: 'account_balance',
    description: 'Ayuntamientos, juzgados y edificios públicos',
    visible: false
  },
  {
    id: 'poi.medical',
    label: 'Salud',
    icon: 'local_hospital',
    description: 'Hospitales, clínicas y farmacias',
    visible: false
  },
  {id: 'poi.park', label: 'Parques', icon: 'park', description: 'Parques, jardines y zonas verdes', visible: true},
  {
    id: 'poi.place_of_worship',
    label: 'Lugares de culto',
    icon: 'church',
    description: 'Iglesias, mezquitas, sinagogas…',
    visible: false
  },
  {
    id: 'poi.school',
    label: 'Educación',
    icon: 'school',
    description: 'Colegios, institutos y universidades',
    visible: false
  },
  {
    id: 'poi.sports_complex',
    label: 'Deporte',
    icon: 'sports',
    description: 'Estadios, polideportivos y campos deportivos',
    visible: false
  },
  {
    id: 'transit',
    label: 'Transporte público',
    icon: 'directions_transit',
    description: 'Metro, autobús y estaciones de tren',
    visible: true
  },
];

/** Clave usada para almacenar y recuperar los ajustes en `localStorage`. */
const STORAGE_KEY = 'mapit_map_settings';

/**
 * Paleta de estilos oscuros para Google Maps.
 *
 * @remarks
 * Basado en el tema oficial de Google Maps "Night Mode".
 * Se antepone a los estilos de POI en {@link MapSettingsService.mapStyles}
 * cuando {@link ThemeService.isDark} es `true`.
 *
 * Las reglas siguen el orden de especificidad de la Styled Maps API:
 * primero se oscurece la geometría base (tierra, agua, carreteras) y después
 * se ajustan las etiquetas de texto sobre esa geometría.
 *
 * @see {@link https://developers.google.com/maps/documentation/javascript/style-reference}
 */
const DARK_MAP_STYLES: google.maps.MapTypeStyle[] = [
  { elementType: 'geometry',                stylers: [{ color: '#242f3e' }] },
  { elementType: 'labels.text.stroke',      stylers: [{ color: '#242f3e' }] },
  { elementType: 'labels.text.fill',        stylers: [{ color: '#746855' }] },
  { featureType: 'administrative.locality', elementType: 'labels.text.fill',    stylers: [{ color: '#d59563' }] },
  { featureType: 'road',                    elementType: 'geometry',             stylers: [{ color: '#38414e' }] },
  { featureType: 'road',                    elementType: 'geometry.stroke',      stylers: [{ color: '#212a37' }] },
  { featureType: 'road',                    elementType: 'labels.text.fill',     stylers: [{ color: '#9ca5b3' }] },
  { featureType: 'road.highway',            elementType: 'geometry',             stylers: [{ color: '#746855' }] },
  { featureType: 'road.highway',            elementType: 'geometry.stroke',      stylers: [{ color: '#1f2835' }] },
  { featureType: 'road.highway',            elementType: 'labels.text.fill',     stylers: [{ color: '#f3d19c' }] },
  { featureType: 'water',                   elementType: 'geometry',             stylers: [{ color: '#17263c' }] },
  { featureType: 'water',                   elementType: 'labels.text.fill',     stylers: [{ color: '#515c6d' }] },
  { featureType: 'water',                   elementType: 'labels.text.stroke',   stylers: [{ color: '#17263c' }] },
  { featureType: 'poi.park',                elementType: 'geometry',             stylers: [{ color: '#263c3f' }] },
  { featureType: 'poi.park',                elementType: 'labels.text.fill',     stylers: [{ color: '#6b9a76' }] },
  { featureType: 'transit',                 elementType: 'geometry',             stylers: [{ color: '#2f3948' }] },
  { featureType: 'poi', elementType: 'labels.icon',      stylers: [{ lightness: -40 }, { saturation: -30 }] },
  { featureType: 'poi', elementType: 'labels.text.fill', stylers: [{ color: '#a0aec0' }] },
  { featureType: 'poi', elementType: 'labels.text.stroke', stylers: [{ color: '#1e293b' }] },
];

// ─────────────────────────────────────────────────────────────────────────────
// Funciones auxiliares de módulo
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Fusiona los ajustes guardados con los valores por defecto.
 *
 * @remarks
 * Garantiza compatibilidad hacia adelante: si en una versión futura se añade
 * un nuevo POI a `DEFAULT_POI`, los usuarios que ya tengan datos en
 * `localStorage` lo recibirán con su valor por defecto en lugar de perderlo.
 * El orden final siempre sigue el de `DEFAULT_POI`.
 *
 * @param saved - Ajustes recuperados de `localStorage`.
 * @returns Objeto `MapSettings` con todos los POIs conocidos en el orden correcto.
 */
function mergeWithDefaults(saved: MapSettings): MapSettings {
  const savedIds = new Set(saved.poi.map(p => p.id));
  const merged = [
    ...saved.poi,
    ...DEFAULT_POI.filter(p => !savedIds.has(p.id)),
  ];
  // Mantener el orden del array de defaults
  const ordered = DEFAULT_POI.map(def => merged.find(p => p.id === def.id) ?? def);
  return {poi: ordered};
}

/**
 * Construye el array de estilos de Google Maps a partir del estado de visibilidad
 * de los POIs.
 *
 * @remarks
 * Estrategia:
 * 1. Oculta **todos** los POIs con reglas base sobre `featureType: 'poi'`.
 * 2. Para cada POI marcado como visible re-activa `elementType: 'all'`
 *    (geometry + labels.text + **labels.icon**) para ese subtipo concreto.
 *    Usar solo `geometry` o `labels.text` dejaba los iconos ocultos porque
 *    la regla base `elementType: 'labels'` cubre también `labels.icon`.
 * 3. `transit` se trata como caso especial (no es un subtipo de `poi`).
 *
 * @param poi - Lista de configuraciones de POI con su estado actual.
 * @returns Array de {@link google.maps.MapTypeStyle} listo para pasar a
 *   `google.maps.Map` mediante `new google.maps.Map(el, { styles })` o
 *   `map.setOptions({ styles })`.
 */
function buildMapStyles(poi: PoiConfig[]): google.maps.MapTypeStyle[] {
  const styles: google.maps.MapTypeStyle[] = [
    // Ocultar geometría e iconos/texto de TODOS los POIs
    { featureType: 'poi', elementType: 'geometry', stylers: [{ visibility: 'off' }] },
    { featureType: 'poi', elementType: 'labels',   stylers: [{ visibility: 'off' }] },
  ];

  for (const p of poi) {
    // Transit no es un poi.* → gestión independiente
    if (p.id === 'transit') {
      styles.push({
        featureType: 'transit',
        elementType: 'labels.icon',
        stylers: [{ visibility: p.visible ? 'on' : 'off' }],
      });
      continue;
    }

    if (p.visible) {
      // 'all' restaura geometry + labels.text + labels.icon de una vez
      styles.push({
        featureType: p.id,
        elementType: 'all',
        stylers: [{ visibility: 'on' }],
      });
    }
  }

  return styles;
}

// ─────────────────────────────────────────────────────────────────────────────
// Servicio
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Servicio singleton que gestiona la configuración de POIs del mapa.
 *
 * @remarks
 * - Los ajustes se persisten automáticamente en `localStorage` mediante un
 *   `effect()` interno, sin necesidad de llamadas explícitas de guardado.
 * - El signal {@link mapStyles} es consumido directamente por
 *   {@link MapsPageComponent}, que reacciona a cambios con otro `effect()`.
 * - Migración a BD: sustituir `localStorage` por `HttpClient` en
 *   {@link loadSettings} y en el `effect()` del constructor.
 */
@Injectable({providedIn: 'root'})
export class MapSettingsService {

  /**
   * Referencia al {@link ThemeService} para leer {@link ThemeService.isDark}
   * de forma reactiva dentro del computed {@link mapStyles}.
   * Cuando el tema cambia, Angular recalcula automáticamente `mapStyles`
   * sin necesidad de suscripciones manuales.
   */
  private readonly themeService = inject(ThemeService);

  /**
   * Signal con el estado completo de los ajustes del mapa.
   * Inicializado desde `localStorage` o con {@link DEFAULT_POI} si no hay datos.
   */
  readonly settings = signal<MapSettings>(this.loadSettings());

  /**
   * Computed signal con el array de estilos final listo para Google Maps.
   *
   * @remarks
   * Combina **dos capas** en orden de precedencia:
   * 1. **Tema oscuro** ({@link DARK_MAP_STYLES}) — se incluye solo si
   *    {@link ThemeService.isDark} es `true`. Oscurece geometría base,
   *    carreteras, agua y etiquetas.
   * 2. **POIs** ({@link buildMapStyles}) — oculta/muestra los POIs nativos
   *    de Google Maps según la configuración del usuario.
   *
   * Se recalcula automáticamente cuando cambia cualquiera de sus dependencias:
   * {@link settings} (POIs) o {@link ThemeService.isDark} (tema).
   *
   * {@link MapsPageComponent} consume este signal en un `effect()` para
   * llamar a `map.setOptions({ styles })` sin suscripciones manuales.
   */
  readonly mapStyles = computed<google.maps.MapTypeStyle[]>(() => [
    ...(this.themeService.isDark() ? DARK_MAP_STYLES : []),
    ...buildMapStyles(this.settings().poi),
  ]);

  /**
   * Registra el `effect()` de persistencia automática en `localStorage`.
   *
   * @remarks
   * El `effect()` persiste únicamente {@link settings} (configuración de POIs),
   * no el tema oscuro, ya que ese estado lo gestiona {@link ThemeService}
   * con su propia clave en `localStorage`.
   *
   * El `effect()` debe declararse en el constructor porque es el único lugar
   * que garantiza un contexto de inyección activo en Angular.
   */
  constructor() {
    // Auto-guardar en localStorage cada vez que cambie algún ajuste
    effect(() => {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.settings()));
    });
  }

  /**
   * Alterna la visibilidad de un POI.
   *
   * @param id - Identificador del POI a modificar (coincide con `featureType`
   *   de la API de Google Maps, p.ej. `'poi.park'` o `'transit'`).
   */
  togglePoi(id: string): void {
    this.settings.update(s => ({
      ...s,
      poi: s.poi.map(p => p.id === id ? {...p, visible: !p.visible} : p),
    }));
  }

  /**
   * Restablece todos los ajustes a los valores por defecto definidos en
   * {@link DEFAULT_POI} y sobreescribe `localStorage`.
   */
  resetToDefaults(): void {
    this.settings.set({poi: [...DEFAULT_POI]});
  }

  /**
   * Carga los ajustes desde `localStorage` y los fusiona con los defaults.
   *
   * @returns `MapSettings` con los ajustes guardados o los valores por defecto
   *   si `localStorage` no está disponible o los datos están corruptos.
   */
  private loadSettings(): MapSettings {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return mergeWithDefaults(JSON.parse(raw) as MapSettings);
    } catch { /* localStorage no disponible */
    }
    return {poi: [...DEFAULT_POI]};
  }
}
