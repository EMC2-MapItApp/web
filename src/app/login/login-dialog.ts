import { Component, inject, isDevMode, signal } from '@angular/core';
import { MatDialog, MatDialogRef, MatDialogModule } from '@angular/material/dialog';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { AuthService } from '../core/services/auth.service';
import { ForgotPasswordDialogComponent } from '../forgot-password/forgot-password-dialog';
import { FORGOT_PASSWORD_DIALOG_CONFIG } from '../core/constants/dialog.constants';

/**
 * Diálogo de login, abierto sobre {@link HomeComponent} vía `openLoginDialogGuard` (nunca
 * navegado como página propia). En modo desarrollo precarga credenciales de prueba para agilizar
 * el ciclo de prueba manual — gateado por {@link isDevMode}, no se ejecuta en el build de
 * producción.
 */
@Component({
  selector: 'app-login-dialog',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    RouterModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
  ],
  templateUrl: './login-dialog.html',
  styleUrl: './login-dialog.scss',
})
export class LoginDialogComponent {
  readonly dialogRef = inject(MatDialogRef<LoginDialogComponent>);
  private fb = inject(FormBuilder);
  private router = inject(Router);
  private authService = inject(AuthService);
  private matDialog = inject(MatDialog);

  hidePassword = true;
  loading = signal(false);
  errorMsg = signal<string | null>(null);



  loginForm = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(6)]],
  });

  get emailCtrl() { return this.loginForm.controls['email']; }
  get passwordCtrl() { return this.loginForm.controls['password']; }


  constructor() {
    if (isDevMode()) {
      this.loginForm.setValue({
        email: 'dev@mapit.local',
        password: 'dev-password',
      });
    }
  }

  goToRegister(): void {
    this.dialogRef.close();
    this.router.navigate(['/register']);
  }

  openForgotPassword(): void {
    this.dialogRef.close();
    this.matDialog.open(ForgotPasswordDialogComponent, FORGOT_PASSWORD_DIALOG_CONFIG);
  }

  submit(): void {
    if (this.loginForm.invalid || this.loading()) {
      this.loginForm.markAllAsTouched();
      return;
    }

    const { email, password } = this.loginForm.value;
    this.loading.set(true);
    this.errorMsg.set(null);

    this.authService.login({ email: email!, password: password! }).subscribe({
      next: () => {
        this.loading.set(false);
        this.dialogRef.close(true); // cierra y queda en el mapa
      },
      error: (err) => {
        this.loading.set(false);
        this.errorMsg.set(
          err.status === 401 ? 'Correo o contraseña incorrectos.'
          : err.status === 403 && err.error?.error?.code === 'EMAIL_NOT_VERIFIED'
            ? 'Debes verificar tu correo antes de iniciar sesión.'
            : 'Error al iniciar sesión. Inténtalo de nuevo.'
        );
      },
    });
  }
}
