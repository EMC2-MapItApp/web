import { Component, inject, signal } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatListModule } from '@angular/material/list';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { CurrentUserService } from '../core/services/current-user.service';
import { SlicePipe } from '@angular/common';
import { WelcomeDialogComponent } from '../shared/welcome-dialog/welcome-dialog';
import { MatDialog } from '@angular/material/dialog';
import { WELCOME_DIALOG_CONFIG } from '../core/constants/dialog.constants';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [
    RouterOutlet,
    RouterLink,
    RouterLinkActive,
    MatSidenavModule,
    MatToolbarModule,
    MatListModule,
    MatIconModule,
    MatButtonModule,
    SlicePipe
  ],
  templateUrl: './home.html',
  styleUrls: ['./home.scss']
})
export class HomeComponent {
  private router = inject(Router);
  private dialog = inject(MatDialog);

  readonly currentUser = inject(CurrentUserService);

  readonly collapsed = signal(true);

  ngOnInit(): void {
    const alreadyShown = sessionStorage.getItem('welcome-dialog-shown');
    if (!this.currentUser.user() && !alreadyShown) {
      sessionStorage.setItem('welcome-dialog-shown', '1');
      this.dialog.open(WelcomeDialogComponent, WELCOME_DIALOG_CONFIG);
    }
  }

  toggleSidenav(): void {
    this.collapsed.update((v) => !v);
  }

  logout(): void {
    localStorage.removeItem('token');
    this.currentUser.clear();
    this.router.navigate(['/']);
  }
}

