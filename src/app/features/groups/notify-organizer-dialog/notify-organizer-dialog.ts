/**
 * @file notify-organizer-dialog.ts
 * @description Diálogo para enviar un aviso (email, mock) al organizador de un grupo desde
 * la página de detalle. Se cierra con el mensaje escrito, o `undefined` si se cancela.
 */
import { Component, inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

export interface NotifyOrganizerDialogData {
  groupName: string;
  organizerName: string;
}

@Component({
  selector: 'app-notify-organizer-dialog',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    MatDialogModule, MatFormFieldModule, MatInputModule,
    MatButtonModule, MatIconModule,
  ],
  templateUrl: './notify-organizer-dialog.html',
  styleUrl: './notify-organizer-dialog.scss',
})
export class NotifyOrganizerDialogComponent {
  readonly dialogRef = inject(MatDialogRef<NotifyOrganizerDialogComponent>);
  readonly data = inject<NotifyOrganizerDialogData>(MAT_DIALOG_DATA);
  private readonly fb = inject(FormBuilder);

  readonly form = this.fb.group({
    message: ['', [Validators.required, Validators.maxLength(1000)]],
  });

  get messageCtrl() { return this.form.controls['message']; }

  send(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.dialogRef.close(this.form.value.message!);
  }
}
