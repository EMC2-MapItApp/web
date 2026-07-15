/**
 * @file app.routes.ts
 * @description Rutas de la aplicación. `login`/`register` no son páginas propias: activan un
 * guard que abre el diálogo correspondiente sobre {@link HomeComponent} y redirigen a `/`.
 * `verify-email` y `reset-password` sí son páginas standalone (fuera del shell), pensadas para
 * llegarse desde el enlace de un correo sin contexto previo de la app. El resto de páginas
 * (incluidas las informativas about/changelog/stack, sin guard) son hijas del shell de home.
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
import { AboutPageComponent } from './about/about-page';
import { ChangelogPageComponent } from './changelog/changelog-page';


export const routes: Routes = [
  { path: 'login', canActivate: [openLoginDialogGuard], component: HomeComponent },
  { path: 'register', canActivate: [openRegisterDialogGuard], component: HomeComponent },
  // Pagina real (no dialog): se llega aqui desde el enlace del correo de verificacion,
  // sin contexto previo de la app.
  { path: 'verify-email', component: VerifyEmailPageComponent },
  // Idem: se llega aqui desde el enlace del correo de restablecimiento de contraseña.
  { path: 'reset-password', component: ResetPasswordPageComponent },
  {
    path: '', component: HomeComponent,
    canActivate: [loadUserOptionalGuard],
    children: [
      { path: '', component: MapsPageComponent },
      { path: 'dashboard', component: DashboardPageComponent, canActivate: [authDialogGuard] },
      { path: 'profile', component: ProfilePageComponent, canActivate: [authDialogGuard] },
      { path: 'settings', component: SettingsPageComponent, canActivate: [authDialogGuard] },
      { path: 'create-publication', component: CreatePublicationPageComponent, canActivate: [authDialogGuard] },
      // Paginas informativas ("Acerca de", "Novedades", "Stack tecnico"): se renderizan
      // dentro del shell (mismo marco visual que Ajustes) pero sin guard de login —
      // siguen siendo accesibles sin sesion.
      { path: 'about', component: AboutPageComponent },
      { path: 'changelog', component: ChangelogPageComponent },
      { path: 'stack', component: StackPageComponent },
    ]
  },
  { path: '**', redirectTo: '' }
];
