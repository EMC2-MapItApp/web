import { Component } from '@angular/core';

/**
 * Placeholder de la página de dashboard (niveles/XP/gamificación). Sin contenido real
 * todavía — el enlace del menú está deshabilitado en {@link HomeComponent} hasta que el backend
 * exponga esos datos; la ruta existe para no tener que recablear el routing cuando se implemente.
 */
@Component({
  selector: 'app-dashboard-page',
  standalone: true,
  template: `<h2>Dashboard</h2><p>Contenido del dashboard.</p>`
})
export class DashboardPageComponent {}
