/**
 * @file group-form-page.ts
 * @description Formulario de creación/edición de un grupo. Página full-page (patrón
 * create-publication), alcanzable desde `groups/new` (crear) y `groups/:id/edit` (editar) —
 * el modo se resuelve a partir del parámetro `id` de la ruta.
 *
 * En creación las invitaciones se acumulan localmente y se envían junto con el grupo al
 * guardar (con confirmación previa si hay alguna en cola); en edición cada invitación se
 * envía en el momento (el grupo ya existe).
 */
import { Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DestroyRef } from '@angular/core';
import { debounceTime, distinctUntilChanged, switchMap } from 'rxjs';
import { SlicePipe } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatDialog } from '@angular/material/dialog';
import { ActivatedRoute, Router } from '@angular/router';
import { GroupService } from '@core/services/group.service';
import { CategoryService } from '@core/services/category.service';
import { Group, GroupMember, GroupSearchUser } from '@core/models/group.model';
import { MainCategory } from '@core/models/category.model';
import { ResponsiveService } from '@core/responsive/responsive.service';
import { CONFIRM_DIALOG_CONFIG, withResponsiveDialogLayout } from '@core/constants/dialog.constants';
import { ConfirmDialogComponent, ConfirmDialogData } from '@shared/confirm-dialog/confirm-dialog';

type FormMode = 'create' | 'edit';

@Component({
  selector: 'app-group-form-page',
  standalone: true,
  imports: [
    ReactiveFormsModule, SlicePipe,
    MatIconModule, MatButtonModule,
    MatFormFieldModule, MatInputModule,
    MatProgressSpinnerModule,
  ],
  templateUrl: './group-form-page.html',
  styleUrl: './group-form-page.scss',
})
export class GroupFormPageComponent {

  private readonly fb = inject(FormBuilder);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly groupService = inject(GroupService);
  private readonly categoryService = inject(CategoryService);
  private readonly snackBar = inject(MatSnackBar);
  private readonly destroyRef = inject(DestroyRef);
  private readonly dialog = inject(MatDialog);
  private readonly responsive = inject(ResponsiveService);

  private readonly groupId = this.route.snapshot.paramMap.get('id');
  readonly mode = signal<FormMode>(this.groupId ? 'edit' : 'create');

  readonly categories = signal<MainCategory[]>([]);
  readonly loadingGroup = signal(!!this.groupId);
  readonly saving = signal(false);
  readonly currentMembers = signal<GroupMember[]>([]);

  readonly form = this.fb.group({
    name: ['', [Validators.required, Validators.minLength(3), Validators.maxLength(100)]],
    description: ['', [Validators.required, Validators.maxLength(500)]],
    categoryId: [null as string | null, Validators.required],
  });

  // ── Búsqueda e invitación de usuarios ───────────────────────────────────────
  readonly searchCtrl = this.fb.control('');
  readonly searching = signal(false);
  readonly searchResults = signal<GroupSearchUser[]>([]);

  /** Cola de invitaciones en modo creación (se envían junto con el grupo). */
  readonly queuedInvites = signal<GroupSearchUser[]>([]);
  /** Usuarios ya invitados en modo edición (invitación enviada de inmediato). */
  readonly sentInvites = signal<GroupSearchUser[]>([]);
  readonly invitingUserId = signal<string | null>(null);

  private group: Group | null = null;

  constructor() {
    this.categoryService.getAll().subscribe(cats => this.categories.set(cats));

    if (this.groupId) {
      this.groupService.getGroupById(this.groupId).subscribe(group => {
        this.loadingGroup.set(false);
        if (!group) return;
        this.group = group;
        this.currentMembers.set(group.members);
        this.form.patchValue({
          name: group.name,
          description: group.description,
          categoryId: group.categoryId,
        });
      });
    }

    this.searchCtrl.valueChanges.pipe(
      debounceTime(300),
      distinctUntilChanged(),
      switchMap(query => {
        this.searching.set(true);
        return this.groupService.searchUsers(query ?? '');
      }),
      takeUntilDestroyed(this.destroyRef),
    ).subscribe(results => {
      this.searching.set(false);
      this.searchResults.set(results);
    });
  }

  readonly pageTitle = computed(() => this.mode() === 'create' ? 'Crear grupo' : 'Editar grupo');

  get nameCtrl() { return this.form.controls['name']; }
  get descriptionCtrl() { return this.form.controls['description']; }
  get categoryIdCtrl() { return this.form.controls['categoryId']; }

  selectCategory(categoryId: number): void {
    // `String()`: `MainCategory.id` está tipado `number` pero el backend real de categorías
    // usa ObjectId de Mongo (ver comentario en `Group.categoryId`).
    this.categoryIdCtrl.setValue(String(categoryId));
    this.categoryIdCtrl.markAsTouched();
  }

  isSelectedCategory(categoryId: number): boolean {
    return this.categoryIdCtrl.value === String(categoryId);
  }

  /** Ya invitado (en cola o, en edición, ya enviado) o ya miembro del grupo. */
  isAlreadyLinked(user: GroupSearchUser): boolean {
    if (this.currentMembers().some(m => m.userId === user.id)) return true;
    if (this.mode() === 'create') return this.queuedInvites().some(u => u.id === user.id);
    return this.sentInvites().some(u => u.id === user.id);
  }

  invite(user: GroupSearchUser): void {
    if (this.isAlreadyLinked(user)) return;

    if (this.mode() === 'create') {
      this.queuedInvites.update(list => [...list, user]);
      return;
    }

    if (!this.group) return;
    this.invitingUserId.set(user.id);
    this.groupService.inviteUser(this.group, user).subscribe({
      next: () => {
        this.invitingUserId.set(null);
        this.sentInvites.update(list => [...list, user]);
        this.notify(`Invitación enviada a ${user.name}`);
      },
      error: (err) => {
        this.invitingUserId.set(null);
        this.notify(this.groupService.inviteErrorMessage(err));
      },
    });
  }

  removeQueuedInvite(user: GroupSearchUser): void {
    this.queuedInvites.update(list => list.filter(u => u.id !== user.id));
  }

  save(): void {
    if (this.form.invalid || this.saving()) {
      this.form.markAllAsTouched();
      return;
    }

    const invitesCount = this.queuedInvites().length;
    if (this.mode() === 'create' && invitesCount > 0) {
      const { name, description } = this.form.value;
      this.confirmCreateWithInvites(invitesCount, name!, description!);
      return;
    }

    this.submit();
  }

  /** Solo en creación y con invitaciones en cola: el grupo y sus invitaciones se envían juntos
   * al aceptar ({@link GroupService.createGroup}), así que se confirma antes de disparar ambos. */
  private confirmCreateWithInvites(invitesCount: number, name: string, description: string): void {
    const compactViewport = this.responsive.isMobile() || this.responsive.isTablet();
    const dialogRef = this.dialog.open(ConfirmDialogComponent, withResponsiveDialogLayout(
      {
        ...CONFIRM_DIALOG_CONFIG,
        data: {
          title: 'Crear grupo',
          message: invitesCount === 1
            ? 'Se creará el grupo y se enviará 1 invitación.'
            : `Se creará el grupo y se enviarán ${invitesCount} invitaciones.`,
          preview: { title: name, description },
          icon: 'group_add',
          acceptText: 'Crear grupo',
          acceptIcon: 'check',
        } satisfies ConfirmDialogData,
      },
      compactViewport,
    ));

    dialogRef.afterClosed().subscribe(confirmed => {
      if (confirmed) this.submit();
    });
  }

  private submit(): void {
    const { name, description, categoryId } = this.form.value;
    this.saving.set(true);

    const request$ = this.mode() === 'create'
      ? this.groupService.createGroup({
          name: name!,
          description: description!,
          categoryId: categoryId!,
          inviteUserIds: this.queuedInvites().map(u => u.id),
        })
      : this.groupService.updateGroup(this.groupId!, {
          name: name!,
          description: description!,
          categoryId: categoryId!,
        });

    request$.subscribe({
      next: (group) => {
        this.saving.set(false);
        this.notify(this.mode() === 'create' ? `Grupo "${group.name}" creado` : 'Cambios guardados');
        this.router.navigate(['/groups']);
      },
      error: () => {
        this.saving.set(false);
        this.notify('No se pudo guardar el grupo. Inténtalo de nuevo.');
      },
    });
  }

  cancel(): void {
    this.router.navigate(['/groups']);
  }

  private notify(message: string): void {
    this.snackBar.open(message, 'Cerrar', {
      duration: 3000,
      horizontalPosition: 'center',
      verticalPosition: 'top',
    });
  }
}
