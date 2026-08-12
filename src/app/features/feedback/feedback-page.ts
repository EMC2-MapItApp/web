/**
 * @file feedback-page.ts
 * @description Página para que el usuario autenticado informe de un error o una sugerencia al
 * equipo de desarrollo (categoría + asunto + mensaje → `POST /api/v1/feedback`, ver
 * FeedbackService). Ruta protegida por `authDialogGuard`, como Perfil/Ajustes/Grupos.
 */
import { Component, inject, signal } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar } from '@angular/material/snack-bar';
import { FeedbackCategory, FeedbackService } from '@core/services/feedback.service';

interface CategoryOption {
  value: FeedbackCategory;
  label: string;
}

@Component({
  selector: 'app-feedback-page',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    MatFormFieldModule, MatInputModule, MatSelectModule,
    MatButtonModule, MatIconModule, MatProgressSpinnerModule,
  ],
  templateUrl: './feedback-page.html',
  styleUrl: './feedback-page.scss',
})
export class FeedbackPageComponent {
  private readonly titleService = inject(Title);
  private readonly feedbackService = inject(FeedbackService);
  private readonly snackBar = inject(MatSnackBar);
  private readonly fb = inject(FormBuilder);

  readonly categoryOptions: CategoryOption[] = [
    { value: 'BUG', label: 'He encontrado un error' },
    { value: 'SUGGESTION', label: 'Tengo una sugerencia' },
    { value: 'OTHER', label: 'Otro' },
  ];

  readonly form = this.fb.nonNullable.group({
    category: this.fb.nonNullable.control<FeedbackCategory>('BUG', Validators.required),
    subject: ['', [Validators.required, Validators.maxLength(200)]],
    message: ['', [Validators.required, Validators.maxLength(2000)]],
  });

  readonly sending = signal(false);

  get subjectCtrl() { return this.form.controls['subject']; }
  get messageCtrl() { return this.form.controls['message']; }

  constructor() {
    this.titleService.setTitle('MapIt — Enviar feedback');
  }

  send(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const { category, subject, message } = this.form.getRawValue();
    this.sending.set(true);
    this.feedbackService.send({ category, subject: subject.trim(), message: message.trim() }).subscribe({
      next: () => {
        this.sending.set(false);
        this.form.reset({ category: 'BUG', subject: '', message: '' });
        this.notify('Gracias por tu feedback, lo hemos recibido');
      },
      error: () => {
        this.sending.set(false);
        this.notify('No se pudo enviar el feedback. Inténtalo de nuevo más tarde.');
      },
    });
  }

  private notify(message: string): void {
    this.snackBar.open(message, 'Cerrar', {
      duration: 3000,
      horizontalPosition: 'center',
      verticalPosition: 'top',
    });
  }
}
