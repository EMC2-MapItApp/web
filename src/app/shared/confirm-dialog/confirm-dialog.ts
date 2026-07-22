/**
 * @file confirm-dialog.ts
 * @description Diálogo de confirmación genérico y reutilizable. Todos los campos de
 * {@link ConfirmDialogData} son opcionales — título, icono, textos de aceptar/cancelar caen a
 * un valor por defecto neutro si no se indican. Se cierra con `true` si se acepta, `false` si
 * se cancela explícitamente o `undefined` si se cierra por backdrop/Esc.
 */
import { Component, inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

/** Bloque opcional de vista previa del elemento afectado (p.ej. nombre + descripción del
 * grupo que se va a crear), mostrado como una tarjeta dentro del diálogo. */
export interface ConfirmDialogPreview {
  title: string;
  description?: string;
}

export interface ConfirmDialogData {
  title?: string;
  subtitle?: string;
  message?: string;
  preview?: ConfirmDialogPreview;
  warning?: string;
  icon?: string;
  acceptText?: string;
  acceptIcon?: string;
  cancelText?: string;
  cancelIcon?: string;
}

@Component({
  selector: 'app-confirm-dialog',
  standalone: true,
  imports: [MatDialogModule, MatButtonModule, MatIconModule],
  templateUrl: './confirm-dialog.html',
  styleUrl: './confirm-dialog.scss',
})
export class ConfirmDialogComponent {
  readonly dialogRef = inject(MatDialogRef<ConfirmDialogComponent, boolean>);
  private readonly data = inject<ConfirmDialogData>(MAT_DIALOG_DATA, { optional: true }) ?? {};

  readonly title = this.data.title ?? '¿Confirmar acción?';
  readonly subtitle = this.data.subtitle;
  readonly message = this.data.message;
  readonly preview = this.data.preview;
  readonly warning = this.data.warning;
  readonly icon = this.data.icon ?? 'help_outline';
  readonly acceptText = this.data.acceptText ?? 'Aceptar';
  readonly acceptIcon = this.data.acceptIcon;
  readonly cancelText = this.data.cancelText ?? 'Cancelar';
  readonly cancelIcon = this.data.cancelIcon;

  accept(): void {
    this.dialogRef.close(true);
  }

  cancel(): void {
    this.dialogRef.close(false);
  }
}
