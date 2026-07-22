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

/** Grupo de usuarios. */
export interface Group {
  id: string;
  name: string;
  description: string;
  categoryId: string;
  members: GroupMember[];
  /** Invitaciones pendientes — solo visibles para el organizador. */
  pendingInvitees: { userId: string; name: string; nick: string }[];
  createdAt: string;
  updatedAt?: string;
}

/**
 * Invitación pendiente (o resuelta) a un grupo.
 * Desnormaliza nombre/categoría del grupo y del emisor para no depender de otra
 * carga adicional al pintar la lista de invitaciones recibidas.
 */
export interface GroupInvitation {
  id: string;
  groupId: string;
  groupName: string;
  groupDescription: string;
  groupCategoryId: string;
  groupMemberCount: number;
  invitedUserId: string;
  invitedUserName: string;
  invitedUserNick: string;
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
}

/** Campos editables de un grupo existente. Todos opcionales (PATCH). */
export interface UpdateGroupRequest {
  name?: string;
  description?: string;
  categoryId?: string;
}
