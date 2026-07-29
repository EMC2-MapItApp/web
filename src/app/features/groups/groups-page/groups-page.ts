/**
 * @file groups-page.ts
 * @description Página "Grupos" (ver docs/back/IDEAS.md → sección Grupos): punto de entrada
 * desde el menú principal, análogo a Perfil/Ajustes. Muestra las invitaciones pendientes del
 * usuario y sus grupos, separados por rol (organizador / miembro).
 */
import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { debounceTime, distinctUntilChanged, switchMap } from 'rxjs';
import { SlicePipe } from '@angular/common';
import { FormBuilder, FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatDialog } from '@angular/material/dialog';
import { GroupService } from '@core/services/group.service';
import { CategoryService } from '@core/services/category.service';
import { Group, GroupInvitation, GroupMember, GroupSearchUser, QueuedInvite } from '@core/models/group.model';
import { MainCategory } from '@core/models/category.model';
import { ResponsiveService } from '@core/responsive/responsive.service';
import { CONFIRM_DIALOG_CONFIG, CONTACT_MEMBERS_DIALOG_CONFIG, NOTIFY_ORGANIZER_DIALOG_CONFIG, withResponsiveDialogLayout } from '@core/constants/dialog.constants';
import { ConfirmDialogComponent, ConfirmDialogData } from '@shared/confirm-dialog/confirm-dialog';
import { NotifyOrganizerDialogComponent, NotifyOrganizerDialogResult } from '../notify-organizer-dialog/notify-organizer-dialog';
import { ContactMembersDialogComponent, ContactMembersDialogResult } from '../contact-members-dialog/contact-members-dialog';

@Component({
  selector: 'app-groups-page',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    MatIconModule, MatButtonModule,
    MatExpansionModule, MatProgressSpinnerModule,
    MatFormFieldModule, MatInputModule,
  ],
  templateUrl: './groups-page.html',
  styleUrl: './groups-page.scss',
})
export class GroupsPageComponent {

  private readonly groupService = inject(GroupService);
  private readonly categoryService = inject(CategoryService);
  private readonly snackBar = inject(MatSnackBar);
  private readonly responsive = inject(ResponsiveService);
  private readonly dialog = inject(MatDialog);
  private readonly fb = inject(FormBuilder);
  private readonly destroyRef = inject(DestroyRef);

  readonly isMobile = this.responsive.isMobile;

  /** Grupos del usuario actual (organizador o miembro), sin distinguir todavía. */
  private readonly myGroups = signal<Group[]>([]);
  readonly pendingInvitations = signal<GroupInvitation[]>([]);
  readonly categories = signal<MainCategory[]>([]);

  readonly loadingGroups = signal(true);
  readonly loadingInvitations = signal(true);

  /** Id de invitación con una acción (aceptar/rechazar) en curso, para deshabilitar sus botones. */
  readonly invitationActionInProgress = signal<string | null>(null);

  /**
   * Grupo que está esperando confirmación de borrado/abandono.
   * Guarda el id y el rol del usuario para diferenciar la acción y el texto de confirmación.
   */
  readonly deleteConfirmGroup = signal<{ id: string; role: 'organizer' | 'member' } | null>(null);

  /** Indica que la llamada de borrado/abandono está en curso (deshabilita los botones de confirmación). */
  readonly deleteInProgress = signal(false);

  // ── Formulario de creación inline ───────────────────────────────────────────

  readonly showCreateForm = signal(false);
  readonly isOrganizedPanelOpen = signal(true);
  readonly createSaving = signal(false);
  readonly createSearching = signal(false);
  readonly createSearchResults = signal<GroupSearchUser[]>([]);
  readonly createQueuedInvites = signal<QueuedInvite[]>([]);

  readonly createForm = this.fb.group({
    name: ['', [Validators.required, Validators.minLength(3), Validators.maxLength(100)]],
    description: ['', [Validators.required, Validators.maxLength(500)]],
    categoryId: [null as string | null, Validators.required],
  });

  readonly createSearchCtrl = new FormControl('');
  /** Invitar por email a alguien sin cuenta todavía — independiente del buscador de arriba. */
  readonly createEmailInviteCtrl = new FormControl('', [Validators.email]);

  // ── Edición inline de grupo ────────────────────────────────────────────

  /** Id del grupo cuya tarjeta está en modo edición. */
  readonly editingGroupId = signal<string | null>(null);
  readonly editSaving = signal(false);
  readonly editSearching = signal(false);
  readonly editSearchResults = signal<GroupSearchUser[]>([]);
  /** Invitaciones pendientes del grupo en edición (cargadas al abrir el form). */
  readonly editPendingInvitations = signal<GroupInvitation[]>([]);
  readonly editLoadingInvitations = signal(false);
  readonly editInvitingUserId = signal<string | null>(null);
  readonly editInvitingEmail = signal<string | null>(null);
  /** Id de miembro/invitado cuya acción de expulsión/cancelación está en curso. */
  readonly editActionInProgressId = signal<string | null>(null);

  readonly editForm = this.fb.group({
    name: ['', [Validators.required, Validators.minLength(3), Validators.maxLength(100)]],
    description: ['', [Validators.required, Validators.maxLength(500)]],
    categoryId: [null as string | null, Validators.required],
  });

  readonly editSearchCtrl = new FormControl('');
  /** Invitar por email a alguien sin cuenta todavía — independiente del buscador de arriba. */
  readonly editEmailInviteCtrl = new FormControl('', [Validators.email]);

  readonly organizedGroups = computed(() =>
    this.myGroups().filter(g => this.groupService.getMyRole(g) === 'organizer')
  );

  readonly memberGroups = computed(() =>
    this.myGroups().filter(g => this.groupService.getMyRole(g) === 'member')
  );

  constructor() {
    this.categoryService.getAll().subscribe(cats => this.categories.set(cats));
    this.loadGroups();
    this.loadInvitations();

    // Búsqueda para formulario de creación inline.
    this.createSearchCtrl.valueChanges.pipe(
      debounceTime(300),
      distinctUntilChanged(),
      switchMap(query => {
        this.createSearching.set(true);
        return this.groupService.searchUsers(query ?? '');
      }),
      takeUntilDestroyed(this.destroyRef),
    ).subscribe(results => {
      this.createSearching.set(false);
      this.createSearchResults.set(results);
      console.log("Result ", results)
    });

    // Búsqueda para formulario de edición inline.
    this.editSearchCtrl.valueChanges.pipe(
      debounceTime(300),
      distinctUntilChanged(),
      switchMap(query => {
        this.editSearching.set(true);
        return this.groupService.searchUsers(query ?? '');
      }),
      takeUntilDestroyed(this.destroyRef),
    ).subscribe(results => {
      this.editSearching.set(false);
      this.editSearchResults.set(results);
    });
  }

  private loadGroups(): void {
    this.loadingGroups.set(true);
    this.groupService.getMyGroups().subscribe(groups => {
      this.myGroups.set(groups);
      this.loadingGroups.set(false);
    });
  }

  private loadInvitations(): void {
    this.loadingInvitations.set(true);
    this.groupService.getPendingInvitations().subscribe(invitations => {
      this.pendingInvitations.set(invitations);
      this.loadingInvitations.set(false);
    });
  }

  /**
   * Categoría de un grupo, con fallback si el id no resuelve (categorías aún sin cargar).
   * Búsqueda local (no `categoryService.getMainCategoryById`, tipado con id `number`
   * desactualizado respecto al ObjectId real — ver comentario en `Group.categoryId`).
   */
  categoryOf(categoryId: string): MainCategory | undefined {
    return this.categories().find(c => String(c.id) === categoryId);
  }

  /** Activa la fila de confirmación de borrado/abandono para el grupo indicado. */
  requestDeleteGroup(group: Group, role: 'organizer' | 'member'): void {
    this.deleteConfirmGroup.set({ id: group.id, role });
  }

  /** Cancela la confirmación sin hacer nada. */
  cancelDeleteGroup(): void {
    this.deleteConfirmGroup.set(null);
  }

  // ── Creación inline ─────────────────────────────────────────────────────

  openCreateForm(): void {
    this.createForm.reset();
    this.createSearchCtrl.reset();
    this.createEmailInviteCtrl.reset();
    this.createQueuedInvites.set([]);
    this.createSearchResults.set([]);
    this.showCreateForm.set(true);
  }

  cancelCreateForm(): void {
    this.showCreateForm.set(false);
  }

  saveCreateForm(): void {
    if (this.createForm.invalid || this.createSaving()) {
      this.createForm.markAllAsTouched();
      return;
    }

    const invitesCount = this.createQueuedInvites().length;
    if (invitesCount > 0) {
      const { name, description } = this.createForm.value;
      this.confirmCreateWithInvites(invitesCount, name!, description!);
      return;
    }

    this.submitCreateForm();
  }

  /** Con invitaciones en cola, el grupo y sus invitaciones se envían juntos al aceptar
   * ({@link GroupService.createGroup}), así que se confirma antes de disparar ambos. */
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
      if (confirmed) this.submitCreateForm();
    });
  }

  private submitCreateForm(): void {
    const { name, description, categoryId } = this.createForm.value;
    this.createSaving.set(true);
    const queue = this.createQueuedInvites();
    this.groupService.createGroup({
      name: name!,
      description: description!,
      categoryId: categoryId!,
      inviteUserIds: queue.filter(q => q.kind === 'user').map(q => q.user.id),
      inviteEmails: queue.filter(q => q.kind === 'email').map(q => q.email),
    }).subscribe({
      next: (group) => {
        this.myGroups.update(list => [...list, group]);
        this.createSaving.set(false);
        this.showCreateForm.set(false);
        this.notify(`Grupo "${group.name}" creado`);
      },
      error: () => {
        this.createSaving.set(false);
        this.notify('No se pudo crear el grupo. Inténtalo de nuevo.');
      },
    });
  }

  selectCreateCategory(categoryId: number): void {
    this.createForm.controls.categoryId.setValue(String(categoryId));
    this.createForm.controls.categoryId.markAsTouched();
  }

  isCreateCategorySelected(categoryId: number): boolean {
    return this.createForm.controls.categoryId.value === String(categoryId);
  }

  isAlreadyQueued(user: GroupSearchUser): boolean {
    return this.createQueuedInvites().some(q => q.kind === 'user' && q.user.id === user.id);
  }

  isEmailAlreadyQueued(email: string): boolean {
    return this.createQueuedInvites().some(q => q.kind === 'email' && q.email.toLowerCase() === email.toLowerCase());
  }

  addToCreateQueue(user: GroupSearchUser): void {
    if (!this.isAlreadyQueued(user)) {
      this.createQueuedInvites.update(list => [...list, { kind: 'user', user }]);
    }
  }

  /** Encola una invitación por email (persona sin cuenta todavía) desde el mini-formulario dedicado. */
  submitCreateEmailInvite(): void {
    const email = this.createEmailInviteCtrl.value?.trim();
    if (this.createEmailInviteCtrl.invalid || !email || this.isEmailAlreadyQueued(email)) return;

    this.createQueuedInvites.update(list => [...list, { kind: 'email', email }]);
    this.createEmailInviteCtrl.reset();
  }

  removeFromCreateQueue(invite: QueuedInvite): void {
    this.createQueuedInvites.update(list => list.filter(q => !this.isSameQueuedInvite(q, invite)));
  }

  private isSameQueuedInvite(a: QueuedInvite, b: QueuedInvite): boolean {
    if (a.kind === 'user' && b.kind === 'user') return a.user.id === b.user.id;
    if (a.kind === 'email' && b.kind === 'email') return a.email === b.email;
    return false;
  }

  // ── Edición inline ────────────────────────────────────────────────────────

  openEditForm(group: Group): void {
    this.editForm.patchValue({
      name: group.name,
      description: group.description,
      categoryId: group.categoryId,
    });
    this.editSearchCtrl.reset();
    this.editEmailInviteCtrl.reset();
    this.editSearchResults.set([]);
    this.editPendingInvitations.set([]);
    this.editingGroupId.set(group.id);

    // Carga las invitaciones pendientes del grupo para mostrarlas en el formulario.
    this.editLoadingInvitations.set(true);
    this.groupService.getGroupPendingInvitations(group.id).subscribe({
      next: (invitations) => {
        this.editPendingInvitations.set(invitations);
        this.editLoadingInvitations.set(false);
      },
      error: () => this.editLoadingInvitations.set(false),
    });
  }

  cancelEditForm(): void {
    this.editingGroupId.set(null);
  }

  saveEditForm(group: Group): void {
    if (this.editForm.invalid || this.editSaving()) {
      this.editForm.markAllAsTouched();
      return;
    }
    const { name, description, categoryId } = this.editForm.value;
    this.editSaving.set(true);
    this.groupService.updateGroup(group.id, {
      name: name!,
      description: description!,
      categoryId: categoryId!,
    }).subscribe({
      next: (updated) => {
        this.myGroups.update(list => list.map(g => g.id === updated.id ? updated : g));
        this.editingGroupId.set(null);
        this.editSaving.set(false);
        this.notify(`Grupo "${updated.name}" actualizado`);
      },
      error: () => {
        this.editSaving.set(false);
        this.notify('No se pudo guardar. Inténtalo de nuevo.');
      },
    });
  }

  selectEditCategory(categoryId: number): void {
    this.editForm.controls.categoryId.setValue(String(categoryId));
    this.editForm.controls.categoryId.markAsTouched();
  }

  isEditCategorySelected(categoryId: number): boolean {
    return this.editForm.controls.categoryId.value === String(categoryId);
  }

  /**
   * Relación del usuario buscado con el grupo en edición: ya es miembro, tiene una invitación
   * pendiente (de esta sesión o de antes, ambas viven en {@link editPendingInvitations}) o
   * ninguna de las dos.
   */
  editUserStatus(user: GroupSearchUser, group: Group): 'member' | 'pending' | 'none' {
    if (group.members.some(m => m.userId === user.id)) return 'member';
    if (this.editPendingInvitations().some(i => i.invitedUserId === user.id)) return 'pending';
    return 'none';
  }

  inviteUserInEdit(user: GroupSearchUser, group: Group): void {
    if (this.editUserStatus(user, group) !== 'none') return;
    this.editInvitingUserId.set(user.id);
    this.groupService.inviteUser(group, user).subscribe({
      next: (invitation) => {
        this.editInvitingUserId.set(null);
        this.editPendingInvitations.update(list => [...list, invitation]);
        this.notify(`Invitación enviada a ${user.name}`);
      },
      error: (err) => {
        this.editInvitingUserId.set(null);
        this.notify(this.groupService.inviteErrorMessage(err));
      },
    });
  }

  /** Invita por email a alguien sin cuenta todavía, desde el mini-formulario dedicado. */
  submitEditEmailInvite(group: Group): void {
    const email = this.editEmailInviteCtrl.value?.trim();
    if (this.editEmailInviteCtrl.invalid || !email) return;

    this.editInvitingEmail.set(email);
    this.groupService.inviteUserByEmail(group, email).subscribe({
      next: (invitation) => {
        this.editInvitingEmail.set(null);
        this.editEmailInviteCtrl.reset();
        this.editPendingInvitations.update(list => [...list, invitation]);
        this.notify(`Invitación enviada a ${email}`);
      },
      error: (err) => {
        this.editInvitingEmail.set(null);
        this.notify(this.groupService.inviteErrorMessage(err));
      },
    });
  }

  /** Cancela una invitación pendiente del grupo en edición. */
  cancelEditInvitation(inv: GroupInvitation): void {
    this.editActionInProgressId.set(inv.id);
    this.groupService.cancelGroupInvitation(inv.id).subscribe({
      next: () => {
        this.editPendingInvitations.update(list => list.filter(i => i.id !== inv.id));
        this.editActionInProgressId.set(null);
        this.notify(`Invitación a ${inv.invitedUserName ?? inv.invitedEmail} cancelada`);
      },
      error: () => {
        this.editActionInProgressId.set(null);
        this.notify('No se pudo cancelar la invitación. Inténtalo de nuevo.');
      },
    });
  }

  /** Expulsa a un miembro del grupo en edición. */
  removeEditMember(member: GroupMember, group: Group): void {
    this.editActionInProgressId.set(member.userId);
    this.groupService.removeMember(group.id, member.userId).subscribe({
      next: () => {
        // Actualiza la lista local de miembros sin recargar el grupo completo.
        this.myGroups.update(list =>
          list.map(g => g.id === group.id
            ? { ...g, members: g.members.filter(m => m.userId !== member.userId) }
            : g)
        );
        this.editActionInProgressId.set(null);
        this.notify(`${member.name} ha sido eliminado del grupo`);
      },
      error: () => {
        this.editActionInProgressId.set(null);
        this.notify('No se pudo eliminar al miembro. Inténtalo de nuevo.');
      },
    });
  }

  /**
   * Confirma el borrado (organizador) o el abandono (miembro) del grupo.
   * Elimina el grupo de la lista local en caso de éxito.
   */
  confirmDeleteGroup(group: Group): void {
    const confirm = this.deleteConfirmGroup();
    if (!confirm) return;

    this.deleteInProgress.set(true);

    const action$ = confirm.role === 'organizer'
      ? this.groupService.deleteGroup(group.id)
      : this.groupService.leaveGroup(group.id);

    const successMsg = confirm.role === 'organizer'
      ? `Grupo "${group.name}" eliminado`
      : `Has abandonado "${group.name}"`;

    const errorMsg = confirm.role === 'organizer'
      ? 'No se pudo eliminar el grupo. Inténtalo de nuevo.'
      : 'No se pudo abandonar el grupo. Inténtalo de nuevo.';

    action$.subscribe({
      next: () => {
        this.myGroups.update(list => list.filter(g => g.id !== group.id));
        this.deleteConfirmGroup.set(null);
        this.deleteInProgress.set(false);
        this.notify(successMsg);
      },
      error: () => {
        this.deleteConfirmGroup.set(null);
        this.deleteInProgress.set(false);
        this.notify(errorMsg);
      },
    });
  }

  /** Avisa (email) al organizador de un grupo del que se es miembro. */
  openNotifyOrganizer(group: Group): void {
    const organizer = group.members.find(m => m.role === 'organizer');
    if (!organizer) return;

    const compactViewport = this.responsive.isMobile() || this.responsive.isTablet();
    const dialogRef = this.dialog.open(NotifyOrganizerDialogComponent, withResponsiveDialogLayout(
      { ...NOTIFY_ORGANIZER_DIALOG_CONFIG, data: { groupName: group.name, organizerName: organizer.name } },
      compactViewport,
    ));

    dialogRef.afterClosed().subscribe((result: NotifyOrganizerDialogResult | undefined) => {
      if (!result) return;
      this.groupService.notifyOrganizer(group, result.subject, result.message).subscribe(() => {
        this.notify('Aviso enviado al organizador');
      });
    });
  }

  /** Envía un mensaje a los miembros seleccionados del grupo (por defecto, todos). Solo organizador. */
  openContactMembers(group: Group): void {
    const members = group.members.filter(m => m.role !== 'organizer');
    if (members.length === 0) {
      this.notify('Este grupo todavía no tiene miembros a los que contactar');
      return;
    }

    const compactViewport = this.responsive.isMobile() || this.responsive.isTablet();
    const dialogRef = this.dialog.open(ContactMembersDialogComponent, withResponsiveDialogLayout(
      { ...CONTACT_MEMBERS_DIALOG_CONFIG, data: { groupName: group.name, members } },
      compactViewport,
    ));

    dialogRef.afterClosed().subscribe((result: ContactMembersDialogResult | undefined) => {
      if (!result) return;
      this.groupService.contactMembers(group, result.subject, result.message, result.recipientUserIds).subscribe(() => {
        this.notify('Mensaje enviado a los miembros seleccionados');
      });
    });
  }

  acceptInvitation(invitation: GroupInvitation): void {
    this.invitationActionInProgress.set(invitation.id);
    this.groupService.acceptInvitation(invitation.id).subscribe({
      next: () => {
        this.pendingInvitations.update(list => list.filter(i => i.id !== invitation.id));
        this.invitationActionInProgress.set(null);
        this.loadGroups();
        this.notify(`Te has unido a "${invitation.groupName}"`);
      },
      error: () => {
        this.invitationActionInProgress.set(null);
        this.notify('No se pudo aceptar la invitación. Inténtalo de nuevo.');
      },
    });
  }

  declineInvitation(invitation: GroupInvitation): void {
    this.invitationActionInProgress.set(invitation.id);
    this.groupService.declineInvitation(invitation.id).subscribe({
      next: () => {
        this.pendingInvitations.update(list => list.filter(i => i.id !== invitation.id));
        this.invitationActionInProgress.set(null);
        this.notify(`Invitación a "${invitation.groupName}" rechazada`);
      },
      error: () => {
        this.invitationActionInProgress.set(null);
        this.notify('No se pudo rechazar la invitación. Inténtalo de nuevo.');
      },
    });
  }

  private notify(message: string): void {
    this.snackBar.open(message, 'Cerrar', {
      duration: 3000,
      horizontalPosition: 'center',
      verticalPosition: 'top',
    });
  }
}
