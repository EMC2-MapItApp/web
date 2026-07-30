/** @file settings.ts * @description Página de Ajustes de la aplicación MapIt.
 *  Estructura de secciones (cada una es un `mat-expansion-panel`):
 *  - **Mapa** – configuración visual del mapa:
 *  - Configurar POI: activa/desactiva los POIs nativos de Google Maps.
 *  @remarks * Las secciones futuras (p.ej. Cuenta, Notificaciones) se añadirán como
 *  nuevos `mat-expansion-panel` dentro del mismo `mat-accordion`.
 */

import {Component, inject} from '@angular/core';
import {ActivatedRoute} from '@angular/router';
import {MatExpansionModule} from '@angular/material/expansion';
import {MatSlideToggleModule} from '@angular/material/slide-toggle';
import {MatIconModule} from '@angular/material/icon';
import {MatButtonModule} from '@angular/material/button';
import {MatDividerModule} from '@angular/material/divider';
import {MapSettingsService} from '@core/services/map-settings.service';
import {ThemeService} from '@core/services/theme.service';
import {PushNotificationService} from '@core/services/push-notification.service';

/** Componente de la página de Ajustes.
 * @remarks Actúa como contenedor de configuración. Delega toda la lógica de estado
 * en los servicios correspondientes (actualmente solo {@link MapSettingsService}).
 * El componente es intencionadamente ligero: no contiene lógica propia.
 */

@Component({
  selector: 'app-settings-page',
  standalone: true,
  imports: [
    MatExpansionModule,
    MatSlideToggleModule,
    MatIconModule,
    MatButtonModule,
    MatDividerModule,
  ],
  templateUrl: './settings.html',
  styleUrl: './settings.scss',
})
export class SettingsPageComponent {
  /** Servicio que gestiona la configuración de POIs del mapa.
   *  Se expone como `readonly` para que el template pueda leerlo
   *  sin necesidad de getters intermedios.
   */

  readonly mapSettings = inject(MapSettingsService);
  readonly themeService = inject(ThemeService);
  readonly pushNotifications = inject(PushNotificationService);

  /** Permite enlazar aquí con `?section=notifications` (p. ej. desde la campana de notificaciones)
   *  para abrir directamente el acordeón de Notificaciones. */
  readonly notificationsSectionExpanded =
    inject(ActivatedRoute).snapshot.queryParamMap.get('section') === 'notifications';

  /** Activa/desactiva el push nativo del SO para este dispositivo. */
  togglePushNotifications(): void {
    if (this.pushNotifications.enabled()) {
      this.pushNotifications.disable();
    } else {
      this.pushNotifications.enable();
    }
  }
}
