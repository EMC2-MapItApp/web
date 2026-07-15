/**
 * @file forgot-password-dialog.ts
 * @description Diálogo "olvidé mi contraseña" (Fase 1 auth), abierto desde
 * {@link LoginDialogComponent}. A diferencia del reenvío de verificación, el backend sí
 * distingue si el email existe (404 si no) — ver {@link AuthService.forgotPassword} — así que
 * este diálogo muestra ese error en el propio formulario en vez de un mensaje genérico.
 */
import { Component, inject, signal } from '@angular/core';
import { MatDialogRef, MatDialogModule } from '@angular/material/dialog';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { AuthService } from '@core/services/auth.service';

type ForgotPasswordState = 'form' | 'sent';

@Component({
  selector: 'app-forgot-password-dialog',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
  ],
  templateUrl: './forgot-password-dialog.html',
  styleUrl: './forgot-password-dialog.scss',
})
export class ForgotPasswordDialogComponent {
  readonly dialogRef = inject(MatDialogRef<ForgotPasswordDialogComponent>);
  private readonly fb = inject(FormBuilder);
  private readonly authService = inject(AuthService);

  readonly state = signal<ForgotPasswordState>('form');
  readonly loading = signal(false);
  readonly errorMsg = signal<string | null>(null);

  readonly forgotPasswordForm = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
  });

  get emailCtrl() { return this.forgotPasswordForm.controls['email']; }

  submit(): void {
    if (this.forgotPasswordForm.invalid || this.loading()) {
      this.forgotPasswordForm.markAllAsTouched();
      return;
    }

    const { email } = this.forgotPasswordForm.value;
    this.loading.set(true);
    this.errorMsg.set(null);

    this.authService.forgotPassword(email!).subscribe({
      next: () => {
        this.loading.set(false);
        this.state.set('sent');
      },
      error: (err) => {
        this.loading.set(false);
        this.errorMsg.set(
          err.status === 404 ? 'No existe ninguna cuenta con ese correo electrónico.'
          : 'Error al solicitar el restablecimiento. Inténtalo de nuevo.'
        );
      },
    });
  }
}
