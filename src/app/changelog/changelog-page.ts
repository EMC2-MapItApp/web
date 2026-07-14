/**
 * @file changelog-page.ts
 * @description Página pública (sin login) con el historial completo de novedades y
 * correcciones, alimentada por {@link ChangelogService} (JSON estático en
 * `public/assets/changelog.json`). Accesible desde el enlace "Ver todas" del welcome-dialog y
 * desde `/about`.
 */
import { Component, OnInit, inject, signal } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { RouterLink } from '@angular/router';
import { DatePipe } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { ChangelogService } from '../core/services/changelog.service';
import { ChangelogEntry, ChangelogEntryType } from '../core/models/changelog.model';

const TYPE_ICON: Record<ChangelogEntryType, string> = {
  feature: 'auto_awesome',
  improvement: 'trending_up',
  fix: 'build',
};

const TYPE_LABEL: Record<ChangelogEntryType, string> = {
  feature: 'Novedad',
  improvement: 'Mejora',
  fix: 'Corrección',
};

@Component({
  selector: 'app-changelog-page',
  standalone: true,
  imports: [RouterLink, DatePipe, MatIconModule],
  templateUrl: './changelog-page.html',
  styleUrl: './changelog-page.scss',
})
export class ChangelogPageComponent implements OnInit {
  private readonly titleService = inject(Title);
  private readonly changelogService = inject(ChangelogService);

  readonly entries = signal<ChangelogEntry[]>([]);

  ngOnInit(): void {
    this.titleService.setTitle('MapIt — Novedades');
    this.changelogService.getAll().subscribe(entries => this.entries.set(entries));
  }

  typeIcon(type: ChangelogEntryType): string {
    return TYPE_ICON[type];
  }

  typeLabel(type: ChangelogEntryType): string {
    return TYPE_LABEL[type];
  }
}
