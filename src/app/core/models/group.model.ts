/**
 * @file group.model.ts
 * @description Modelos del dominio "Grupos" (ver docs/back/IDEAS.md → sección Grupos).
 *
 * Un grupo agrupa usuarios en torno a un tema (una {@link MainCategory} del árbol de
 * categorías del mapa, reutilizada aquí para no duplicar vocabulario). Cada miembro tiene
 * un rol: quien crea el grupo es `organizer`, el resto entra como `member` tras aceptar
 * una invitación.
 *
 * @remarks
 * {@link GroupService} consume la API real (`BACK/src/main/java/emc/mapIt/groups`). Los roles y
 * estados de aquí están en minúscula por convención del frontend; el backend los serializa en
 * mayúscula (`ORGANIZER`/`MEMBER`, `PENDING`/`ACCEPTED`/`DECLINED`) — el mapeo vive dentro del
 * propio servicio, igual que `CategoryService.mapTree` hace con el árbol de categorías.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Enums / union types
// ─────────────────────────────────────────────────────────────────────────────

/** Rol de un usuario dentro de un grupo. */
export type GroupRole = 'organizer' | 'member';

/** Estado de una invitación a un grupo. */
export type GroupInvitationStatus = 'pending' | 'accepted' | 'declined';

// ─────────────────────────────────────────────────────────────────────────────
// Interfaces principales
// ─────────────────────────────────────────────────────────────────────────────

/** Miembro de un grupo (incluye al organizador, con role: 'organizer'). */
export interface GroupMember {
  userId: string;
  name: string;
  nick: string;
  avatarUrl?: string;
  role: GroupRole;
  /** Fecha ISO 8601 en la que se unió (o creó el grupo, para el organizador). */
  joinedAt: string;
}

/**
 * Destinatario de una invitación pendiente a un grupo. Si todavía no está registrado (invitado
 * por email, ver {@link GroupInvitation}), `userId`/`name`/`nick` son `null` y `email` lleva la
 * dirección invitada.
 */
export interface PendingInvitee {
  userId: string | null;
  name: string | null;
  nick: string | null;
  email?: string | null;
}

/** Grupo de usuarios. */
export interface Group {
  id: string;
  name: string;
  description: string;
  categoryId: string;
  members: GroupMember[];
  /** Invitaciones pendientes — solo visibles para el organizador. */
  pendingInvitees: PendingInvitee[];
  createdAt: string;
  updatedAt?: string;
}

/**
 * Invitación pendiente (o resuelta) a un grupo.
 * Desnormaliza nombre/categoría del grupo y del emisor para no depender de otra
 * carga adicional al pintar la lista de invitaciones recibidas.
 *
 * Si la invitación fue creada por email y todavía no ha sido reclamada por un usuario
 * registrado, `invitedUserId`/`invitedUserName`/`invitedUserNick` son `null` y `invitedEmail`
 * lleva la dirección invitada.
 */
export interface GroupInvitation {
  id: string;
  groupId: string;
  groupName: string;
  groupDescription: string;
  groupCategoryId: string;
  groupMemberCount: number;
  /** Miembros actuales del grupo, para mostrarlos en la pantalla de invitación. */
  groupMembers: GroupMember[];
  invitedUserId: string | null;
  invitedUserName: string | null;
  invitedUserNick: string | null;
  invitedEmail?: string | null;
  invitedByUserId: string;
  invitedByName: string;
  status: GroupInvitationStatus;
  createdAt: string;
}

/** Resultado del buscador de usuarios a invitar. */
export interface GroupSearchUser {
  id: string;
  name: string;
  nick: string;
  email: string;
  avatarUrl?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// DTOs de creación / edición
// ─────────────────────────────────────────────────────────────────────────────

/** Payload para crear un grupo, con invitaciones iniciales opcionales. */
export interface CreateGroupRequest {
  name: string;
  description: string;
  categoryId: string;
  inviteUserIds: string[];
  /** Emails a invitar de inmediato — para quien no tenga cuenta todavía (ver `PendingInvitee`). */
  inviteEmails: string[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Cola de invitaciones en el formulario de creación de grupo
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Invitación en cola antes de crear el grupo: un usuario ya encontrado por búsqueda, o un email
 * suelto (persona sin cuenta todavía). Se envían juntas al crear el grupo
 * ({@link CreateGroupRequest.inviteUserIds}/`inviteEmails`).
 */
export type QueuedInvite =
  { kind: 'user'; user: GroupSearchUser } | { kind: 'email'; email: string };

/** Campos editables de un grupo existente. Todos opcionales (PATCH). */
export interface UpdateGroupRequest {
  name?: string;
  description?: string;
  categoryId?: string;
}
