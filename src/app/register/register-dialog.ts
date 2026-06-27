import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators, AbstractControl } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { MatDialogRef, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSelectModule } from '@angular/material/select';
import { MatStepperModule } from '@angular/material/stepper';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { UserType } from '../core/models/user.model';
import { AuthService } from '../core/services/auth.service';
import { AuthRegisterRequest } from '../core/models/auth.model';

const ENTITY_TYPES = [
  { value: 'museum',      label: 'Museo' },
  { value: 'association', label: 'Asociación' },
  { value: 'town_hall',   label: 'Ayuntamiento' },
  { value: 'ngo',         label: 'ONG' },
  { value: 'cultural',    label: 'Centro cultural' },
  { value: 'sports_club', label: 'Club deportivo' },
  { value: 'other',       label: 'Otro' },
];

const USER_TYPE_MAP: Record<UserType, AuthRegisterRequest['userType']> = {
  individual:   'PARTICULAR',
  professional: 'PROFESSIONAL',
  entity:       'ENTITY',
};

@Component({
  selector: 'app-register-dialog',
  standalone: true,
  imports: [
    CommonModule, ReactiveFormsModule, RouterModule,
    MatDialogModule, MatFormFieldModule, MatInputModule,
    MatButtonModule, MatIconModule, MatSelectModule,
    MatStepperModule, MatProgressSpinnerModule, MatTooltipModule,
  ],
  templateUrl: './register-dialog.html',
  styleUrl: './register-dialog.scss',
})
export class RegisterDialogComponent {
  readonly dialogRef = inject(MatDialogRef<RegisterDialogComponent>);
  private fb          = inject(FormBuilder);
  private router      = inject(Router);
  private authService = inject(AuthService);

  selectedType        = signal<UserType | null>(null);
  hidePassword        = true;
  hidePasswordConfirm = true;
  loading             = signal(false);
  errorMsg            = signal<string | null>(null);
  readonly entityTypes = ENTITY_TYPES;

  step1Form = this.fb.group({
    userType: ['' as UserType, Validators.required],
  });

  step2Form = this.fb.group(
    {
      name:            ['', [Validators.required, Validators.minLength(2), Validators.maxLength(120)]],
      email:           ['', [Validators.required, Validators.email]],
      password:        ['', [Validators.required, Validators.minLength(6), Validators.maxLength(120)]],
      passwordConfirm: ['', Validators.required],
    },
    { validators: this.passwordMatchValidator }
  );

  step3ProfessionalForm = this.fb.group({
    businessName: ['', [Validators.required, Validators.minLength(2)]],
    cif:          ['', [Validators.required, Validators.pattern(/^[A-Z]\d{7}[0-9A-J]$/)]],
    phone:        ['', [Validators.required, Validators.pattern(/^\+?[0-9\s\-]{7,15}$/)]],
    web:          ['', Validators.pattern(/^https?:\/\/.+/)],
    address:      ['', Validators.required],
  });

  step3EntityForm = this.fb.group({
    entityName: ['', [Validators.required, Validators.minLength(2)]],
    entityType: ['', Validators.required],
    phone:      ['', [Validators.required, Validators.pattern(/^\+?[0-9\s\-]{7,15}$/)]],
    web:        ['', Validators.pattern(/^https?:\/\/.+/)],
    address:    ['', Validators.required],
  });

  get nameCtrl()            { return this.step2Form.controls['name']; }
  get emailCtrl()           { return this.step2Form.controls['email']; }
  get passwordCtrl()        { return this.step2Form.controls['password']; }
  get passwordConfirmCtrl() { return this.step2Form.controls['passwordConfirm']; }
  get businessNameCtrl()    { return this.step3ProfessionalForm.controls['businessName']; }
  get cifCtrl()             { return this.step3ProfessionalForm.controls['cif']; }
  get proPhoneCtrl()        { return this.step3ProfessionalForm.controls['phone']; }
  get proAddressCtrl()      { return this.step3ProfessionalForm.controls['address']; }
  get entityNameCtrl()      { return this.step3EntityForm.controls['entityName']; }
  get entityTypeCtrl()      { return this.step3EntityForm.controls['entityType']; }
  get entPhoneCtrl()        { return this.step3EntityForm.controls['phone']; }
  get entAddressCtrl()      { return this.step3EntityForm.controls['address']; }

  get step3Valid(): boolean {
    switch (this.selectedType()) {
      case 'individual':   return true;
      case 'professional': return this.step3ProfessionalForm.valid;
      case 'entity':       return this.step3EntityForm.valid;
      default:             return false;
    }
  }

  selectType(type: UserType): void {
    this.selectedType.set(type);
    this.step1Form.patchValue({ userType: type });
  }

  goToLogin(): void {
    this.dialogRef.close();
    this.router.navigate(['/login']);
  }

  submit(): void {
    if (!this.step3Valid || this.loading()) return;

    const type = this.selectedType()!;
    const { name, email, password } = this.step2Form.value;

    const payload: AuthRegisterRequest = {
      name:     name!,
      email:    email!,
      password: password!,
      userType: USER_TYPE_MAP[type],
    };

    this.loading.set(true);
    this.errorMsg.set(null);

    this.authService.register(payload).subscribe({
      next:  () => {
        this.loading.set(false);
        this.dialogRef.close(true);
      },
      error: (err) => {
        this.loading.set(false);
        this.errorMsg.set(
          err.status === 409
            ? 'Ya existe una cuenta con ese correo electrónico.'
            : 'Error al crear la cuenta. Inténtalo de nuevo.'
        );
      },
    });
  }

  private passwordMatchValidator(group: AbstractControl) {
    const pass    = group.get('password')?.value;
    const confirm = group.get('passwordConfirm')?.value;
    return pass === confirm ? null : { passwordMismatch: true };
  }
}
