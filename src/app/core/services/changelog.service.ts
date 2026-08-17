import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map, shareReplay } from 'rxjs';
import { ChangelogEntry } from '../models/changelog.model';

/**
 * @file changelog.service.ts
 * @description Novedades y correcciones de la app, servidas como JSON estático desde
 * `public/assets/changelog.json` (sin backend). Se comparte una única petición HTTP
 * (`shareReplay`) entre el welcome-dialog y las páginas `/about` y `/changelog`.
 */
@Injectable({ providedIn: 'root' })
export class ChangelogService {
  private readonly http = inject(HttpClient);
  private readonly entries$: Observable<ChangelogEntry[]> = this.http
    .get<ChangelogEntry[]>('/assets/changelog.json')
    .pipe(
      map((entries) => [...entries].sort((a, b) => b.date.localeCompare(a.date))),
      shareReplay(1),
    );

  getAll(): Observable<ChangelogEntry[]> {
    return this.entries$;
  }
}
