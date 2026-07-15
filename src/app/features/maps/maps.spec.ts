import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { MapsPageComponent } from './maps';

describe('MapsPageComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MapsPageComponent],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    }).compileComponents();
  });

  // Smoke test sin detectChanges: ngOnInit carga el script real de Google Maps,
  // que no está disponible en el entorno de test. Instanciar ya valida el
  // cableado de inyección (12 servicios) tras la reorganización de carpetas.
  it('se instancia con todas sus dependencias resueltas', () => {
    const fixture = TestBed.createComponent(MapsPageComponent);
    expect(fixture.componentInstance).toBeTruthy();
  });
});
