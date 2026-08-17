import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { MatDialogRef, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { Router } from '@angular/router';
import { DatePipe } from '@angular/common';
import { ChangelogService } from '@core/services/changelog.service';
import { ChangelogEntry, ChangelogEntryType } from '@core/models/changelog.model';

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

/**
 * Diálogo de bienvenida para visitantes anónimos, abierto una vez por sesión de navegador desde
 * {@link HomeShellComponent} (marcado con `sessionStorage['welcome-dialog-shown']` para no repetirse
 * en cada navegación dentro de la misma pestaña).
 */
@Component({
  selector: 'app-welcome-dialog',
  standalone: true,
  imports: [MatDialogModule, MatButtonModule, MatIconModule, DatePipe],
  templateUrl: './welcome-dialog.html',
  styleUrl: './welcome-dialog.scss',
})
export class WelcomeDialogComponent implements OnInit {
  readonly dialogRef = inject(MatDialogRef<WelcomeDialogComponent>);

  private readonly router = inject(Router);
  private readonly changelogService = inject(ChangelogService);

  private readonly entries = signal<ChangelogEntry[]>([]);

  readonly expanded = signal(false);

  readonly latestEntry = computed<ChangelogEntry | undefined>(() => this.entries()[0]);

  /** Resto de entradas con la misma fecha que la más reciente, reveladas al pulsar "Ver más". */
  readonly sameDayRest = computed<ChangelogEntry[]>(() => {
    const latest = this.latestEntry();
    if (!latest) return [];
    return this.entries()
      .slice(1)
      .filter((entry) => entry.date === latest.date);
  });

  ngOnInit(): void {
    this.changelogService.getAll().subscribe((entries) => this.entries.set(entries));
  }

  showMore(): void {
    this.expanded.set(true);
  }

  typeIcon(type: ChangelogEntryType): string {
    return TYPE_ICON[type];
  }

  typeLabel(type: ChangelogEntryType): string {
    return TYPE_LABEL[type];
  }

  goToRegister(): void {
    this.dialogRef.close();
    this.router.navigate(['/register']);
  }

  goToLogin(): void {
    this.dialogRef.close();
    this.router.navigate(['/login']);
  }

  goToAbout(): void {
    this.dialogRef.close();
    this.router.navigate(['/about']);
  }
}
