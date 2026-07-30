/**
 * @file notification.model.ts
 * @description Modelo del centro de notificaciones in-app (ver docs/back/IDEAS.md → sección
 * Notificaciones). Los eventos de origen son, de momento, solo del dominio Grupos — el mismo
 * conjunto que ya disparaba email antes de este módulo (ver `emc.mapIt.notifications.NotificationType`
 * en el backend).
 *
 * @remarks
 * A diferencia de `group.model.ts`, aquí no hace falta un mapeo Api→frontend: la forma que
 * devuelve `GET /api/v1/notifications` coincide 1:1 con este modelo (mismo `type` en mayúscula
 * que el backend, sin transformación de casing).
 */

/** Evento de negocio que originó la notificación. */
export type NotificationType = 'GROUP_INVITATION' | 'GROUP_ORGANIZER_NOTICE' | 'GROUP_BROADCAST';

/** Notificación in-app persistida (centro de notificaciones / campana). */
export interface AppNotification {
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  /** Ruta relativa del frontend a abrir al pulsar la notificación (p. ej. '/groups'). */
  link: string | null;
  read: boolean;
  /** Fecha ISO 8601 de creación. */
  createdAt: string;
}

/**
 * Preferencia de email de un {@link NotificationType} para el usuario autenticado — forma
 * devuelta por `GET /api/v1/notifications/preferences`. Solo el canal email es configurable por
 * tipo: el centro in-app (campana) se recibe siempre, y el push nativo se activa/desactiva de
 * forma global (no por tipo, ver `NoopPushProvider`), así que ninguno de los dos aparece aquí.
 */
export interface NotificationPreference {
  type: NotificationType;
  emailEnabled: boolean;
}

/**
 * Metadata de presentación de cada {@link NotificationType}, para renderizar la lista de toggles
 * en Ajustes → Notificaciones. Único punto a extender cuando se añada un tipo nuevo — mantener en
 * espejo con el enum `emc.mapIt.notifications.NotificationType` del backend.
 */
export const NOTIFICATION_TYPE_META: Record<NotificationType, { label: string; description: string; icon: string }> = {
  GROUP_INVITATION: {
    label: 'Invitaciones a grupos',
    icon: 'group_add',
    description: 'Cuando alguien te invita a unirte a un grupo.',
  },
  GROUP_ORGANIZER_NOTICE: {
    label: 'Avisos al organizador',
    icon: 'campaign',
    description: 'Cuando un miembro te escribe como organizador de un grupo.',
  },
  GROUP_BROADCAST: {
    label: 'Difusiones de grupo',
    icon: 'forum',
    description: 'Cuando el organizador de un grupo envía un mensaje a los miembros.',
  },
};
