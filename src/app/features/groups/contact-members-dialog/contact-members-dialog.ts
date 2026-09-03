/**
 * @file contact-members-dialog.ts
 * @description Diálogo para que el organizador envíe un mensaje (email) a los miembros de su
 * grupo, con selección de destinatarios (por defecto, todos). Se cierra con
 * `{ message, recipientUserIds }`, o `undefined` si se cancela.
 */
import { Component, computed, inject, signal } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { GroupMember } from '@core/models/group.model';

export interface ContactMembersDialogData {
  groupName: string;
  /** Miembros del grupo a los que se puede escribir (ya excluye al organizador). */
  members: GroupMember[];
}

export interface ContactMembersDialogResult {
  subject: string;
  message: string;
  recipientUserIds: string[];
}

@Component({
  selector: 'app-contact-members-dialog',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatCheckboxModule,
  ],
  templateUrl: './contact-members-dialog.html',
  styleUrl: './contact-members-dialog.scss',
})
export class ContactMembersDialogComponent {
  readonly dialogRef = inject(MatDialogRef<ContactMembersDialogComponent>);
  readonly data = inject<ContactMembersDialogData>(MAT_DIALOG_DATA);
  private readonly fb = inject(FormBuilder);

  // Por defecto se selecciona a todos los miembros ("Contacta con todos").
  private readonly selectedIds = signal<Set<string>>(
    new Set(this.data.members.map((m) => m.userId)),
  );
  readonly selectedCount = computed(() => this.selectedIds().size);
  readonly allSelected = computed(() => this.selectedCount() === this.data.members.length);
  readonly noneSelected = computed(() => this.selectedCount() === 0);

  readonly form = this.fb.group({
    subject: ['', [Validators.required, Validators.maxLength(200)]],
    message: ['', [Validators.required, Validators.maxLength(2000)]],
  });

  get subjectCtrl() {
    return this.form.controls['subject'];
  }
  get messageCtrl() {
    return this.form.controls['message'];
  }

  isSelected(userId: string): boolean {
    return this.selectedIds().has(userId);
  }

  toggleMember(userId: string): void {
    this.selectedIds.update((current) => {
      const next = new Set(current);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });
  }

  toggleAll(): void {
    this.selectedIds.set(
      this.allSelected() ? new Set() : new Set(this.data.members.map((m) => m.userId)),
    );
  }

  send(): void {
    if (this.form.invalid || this.noneSelected()) {
      this.form.markAllAsTouched();
      return;
    }
    const result: ContactMembersDialogResult = {
      subject: this.form.value.subject!,
      message: this.form.value.message!,
      recipientUserIds: [...this.selectedIds()],
    };
    this.dialogRef.close(result);
  }
}
