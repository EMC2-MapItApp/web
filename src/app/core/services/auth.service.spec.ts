import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { AuthService } from './auth.service';
import { CurrentUserService } from './current-user.service';
import { AuthResponse } from '../models/auth.model';
import { MapItUser } from '../models/user.model';
import { environment } from '@env/environment';

describe('AuthService', () => {
  let service: AuthService;
  let cu: CurrentUserService;
  let httpMock: HttpTestingController;

  const baseUser: Omit<MapItUser, 'userType'> = {
    id: 'u1',
    name: 'Ana',
    nick: 'ana',
    email: 'ana@test.com',
    level: 0,
    xp: 0,
    unlockedCapabilities: [],
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(AuthService);
    cu = TestBed.inject(CurrentUserService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
    localStorage.clear();
  });

  describe('login', () => {
    it('guarda el token y mapea PARTICULAR a individual en CurrentUserService', () => {
      const backendUser = { ...baseUser, userType: 'PARTICULAR' } as unknown as MapItUser;
      const response: AuthResponse = { token: 'jwt-abc', user: backendUser };

      service.login({ identifier: 'ana@test.com', password: 'x' }).subscribe();

      const req = httpMock.expectOne(`${environment.apiAuthUrl}/login`);
      expect(req.request.method).toBe('POST');
      req.flush(response);

      // Clave literal, no TOKEN_KEY importado: si alguien cambia el nombre de la
      // clave de storage rompiendo sesiones existentes, este test debe fallar.
      expect(localStorage.getItem('token')).toBe('jwt-abc');
      expect(cu.user()?.userType).toBe('individual');
      expect(cu.userId()).toBe('u1');
    });
  });

  describe('logout', () => {
    it('borra el token y limpia CurrentUserService', () => {
      localStorage.setItem('token', 'jwt-abc');
      cu.setUser({ ...baseUser, userType: 'individual' });

      service.logout();

      expect(localStorage.getItem('token')).toBeNull();
      expect(cu.user()).toBeNull();
    });
  });

  describe('register', () => {
    it('hace POST a /register con el payload tal cual', () => {
      const payload = {
        name: 'Ana',
        email: 'ana@test.com',
        password: 'x',
        userType: 'PARTICULAR' as const,
      };
      service.register(payload).subscribe();

      const req = httpMock.expectOne(`${environment.apiAuthUrl}/register`);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual(payload);
      req.flush({ email: 'ana@test.com' });
    });
  });

  describe('verifyEmail / resendVerification / forgotPassword / resetPassword', () => {
    it('verifyEmail envía { token } a /verify-email', () => {
      service.verifyEmail('tok-1').subscribe();
      const req = httpMock.expectOne(`${environment.apiAuthUrl}/verify-email`);
      expect(req.request.body).toEqual({ token: 'tok-1' });
      req.flush(null);
    });

    it('resendVerification envía { email } a /resend-verification', () => {
      service.resendVerification('ana@test.com').subscribe();
      const req = httpMock.expectOne(`${environment.apiAuthUrl}/resend-verification`);
      expect(req.request.body).toEqual({ email: 'ana@test.com' });
      req.flush({ message: 'ok' });
    });

    it('forgotPassword envía { email } a /forgot-password', () => {
      service.forgotPassword('ana@test.com').subscribe();
      const req = httpMock.expectOne(`${environment.apiAuthUrl}/forgot-password`);
      expect(req.request.body).toEqual({ email: 'ana@test.com' });
      req.flush({ message: 'ok' });
    });

    it('resetPassword envía { token, newPassword } a /reset-password', () => {
      service.resetPassword('tok-1', 'nueva123').subscribe();
      const req = httpMock.expectOne(`${environment.apiAuthUrl}/reset-password`);
      expect(req.request.body).toEqual({ token: 'tok-1', newPassword: 'nueva123' });
      req.flush(null);
    });
  });
});
