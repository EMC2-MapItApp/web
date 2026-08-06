/**
 * @file share.constants.ts
 * @description Contenido por defecto de la funcionalidad "Compartir": invitación genérica a
 * MapIt, usada por el botón del menú del layout (que no tiene contexto de una publicación o
 * grupo concreto). Centralizado aquí para que pantallas futuras (compartir una publicación,
 * un grupo...) puedan construir su propio {@link ShareContent} sin duplicar copy.
 */
import { ShareContent } from '@core/models/share.model';

/** Invitación genérica a MapIt con enlace a la home pública (ver `og:url` en `index.html`). */
export const DEFAULT_SHARE_CONTENT: ShareContent = {
  text: 'Descubre MapIt: encuentra y comparte eventos y lugares cerca de ti.',
  url: 'https://mapit-web.com/',
};
