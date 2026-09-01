import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { UserService } from './user.service';
import { CurrentUserService } from './current-user.service';
import { MapItUser } from '../models/user.model';
import { SKIP_UNAUTHORIZED_DIALOG } from '../interceptors/unauthorized.interceptor';
import { environment } from '@env/environment';

describe('UserService', () => {
  let service: UserService;
  let cu: CurrentUserService;
  let httpMock: HttpTestingController;

  const user: MapItUser = {
    id: 'u1', name: 'Ana', nick: 'ana', email: 'ana@test.com', userType: 'individual',
    level: 0, xp: 0, unlockedCapabilities: [],
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(UserService);
    cu = TestBed.inject(CurrentUserService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('loadMe hace GET /auth/me marcado para saltar el diálogo global de 401, y puebla CurrentUserService', () => {
    let result: MapItUser | undefined;
    service.loadMe().subscribe(r => (result = r));

    const req = httpMock.expectOne(`${environment.apiAuthUrl}/me`);
    expect(req.request.method).toBe('GET');
    expect(req.request.context.get(SKIP_UNAUTHORIZED_DIALOG)).toBe(true);
    req.flush(user);

    expect(result).toEqual(user);
    expect(cu.user()).toEqual(user);
  });

  it('getById hace GET /users/{id} sin tocar CurrentUserService', () => {
    let result: MapItUser | undefined;
    service.getById('u2').subscribe(r => (result = r));

    const req = httpMock.expectOne(`${environment.apiUsersUrl}/u2`);
    expect(req.request.method).toBe('GET');
    req.flush({ ...user, id: 'u2' });

    expect(result?.id).toBe('u2');
    expect(cu.user()).toBeNull();
  });

  it('updateProfile hace PATCH /users/{id} con el usuario activo y actualiza CurrentUserService', () => {
    cu.setUser(user);
    const payload = { name: 'Ana María' };

    let result: MapItUser | undefined;
    service.updateProfile(payload).subscribe(r => (result = r));

    const req = httpMock.expectOne(`${environment.apiUsersUrl}/u1`);
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body).toEqual(payload);
    const updated = { ...user, name: 'Ana María' };
    req.flush(updated);

    expect(result).toEqual(updated);
    expect(cu.userName()).toBe('Ana María');
  });

  it('updateProfile sin sesión lanza en vez de llamar al backend', () => {
    expect(() => service.updateProfile({ name: 'x' })).toThrow();
    httpMock.expectNone(`${environment.apiUsersUrl}/u1`);
  });

  it('changePassword hace PATCH /users/{id}/password con ambas contraseñas', () => {
    cu.setUser(user);

    service.changePassword('actual123', 'nueva456').subscribe();

    const req = httpMock.expectOne(`${environment.apiUsersUrl}/u1/password`);
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body).toEqual({ currentPassword: 'actual123', newPassword: 'nueva456' });
    req.flush(null);
  });

  it('changePassword sin sesión lanza en vez de llamar al backend', () => {
    expect(() => service.changePassword('a', 'b')).toThrow();
  });
});
