/**
 * @file group-invitation-page.ts
 * @description Página real (no dialog) a la que lleva el enlace del correo de invitación a
 * un grupo — mismo patrón que {@link VerifyEmailPageComponent} / {@link ResetPasswordPageComponent}:
 * se llega desde fuera de la app, sin contexto previo en el cliente, por eso vive fuera del
 * shell (sin cabecera ni menú).
 *
 * @remarks
 * El parámetro `token` de la URL identifica la invitación. En esta fase mock se resuelve
 * directamente como id de invitación ({@link GroupService.getInvitationById}); en producción
 * sería un token firmado que el backend resuelve a esa misma información.
 */
import { Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { AuthService } from '@core/services/auth.service';
import { GroupService } from '@core/services/group.service';
import { CategoryService } from '@core/services/category.service';
import { GroupInvitation } from '@core/models/group.model';
import { MainCategory } from '@core/models/category.model';

type InvitationPageState = 'loading' | 'invite' | 'accepted' | 'declined' | 'login-required' | 'error';

/** Qué hacer con la invitación en cuanto haya sesión — se resuelve solo tras el login inline. */
type PendingAction = 'accept' | 'decline';

@Component({
  selector: 'app-group-invitation-page',
  standalone: true,
  imports: [
    RouterModule, ReactiveFormsModule,
    MatButtonModule, MatIconModule, MatFormFieldModule, MatInputModule, MatProgressSpinnerModule,
  ],
  templateUrl: './group-invitation-page.html',
  styleUrl: './group-invitation-page.scss',
})
export class GroupInvitationPageComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly authService = inject(AuthService);
  private readonly groupService = inject(GroupService);
  private readonly categoryService = inject(CategoryService);
  private readonly fb = inject(FormBuilder);

  readonly state = signal<InvitationPageState>('loading');
  readonly invitation = signal<GroupInvitation | null>(null);
  readonly category = signal<MainCategory | undefined>(undefined);
  readonly processing = signal(false);

  readonly loginForm = this.fb.group({
    identifier: ['', [Validators.required]],
    password: ['', [Validators.required, Validators.minLength(6)]],
  });
  hidePassword = true;
  readonly loginError = signal<string | null>(null);

  private token: string | null = null;
  /** Por defecto 'accept': es la acción a la que invita el propio enlace del correo. Solo pasa
   *  a 'decline' si el 401 ocurrió al pulsar "Rechazar" con la sesión ya caducada. */
  private pendingAction: PendingAction = 'accept';

  get identifierCtrl() { return this.loginForm.controls['identifier']; }
  get passwordCtrl() { return this.loginForm.controls['password']; }

  ngOnInit(): void {
    this.token = this.route.snapshot.queryParamMap.get('token');
    if (!this.token) {
      this.state.set('error');
      return;
    }

    this.groupService.getInvitationById(this.token).subscribe({
      next: invitation => {
        if (!invitation || invitation.status !== 'pending') {
          this.state.set('error');
          return;
        }
        this.invitation.set(invitation);
        this.state.set('invite');

        // El árbol de categorías se carga bajo demanda (esta página, a diferencia del resto de
        // páginas de Grupos, es standalone y puede ser la primera en cargar, sin cache previa).
        // Búsqueda local (no `categoryService.getMainCategoryById`, tipado con id `number`
        // desactualizado respecto al ObjectId real — ver comentario en `Group.categoryId`).
        this.categoryService.getAll().subscribe(categories => {
          this.category.set(categories.find(c => String(c.id) === invitation.groupCategoryId));
        });
      },
      // 401: el enlace del correo se abrió sin sesión iniciada en este navegador (caso
      // habitual, la página es accesible sin login previo). Como quien recibe una invitación
      // ya tiene cuenta por definición (se invita por nick/email existente), se pide login
      // directamente en la propia página en vez de mandar a crear una cuenta.
      error: err => this.state.set(err.status === 401 ? 'login-required' : 'error'),
    });
  }

  accept(): void {
    const inv = this.invitation();
    if (!inv || this.processing()) return;

    this.processing.set(true);
    this.groupService.acceptInvitation(inv.id).subscribe({
      next: () => {
        this.processing.set(false);
        this.state.set('accepted');
      },
      error: err => {
        this.processing.set(false);
        // La sesión pudo caducar entre la carga de la página y el click en "Aceptar".
        this.pendingAction = 'accept';
        this.state.set(err.status === 401 ? 'login-required' : 'error');
      },
    });
  }

  decline(): void {
    const inv = this.invitation();
    if (!inv || this.processing()) return;

    this.processing.set(true);
    this.groupService.declineInvitation(inv.id).subscribe({
      next: () => {
        this.processing.set(false);
        this.state.set('declined');
      },
      error: err => {
        this.processing.set(false);
        this.pendingAction = 'decline';
        this.state.set(err.status === 401 ? 'login-required' : 'error');
      },
    });
  }

  /**
   * Login inline: al autenticar, resuelve de inmediato la invitación (accept/decline según
   * {@link pendingAction}) sin salir de esta página ni pasar por el diálogo de la app.
   */
  submitLogin(): void {
    if (this.loginForm.invalid || this.processing()) {
      this.loginForm.markAllAsTouched();
      return;
    }

    const { identifier, password } = this.loginForm.value;
    this.processing.set(true);
    this.loginError.set(null);

    this.authService.login({ identifier: identifier!, password: password! }).subscribe({
      next: () => this.resolvePendingAction(),
      error: err => {
        this.processing.set(false);
        this.loginError.set(
          err.status === 401 ? 'Correo o contraseña incorrectos.'
          : err.status === 403 && err.error?.error?.code === 'EMAIL_NOT_VERIFIED'
            ? 'Debes verificar tu correo antes de iniciar sesión.'
            : 'Error al iniciar sesión. Inténtalo de nuevo.'
        );
      },
    });
  }

  private resolvePendingAction(): void {
    const onSettled = (nextState: InvitationPageState) => {
      this.processing.set(false);
      this.state.set(nextState);
    };
    const onError = () => {
      this.processing.set(false);
      this.state.set('error');
    };

    if (this.pendingAction === 'decline') {
      this.groupService.declineInvitation(this.token!).subscribe({
        next: () => onSettled('declined'),
        error: onError,
      });
    } else {
      this.groupService.acceptInvitation(this.token!).subscribe({
        next: () => onSettled('accepted'),
        error: onError,
      });
    }
  }

  goToGroups(): void {
    this.router.navigate(['/groups']);
  }

  goToHome(): void {
    this.router.navigate(['/']);
  }

  /**
   * Salida secundaria: entra a la app a loguearse allí en vez de en esta página (con vuelta
   * automática a esta misma invitación). Aceptar/rechazar directamente desde dentro de la app
   * (p. ej. desde el listado de invitaciones pendientes) queda pendiente de implementar.
   */
  goToApp(): void {
    this.router.navigate(['/login'], { queryParams: { returnUrl: this.currentUrl() } });
  }

  private currentUrl(): string {
    return `/group-invitation?token=${this.token}`;
  }
}
