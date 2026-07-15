/**
 * @file verify-email-page.ts
 * @description Pagina real (no dialog) para el enlace de verificacion de email
 * (Fase 1 auth). El usuario llega aqui desde fuera de la app (enlace del correo),
 * sin contexto previo en el cliente, así que no tiene sentido abrir un dialog.
 */
import { Component, inject, OnInit, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { AuthService } from '@core/services/auth.service';

type VerifyState = 'loading' | 'success' | 'error';

@Component({
  selector: 'app-verify-email-page',
  standalone: true,
  imports: [RouterModule, MatButtonModule, MatIconModule, MatProgressSpinnerModule],
  templateUrl: './verify-email-page.html',
  styleUrl: './verify-email-page.scss',
})
export class VerifyEmailPageComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly authService = inject(AuthService);

  readonly state = signal<VerifyState>('loading');

  ngOnInit(): void {
    const token = this.route.snapshot.queryParamMap.get('token');
    if (!token) {
      this.state.set('error');
      return;
    }

    this.authService.verifyEmail(token).subscribe({
      next: () => this.state.set('success'),
      // Mensaje unico y generico (token invalido/caducado/ya usado/ausente):
      // no aporta distinguir el motivo al usuario final.
      error: () => this.state.set('error'),
    });
  }

  goToLogin(): void {
    this.router.navigate(['/login']);
  }
}
