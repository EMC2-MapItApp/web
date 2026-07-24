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
