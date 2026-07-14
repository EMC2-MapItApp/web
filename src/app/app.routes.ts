/**
 * @file app.routes.ts
 * @description Rutas de la aplicación. `login`/`register` no son páginas propias: activan un
 * guard que abre el diálogo correspondiente sobre {@link HomeComponent} y redirigen a `/`.
 * `verify-email` y `stack` sí son páginas reales, pensadas para llegarse desde fuera de la app
 * (enlace de correo / enlace de portfolio) sin contexto previo del shell.
 */
import { Routes } from '@angular/router';
import { HomeComponent } from './home/home';
import { SettingsPageComponent } from './home/pages/settings/settings';
import { DashboardPageComponent } from './home/pages/dashboard/dashboard';
import { MapsPageComponent } from './home/pages/maps/maps';
import { ProfilePageComponent } from './home/pages/profile/profile';
import { CreatePublicationPageComponent } from './home/pages/create-publication/create-publication';
import { openLoginDialogGuard } from './core/guards/open-login-dialog.guard';
import { authDialogGuard } from './core/guards/auth-dialog.guard';
import { openRegisterDialogGuard } from './core/guards/open-register-dialog.guard';
import { loadUserOptionalGuard } from './core/guards/load-user-optional';
import { VerifyEmailPageComponent } from './verify-email/verify-email-page';
import { ResetPasswordPageComponent } from './reset-password/reset-password-page';
import { StackPageComponent } from './stack/stack-page';


export const routes: Routes = [
  { path: 'login', canActivate: [openLoginDialogGuard], component: HomeComponent },
  { path: 'register', canActivate: [openRegisterDialogGuard], component: HomeComponent },
  // Pagina real (no dialog): se llega aqui desde el enlace del correo de verificacion,
  // sin contexto previo de la app.
  { path: 'verify-email', component: VerifyEmailPageComponent },
  // Idem: se llega aqui desde el enlace del correo de restablecimiento de contraseña.
  { path: 'reset-password', component: ResetPasswordPageComponent },
  // Pagina publica de portfolio (stack tecnico), sin guard: accesible sin sesion.
  { path: 'stack', component: StackPageComponent },
  {
    path: '', component: HomeComponent,
    canActivate: [loadUserOptionalGuard],
    children: [
      { path: '', component: MapsPageComponent },
      { path: 'dashboard', component: DashboardPageComponent, canActivate: [authDialogGuard] },
      { path: 'profile', component: ProfilePageComponent, canActivate: [authDialogGuard] },
      { path: 'settings', component: SettingsPageComponent, canActivate: [authDialogGuard] },
      { path: 'create-publication', component: CreatePublicationPageComponent, canActivate: [authDialogGuard] },
    ]
  },
  { path: '**', redirectTo: '' }
];
