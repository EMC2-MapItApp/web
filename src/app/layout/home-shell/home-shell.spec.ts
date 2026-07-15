import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { HomeShellComponent } from './home-shell';

describe('HomeShellComponent', () => {
  beforeEach(async () => {
    // Evita que ngOnInit abra el welcome-dialog durante el test.
    sessionStorage.setItem('welcome-dialog-shown', '1');
    await TestBed.configureTestingModule({
      imports: [HomeShellComponent],
      providers: [provideRouter([])],
    }).compileComponents();
  });

  afterEach(() => sessionStorage.removeItem('welcome-dialog-shown'));

  it('se crea y renderiza el outlet de las páginas hijas', async () => {
    const fixture = TestBed.createComponent(HomeShellComponent);
    await fixture.whenStable();
    expect(fixture.componentInstance).toBeTruthy();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('router-outlet')).toBeTruthy();
  });
});
