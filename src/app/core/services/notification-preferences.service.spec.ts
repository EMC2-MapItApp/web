import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { NotificationPreferencesService } from './notification-preferences.service';
import { CurrentUserService } from './current-user.service';
import { NotificationPreference } from '../models/notification.model';
import { MapItUser } from '../models/user.model';
import { environment } from '@env/environment';

describe('NotificationPreferencesService', () => {
  let service: NotificationPreferencesService;
  let cu: CurrentUserService;
  let httpMock: HttpTestingController;

  const user: MapItUser = {
    id: 'u1', name: 'Ana', nick: 'ana', email: 'ana@test.com', userType: 'individual',
    level: 0, xp: 0, unlockedCapabilities: [],
  };
  const prefs: NotificationPreference[] = [
    { type: 'GROUP_INVITATION', emailEnabled: true },
    { type: 'GROUP_BROADCAST', emailEnabled: false },
  ];

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(NotificationPreferencesService);
    cu = TestBed.inject(CurrentUserService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('sin sesión, no carga preferencias', () => {
    TestBed.tick();
    expect(service.preferences()).toEqual([]);
    httpMock.expectNone(`${environment.apiNotificationsUrl}/preferences`);
  });

  it('al iniciar sesión (userId), carga las preferencias vía GET', () => {
    cu.setUser(user);
    TestBed.tick();

    httpMock.expectOne(`${environment.apiNotificationsUrl}/preferences`).flush(prefs);

    expect(service.preferences()).toEqual(prefs);
  });

  it('al cerrar sesión, limpia las preferencias sin llamar al backend', () => {
    cu.setUser(user);
    TestBed.tick();
    httpMock.expectOne(`${environment.apiNotificationsUrl}/preferences`).flush(prefs);

    cu.clear();
    TestBed.tick();

    expect(service.preferences()).toEqual([]);
    httpMock.expectNone(`${environment.apiNotificationsUrl}/preferences`);
  });

  it('toggleEmail aplica el cambio de forma optimista antes de que responda el backend', () => {
    cu.setUser(user);
    TestBed.tick();
    httpMock.expectOne(`${environment.apiNotificationsUrl}/preferences`).flush(prefs);

    service.toggleEmail('GROUP_INVITATION');

    expect(service.preferences().find(p => p.type === 'GROUP_INVITATION')?.emailEnabled).toBe(false);
    httpMock.expectOne(`${environment.apiNotificationsUrl}/preferences/GROUP_INVITATION`).flush(null);
  });

  it('toggleEmail revierte el cambio optimista si el PATCH falla', () => {
    cu.setUser(user);
    TestBed.tick();
    httpMock.expectOne(`${environment.apiNotificationsUrl}/preferences`).flush(prefs);

    service.toggleEmail('GROUP_INVITATION');
    httpMock.expectOne(`${environment.apiNotificationsUrl}/preferences/GROUP_INVITATION`)
      .flush(null, { status: 500, statusText: 'Server Error' });

    expect(service.preferences().find(p => p.type === 'GROUP_INVITATION')?.emailEnabled).toBe(true);
  });
});
