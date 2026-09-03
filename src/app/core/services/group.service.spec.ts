import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { GroupService } from './group.service';
import { CurrentUserService } from './current-user.service';
import { Group } from '../models/group.model';
import { MapItUser } from '../models/user.model';
import { environment } from '@env/environment';

describe('GroupService', () => {
  let service: GroupService;
  let cu: CurrentUserService;
  let httpMock: HttpTestingController;

  const apiUser = {
    id: 'u1',
    name: 'Ana',
    nick: 'ana',
    email: 'ana@test.com',
    userType: 'individual',
    level: 0,
    xp: 0,
    unlockedCapabilities: [],
  } as MapItUser;

  const apiMember = (over: object = {}) => ({
    userId: 'u1',
    name: 'Ana',
    nick: 'ana',
    avatarUrl: null,
    role: 'ORGANIZER',
    joinedAt: '2026-08-01T00:00:00Z',
    ...over,
  });
  const apiGroup = (over: object = {}) => ({
    id: 'g1',
    name: 'Ciclistas',
    description: 'Grupo de ciclismo',
    categoryId: 'cat-1',
    organizerId: 'u1',
    members: [apiMember()],
    pendingInvitees: [],
    createdAt: '2026-08-01T00:00:00Z',
    updatedAt: null,
    ...over,
  });
  const apiInvitation = (over: object = {}) => ({
    id: 'i1',
    groupId: 'g1',
    groupName: 'Ciclistas',
    groupDescription: 'x',
    groupCategoryId: 'cat-1',
    groupMemberCount: 1,
    groupMembers: [apiMember()],
    invitedUserId: 'u2',
    invitedUserName: 'Bea',
    invitedUserNick: 'bea',
    invitedEmail: null,
    invitedByUserId: 'u1',
    invitedByName: 'Ana',
    status: 'PENDING',
    createdAt: '2026-08-02T00:00:00Z',
    ...over,
  });

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(GroupService);
    cu = TestBed.inject(CurrentUserService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  describe('badge de invitaciones pendientes (effect ligado a sesión)', () => {
    it('sin sesión, no carga el contador', () => {
      TestBed.tick();
      expect(service.pendingInvitationsCount()).toBe(0);
      httpMock.expectNone(`${environment.apiGroupsUrl}/invitations/pending`);
    });

    it('al iniciar sesión, carga el contador de invitaciones pendientes', () => {
      cu.setUser(apiUser);
      TestBed.tick();

      httpMock
        .expectOne(`${environment.apiGroupsUrl}/invitations/pending`)
        .flush([apiInvitation(), apiInvitation({ id: 'i2' })]);

      expect(service.pendingInvitationsCount()).toBe(2);
    });
  });

  describe('mapeo de forma API → modelo frontend', () => {
    it('mapGroup traduce roles a minúscula y normaliza pendingInvitees/updatedAt ausentes', () => {
      let result: Group | undefined;
      service.getMyGroups().subscribe((r) => (result = r[0]));

      httpMock.expectOne(`${environment.apiGroupsUrl}/mine`).flush([apiGroup()]);

      expect(result?.members[0].role).toBe('organizer');
      expect(result?.pendingInvitees).toEqual([]);
      expect(result?.updatedAt).toBeUndefined();
    });

    it('mapInvitation traduce el status a minúscula', () => {
      let result: string | undefined;
      service.getPendingInvitations().subscribe((r) => (result = r[0]?.status));

      httpMock
        .expectOne(`${environment.apiGroupsUrl}/invitations/pending`)
        .flush([apiInvitation({ status: 'ACCEPTED' })]);

      expect(result).toBe('accepted');
    });
  });

  describe('getGroupById', () => {
    it('devuelve undefined si el backend responde error (404/403 tratados igual)', () => {
      let result: Group | undefined | 'not-called' = 'not-called';
      service.getGroupById('g1').subscribe((r) => (result = r));

      httpMock
        .expectOne(`${environment.apiGroupsUrl}/g1`)
        .flush(null, { status: 404, statusText: 'Not Found' });

      expect(result).toBeUndefined();
    });
  });

  describe('getInvitationById', () => {
    it('devuelve undefined en un 404', () => {
      let result: unknown = 'not-called';
      service.getInvitationById('i1').subscribe((r) => (result = r));

      httpMock
        .expectOne(`${environment.apiGroupsUrl}/invitations/i1`)
        .flush(null, { status: 404, statusText: 'Not Found' });

      expect(result).toBeUndefined();
    });

    it('relanza un 401 en vez de devolver undefined (sin sesión ≠ invitación inexistente)', () => {
      let errored = false;
      service.getInvitationById('i1').subscribe({ error: () => (errored = true) });

      httpMock
        .expectOne(`${environment.apiGroupsUrl}/invitations/i1`)
        .flush(null, { status: 401, statusText: 'Unauthorized' });

      expect(errored).toBe(true);
    });

    it('relanza un 403 en vez de devolver undefined (sesión de otro usuario)', () => {
      let errored = false;
      service.getInvitationById('i1').subscribe({ error: () => (errored = true) });

      httpMock
        .expectOne(`${environment.apiGroupsUrl}/invitations/i1`)
        .flush(null, { status: 403, statusText: 'Forbidden' });

      expect(errored).toBe(true);
    });
  });

  describe('searchUsers', () => {
    it('con menos de 2 caracteres, no llama al backend y emite vacío', () => {
      let result: unknown[] | undefined;
      service.searchUsers('a').subscribe((r) => (result = r));

      expect(result).toEqual([]);
      httpMock.expectNone((r) => r.url === `${environment.apiUsersUrl}/search`);
    });

    it('con 2+ caracteres, pide al backend con el query recortado', () => {
      service.searchUsers('  an  ').subscribe();

      const req = httpMock.expectOne((r) => r.url === `${environment.apiUsersUrl}/search`);
      expect(req.request.params.get('q')).toBe('an');
      req.flush([]);
    });
  });

  describe('acceptInvitation / declineInvitation refrescan el badge', () => {
    it('acceptInvitation dispara un refresh del contador tras aceptar', () => {
      cu.setUser(apiUser);
      TestBed.tick();
      httpMock
        .expectOne(`${environment.apiGroupsUrl}/invitations/pending`)
        .flush([apiInvitation()]);

      service.acceptInvitation('i1').subscribe();
      httpMock.expectOne(`${environment.apiGroupsUrl}/invitations/i1/accept`).flush(apiGroup());

      httpMock.expectOne(`${environment.apiGroupsUrl}/invitations/pending`).flush([]);
      expect(service.pendingInvitationsCount()).toBe(0);
    });

    it('declineInvitation dispara un refresh del contador tras rechazar', () => {
      cu.setUser(apiUser);
      TestBed.tick();
      httpMock
        .expectOne(`${environment.apiGroupsUrl}/invitations/pending`)
        .flush([apiInvitation()]);

      service.declineInvitation('i1').subscribe();
      httpMock.expectOne(`${environment.apiGroupsUrl}/invitations/i1/decline`).flush(null);

      httpMock.expectOne(`${environment.apiGroupsUrl}/invitations/pending`).flush([]);
      expect(service.pendingInvitationsCount()).toBe(0);
    });
  });

  describe('getMyRole', () => {
    it('devuelve el rol del usuario actual dentro del grupo', () => {
      cu.setUser(apiUser);
      TestBed.tick();
      // setUser dispara el effect del badge (refreshPendingInvitationsCount) — hay que
      // consumir esa petición o httpMock.verify() falla en el afterEach.
      httpMock.expectOne(`${environment.apiGroupsUrl}/invitations/pending`).flush([]);

      const group: Group = {
        id: 'g1',
        name: 'x',
        description: 'x',
        categoryId: 'c1',
        createdAt: 'x',
        pendingInvitees: [],
        members: [{ userId: 'u1', name: 'Ana', nick: 'ana', role: 'organizer', joinedAt: 'x' }],
      };

      expect(service.getMyRole(group)).toBe('organizer');
    });

    it('sin sesión, devuelve null', () => {
      const group: Group = {
        id: 'g1',
        name: 'x',
        description: 'x',
        categoryId: 'c1',
        createdAt: 'x',
        pendingInvitees: [],
        members: [{ userId: 'u1', name: 'Ana', nick: 'ana', role: 'organizer', joinedAt: 'x' }],
      };

      expect(service.getMyRole(group)).toBeNull();
    });

    it('con sesión pero sin ser miembro, devuelve null', () => {
      cu.setUser({ ...apiUser, id: 'otro' });
      const group: Group = {
        id: 'g1',
        name: 'x',
        description: 'x',
        categoryId: 'c1',
        createdAt: 'x',
        pendingInvitees: [],
        members: [{ userId: 'u1', name: 'Ana', nick: 'ana', role: 'organizer', joinedAt: 'x' }],
      };

      expect(service.getMyRole(group)).toBeNull();
    });
  });

  describe('inviteErrorMessage', () => {
    it('traduce ALREADY_MEMBER y ALREADY_INVITED a mensajes concretos, y el resto a uno genérico', () => {
      expect(service.inviteErrorMessage({ error: { error: { code: 'ALREADY_MEMBER' } } })).toBe(
        'Este usuario ya pertenece a este grupo.',
      );
      expect(service.inviteErrorMessage({ error: { error: { code: 'ALREADY_INVITED' } } })).toBe(
        'Ya se ha invitado a este usuario o email.',
      );
      expect(service.inviteErrorMessage({ error: { error: { code: 'OTRO' } } })).toBe(
        'No se pudo enviar la invitación. Inténtalo de nuevo.',
      );
      expect(service.inviteErrorMessage({})).toBe(
        'No se pudo enviar la invitación. Inténtalo de nuevo.',
      );
    });
  });

  describe('operaciones de escritura, forma de la petición', () => {
    it('leaveGroup hace DELETE a /groups/{id}/members/me', () => {
      service.leaveGroup('g1').subscribe();
      const req = httpMock.expectOne(`${environment.apiGroupsUrl}/g1/members/me`);
      expect(req.request.method).toBe('DELETE');
      req.flush(null);
    });

    it('removeMember hace DELETE a /groups/{id}/members/{userId}', () => {
      service.removeMember('g1', 'u2').subscribe();
      const req = httpMock.expectOne(`${environment.apiGroupsUrl}/g1/members/u2`);
      expect(req.request.method).toBe('DELETE');
      req.flush(null);
    });

    it('createGroup hace POST con el payload tal cual y mapea la respuesta', () => {
      const payload = {
        name: 'x',
        description: 'y',
        categoryId: 'c1',
        inviteUserIds: ['u2'],
        inviteEmails: [],
      };
      let result: Group | undefined;
      service.createGroup(payload).subscribe((r) => (result = r));

      const req = httpMock.expectOne(environment.apiGroupsUrl);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual(payload);
      req.flush(apiGroup());

      expect(result?.id).toBe('g1');
    });
  });
});
