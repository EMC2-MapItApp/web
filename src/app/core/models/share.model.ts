/**
 * @file share.model.ts
 * @description Contrato de contenido compartible, independiente del canal de envío.
 * WhatsApp es el primer consumidor ({@link ShareService}); un canal futuro (Telegram,
 * email...) reutiliza el mismo contrato en vez de definir el suyo propio.
 */

/** Contenido a compartir: texto descriptivo + enlace opcional que se añade al mensaje. */
export interface ShareContent {
  /** Texto principal del mensaje compartido. */
  text: string;
  /** Enlace opcional añadido al final del mensaje (p. ej. la URL pública de MapIt). */
  url?: string;
}
