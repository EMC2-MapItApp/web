import { Component, inject } from '@angular/core';
import { MatDialogRef, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { Router } from '@angular/router';

@Component({
  selector: 'app-auth-required-dialog',
  standalone: true,
  imports: [MatDialogModule, MatButtonModule, MatIconModule],
  templateUrl: './auth-required-dialog.html',
  styleUrl: './auth-required-dialog.scss',
})
export class AuthRequiredDialogComponent {
  readonly dialogRef = inject(MatDialogRef<AuthRequiredDialogComponent>);
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
