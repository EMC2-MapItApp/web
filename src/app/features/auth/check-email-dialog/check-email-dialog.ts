/**
 * @file check-email-dialog.ts
 * @description Confirmación tras el registro (Fase 1 auth): el registro ya no
 * autentica, así que en vez de dar por logueado al usuario se le pide que
 * confirme su email antes de poder iniciar sesión.
 */
import { Component, inject, OnDestroy, signal } from '@angular/core';
import { MatDialogRef, MatDialogModule, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { Router } from '@angular/router';
import { AuthService } from '@core/services/auth.service';

/** Segundos de debounce de cliente entre reenvíos. El control real es el cooldown server-side. */
const RESEND_DEBOUNCE_SECONDS = 60;

export interface CheckEmailDialogData {
  email: string;
}

@Component({
  selector: 'app-check-email-dialog',
  standalone: true,
  imports: [MatDialogModule, MatButtonModule, MatIconModule, MatProgressSpinnerModule],
  templateUrl: './check-email-dialog.html',
  styleUrl: './check-email-dialog.scss',
})
export class CheckEmailDialogComponent implements OnDestroy {
  readonly dialogRef = inject(MatDialogRef<CheckEmailDialogComponent>);
  readonly data = inject<CheckEmailDialogData>(MAT_DIALOG_DATA);

  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  readonly resending = signal(false);
  readonly resendCooldownLeft = signal(0);
  private cooldownIntervalId?: ReturnType<typeof setInterval>;

  resend(): void {
    if (this.resending() || this.resendCooldownLeft() > 0) return;

    this.resending.set(true);
    this.authService.resendVerification(this.data.email).subscribe({
      next: () => this.startCooldown(),
      error: () => this.startCooldown(), // respuesta siempre generica; el debounce de UI no depende del resultado
    });
  }

  goToLogin(): void {
    this.dialogRef.close();
    this.router.navigate(['/login']);
  }

  ngOnDestroy(): void {
    clearInterval(this.cooldownIntervalId);
  }

  private startCooldown(): void {
    this.resending.set(false);
    this.resendCooldownLeft.set(RESEND_DEBOUNCE_SECONDS);
    this.cooldownIntervalId = setInterval(() => {
      const remaining = this.resendCooldownLeft() - 1;
      if (remaining <= 0) {
        clearInterval(this.cooldownIntervalId);
        this.resendCooldownLeft.set(0);
      } else {
        this.resendCooldownLeft.set(remaining);
      }
    }, 1000);
  }
}
