import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { NotificationService } from './notification.service';
import { CurrentUserService } from './current-user.service';
import { AppNotification } from '../models/notification.model';
import { MapItUser } from '../models/user.model';
import { environment } from '@env/environment';

describe('NotificationService', () => {
  let service: NotificationService;
  let cu: CurrentUserService;
  let httpMock: HttpTestingController;

  const user: MapItUser = {
    id: 'u1', name: 'Ana', nick: 'ana', email: 'ana@test.com', userType: 'individual',
    level: 0, xp: 0, unlockedCapabilities: [],
  };
  const notif = (over: Partial<AppNotification> = {}): AppNotification => ({
    id: 'n1', type: 'GROUP_INVITATION', title: 't', body: 'b', link: null, read: false,
    createdAt: '2026-08-01T00:00:00Z', ...over,
  });

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(NotificationService);
    cu = TestBed.inject(CurrentUserService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  /** Dispara el refresh() inicial atado a la sesión y consume las 2 peticiones que lanza. */
  function loginAndFlush(list: AppNotification[], unreadCount: number): void {
    cu.setUser(user);
    TestBed.tick();
    httpMock.expectOne(environment.apiNotificationsUrl).flush(list);
    httpMock.expectOne(`${environment.apiNotificationsUrl}/unread-count`).flush({ count: unreadCount });
  }

  it('sin sesión, no carga notificaciones', () => {
    TestBed.tick();
    expect(service.notifications()).toEqual([]);
    expect(service.unreadCount()).toBe(0);
    httpMock.expectNone(environment.apiNotificationsUrl);
  });

  it('al iniciar sesión, carga histórico y contador de no leídas', () => {
    loginAndFlush([notif()], 3);

    expect(service.notifications()).toEqual([notif()]);
    expect(service.unreadCount()).toBe(3);
  });

  it('al cerrar sesión, limpia histórico y contador', () => {
    loginAndFlush([notif()], 3);

    cu.clear();
    TestBed.tick();

    expect(service.notifications()).toEqual([]);
    expect(service.unreadCount()).toBe(0);
  });

  it('markRead marca como leída y decrementa el contador', () => {
    loginAndFlush([notif({ read: false })], 1);

    service.markRead('n1');
    httpMock.expectOne(`${environment.apiNotificationsUrl}/n1/read`).flush(null);

    expect(service.notifications()[0].read).toBe(true);
    expect(service.unreadCount()).toBe(0);
  });

  it('markRead sobre una notificación ya leída no hace ninguna petición', () => {
    loginAndFlush([notif({ read: true })], 0);

    service.markRead('n1');

    httpMock.expectNone(`${environment.apiNotificationsUrl}/n1/read`);
  });

  it('markAllRead marca todas como leídas y pone el contador a 0', () => {
    loginAndFlush([notif({ id: 'n1', read: false }), notif({ id: 'n2', read: false })], 2);

    service.markAllRead();
    httpMock.expectOne(`${environment.apiNotificationsUrl}/read-all`).flush(null);

    expect(service.notifications().every(n => n.read)).toBe(true);
    expect(service.unreadCount()).toBe(0);
  });

  it('markUnread marca como no leída e incrementa el contador', () => {
    loginAndFlush([notif({ read: true })], 0);

    service.markUnread('n1');
    httpMock.expectOne(`${environment.apiNotificationsUrl}/n1/unread`).flush(null);

    expect(service.notifications()[0].read).toBe(false);
    expect(service.unreadCount()).toBe(1);
  });

  it('delete quita la notificación de la lista y decrementa el contador si no estaba leída', () => {
    loginAndFlush([notif({ read: false })], 1);

    service.delete('n1');
    httpMock.expectOne(`${environment.apiNotificationsUrl}/n1`).flush(null);

    expect(service.notifications()).toEqual([]);
    expect(service.unreadCount()).toBe(0);
  });

  it('delete de una notificación ya leída no toca el contador', () => {
    loginAndFlush([notif({ read: true })], 0);

    service.delete('n1');
    httpMock.expectOne(`${environment.apiNotificationsUrl}/n1`).flush(null);

    expect(service.unreadCount()).toBe(0);
  });

  it('deleteAll vacía histórico y contador', () => {
    loginAndFlush([notif()], 1);

    service.deleteAll();
    httpMock.expectOne(environment.apiNotificationsUrl).flush(null);

    expect(service.notifications()).toEqual([]);
    expect(service.unreadCount()).toBe(0);
  });
});
