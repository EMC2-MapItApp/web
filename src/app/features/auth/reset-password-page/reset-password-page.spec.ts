import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ResetPasswordPageComponent } from './reset-password-page';

describe('ResetPasswordPageComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ResetPasswordPageComponent],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        // Simula llegar desde el enlace del correo con un token válido en la URL.
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { queryParamMap: convertToParamMap({ token: 'test-token' }) } },
        },
      ],
    }).compileComponents();
  });

  it('se crea y muestra el formulario con el medidor de fuerza de contraseña', async () => {
    const fixture = TestBed.createComponent(ResetPasswordPageComponent);
    await fixture.whenStable();
    expect(fixture.componentInstance).toBeTruthy();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('form')).toBeTruthy();
    // Valida que password-strength-meter resuelve tras moverse a features/auth.
    expect(compiled.querySelector('app-password-strength-meter')).toBeTruthy();
  });
});
