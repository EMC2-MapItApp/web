/**
 * @file group.service.ts
 * @description Operaciones sobre el dominio "Grupos" (ver docs/back/IDEAS.md → sección Grupos)
 * contra la API real (`GET/POST/PATCH/DELETE /api/v1/groups/...`, `GET /api/v1/users/search`).
 *
 * @remarks
 * El backend serializa roles y estados en mayúscula (enums Java: `ORGANIZER`/`MEMBER`,
 * `PENDING`/`ACCEPTED`/`DECLINED`); este servicio los traduce a las convenciones en minúscula del
 * modelo de frontend (ver `group.model.ts`) — mismo patrón que `CategoryService.mapTree` aplica
 * al árbol de categorías. Los componentes consumidores no conocen esta diferencia.
 */
import { Injectable, effect, inject, signal } from '@angular/core';
import { HttpClient, HttpContext } from '@angular/common/http';
import { Observable, catchError, map, of, tap, throwError } from 'rxjs';
import { environment } from '@env/environment';
import { CurrentUserService } from './current-user.service';
import {
  CreateGroupRequest,
  Group,
  GroupInvitation,
  GroupInvitationStatus,
  GroupMember,
  GroupRole,
  GroupSearchUser,
  UpdateGroupRequest,
} from '../models/group.model';

// ─────────────────────────────────────────────────────────────────────────────
// Formas de la API (backend) — ver GroupResponse/GroupMemberResponse/
// GroupInvitationResponse/UserSearchResultResponse en emc.mapIt.groups / emc.mapIt.dto
// ─────────────────────────────────────────────────────────────────────────────

interface ApiGroupMember {
  userId: string;
  name: string;
  nick: string;
  avatarUrl: string | null;
  role: 'ORGANIZER' | 'MEMBER';
  joinedAt: string;
}

interface ApiPendingInvitee {
  userId: string | null;
  name: string | null;
  nick: string | null;
  email: string | null;
}

interface ApiGroup {
  id: string;
  name: string;
  description: string;
  categoryId: string;
  organizerId: string;
  members: ApiGroupMember[];
  pendingInvitees: ApiPendingInvitee[];
  createdAt: string;
  updatedAt: string | null;
}

interface ApiGroupInvitation {
  id: string;
  groupId: string;
  groupName: string;
  groupDescription: string;
  groupCategoryId: string;
  groupMemberCount: number;
  groupMembers: ApiGroupMember[];
  invitedUserId: string | null;
  invitedUserName: string | null;
  invitedUserNick: string | null;
  invitedEmail: string | null;
  invitedByUserId: string;
  invitedByName: string;
  status: 'PENDING' | 'ACCEPTED' | 'DECLINED';
  createdAt: string;
}

interface ApiUserSearchResult {
  id: string;
  name: string;
  nick: string;
  email: string;
  avatarUrl: string | null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Servicio
// ─────────────────────────────────────────────────────────────────────────────

@Injectable({ providedIn: 'root' })
export class GroupService {
  private readonly http = inject(HttpClient);
  private readonly cu = inject(CurrentUserService);
  private readonly baseUrl = environment.apiGroupsUrl;
  private readonly usersBaseUrl = environment.apiUsersUrl;

  /** Invitaciones pendientes del usuario actual, para el badge del menú lateral. */
  private readonly _pendingInvitationsCount = signal(0);
  readonly pendingInvitationsCount = this._pendingInvitationsCount.asReadonly();

  constructor() {
    // Recalcula el badge al iniciar/cerrar sesión. No hay push en tiempo real (sin
    // notificaciones in-app todavía, ver docs/back/IDEAS.md → sección Notificaciones): una
    // invitación nueva creada mientras la sesión está abierta no actualiza el badge hasta la
    // próxima recarga o hasta que se resuelva otra invitación (ver acceptInvitation/declineInvitation).
    effect(() => {
      // this.cu.userId(), no this.cu.user(): un patch() de perfil crea un MapItUser nuevo
      // por referencia sin cambiar la sesión, y no debe recargar el badge de invitaciones.
      if (this.cu.userId()) {
        this.refreshPendingInvitationsCount();
      } else {
        this._pendingInvitationsCount.set(0);
      }
    });
  }

  // ── Lecturas ──────────────────────────────────────────────────────────────

  /** Grupos donde el usuario actual es organizador o miembro. */
  getMyGroups(): Observable<Group[]> {
    return this.http
      .get<ApiGroup[]>(`${this.baseUrl}/mine`)
      .pipe(map((groups) => groups.map((g) => this.mapGroup(g))));
  }

  /**
   * Recupera un grupo por id. `undefined` si no existe o si el usuario actual no tiene acceso
   * (no es miembro) — el backend distingue 404/403, pero de cara a la UI ambos casos se tratan
   * igual que "grupo no disponible".
   */
  getGroupById(id: string): Observable<Group | undefined> {
    return this.http.get<ApiGroup>(`${this.baseUrl}/${id}`).pipe(
      map((g) => this.mapGroup(g)),
      catchError(() => of(undefined)),
    );
  }

  /** Invitaciones pendientes recibidas por el usuario actual. */
  getPendingInvitations(): Observable<GroupInvitation[]> {
    return this.http
      .get<ApiGroupInvitation[]>(`${this.baseUrl}/invitations/pending`)
      .pipe(map((invitations) => invitations.map((i) => this.mapInvitation(i))));
  }

  /**
   * Resuelve una invitación por id (pantalla del enlace de correo). `undefined` solo si no existe
   * (404 del backend). 401 y 403 se relanzan tal cual: un 401 significa que quien abre el enlace
   * no tiene sesión iniciada en este navegador; un 403 significa que sí hay sesión, pero de un
   * usuario distinto al invitado (p. ej. otra cuenta ya logada en ese navegador). El componente
   * distingue ambos casos de "invitación no disponible" para no confundir "no tienes sesión" con
   * "la sesión activa no es la correcta".
   */
  getInvitationById(
    id: string,
    options?: { context?: HttpContext },
  ): Observable<GroupInvitation | undefined> {
    return this.http.get<ApiGroupInvitation>(`${this.baseUrl}/invitations/${id}`, options).pipe(
      map((i) => this.mapInvitation(i)),
      catchError((err) =>
        err.status === 401 || err.status === 403 ? throwError(() => err) : of(undefined),
      ),
    );
  }

  /** Rol del usuario actual en un grupo, o null si no pertenece a él. */
  getMyRole(group: Group): GroupRole | null {
    const userId = this.cu.user()?.id;
    if (!userId) return null;
    return group.members.find((m) => m.userId === userId)?.role ?? null;
  }

  // ── Búsqueda de usuarios a invitar ──────────────────────────────────────────

  /** Busca por nick o email, excluyendo al propio usuario. Vacío si la query es < 2 caracteres. */
  searchUsers(query: string): Observable<GroupSearchUser[]> {
    const q = query.trim();
    if (q.length < 2) return of([]);

    return this.http
      .get<ApiUserSearchResult[]>(`${this.usersBaseUrl}/search`, {
        params: { q },
      })
      .pipe(map((results) => results.map((r) => this.mapSearchUser(r))));
  }

  // ── Escrituras ────────────────────────────────────────────────────────────

  /** Crea un grupo nuevo (organizador = usuario actual) e invita a los usuarios indicados. */
  createGroup(payload: CreateGroupRequest): Observable<Group> {
    return this.http.post<ApiGroup>(this.baseUrl, payload).pipe(map((g) => this.mapGroup(g)));
  }

  updateGroup(id: string, payload: UpdateGroupRequest): Observable<Group> {
    return this.http
      .patch<ApiGroup>(`${this.baseUrl}/${id}`, payload)
      .pipe(map((g) => this.mapGroup(g)));
  }

  /** Invita a un usuario ya existente a un grupo ya creado (desde la página de detalle/edición). */
  inviteUser(group: Group, user: GroupSearchUser): Observable<GroupInvitation> {
    return this.http
      .post<ApiGroupInvitation>(`${this.baseUrl}/${group.id}/invitations`, {
        userId: user.id,
      })
      .pipe(map((i) => this.mapInvitation(i)));
  }

  /**
   * Invita por email a alguien que puede no estar registrado todavía, a un grupo ya creado. Si
   * el email ya pertenece a un usuario, el backend la resuelve como una invitación normal.
   */
  inviteUserByEmail(group: Group, email: string): Observable<GroupInvitation> {
    return this.http
      .post<ApiGroupInvitation>(`${this.baseUrl}/${group.id}/invitations/by-email`, {
        email,
      })
      .pipe(map((i) => this.mapInvitation(i)));
  }

  /**
   * Traduce el código de error de {@link inviteUser}/{@link inviteUserByEmail} a un mensaje
   * concreto. El buscador de usuarios de la tarjeta no siempre sabe que alguien ya fue invitado
   * (solo recuerda lo enviado en la sesión de edición actual, no invitaciones pendientes de
   * sesiones previas), así que es el backend quien detecta el duplicado y hay que traducir su
   * código a texto.
   */
  inviteErrorMessage(err: { error?: { error?: { code?: string } } }): string {
    switch (err.error?.error?.code) {
      case 'ALREADY_MEMBER':
        return 'Este usuario ya pertenece a este grupo.';
      case 'ALREADY_INVITED':
        return 'Ya se ha invitado a este usuario o email.';
      default:
        return 'No se pudo enviar la invitación. Inténtalo de nuevo.';
    }
  }

  /** Acepta una invitación: pasa a miembro del grupo. */
  acceptInvitation(invitationId: string, options?: { context?: HttpContext }): Observable<Group> {
    return this.http
      .post<ApiGroup>(`${this.baseUrl}/invitations/${invitationId}/accept`, {}, options)
      .pipe(
        map((g) => this.mapGroup(g)),
        tap(() => this.refreshPendingInvitationsCount()),
      );
  }

  /** Rechaza una invitación (no se añade al grupo). */
  declineInvitation(invitationId: string, options?: { context?: HttpContext }): Observable<void> {
    return this.http
      .post<void>(`${this.baseUrl}/invitations/${invitationId}/decline`, {}, options)
      .pipe(tap(() => this.refreshPendingInvitationsCount()));
  }

  /** Abandona un grupo del que se es miembro (no válido para el organizador). */
  leaveGroup(groupId: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${groupId}/members/me`);
  }

  /** Elimina un grupo permanentemente. Solo puede hacerlo el organizador. */
  deleteGroup(groupId: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${groupId}`);
  }

  /** Devuelve las invitaciones pendientes de un grupo. Solo el organizador puede consultarlas. */
  getGroupPendingInvitations(groupId: string): Observable<GroupInvitation[]> {
    return this.http
      .get<ApiGroupInvitation[]>(`${this.baseUrl}/${groupId}/invitations`)
      .pipe(map((list) => list.map((i) => this.mapInvitation(i))));
  }

  /** Cancela una invitación pendiente (la elimina). Puede hacerlo el organizador o el invitado. */
  cancelGroupInvitation(invitationId: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/invitations/${invitationId}/cancel`);
  }

  /** Expulsa a un miembro del grupo. Solo el organizador puede hacerlo. */
  removeMember(groupId: string, userId: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${groupId}/members/${userId}`);
  }

  /**
   * Envía un aviso al organizador de un grupo. `subject` se muestra en el cuerpo del correo, no
   * sustituye el asunto real del email (fijo, ver `EmailNotificationSender` en el backend).
   */
  notifyOrganizer(group: Group, subject: string, message: string): Observable<void> {
    return this.http.post<void>(`${this.baseUrl}/${group.id}/notify-organizer`, {
      subject,
      message,
    });
  }

  /**
   * Envía un mensaje del organizador a los miembros del grupo. Solo puede invocarlo el
   * organizador; `recipientUserIds` vacío significa "todos los miembros". `subject` se muestra
   * en el cuerpo del correo, no sustituye el asunto real del email (fijo, ver backend).
   */
  contactMembers(
    group: Group,
    subject: string,
    message: string,
    recipientUserIds: string[],
  ): Observable<void> {
    return this.http.post<void>(`${this.baseUrl}/${group.id}/contact-members`, {
      subject,
      message,
      recipientUserIds,
    });
  }

  // ── Helpers privados ─────────────────────────────────────────────────────

  private refreshPendingInvitationsCount(): void {
    this.getPendingInvitations().subscribe({
      next: (list) => this._pendingInvitationsCount.set(list.length),
      // Fallo silencioso: el badge es una mejora de UX, no debe romper la navegación.
      error: () => this._pendingInvitationsCount.set(0),
    });
  }

  private mapMember(api: ApiGroupMember): GroupMember {
    return {
      userId: api.userId,
      name: api.name,
      nick: api.nick,
      avatarUrl: api.avatarUrl ?? undefined,
      role: api.role === 'ORGANIZER' ? 'organizer' : 'member',
      joinedAt: api.joinedAt,
    };
  }

  private mapGroup(api: ApiGroup): Group {
    return {
      id: api.id,
      name: api.name,
      description: api.description,
      categoryId: api.categoryId,
      members: api.members.map((m) => this.mapMember(m)),
      pendingInvitees: (api.pendingInvitees ?? []).map((p) => ({
        userId: p.userId,
        name: p.name,
        nick: p.nick,
        email: p.email,
      })),
      createdAt: api.createdAt,
      updatedAt: api.updatedAt ?? undefined,
    };
  }

  private mapInvitation(api: ApiGroupInvitation): GroupInvitation {
    return {
      id: api.id,
      groupId: api.groupId,
      groupName: api.groupName,
      groupDescription: api.groupDescription,
      groupCategoryId: api.groupCategoryId,
      groupMemberCount: api.groupMemberCount,
      groupMembers: (api.groupMembers ?? []).map((m) => this.mapMember(m)),
      invitedUserId: api.invitedUserId,
      invitedUserName: api.invitedUserName,
      invitedUserNick: api.invitedUserNick,
      invitedEmail: api.invitedEmail,
      invitedByUserId: api.invitedByUserId,
      invitedByName: api.invitedByName,
      status: api.status.toLowerCase() as GroupInvitationStatus,
      createdAt: api.createdAt,
    };
  }

  private mapSearchUser(api: ApiUserSearchResult): GroupSearchUser {
    return {
      id: api.id,
      name: api.name,
      nick: api.nick,
      email: api.email,
      avatarUrl: api.avatarUrl ?? undefined,
    };
  }
}
