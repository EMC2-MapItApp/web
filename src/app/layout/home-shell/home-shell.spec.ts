import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { HomeShellComponent } from './home-shell';
import { PUSH_PROVIDER, PushProvider } from '@core/notifications/push-provider';

// PushNotificationService (inyectado por HomeShellComponent) requiere el token PUSH_PROVIDER
// en runtime real (ver app.config.ts) — sin él, TestBed falla con NG0201. No hace falta un
// provider funcional para este test, solo que resuelva la inyección.
const fakePushProvider: PushProvider = {
  isSupported: () => false,
  permissionState: () => 'unsupported',
  hasActiveSubscription: () => Promise.resolve(false),
  subscribe: () => Promise.resolve(null),
  unsubscribe: () => Promise.resolve(null),
};

describe('HomeShellComponent', () => {
  beforeEach(async () => {
    // Evita que ngOnInit abra el welcome-dialog durante el test.
    sessionStorage.setItem('welcome-dialog-shown', '1');
    await TestBed.configureTestingModule({
      imports: [HomeShellComponent],
      providers: [provideRouter([]), { provide: PUSH_PROVIDER, useValue: fakePushProvider }],
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
