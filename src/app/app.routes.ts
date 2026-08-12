/**
 * @file app.routes.ts
 * @description Rutas de la aplicación. `login`/`register` no son páginas propias: activan un
 * guard que abre el diálogo correspondiente sobre {@link HomeShellComponent} y redirigen a `/`.
 * `verify-email`, `reset-password` y `group-invitation` sí son páginas standalone (fuera del
 * shell), pensadas para llegarse desde el enlace de un correo sin contexto previo de la app.
 * El resto de páginas (incluidas las informativas about/changelog/stack, sin guard) son hijas
 * del shell.
 *
 * Todas las páginas se cargan con `loadComponent` (lazy) salvo el shell, que es la ruta raíz
 * y siempre hace falta. Los diálogos que abren los guards también se importan dinámicamente
 * dentro del propio guard para mantenerlos fuera del bundle inicial.
 */
import { Routes } from '@angular/router';
import { HomeShellComponent } from '@layout/home-shell/home-shell';
import { openLoginDialogGuard } from '@core/guards/open-login-dialog.guard';
import { authDialogGuard } from '@core/guards/auth-dialog.guard';
import { openRegisterDialogGuard } from '@core/guards/open-register-dialog.guard';
import { loadUserOptionalGuard } from '@core/guards/load-user-optional';


export const routes: Routes = [
  { path: 'login', canActivate: [openLoginDialogGuard], component: HomeShellComponent },
  { path: 'register', canActivate: [openRegisterDialogGuard], component: HomeShellComponent },
  // Pagina real (no dialog): se llega aqui desde el enlace del correo de verificacion,
  // sin contexto previo de la app.
  {
    path: 'verify-email',
    loadComponent: () => import('@features/auth/verify-email-page/verify-email-page')
      .then(m => m.VerifyEmailPageComponent)
  },
  // Idem: se llega aqui desde el enlace del correo de restablecimiento de contraseña.
  {
    path: 'reset-password',
    loadComponent: () => import('@features/auth/reset-password-page/reset-password-page')
      .then(m => m.ResetPasswordPageComponent)
  },
  // Idem: se llega aqui desde el enlace del correo de invitacion a un grupo.
  {
    path: 'group-invitation',
    loadComponent: () => import('@features/groups/group-invitation-page/group-invitation-page')
      .then(m => m.GroupInvitationPageComponent)
  },
  {
    path: '', component: HomeShellComponent,
    canActivate: [loadUserOptionalGuard],
    children: [
      {
        path: '',
        loadComponent: () => import('@features/maps/maps').then(m => m.MapsPageComponent)
      },
      {
        path: 'dashboard',
        canActivate: [authDialogGuard],
        loadComponent: () => import('@features/dashboard/dashboard').then(m => m.DashboardPageComponent)
      },
      {
        path: 'profile',
        canActivate: [authDialogGuard],
        loadComponent: () => import('@features/profile/profile').then(m => m.ProfilePageComponent)
      },
      {
        path: 'settings',
        canActivate: [authDialogGuard],
        loadComponent: () => import('@features/settings/settings').then(m => m.SettingsPageComponent)
      },
      {
        path: 'groups',
        canActivate: [authDialogGuard],
        loadComponent: () => import('@features/groups/groups-page/groups-page').then(m => m.GroupsPageComponent)
      },
      {
        path: 'feedback',
        canActivate: [authDialogGuard],
        loadComponent: () => import('@features/feedback/feedback-page').then(m => m.FeedbackPageComponent)
      },
      {
        path: 'groups/:id/edit',
        canActivate: [authDialogGuard],
        loadComponent: () => import('@features/groups/group-form-page/group-form-page').then(m => m.GroupFormPageComponent)
      },
      {
        path: 'create-publication',
        canActivate: [authDialogGuard],
        loadComponent: () => import('@features/publications/create-publication/create-publication')
          .then(m => m.CreatePublicationPageComponent)
      },
      // Paginas informativas ("Acerca de", "Novedades", "Stack tecnico"): se renderizan
      // dentro del shell (mismo marco visual que Ajustes) pero sin guard de login —
      // siguen siendo accesibles sin sesion.
      {
        path: 'about',
        loadComponent: () => import('@features/info/about/about-page').then(m => m.AboutPageComponent)
      },
      {
        path: 'changelog',
        loadComponent: () => import('@features/info/changelog/changelog-page').then(m => m.ChangelogPageComponent)
      },
      {
        path: 'stack',
        loadComponent: () => import('@features/info/stack/stack-page').then(m => m.StackPageComponent)
      },
    ]
  },
  { path: '**', redirectTo: '' }
];
