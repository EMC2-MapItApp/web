/**
 * @file about-page.ts
 * @description Página "Acerca de" con una breve descripción de MapIt y enlaces a las páginas
 * de portfolio existentes (`/stack`) y al historial de novedades (`/changelog`). Se renderiza
 * dentro del shell de home (ruta hija sin guard de login) para compartir el mismo marco visual
 * que el resto de páginas de la app (Ajustes, Perfil).
 */
import { Component, OnInit, inject } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatExpansionModule } from '@angular/material/expansion';

@Component({
  selector: 'app-about-page',
  standalone: true,
  imports: [RouterLink, MatIconModule, MatExpansionModule],
  templateUrl: './about-page.html',
  styleUrl: './about-page.scss',
})
export class AboutPageComponent implements OnInit {
  private readonly titleService = inject(Title);

  /** Versión mostrada al usuario; se mantiene a mano (el `version` de package.json no se bumpea). */
  readonly version = '1.0.0';

  ngOnInit(): void {
    this.titleService.setTitle('MapIt — Acerca de');
  }
}
