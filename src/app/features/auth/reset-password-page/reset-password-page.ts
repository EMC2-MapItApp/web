/**
 * @file reset-password-page.ts
 * @description Pagina real (no dialog) para el enlace de restablecimiento de contraseña
 * (Fase 1 auth). El usuario llega aqui desde fuera de la app (enlace del correo), sin
 * contexto previo en el cliente — mismo patrón que {@link VerifyEmailPageComponent}, pero con
 * un formulario de contraseña nueva en vez de una confirmación automática.
 */
import { Component, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { FormBuilder, ReactiveFormsModule, Validators, AbstractControl } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { AuthService } from '@core/services/auth.service';
import {
  PasswordStrengthMeterComponent,
  PasswordStrengthScore,
} from '@shared/password-strength-meter/password-strength-meter';
import type { ZxcvbnFactory as ZxcvbnFactoryType } from '@zxcvbn-ts/core';

type ResetPasswordState = 'form' | 'success' | 'error';

@Component({
  selector: 'app-reset-password-page',
  standalone: true,
  imports: [
    RouterModule,
    ReactiveFormsModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatFormFieldModule,
    MatInputModule,
    PasswordStrengthMeterComponent,
  ],
  templateUrl: './reset-password-page.html',
  styleUrl: './reset-password-page.scss',
})
export class ResetPasswordPageComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly authService = inject(AuthService);
  private readonly fb = inject(FormBuilder);
  private readonly destroyRef = inject(DestroyRef);

  readonly state = signal<ResetPasswordState>('form');
  readonly loading = signal(false);
  readonly errorMsg = signal<string | null>(null);
  hidePassword = true;
  hidePasswordConfirm = true;

  /** Score de zxcvbn (0-4) para la contraseña actual. Null hasta que la libreria carga. */
  readonly passwordScore = signal<PasswordStrengthScore>(null);
  private zxcvbnFactory: ZxcvbnFactoryType | null = null;
  private zxcvbnLoadingPromise: Promise<void> | null = null;

  private token = '';

  readonly resetPasswordForm = this.fb.group(
    {
      newPassword: ['', [Validators.required, Validators.minLength(8), Validators.maxLength(72)]],
      newPasswordConfirm: ['', Validators.required],
    },
    { validators: this.passwordMatchValidator },
  );

  get newPasswordCtrl() {
    return this.resetPasswordForm.controls['newPassword'];
  }
  get newPasswordConfirmCtrl() {
    return this.resetPasswordForm.controls['newPasswordConfirm'];
  }

  ngOnInit(): void {
    const token = this.route.snapshot.queryParamMap.get('token');
    if (!token) {
      this.state.set('error');
      return;
    }
    this.token = token;
    // Cargar zxcvbn de inmediato: si se esperaba al primer foco, el autorrelleno
    // de gestores de contraseñas no dispara el evento y el botón quedaba
    // permanentemente deshabilitado (passwordScore === null → (null ?? -1) < 3).
    this.zxcvbnLoadingPromise = this.loadZxcvbn();
  }

  submit(): void {
    if (this.resetPasswordForm.invalid || this.loading() || (this.passwordScore() ?? -1) < 3) {
      this.resetPasswordForm.markAllAsTouched();
      return;
    }

    const { newPassword } = this.resetPasswordForm.value;
    this.loading.set(true);
    this.errorMsg.set(null);

    this.authService.resetPassword(this.token, newPassword!).subscribe({
      next: () => {
        this.loading.set(false);
        this.state.set('success');
      },
      error: (err) => {
        this.loading.set(false);
        if (err.status === 400 && err.error?.error?.code === 'INVALID_TOKEN') {
          this.state.set('error');
        } else if (err.error?.error?.code === 'WEAK_PASSWORD') {
          this.errorMsg.set('La contraseña es demasiado débil.');
        } else {
          this.errorMsg.set('Error al restablecer la contraseña. Inténtalo de nuevo.');
        }
      },
    });
  }

  goToLogin(): void {
    this.router.navigate(['/login']);
  }

  private async loadZxcvbn(): Promise<void> {
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
      .subscribe((value) => this.scorePassword(value));
    this.scorePassword(this.newPasswordCtrl.value);
  }

  private scorePassword(password: string | null): void {
    if (!this.zxcvbnFactory || !password) {
      this.passwordScore.set(null);
      return;
    }
    this.passwordScore.set(this.zxcvbnFactory.check(password).score);
  }

  private passwordMatchValidator(group: AbstractControl) {
    const pass = group.get('newPassword')?.value;
    const confirm = group.get('newPasswordConfirm')?.value;
    return pass === confirm ? null : { passwordMismatch: true };
  }
}
