/**
 * @file password-strength-meter.ts
 * @description Barra de fuerza de contraseña (Fase 1 auth). Puramente presentacional:
 * recibe un score 0-4 (escala zxcvbn) y lo pinta; no calcula nada. El calculo del score
 * vive en el componente que lo usa (ver register-dialog.ts), que hace el import diferido
 * de zxcvbn-ts.
 */
import { Component, computed, input } from '@angular/core';

export type PasswordStrengthScore = 0 | 1 | 2 | 3 | 4 | null;
type StrengthTier = 'danger' | 'warning' | 'success';

const TOTAL_BARS = 4;

const LABELS: Record<number, string> = {
  0: 'Muy débil',
  1: 'Débil',
  2: 'Regular',
  3: 'Fuerte',
  4: 'Muy fuerte',
};

@Component({
  selector: 'app-password-strength-meter',
  standalone: true,
  templateUrl: './password-strength-meter.html',
  styleUrl: './password-strength-meter.scss',
})
export class PasswordStrengthMeterComponent {
  readonly score = input<PasswordStrengthScore>(null);
  readonly showLabel = input(true);

  protected readonly bars = Array.from({ length: TOTAL_BARS });
  protected readonly filledBars = computed(() => this.score() ?? 0);
  protected readonly label = computed(() => {
    const score = this.score();
    return score === null ? '' : LABELS[score];
  });
  protected readonly tier = computed<StrengthTier | null>(() => {
    const score = this.score();
    if (score === null) return null;
    if (score <= 1) return 'danger';
    if (score === 2) return 'warning';
    return 'success';
  });
}
