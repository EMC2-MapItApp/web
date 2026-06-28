/**
 * @file profile.ts
 * @description Página de perfil del usuario activo.
 */
import { Component, inject, signal } from '@angular/core';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatDividerModule } from '@angular/material/divider';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Router } from '@angular/router';
import { CurrentUserService } from '../../../core/services/current-user.service';
import { UserService } from '../../../core/services/user.service';
import { CategoryService } from '../../../core/services/category.service';
import { MainCategory, SubCategory } from '../../../core/models/category.model';
import { DatePipe, SlicePipe } from '@angular/common';
import { Publication } from '../../../core/models/publication.model';
import { PublicationService } from '../../../core/services/publications.service';

const USER_TYPE_LABELS: Record<string, string> = {
  individual: 'Particular',
  professional: 'Profesional',
  entity: 'Entidad',
};

const USER_TYPE_EMOJIS: Record<string, string> = {
  individual: '🙋',
  professional: '🏪',
  entity: '🏛️',
};

const XP_PER_LEVEL = [0, 100, 250, 450, 700, 1000, 1400, 1900, 2500, 3200, 4000];

@Component({
  selector: 'app-profile-page',
  standalone: true,
  imports: [
    DatePipe,
    SlicePipe,
    ReactiveFormsModule,
    MatIconModule, MatButtonModule,
    MatFormFieldModule, MatInputModule,
    MatProgressSpinnerModule,
    MatExpansionModule, MatDividerModule,
  ],
  templateUrl: './profile.html',
  styleUrl: './profile.scss',
})
export class ProfilePageComponent {

  readonly cu = inject(CurrentUserService);
  private userService = inject(UserService);
  private categoryService = inject(CategoryService);
  private publicationService = inject(PublicationService);
  private snackBar = inject(MatSnackBar);
  private router = inject(Router);
  private fb = inject(FormBuilder);

  /** Publicaciones del usuario para el panel "Mis actividades". */
  myPublications = signal<Publication[]>([]);

  /** Estado de carga de publicaciones del perfil. */
  loadingPublications = signal(false);

  /** Error al cargar/borrar publicaciones. */
  publicationsError = signal<string | null>(null);

  // ── Árbol de categorías para el selector de favoritos ──────────────────────
  categories = signal<MainCategory[]>([]);

  /** Categoría expandida en el selector de favoritos (null = ninguna). */
  expandedMain = signal<number | null>(null);

  /** Subcategoría expandida (null = ninguna). */
  expandedSub = signal<number | null>(null);

  constructor() {
    this.categoryService.getAll().subscribe(cats => this.categories.set(cats));
    this.loadMyPublications();
  }

  /**
   * Recarga la lista de actividades del usuario autenticado.
   */
  loadMyPublications(): void {
    this.loadingPublications.set(true);
    this.publicationsError.set(null);

    this.publicationService.getMine(false).subscribe({
      next: pubs => {
        this.myPublications.set(
          [...pubs].sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime())
        );
        this.loadingPublications.set(false);
      },
      error: () => {
        this.loadingPublications.set(false);
        this.publicationsError.set('No se pudieron cargar tus actividades.');
      }
    });
  }

  /**
   * Determina si una actividad está finalizada.
   *
   * Se considera finalizada si ya no está activa o si su fecha de fin ya venció.
   */
  isFinished(publication: Publication): boolean {
    if (publication.active === false) return true;
    if (!publication.endDate) return false;
    return new Date(publication.endDate).getTime() <= Date.now();
  }

  /**
   * Elimina de forma definitiva una actividad del usuario.
   */
  deletePublication(publication: Publication): void {
    this.publicationService.remove(publication.id).subscribe({
      next: () => {
        this.myPublications.update(list => list.filter(item => item.id !== publication.id));
        this.snackBar.open('Actividad eliminada definitivamente', 'Cerrar', {
          duration: 3000,
          horizontalPosition: 'center',
          verticalPosition: 'top',
        });
      },
      error: () => {
        this.snackBar.open('No se pudo eliminar la actividad', 'Cerrar', {
          duration: 3000,
          horizontalPosition: 'center',
          verticalPosition: 'top',
        });
      }
    });
  }

  /**
   * Inicia el flujo de repetir actividad.
   *
   * Navega a crear actividad indicando el id origen para precargar los datos.
   */
  repeatPublication(publication: Publication): void {
    this.router.navigate(['/create-activity'], {
      queryParams: { repeatFrom: publication.id },
    });
  }

  // ── Modo edición ────────────────────────────────────────────────────────────

  /** true = mostrando formulario de edición */
  editMode = signal(false);
  saving = signal(false);
  saveError = signal<string | null>(null);

  /** Formulario de edición del perfil */
  editForm = this.fb.group({
    name: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(100)]],
    avatarUrl: [''],
    phone: ['', Validators.maxLength(25)],
    city: ['', Validators.maxLength(100)],
    province: ['', Validators.maxLength(100)],
    bio: ['', Validators.maxLength(1000)],
    birthDate: [''],
  });

  /** Abre el modo edición cargando los valores actuales del usuario */
  openEdit(): void {
    const u = this.cu.user();
    if (!u) return;
    this.editForm.patchValue({
      name: u.name ?? '',
      avatarUrl: u.avatarUrl ?? '',
      phone: u.phone ?? '',
      city: u.city ?? '',
      province: u.province ?? '',
      bio: u.bio ?? '',
      birthDate: u.birthDate ?? '',
    });
    this.saveError.set(null);
    this.editMode.set(true);
  }

  cancelEdit(): void {
    this.editMode.set(false);
  }

  saveEdit(): void {
    if (this.editForm.invalid || this.saving()) return;
    const v = this.editForm.value;
    this.saving.set(true);
    this.saveError.set(null);

    this.userService.updateProfile({
      name: v.name || undefined,
      avatarUrl: v.avatarUrl || undefined,
      phone: v.phone || undefined,
      city: v.city || undefined,
      province: v.province || undefined,
      bio: v.bio || undefined,
      birthDate: v.birthDate || undefined,
    }).subscribe({
      next: () => {
        this.saving.set(false);
        this.editMode.set(false);
      },
      error: () => {
        this.saving.set(false);
        this.saveError.set('Error al guardar. Inténtalo de nuevo.');
      },
    });
  }

  /**
 * Set de ids de secciones actualmente abiertas.
 * Por defecto la primera sección relevante de cada tipo arranca abierta.
 */
  openSections = signal<Set<string>>(new Set([
    'level',        // individual: abierto por defecto
    'account',      // todos: abierto por defecto
  ]));

  toggleSection(id: string): void {
    this.openSections.update(s => {
      const next = new Set(s);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  openSection(id: string): void {
    this.openSections.update(s => new Set([...s, id]));
  }

  closeSection(id: string): void {
    this.openSections.update(s => { const n = new Set(s); n.delete(id); return n; });
  }

  isSectionOpen(id: string): boolean {
    return this.openSections().has(id);
  }

  // ── Helpers de tipo ────────────────────────────────────────────────────────

  get typeLabel(): string { return USER_TYPE_LABELS[this.cu.userType()!] ?? this.cu.userType(); }
  get typeEmoji(): string { return USER_TYPE_EMOJIS[this.cu.userType()!] ?? '👤'; }

  // ── Nivel / XP ─────────────────────────────────────────────────────────────

  get xpForNextLevel(): number {
    const level = this.cu.userLevel() ?? 0;
    return XP_PER_LEVEL[level + 1] ?? XP_PER_LEVEL[XP_PER_LEVEL.length - 1];
  }

  get xpForCurrentLevel(): number {
    return XP_PER_LEVEL[this.cu.userLevel() ?? 0] ?? 0;
  }

  get levelProgress(): number {
    const xp = this.cu.userXp() ?? 0;
    const base = this.xpForCurrentLevel;
    const target = this.xpForNextLevel;
    if (target === base) return 100;
    return Math.min(100, Math.round(((xp - base) / (target - base)) * 100));
  }

  get isMaxLevel(): boolean { return (this.cu.userLevel() ?? 0) >= 10; }

  // ── Favoritos ──────────────────────────────────────────────────────────────

  /** Alterna expansión de una categoría principal. */
  toggleMain(catId: number): void {
    this.expandedMain.update(v => v === catId ? null : catId);
    this.expandedSub.set(null);
  }

  /** Alterna expansión de una subcategoría. */
  toggleSub(subId: number): void {
    this.expandedSub.update(v => v === subId ? null : subId);
  }

  /** Comprueba si un locationTypeId está en favoritos. */
  isFavorite(typeId: number): boolean {
    return this.cu.favoriteTypeIds().includes(typeId);
  }

  /**
   * Comprueba el estado de selección de una categoría principal:
   *  'all'  → todos sus tipos son favoritos
   *  'some' → algunos son favoritos
   *  'none' → ninguno es favorito
   */
  mainSelectionState(cat: MainCategory): 'all' | 'some' | 'none' {
    const subStates = cat.subcategories.map(s => this.subSelectionState(s));
    const withSelection = subStates.filter(s => s !== 'none').length;

    if (withSelection === 0) return 'none';
    if (withSelection === subStates.length) return 'all';   // todas las subcats tienen algo
    return 'some';
  }

  /**
   * Comprueba el estado de selección de una subcategoría:
   *  'all'  → todos sus tipos son favoritos
   *  'some' → algunos
   *  'none' → ninguno
   */
  subSelectionState(sub: SubCategory): 'all' | 'some' | 'none' {
    const typeIds = sub.locationTypes.map(t => t.id);
    const favCount = typeIds.filter(id => this.isFavorite(id)).length;
    if (favCount === 0) return 'none';
    if (favCount === typeIds.length) return 'all';
    return 'some';
  }

  /** Añade o quita un locationTypeId de favoritos. */
  toggleFavorite(typeId: number): void {
    const current = [...this.cu.favoriteTypeIds()];
    const idx = current.indexOf(typeId);
    if (idx >= 0) current.splice(idx, 1);
    else current.push(typeId);
    this.cu.patch({ favoriteLocationTypeIds: current });
  }

  /**
 * Nivel mínimo requerido para marcar como favorito un tipo profesional.
 * Se define aquí de forma centralizada para cambiarlo fácilmente.
 */
  private readonly PROFESSIONAL_TYPE_REQUIRED_LEVEL = 10;

  /**
   * Comprueba si un locationTypeId corresponde a un tipo profesional.
   * Por convención todos los tipos profesionales terminan en '-profesional'.
   */
  isProfessionalType(typeId: number): boolean {
    const type = this.categoryService.getLocationTypeById(typeId);
    return type?.name.toLowerCase() === 'profesional';
  }

  /**
   * Comprueba si el usuario puede interactuar con un tipo de localización.
   * Los tipos profesionales requieren nivel 10.
   * El resto están siempre disponibles.
   */
  canToggleFavorite(typeId: number): boolean {
    if (!this.isProfessionalType(typeId)) return true;
    return (this.cu.userLevel() ?? 0) >= this.PROFESSIONAL_TYPE_REQUIRED_LEVEL;
  }

  /**
   * Versión protegida de toggleFavorite: ignora la acción si no tiene nivel.
   */
  toggleFavoriteIfAllowed(typeId: number): void {
    if (this.canToggleFavorite(typeId)) this.toggleFavorite(typeId);
  }

  /**
   * Versión protegida de toggleSubFavorites: filtra los tipos bloqueados.
   */
  toggleSubFavoritesIfAllowed(sub: SubCategory): void {
    const allowedIds = sub.locationTypes
      .filter(t => this.canToggleFavorite(t.id))
      .map(t => t.id);

    if (allowedIds.length === 0) return;

    const allFav = allowedIds.every(id => this.isFavorite(id));
    const current = [...this.cu.favoriteTypeIds()];

    if (allFav) {
      this.cu.patch({ favoriteLocationTypeIds: current.filter(id => !allowedIds.includes(id)) });
    } else {
      const toAdd = allowedIds.filter(id => !current.includes(id));
      this.cu.patch({ favoriteLocationTypeIds: [...current, ...toAdd] });
    }
  }

  /**
   * Versión protegida de toggleMainFavorites: filtra los tipos bloqueados.
   */
  toggleMainFavoritesIfAllowed(cat: MainCategory): void {
    const allowedIds = cat.subcategories
      .flatMap(s => s.locationTypes)
      .filter(t => this.canToggleFavorite(t.id))
      .map(t => t.id);

    if (allowedIds.length === 0) return;

    const allFav = allowedIds.every(id => this.isFavorite(id));
    const current = [...this.cu.favoriteTypeIds()];

    if (allFav) {
      this.cu.patch({ favoriteLocationTypeIds: current.filter(id => !allowedIds.includes(id)) });
    } else {
      const toAdd = allowedIds.filter(id => !current.includes(id));
      this.cu.patch({ favoriteLocationTypeIds: [...current, ...toAdd] });
    }
  }

  /**
   * Marca/desmarca todos los tipos de una subcategoría.
   * Si todos están marcados → los desmarca. Si no → los marca todos.
   */
  toggleSubFavorites(sub: SubCategory): void {
    const typeIds = sub.locationTypes.map(t => t.id);
    const allFav = typeIds.every(id => this.isFavorite(id));
    const current = [...this.cu.favoriteTypeIds()];

    if (allFav) {
      // Desmarcar todos
      this.cu.patch({ favoriteLocationTypeIds: current.filter(id => !typeIds.includes(id)) });
    } else {
      // Marcar los que faltan
      const toAdd = typeIds.filter(id => !current.includes(id));
      this.cu.patch({ favoriteLocationTypeIds: [...current, ...toAdd] });
    }
  }

  /**
   * Marca/desmarca todos los tipos de una categoría principal.
   */
  toggleMainFavorites(cat: MainCategory): void {
    const typeIds = cat.subcategories.flatMap(s => s.locationTypes.map(t => t.id));
    const allFav = typeIds.every(id => this.isFavorite(id));
    const current = [...this.cu.favoriteTypeIds()];

    if (allFav) {
      this.cu.patch({ favoriteLocationTypeIds: current.filter(id => !typeIds.includes(id)) });
    } else {
      const toAdd = typeIds.filter(id => !current.includes(id));
      this.cu.patch({ favoriteLocationTypeIds: [...current, ...toAdd] });
    }
  }

  /** Número total de favoritos seleccionados. */
  get favoritesCount(): number {
    return this.cu.favoriteTypeIds().length;
  }
}
