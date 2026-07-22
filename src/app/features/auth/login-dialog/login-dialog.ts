import { Component, inject, isDevMode, signal } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialog, MatDialogRef, MatDialogModule } from '@angular/material/dialog';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { AuthService } from '@core/services/auth.service';
import { ForgotPasswordDialogComponent } from '../forgot-password-dialog/forgot-password-dialog';
import { FORGOT_PASSWORD_DIALOG_CONFIG } from '@core/constants/dialog.constants';

/**
 * Diálogo de login, abierto sobre {@link HomeShellComponent} vía `openLoginDialogGuard` (nunca
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
  /** `returnUrl`: presente cuando el diálogo se abrió desde una página que necesitaba sesión
   *  (p.ej. el enlace de invitación a un grupo) — ver {@link openLoginDialogGuard}. */
  private data = inject<{ returnUrl?: string | null } | null>(MAT_DIALOG_DATA, { optional: true });

  hidePassword = true;
  loading = signal(false);
  errorMsg = signal<string | null>(null);



  loginForm = this.fb.group({
    identifier: ['', [Validators.required]],
    password: ['', [Validators.required, Validators.minLength(6)]],
  });

  get identifierCtrl() { return this.loginForm.controls['identifier']; }
  get passwordCtrl() { return this.loginForm.controls['password']; }


  constructor() {
    if (isDevMode()) {
      this.loginForm.setValue({
        identifier: '@admin',
        password: 'admin-dev-ONLY-FOR-LOCAL',
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

    const { identifier, password } = this.loginForm.value;
    this.loading.set(true);
    this.errorMsg.set(null);

    this.authService.login({ identifier: identifier!, password: password! }).subscribe({
      next: () => {
        this.loading.set(false);
        this.dialogRef.close(true);
        if (this.data?.returnUrl) {
          this.router.navigateByUrl(this.data.returnUrl);
        } // sin returnUrl: cierra y queda en el mapa
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
