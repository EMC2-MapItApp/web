/**
 * @file share.service.ts
 * @description Servicio singleton para compartir contenido de MapIt por canales externos.
 * Consumido por el submenú "Compartir" del menú del layout (`HomeShellComponent`), que ofrece
 * dos formas de compartir/enviar: WhatsApp y copiar enlace. El servicio solo conoce CÓMO
 * ejecutar cada canal; QUÉ se comparte (texto/URL) es responsabilidad del llamador o de
 * {@link DEFAULT_SHARE_CONTENT} (responsabilidad única: este servicio no decide contenido,
 * solo lo despacha). El feedback visual (p. ej. snackbar de "Enlace copiado") vive en el
 * componente que lo invoca, no aquí — este servicio no tiene dependencias de UI.
 *
 * Detección táctil vs escritorio: se apoya en {@link ResponsiveService} (`pointerCoarse`,
 * fuente única de verdad responsive de la app) en vez de duplicar detección de userAgent
 * o de capacidades táctiles ad-hoc en cada consumidor.
 *
 * Extensibilidad (abierto/cerrado): un canal nuevo (Telegram, email...) se añade como método
 * `shareViaXxx()` nuevo en este servicio (o un servicio hermano que reutilice
 * {@link ShareContent}) sin tocar los métodos existentes ni sus consumidores.
 */
import { Injectable, inject } from '@angular/core';
import { ResponsiveService } from '@core/responsive/responsive.service';
import { ShareContent } from '@core/models/share.model';
import { DEFAULT_SHARE_CONTENT } from '@core/constants/share.constants';

@Injectable({ providedIn: 'root' })
export class ShareService {
  private readonly responsiveService = inject(ResponsiveService);

  /**
   * Comparte contenido por WhatsApp, adaptando el destino según el dispositivo:
   * - **Táctil** (`pointerCoarse`, p. ej. móvil/tablet): enlace `whatsapp://` que abre la
   *   app nativa instalada directamente en su propio selector de contacto/grupo.
   * - **Escritorio**: WhatsApp Web (`web.whatsapp.com`) en una pestaña nueva, con el mismo
   *   selector de contacto pero en el navegador — no sustituye la pestaña actual de MapIt.
   *
   * @param content - Texto/enlace a compartir; por defecto la invitación genérica a MapIt.
   */
  shareViaWhatsApp(content: ShareContent = DEFAULT_SHARE_CONTENT): void {
    const encodedMessage = this.buildEncodedMessage(content);
    const isTouchDevice = this.responsiveService.state().pointerCoarse;

    if (isTouchDevice) {
      // Deep link nativo: el propio SO resuelve la app instalada, sin pestaña intermedia.
      window.location.href = `whatsapp://send?text=${encodedMessage}`;
    } else {
      // Escritorio: pestaña nueva para no perder el estado de la app en la actual.
      window.open(`https://web.whatsapp.com/send?text=${encodedMessage}`, '_blank', 'noopener');
    }
  }

  /**
   * Copia el enlace al portapapeles (Clipboard API). Copia solo la URL si hay una definida
   * (es lo que el usuario espera de "Copiar enlace"); si el contenido no trae URL, copia el
   * texto como último recurso.
   *
   * @param content - Contenido cuyo enlace se copia; por defecto la invitación genérica.
   * @returns `true` si la copia tuvo éxito, `false` si el navegador la bloqueó o falló
   *          (p. ej. permisos de portapapeles denegados, o contexto no seguro) — el llamador
   *          decide cómo mostrarlo (snackbar de éxito/error).
   */
  async copyLink(content: ShareContent = DEFAULT_SHARE_CONTENT): Promise<boolean> {
    try {
      await navigator.clipboard.writeText(content.url ?? content.text);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Comprueba si el navegador soporta la Web Share API nativa (`navigator.share`). Detección por
   * feature-detection pura — nunca por viewport/`pointerCoarse`/user-agent: un navegador de
   * escritorio que la implemente se trata igual que uno móvil.
   */
  isNativeShareSupported(): boolean {
    return typeof navigator !== 'undefined' && 'share' in navigator;
  }

  /**
   * Despliega el selector nativo de canales del sistema operativo (`navigator.share()`), sin
   * ningún picker propio de MapIt. Solo debe invocarse tras comprobar
   * {@link isNativeShareSupported}; aun así se protege con try/catch por si el navegador
   * fallara igualmente (p. ej. contexto no seguro).
   *
   * @param content - Contenido a compartir; por defecto la invitación genérica a MapIt.
   * @returns `true` salvo error real — cancelar el share sheet (`AbortError`) no cuenta como
   *          fallo, es una acción válida del usuario. El share sheet del sistema ya da su propia
   *          confirmación visual, por lo que el llamador no necesita mostrar feedback adicional.
   */
  async shareNative(content: ShareContent = DEFAULT_SHARE_CONTENT): Promise<boolean> {
    try {
      await navigator.share({ text: content.text, url: content.url });
      return true;
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return true;
      return false;
    }
  }

  /** Compone texto + enlace en un único mensaje y lo codifica para ir en la query string. */
  private buildEncodedMessage(content: ShareContent): string {
    const fullMessage = content.url ? `${content.text}\n\n${content.url}` : content.text;
    return encodeURIComponent(fullMessage);
  }
}
