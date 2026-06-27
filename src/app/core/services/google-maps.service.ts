import { Injectable } from '@angular/core';
import { environment } from '../../../environments/environment';

/**
 * Servicio encargado de gestionar la carga dinámica de la API de Google Maps.
 *
 * @remarks
 * Implementa un patrón de carga diferida (_lazy loading_) con promesa reutilizable,
 * de modo que el script de Google Maps solo se inyecta una vez en el DOM,
 * independientemente de cuántas veces se invoque {@link GoogleMapsService.load}.
 *
 * @example
 * ```typescript
 * export class MiComponente implements AfterViewInit {
 *   private mapsService = inject(GoogleMapsService);
 *
 *   async ngAfterViewInit(): Promise<void> {
 *     await this.mapsService.load();
 *     const map = new google.maps.Map(this.mapContainer.nativeElement, { zoom: 12 });
 *   }
 * }
 * ```
 */
@Injectable({ providedIn: 'root' })
export class GoogleMapsService {
  /**
   * Promesa de carga almacenada en caché.
   *
   * @remarks
   * Se inicializa la primera vez que se llama a {@link GoogleMapsService.load} y se
   * reutiliza en llamadas sucesivas para evitar inyectar el script más de una vez.
   * Su valor es `null` hasta que se realiza la primera solicitud de carga.
   */
  private loadingPromise: Promise<void> | null = null;

  /**
   * Carga la API de Google Maps de forma asíncrona e idempotente.
   *
   * @remarks
   * - Si la API ya está disponible en `window.google.maps`, resuelve inmediatamente.
   * - Si ya existe una carga en curso, devuelve la misma promesa sin crear un nuevo script.
   * - En caso contrario, inyecta el script de Google Maps en el `<head>` del documento.
   *
   * @returns Promesa que se resuelve cuando la API de Google Maps está lista para usarse,
   * o se rechaza si el script no puede cargarse.
   *
   * @throws {@link Error} Si el script de la API de Google Maps no puede ser cargado.
   *
   * @example
   * ```typescript
   * await this.mapsService.load();
   * const geocoder = new google.maps.Geocoder();
   * ```
   */

  /**
   * Genera un icono SVG circular para marcadores del mapa.
   * @param color - Color HEX de fondo del círculo.
   * @param emoji - Emoji o texto centrado dentro del círculo.
   * @param size  - Tamaño del icono en píxeles (por defecto 36).
   * @param dark  - Si es `true`, añade sombra para mejorar visibilidad sobre mapa oscuro.
   */
  buildMarkerIcon(
    color: string,
    emoji: string,
    size = 36,
    dark = false,
  ): { url: string; scaledSize: google.maps.Size; anchor: google.maps.Point } {
    const half = size / 2;
    const r    = half - 2;
    const shadowFilter = dark
      ? `<defs>
         <filter id="s" x="-40%" y="-40%" width="180%" height="180%">
           <feDropShadow dx="0" dy="0" stdDeviation="3"
             flood-color="rgba(0,0,0,0.7)" flood-opacity="1"/>
         </filter>
       </defs>`
      : '';
    const filterAttr = dark ? 'filter="url(#s)"' : '';
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
    ${shadowFilter}
    <circle cx="${half}" cy="${half}" r="${r}" fill="${color}" stroke="white" stroke-width="2" ${filterAttr}/>
    <text x="${half}" y="${half + 5}" text-anchor="middle" font-size="${Math.round(size * 0.44)}">${emoji}</text>
  </svg>`;
    return {
      url:        'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(svg),
      scaledSize: new google.maps.Size(size, size),
      anchor:     new google.maps.Point(half, half),
    };
  }

  load(): Promise<void> {
    if (this.loadingPromise) {
      return this.loadingPromise;
    }

    this.loadingPromise = new Promise<void>((resolve, reject) => {
      if ((window as any).google?.maps) {
        resolve();
        return;
      }

      const script = document.createElement('script');
      script.src = `https://maps.googleapis.com/maps/api/js?key=${environment.googleMapsApiKey}&v=weekly`;
      script.async = true;
      script.defer = true;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error('No se pudo cargar Google Maps API'));
      document.head.appendChild(script);
    });

    return this.loadingPromise;
  }
}
