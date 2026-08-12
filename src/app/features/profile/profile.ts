/**
 * @file profile.ts
 * @description Página de perfil del usuario activo.
 */
import { Component, computed, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
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
import { CurrentUserService } from '@core/services/current-user.service';
import { UserService } from '@core/services/user.service';
import { CategoryService } from '@core/services/category.service';
import { MainCategory, SubCategory } from '@core/models/category.model';
import { DatePipe, SlicePipe } from '@angular/common';
import { Publication, PublicationAccessRequest, PublicationVisibility } from '@core/models/publication.model';
import { PublicationService } from '@core/services/publication.service';
import { Group } from '@core/models/group.model';
import { GroupService } from '@core/services/group.service';
import { ResponsiveService } from '@core/responsive/responsive.service';
import { HttpErrorResponse } from '@angular/common/http';
import {
  PasswordStrengthMeterComponent, PasswordStrengthScore,
} from '../auth/password-strength-meter/password-strength-meter';
import type { ZxcvbnFactory as ZxcvbnFactoryType } from '@zxcvbn-ts/core';

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
    PasswordStrengthMeterComponent,
  ],
  templateUrl: './profile.html',
  styleUrl: './profile.scss',
})
export class ProfilePageComponent {

  readonly cu = inject(CurrentUserService);
  private userService = inject(UserService);
  private categoryService = inject(CategoryService);
  private publicationService = inject(PublicationService);
  private groupService = inject(GroupService);
  private snackBar = inject(MatSnackBar);
  private router = inject(Router);
  private fb = inject(FormBuilder);
  private readonly destroyRef = inject(DestroyRef);

  // ── Estado responsive ────────────────────────────────────────────────────────
  // El componente NO calcula el viewport (nada de `window.innerWidth`).
  // Solo consume el contrato `ResponsiveState` publicado por el servicio central,
  // manteniendo una única fuente de verdad (principio de la arquitectura responsive).
  private readonly responsive = inject(ResponsiveService);

  /** Helpers reactivos derivados del estado responsive, para uso en la plantilla. */
  readonly isMobile = this.responsive.isMobile;
  readonly isTablet = this.responsive.isTablet;
  readonly isDesktop = this.responsive.isDesktop;

  /**
   * Vista compacta (mobile o tablet).
   *
   * Se usa como criterio de comportamiento de UI: en pantallas reducidas el
   * espacio vertical es escaso, por lo que conviene una experiencia más sobria.
   */
  readonly isCompactViewport = computed(() => this.isMobile() || this.isTablet());

  /**
   * Permite tener varias secciones del acordeón abiertas a la vez.
   *
   * - Desktop: se permite (comparación cómoda entre secciones).
   * - Mobile/Tablet: se restringe a una sección para minimizar el scroll.
   */
  readonly allowMultiExpand = computed(() => !this.isCompactViewport());

  /** Publicaciones del usuario para el panel "Mis publicaciones". */
  myPublications = signal<Publication[]>([]);

  /** Estado de carga de publicaciones del perfil. */
  loadingPublications = signal(false);

  /** Error al cargar/borrar publicaciones. */
  publicationsError = signal<string | null>(null);

  /** Indica si alguna publicación del usuario está caducada, para mostrar el aviso de borrado automático. */
  hasFinishedPublications = computed(() => this.myPublications().some(p => this.isFinished(p)));

  // ── Solicitudes de acceso a publicaciones privadas ──────────────────────────

  /** Nº de solicitudes pendientes por publicación, para el badge de la fila cerrada. */
  pendingAccessRequestCountByPublication = signal<Record<number, number>>({});

  /** Id de la publicación cuyo panel de solicitudes está expandido (null = ninguna). */
  accessRequestsPanelId = signal<number | null>(null);

  /** Solicitudes pendientes de la publicación con el panel expandido. */
  openAccessRequests = signal<PublicationAccessRequest[]>([]);

  loadingAccessRequests = signal(false);

  /** Id de la solicitud con una acción (aceptar/rechazar) en curso. */
  accessRequestActionInProgressId = signal<string | null>(null);

  // ── Cambio de visibilidad ────────────────────────────────────────────────────

  /** Grupos que el usuario organiza, para el selector inline al pasar una publicación a privada. */
  myOrganizedGroupsForVisibility = signal<Group[]>([]);

  /** Id de la publicación cuyo control de "Cambiar visibilidad" está expandido (null = ninguna). */
  visibilityEditId = signal<number | null>(null);

  /** Id de la publicación con un cambio de visibilidad en curso, para deshabilitar sus botones. */
  changingVisibilityId = signal<number | null>(null);

  // ── Árbol de categorías para el selector de favoritos ──────────────────────
  categories = signal<MainCategory[]>([]);

  /** Categoría expandida en el selector de favoritos (null = ninguna). */
  expandedMain = signal<number | null>(null);

  /** Subcategoría expandida (null = ninguna). */
  expandedSub = signal<number | null>(null);

  constructor() {
    this.categoryService.getAll().subscribe(cats => this.categories.set(cats));
    this.loadMyPublications();

    this.groupService.getMyGroups().subscribe(groups => {
      this.myOrganizedGroupsForVisibility.set(
        groups.filter(g => this.groupService.getMyRole(g) === 'organizer')
      );
    });
  }

  /**
  * Recarga la lista de publicaciones del usuario autenticado.
   */
  loadMyPublications(): void {
    this.loadingPublications.set(true);
    this.publicationsError.set(null);

    this.publicationService.getMine(false).subscribe({
      next: pubs => {
        const sorted = [...pubs].sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime());
        this.myPublications.set(sorted);
        this.loadingPublications.set(false);
        this.loadPendingAccessRequestCounts(sorted);
      },
      error: () => {
        this.loadingPublications.set(false);
        this.publicationsError.set('No se pudieron cargar tus publicaciones.');
      }
    });
  }

  /** Carga, para cada publicación privada, cuántas solicitudes de acceso tiene pendientes. */
  private loadPendingAccessRequestCounts(pubs: Publication[]): void {
    pubs
      .filter(p => p.visibility === 'PRIVATE_GROUP')
      .forEach(pub => {
        this.publicationService.getPendingAccessRequests(pub.id).subscribe(requests => {
          this.pendingAccessRequestCountByPublication.update(prev => ({ ...prev, [pub.id]: requests.length }));
        });
      });
  }

  /** Expande/colapsa el panel de solicitudes de acceso de una publicación, cargándolas si hace falta. */
  toggleAccessRequests(publication: Publication): void {
    if (this.accessRequestsPanelId() === publication.id) {
      this.accessRequestsPanelId.set(null);
      return;
    }

    this.accessRequestsPanelId.set(publication.id);
    this.loadingAccessRequests.set(true);
    this.publicationService.getPendingAccessRequests(publication.id).subscribe({
      next: requests => {
        this.openAccessRequests.set(requests);
        this.loadingAccessRequests.set(false);
      },
      error: () => {
        this.loadingAccessRequests.set(false);
      },
    });
  }

  /** Acepta una solicitud de acceso: el solicitante ya puede apuntarse a la publicación. */
  acceptAccessRequest(request: PublicationAccessRequest, publication: Publication): void {
    this.accessRequestActionInProgressId.set(request.id);
    this.publicationService.acceptAccessRequest(request.id).subscribe({
      next: () => {
        this.openAccessRequests.update(list => list.filter(r => r.id !== request.id));
        this.decrementPendingAccessRequestCount(publication.id);
        this.accessRequestActionInProgressId.set(null);
        this.notify(`${request.requestedByName} ya puede apuntarse`);
      },
      error: () => {
        this.accessRequestActionInProgressId.set(null);
        this.notify('No se pudo aceptar la solicitud. Inténtalo de nuevo.');
      },
    });
  }

  /** Rechaza una solicitud de acceso. */
  rejectAccessRequest(request: PublicationAccessRequest, publication: Publication): void {
    this.accessRequestActionInProgressId.set(request.id);
    this.publicationService.rejectAccessRequest(request.id).subscribe({
      next: () => {
        this.openAccessRequests.update(list => list.filter(r => r.id !== request.id));
        this.decrementPendingAccessRequestCount(publication.id);
        this.accessRequestActionInProgressId.set(null);
        this.notify(`Solicitud de ${request.requestedByName} rechazada`);
      },
      error: () => {
        this.accessRequestActionInProgressId.set(null);
        this.notify('No se pudo rechazar la solicitud. Inténtalo de nuevo.');
      },
    });
  }

  private decrementPendingAccessRequestCount(publicationId: number): void {
    this.pendingAccessRequestCountByPublication.update(prev => ({
      ...prev,
      [publicationId]: Math.max(0, (prev[publicationId] ?? 1) - 1),
    }));
  }

  private notify(message: string): void {
    this.snackBar.open(message, 'Cerrar', {
      duration: 3000,
      horizontalPosition: 'center',
      verticalPosition: 'top',
    });
  }

  /**
  * Determina si una publicación está finalizada.
   *
   * Se considera finalizada si ya no está activa o si su fecha de fin ya venció.
   */
  isFinished(publication: Publication): boolean {
    if (publication.active === false) return true;
    if (!publication.endDate) return false;
    return new Date(publication.endDate).getTime() <= Date.now();
  }

  /**
  * Elimina de forma definitiva una publicación del usuario.
   */
  deletePublication(publication: Publication): void {
    this.publicationService.remove(publication.id).subscribe({
      next: () => {
        this.myPublications.update(list => list.filter(item => item.id !== publication.id));
        this.snackBar.open('Publicación eliminada definitivamente', 'Cerrar', {
          duration: 3000,
          horizontalPosition: 'center',
          verticalPosition: 'top',
        });
      },
      error: () => {
        this.snackBar.open('No se pudo eliminar la publicación', 'Cerrar', {
          duration: 3000,
          horizontalPosition: 'center',
          verticalPosition: 'top',
        });
      }
    });
  }

  /**
  * Inicia el flujo de editar/repetir publicación (según {@link isFinished}).
   *
  * Navega a crear publicación indicando el id origen para precargar los datos
  * (salvo la fecha); el mapa resalta la ubicación de esa publicación.
   */
  repeatPublication(publication: Publication): void {
    this.router.navigate(['/create-publication'], {
      queryParams: { repeatFrom: publication.id },
    });
  }

  /** Expande/colapsa el control de cambio de visibilidad de una publicación. */
  toggleVisibilityEdit(publication: Publication): void {
    this.visibilityEditId.set(this.visibilityEditId() === publication.id ? null : publication.id);
  }

  /**
   * Cambia una publicación privada a pública. Siempre permitido (regla de negocio: abrir el
   * aforo nunca rompe expectativas de nadie).
   */
  makePublic(publication: Publication): void {
    this.applyVisibilityChange(publication, 'PUBLIC', null);
  }

  /**
   * Cambia una publicación pública a privada de un grupo que organiza. El backend rechaza el
   * cambio (409 `FOREIGN_ENROLLMENTS`) si hay apuntados que no son miembros de ese grupo.
   */
  makePrivate(publication: Publication, groupId: string): void {
    this.applyVisibilityChange(publication, 'PRIVATE_GROUP', groupId);
  }

  private applyVisibilityChange(publication: Publication, visibility: PublicationVisibility, groupId: string | null): void {
    this.changingVisibilityId.set(publication.id);
    this.publicationService.changeVisibility(publication.id, visibility, groupId).subscribe({
      next: updated => {
        this.myPublications.update(list => list.map(p => p.id === updated.id ? updated : p));
        this.changingVisibilityId.set(null);
        this.visibilityEditId.set(null);
        this.snackBar.open(
          visibility === 'PUBLIC' ? 'Publicación ahora abierta a todos' : 'Publicación ahora es privada de grupo',
          'Cerrar', { duration: 3000, horizontalPosition: 'center', verticalPosition: 'top' },
        );
      },
      error: (error: HttpErrorResponse) => {
        this.changingVisibilityId.set(null);
        const code = error?.error?.error?.code;
        const message = code === 'FOREIGN_ENROLLMENTS'
          ? (error.error?.error?.message ?? 'No puedes limitar esta publicación a ese grupo: hay personas apuntadas que no son miembros.')
          : 'No se pudo cambiar la visibilidad. Inténtalo de nuevo.';
        this.snackBar.open(message, 'Cerrar', { duration: 6000, horizontalPosition: 'center', verticalPosition: 'top' });
      },
    });
  }


  // ── Resetear Contraseña ────────────────────────────────────────────────────────────

  /** true = formulario de cambio de contraseña visible */
  resetPasswordMode = signal(false);
  resetPasswordSaving = signal(false);
  resetPasswordError = signal<string | null>(null);
  resetPasswordSuccess = signal(false);

  /** Score de zxcvbn (0-4). Null hasta que la librería carga o el campo está vacío. */
  readonly passwordScore = signal<PasswordStrengthScore>(null);
  private zxcvbnFactory: ZxcvbnFactoryType | null = null;

  /** Visibilidad de los campos de contraseña */
  hideCurrentPassword = true;
  hideNewPassword = true;
  hideConfirmPassword = true;

  resetPasswordForm = this.fb.group(
    {
      currentPassword: ['', [Validators.required]],
      newPassword: ['', [Validators.required, Validators.minLength(8), Validators.maxLength(72)]],
      confirmPassword: ['', [Validators.required]],
    },
    { validators: this._passwordsMatch }
  );

  get newPasswordCtrl() { return this.resetPasswordForm.controls['newPassword']; }
  get confirmPasswordCtrl() { return this.resetPasswordForm.controls['confirmPassword']; }

  private _passwordsMatch(group: import('@angular/forms').AbstractControl) {
    const np = group.get('newPassword')?.value;
    const cp = group.get('confirmPassword')?.value;
    return np && cp && np !== cp ? { passwordsMismatch: true } : null;
  }

  openResetPassword(): void {
    this.resetPasswordForm.reset();
    this.resetPasswordError.set(null);
    this.resetPasswordSuccess.set(false);
    this.passwordScore.set(null);
    this.hideCurrentPassword = true;
    this.hideNewPassword = true;
    this.hideConfirmPassword = true;
    this.resetPasswordMode.set(true);
    // Cerrar el formulario de edición de perfil si estuviera abierto
    this.editMode.set(false);
    // Cargar zxcvbn de inmediato para que el autorrelleno de gestores de
    // contraseñas no deje el botón permanentemente deshabilitado.
    this.loadZxcvbn();
  }

  cancelResetPassword(): void {
    this.resetPasswordMode.set(false);
    this.resetPasswordForm.reset();
    this.resetPasswordError.set(null);
    this.passwordScore.set(null);
  }

  saveResetPassword(): void {
    if (this.resetPasswordForm.invalid || this.resetPasswordSaving()
        || (this.passwordScore() ?? -1) < 3) {
      this.resetPasswordForm.markAllAsTouched();
      return;
    }
    const v = this.resetPasswordForm.value;
    this.resetPasswordSaving.set(true);
    this.resetPasswordError.set(null);

    this.userService.changePassword(v.currentPassword!, v.newPassword!).subscribe({
      next: () => {
        this.resetPasswordSaving.set(false);
        this.resetPasswordSuccess.set(true);
        this.resetPasswordForm.reset();
        this.passwordScore.set(null);
        // Ocultar el formulario tras un breve instante para que el usuario vea el mensaje
        setTimeout(() => {
          this.resetPasswordMode.set(false);
          this.resetPasswordSuccess.set(false);
        }, 2000);
      },
      error: (err) => {
        this.resetPasswordSaving.set(false);
        const code = err.error?.error?.code as string | undefined;
        if (err.status === 401) {
          this.resetPasswordError.set('La contraseña actual no es correcta.');
        } else if (code === 'WEAK_PASSWORD') {
          this.resetPasswordError.set('La contraseña es demasiado débil. Prueba a alargarla o añadir más variedad.');
        } else if (code === 'PASSWORD_POLICY_VIOLATION') {
          this.resetPasswordError.set(
            err.error?.error?.message ?? 'La nueva contraseña no cumple los requisitos de seguridad.'
          );
        } else if (err.status === 422) {
          this.resetPasswordError.set(
            err.error?.error?.message ?? 'La nueva contraseña no cumple los requisitos.'
          );
        } else {
          this.resetPasswordError.set('Error al cambiar la contraseña. Inténtalo de nuevo.');
        }
      },
    });
  }

  private async loadZxcvbn(): Promise<void> {
    if (this.zxcvbnFactory) {
      // Ya cargada; solo reconectar el listener al control actual
      this.newPasswordCtrl.valueChanges
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe(value => this.scorePassword(value));
      this.scorePassword(this.newPasswordCtrl.value);
      return;
    }

    const [{ ZxcvbnFactory }, common, esEs] = await Promise.all([
      import('@zxcvbn-ts/core'),
      import('@zxcvbn-ts/language-common'),
      import('@zxcvbn-ts/language-es-es'),
    ]);

    this.zxcvbnFactory = new ZxcvbnFactory({
      dictionary: { ...common.dictionary, ...esEs.dictionary },
      graphs: common.adjacencyGraphs,
      translations: esEs.translations,
    });

    this.newPasswordCtrl.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(value => this.scorePassword(value));
    this.scorePassword(this.newPasswordCtrl.value);
  }

  private scorePassword(password: string | null): void {
    if (!this.zxcvbnFactory || !password) {
      this.passwordScore.set(null);
      return;
    }
    const userInputs = [
      this.cu.user()?.name ?? '',
      this.cu.user()?.nick ?? '',
      this.cu.user()?.email ?? '',
    ].filter(Boolean);
    this.passwordScore.set(this.zxcvbnFactory.check(password, userInputs).score);
  }

  // ── Modo edición ────────────────────────────────────────────────────────────

  /** true = mostrando formulario de edición */
  editMode = signal(false);
  saving = signal(false);
  saveError = signal<string | null>(null);

  /** Formulario de edición del perfil */
  editForm = this.fb.group({
    name: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(100)]],
    nick: ['', [Validators.required, Validators.minLength(3), Validators.maxLength(30), Validators.pattern(/^[A-Za-z0-9._-]+$/)]],
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
      nick: u.nick ?? '',
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
      nick: v.nick || undefined,
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
      error: (err) => {
        this.saving.set(false);
        this.saveError.set(
          err.status === 409 ? 'Ese nombre de usuario ya está en uso.'
          : 'Error al guardar. Inténtalo de nuevo.'
        );
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
