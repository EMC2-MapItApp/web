import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { vi } from 'vitest';
import { PushNotificationService } from './push-notification.service';
import { PUSH_PROVIDER, PushProvider } from '../notifications/push-provider';
import { environment } from '@env/environment';

describe('PushNotificationService', () => {
  let service: PushNotificationService;
  let httpMock: HttpTestingController;
  let provider: {
    isSupported: ReturnType<typeof vi.fn>;
    permissionState: ReturnType<typeof vi.fn>;
    hasActiveSubscription: ReturnType<typeof vi.fn>;
    subscribe: ReturnType<typeof vi.fn>;
    unsubscribe: ReturnType<typeof vi.fn>;
  };

  function configure(supported: boolean, activeSubscription = false): PushNotificationService {
    provider = {
      isSupported: vi.fn().mockReturnValue(supported),
      permissionState: vi.fn().mockReturnValue(supported ? 'default' : 'unsupported'),
      hasActiveSubscription: vi.fn().mockResolvedValue(activeSubscription),
      subscribe: vi.fn(),
      unsubscribe: vi.fn(),
    };
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: PUSH_PROVIDER, useValue: provider as unknown as PushProvider },
      ],
    });
    httpMock = TestBed.inject(HttpTestingController);
    return TestBed.inject(PushNotificationService);
  }

  afterEach(() => httpMock.verify());

  it('isSupported delega en el provider (soportado)', () => {
    service = configure(true);
    expect(service.isSupported).toBe(true);
  });

  it('isSupported delega en el provider (no soportado)', () => {
    service = configure(false);
    expect(service.isSupported).toBe(false);
  });

  it('al construirse, si el provider lo soporta, comprueba si ya hay una suscripción activa', async () => {
    service = configure(true, true);
    await Promise.resolve(); // deja resolver el .then() del constructor

    expect(provider.hasActiveSubscription).toHaveBeenCalled();
    expect(service.enabled()).toBe(true);
  });

  it('si el provider no está soportado, no comprueba suscripción activa', () => {
    service = configure(false);
    expect(provider.hasActiveSubscription).not.toHaveBeenCalled();
  });

  describe('enable', () => {
    it('sin soporte, marca el estado "unsupported" y no llama al backend', async () => {
      service = configure(false);

      const result = await service.enable();

      expect(result).toBe(false);
      expect(service.permissionState()).toBe('unsupported');
      httpMock.expectNone(`${environment.apiNotificationsUrl}/push/public-key`);
    });

    it('sin clave VAPID configurada en el backend, no se suscribe', async () => {
      service = configure(true);

      const promise = service.enable();
      httpMock
        .expectOne(`${environment.apiNotificationsUrl}/push/public-key`)
        .flush({ publicKey: '' });
      const result = await promise;

      expect(result).toBe(false);
      expect(provider.subscribe).not.toHaveBeenCalled();
    });

    it('con clave VAPID y suscripción del provider, registra en el backend y activa enabled()', async () => {
      service = configure(true);
      provider.subscribe.mockResolvedValue({
        endpoint: 'https://push.example/e1',
        keys: { p256dh: 'a', auth: 'b' },
      });

      const promise = service.enable();
      httpMock
        .expectOne(`${environment.apiNotificationsUrl}/push/public-key`)
        .flush({ publicKey: 'vapid-key' });
      // Deja que provider.subscribe() (async) resuelva antes de esperar la siguiente petición.
      await Promise.resolve();
      await Promise.resolve();
      httpMock.expectOne(`${environment.apiNotificationsUrl}/push/subscriptions`).flush(null);
      const result = await promise;

      expect(provider.subscribe).toHaveBeenCalledWith('vapid-key');
      expect(result).toBe(true);
      expect(service.enabled()).toBe(true);
    });

    it('si provider.subscribe() devuelve null (permiso denegado), no llama al backend', async () => {
      service = configure(true);
      provider.subscribe.mockResolvedValue(null);

      const promise = service.enable();
      httpMock
        .expectOne(`${environment.apiNotificationsUrl}/push/public-key`)
        .flush({ publicKey: 'vapid-key' });
      const result = await promise;

      expect(result).toBe(false);
      httpMock.expectNone(`${environment.apiNotificationsUrl}/push/subscriptions`);
    });

    it('si el registro en el backend falla, propaga el error', async () => {
      service = configure(true);
      provider.subscribe.mockResolvedValue({ endpoint: 'e1', keys: { p256dh: 'a', auth: 'b' } });

      const promise = service.enable();
      httpMock
        .expectOne(`${environment.apiNotificationsUrl}/push/public-key`)
        .flush({ publicKey: 'vapid-key' });
      await Promise.resolve();
      await Promise.resolve();
      httpMock
        .expectOne(`${environment.apiNotificationsUrl}/push/subscriptions`)
        .flush(null, { status: 500, statusText: 'Server Error' });

      await expect(promise).rejects.toBeTruthy();
      expect(service.enabled()).toBe(false);
    });
  });

  describe('disable', () => {
    it('con suscripción activa, da de baja localmente y en el backend con su endpoint', async () => {
      service = configure(true, true);
      await Promise.resolve();
      provider.unsubscribe.mockResolvedValue('https://push.example/e1');

      const promise = service.disable();
      // disable() primero await provider.unsubscribe() (async) antes de llamar al backend —
      // hay que dejar que ese microtask resuelva antes de que la petición HTTP exista.
      await Promise.resolve();
      httpMock.expectOne(`${environment.apiNotificationsUrl}/push/subscriptions`).flush(null);
      await promise;

      expect(service.enabled()).toBe(false);
    });

    it('sin suscripción activa localmente (unsubscribe devuelve null), no llama al backend', async () => {
      service = configure(true);
      provider.unsubscribe.mockResolvedValue(null);

      await service.disable();

      expect(service.enabled()).toBe(false);
      httpMock.expectNone(`${environment.apiNotificationsUrl}/push/subscriptions`);
    });
  });
});
