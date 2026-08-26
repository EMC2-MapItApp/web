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
import { HttpContext } from '@angular/common/http';
import { SKIP_UNAUTHORIZED_DIALOG } from '@core/interceptors/unauthorized.interceptor';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { AuthService } from '@core/services/auth.service';
import { CurrentUserService } from '@core/services/current-user.service';
import { GroupService } from '@core/services/group.service';
import { CategoryService } from '@core/services/category.service';
import { GroupInvitation } from '@core/models/group.model';
import { MainCategory } from '@core/models/category.model';

type InvitationPageState =
  'loading' | 'invite' | 'accepted' | 'declined' | 'login-required' | 'wrong-account' | 'error';

/**
 * Qué hacer con la invitación en cuanto haya sesión de la cuenta correcta — se resuelve solo tras
 * el login inline. 'view' es el caso del propio `ngOnInit` (aún no se ha decidido nada, solo hay
 * que volver a cargar la invitación); 'accept'/'decline' son decisiones ya tomadas antes de que
 * la sesión resultara inválida o de otra cuenta.
 */
type PendingAction = 'view' | 'accept' | 'decline';

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
  private readonly currentUserService = inject(CurrentUserService);
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

  /** El 401/403 de esta página tiene un significado propio (login inline / cuenta equivocada,
   *  ver {@link handleLoadError}) — se excluye del diálogo global de "Acceso restringido". */
  private readonly skipAuthDialog = { context: new HttpContext().set(SKIP_UNAUTHORIZED_DIALOG, true) };

  private token: string | null = null;
  /** Por defecto 'view': es lo que hace el propio `ngOnInit`. Solo pasa a 'accept'/'decline' si
   *  el 401/403 ocurrió al pulsar ese botón con la sesión ya caducada o de otra cuenta. */
  private pendingAction: PendingAction = 'view';
  /** Identificador (nick o email) de la cuenta logada cuando el 403 revela que no es la
   *  invitada — se guarda para poder mostrarlo en el estado 'wrong-account'. */
  readonly wrongAccountIdentifier = signal<string | null>(null);

  get identifierCtrl() { return this.loginForm.controls['identifier']; }
  get passwordCtrl() { return this.loginForm.controls['password']; }

  ngOnInit(): void {
    this.token = this.route.snapshot.queryParamMap.get('token');
    if (!this.token) {
      this.state.set('error');
      return;
    }

    this.loadInvitation();
  }

  private loadInvitation(): void {
    const token = this.token!;
    this.state.set('loading');
    this.groupService.getInvitationById(token, this.skipAuthDialog).subscribe({
      next: invitation => {
        if (!invitation || invitation.status !== 'pending') {
          this.state.set('error');
          return;
        }
        this.invitation.set(invitation);
        this.state.set('invite');

        // El árbol de categorías se carga bajo demanda (esta página, a diferencia del resto de
        // páginas de Grupos, es standalone y puede ser la primera en cargar, sin cache previa).
        this.categoryService.getAll().subscribe(() => {
          this.category.set(this.categoryService.getMainCategoryById(invitation.groupCategoryId));
        });
      },
      // 401: el enlace del correo se abrió sin sesión iniciada en este navegador (caso
      // habitual, la página es accesible sin login previo). Como quien recibe una invitación
      // ya tiene cuenta por definición (se invita por nick/email existente), se pide login
      // directamente en la propia página en vez de mandar a crear una cuenta.
      // 403: sí hay sesión, pero de una cuenta distinta a la invitada (p. ej. otro usuario
      // seguía logado en ese navegador) — se distingue de "invitación no disponible" para no
      // decirle a alguien con la cuenta equivocada que el enlace ha caducado.
      error: err => this.handleLoadError(err),
    });
  }

  private handleLoadError(err: { status?: number }): void {
    if (err.status === 401) {
      this.state.set('login-required');
    } else if (err.status === 403) {
      this.wrongAccountIdentifier.set(this.currentUserService.user()?.nick ?? this.currentUserService.user()?.email ?? null);
      this.state.set('wrong-account');
    } else {
      this.state.set('error');
    }
  }

  accept(): void {
    const inv = this.invitation();
    if (!inv || this.processing()) return;

    this.processing.set(true);
    this.groupService.acceptInvitation(inv.id, this.skipAuthDialog).subscribe({
      next: () => {
        this.processing.set(false);
        this.state.set('accepted');
      },
      // La sesión pudo caducar, o cambiar de cuenta, entre la carga de la página y el click.
      error: err => {
        this.processing.set(false);
        this.pendingAction = 'accept';
        this.handleLoadError(err);
      },
    });
  }

  decline(): void {
    const inv = this.invitation();
    if (!inv || this.processing()) return;

    this.processing.set(true);
    this.groupService.declineInvitation(inv.id, this.skipAuthDialog).subscribe({
      next: () => {
        this.processing.set(false);
        this.state.set('declined');
      },
      error: err => {
        this.processing.set(false);
        this.pendingAction = 'decline';
        this.handleLoadError(err);
      },
    });
  }

  /** Botón del estado 'wrong-account': cierra la sesión de la cuenta equivocada y pide iniciar
   *  sesión con la cuenta invitada, reutilizando el formulario inline de 'login-required'. */
  logoutAndRelogin(): void {
    this.authService.logout();
    this.wrongAccountIdentifier.set(null);
    this.loginError.set(null);
    this.state.set('login-required');
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
    if (this.pendingAction === 'view') {
      // Se llegó a 'login-required' desde la carga inicial (401/403): tras loguear con la
      // cuenta correcta, hay que volver a mostrar la invitación, no decidir nada por el usuario.
      this.processing.set(false);
      this.loadInvitation();
      return;
    }

    const onSettled = (nextState: InvitationPageState) => {
      this.processing.set(false);
      this.state.set(nextState);
    };
    const onError = () => {
      this.processing.set(false);
      this.state.set('error');
    };

    if (this.pendingAction === 'decline') {
      this.groupService.declineInvitation(this.token!, this.skipAuthDialog).subscribe({
        next: () => onSettled('declined'),
        error: onError,
      });
    } else {
      this.groupService.acceptInvitation(this.token!, this.skipAuthDialog).subscribe({
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
