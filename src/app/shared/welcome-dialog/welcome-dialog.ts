import { Component, inject } from '@angular/core';
import { MatDialogRef, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { Router } from '@angular/router';

/**
 * Diálogo de bienvenida para visitantes anónimos, abierto una vez por sesión de navegador desde
 * {@link HomeComponent} (marcado con `sessionStorage['welcome-dialog-shown']` para no repetirse
 * en cada navegación dentro de la misma pestaña).
 */
@Component({
  selector: 'app-welcome-dialog',
  standalone: true,
  imports: [MatDialogModule, MatButtonModule, MatIconModule],
  templateUrl: './welcome-dialog.html',
  styleUrl: './welcome-dialog.scss',
})
export class WelcomeDialogComponent {

  readonly dialogRef = inject(MatDialogRef<WelcomeDialogComponent>);

  private router = inject(Router);

  goToRegister(): void {
    this.dialogRef.close();
    this.router.navigate(['/register']);
  }

  goToLogin(): void {
    this.dialogRef.close();
    this.router.navigate(['/login']);
  }

}
