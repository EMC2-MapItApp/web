/**
 * @file about-page.ts
 * @description Página pública (sin login) "Acerca de" con una breve descripción de MapIt y
 * enlaces a las páginas de portfolio existentes (`/stack`) y al historial de novedades
 * (`/changelog`).
 */
import { Component, OnInit, inject } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'app-about-page',
  standalone: true,
  imports: [RouterLink, MatIconModule],
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
