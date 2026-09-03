/**
 * @file share-menu.ts
 * @description Botón de "Compartir" reutilizable: despacha un {@link ShareContent} dado por
 * quien lo usa (invitación genérica a MapIt, invitación a un grupo...). Este componente no
 * conoce el origen del contenido ni el contexto (sidenav, formulario de grupo...) — solo sabe
 * CÓMO ofrecer los canales disponibles, igual que {@link ShareService} solo sabe CÓMO
 * despacharlos.
 *
 * Si el navegador soporta la Web Share API nativa ({@link ShareService.isNativeShareSupported}),
 * se usa directamente al pulsar el disparador, sin picker propio. Si no, se despliega el
 * submenú de canales de siempre (WhatsApp, copiar enlace), pensado para poder añadir un canal
 * nuevo como un botón más sin tocar el resto — salvo que el consumidor marque {@link
 * ShareMenuComponent.nativeOnly}, en cuyo caso no hay submenú de fallback: el botón se
 * deshabilita directamente si no hay soporte nativo.
 */
import {
  Component,
  ElementRef,
  HostListener,
  computed,
  inject,
  input,
  model,
  output,
} from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar } from '@angular/material/snack-bar';
import { ShareService } from '@core/services/share.service';
import { ShareContent } from '@core/models/share.model';

@Component({
  selector: 'app-share-menu',
  standalone: true,
  imports: [MatIconModule],
  templateUrl: './share-menu.html',
  styleUrl: './share-menu.scss',
})
export class ShareMenuComponent {
  private readonly elementRef = inject(ElementRef<HTMLElement>);
  private readonly shareService = inject(ShareService);
  private readonly snackBar = inject(MatSnackBar);

  /** Qué compartir. Este componente no decide contenido, solo lo despacha. */
  readonly content = input.required<ShareContent>();

  /** Deshabilita el disparador (p. ej. todavía no hay nada real que compartir). */
  readonly disabled = input(false);

  /** Tooltip (`title`) a mostrar mientras {@link disabled} es `true`. */
  readonly disabledReason = input<string | undefined>(undefined);

  /**
   * Cuando es `true`, este botón solo funciona con la Web Share API nativa: sin submenú de
   * fallback (WhatsApp/copiar). Si el navegador no la soporta, se deshabilita automáticamente
   * con el tooltip "No soportado" — no hay canal alternativo para este consumidor.
   */
  readonly nativeOnly = input(false);

  /** Oculta el texto junto al icono (p. ej. sidenav colapsado, o botón solo-icono). */
  readonly showLabel = input(true);

  /** Texto del disparador y de los ítems del submenú de fallback. */
  readonly label = input('Compartir');

  /** Icono Material del disparador. */
  readonly icon = input('share');

  /** aria-label del disparador; si no se especifica, reutiliza {@link label}. */
  readonly ariaLabel = input<string | undefined>(undefined);

  /**
   * Estado abierto/cerrado del submenú de fallback. Two-way (`model()`): un host con lógica
   * propia de cierre (p. ej. el sidenav, que debe cerrar este submenú también al colapsarse)
   * puede seguir siendo la fuente de verdad enlazando `[(open)]`; sin enlazar, funciona con
   * estado interno propio.
   */
  readonly open = model(false);

  /**
   * Se emite al elegir cualquier canal (nativo, WhatsApp o copiar), antes de esperar el
   * resultado async. No indica éxito/fracaso, solo "se ha elegido una acción" — para que un host
   * con un efecto propio (p. ej. colapsar el sidenav entero) reaccione sin que este componente
   * sepa nada de sidenavs.
   */
  readonly shareDispatched = output<void>();

  protected readonly effectiveAriaLabel = computed(() => this.ariaLabel() ?? this.label());

  private readonly nativeUnsupported = computed(
    () => this.nativeOnly() && !this.shareService.isNativeShareSupported(),
  );
  protected readonly effectiveDisabled = computed(
    () => this.disabled() || this.nativeUnsupported(),
  );
  protected readonly effectiveTitle = computed(() => {
    if (this.nativeUnsupported()) return 'No soportado';
    return this.disabled() ? this.disabledReason() : undefined;
  });

  protected onTriggerClick(): void {
    if (this.effectiveDisabled()) return;

    if (this.shareService.isNativeShareSupported()) {
      this.dispatchNative();
      return;
    }
    this.open.update((v) => !v);
  }

  private async dispatchNative(): Promise<void> {
    this.shareDispatched.emit();
    await this.shareService.shareNative(this.content());
  }

  protected shareViaWhatsApp(): void {
    this.open.set(false);
    this.shareDispatched.emit();
    this.shareService.shareViaWhatsApp(this.content());
  }

  protected async copyLink(): Promise<void> {
    this.open.set(false);
    this.shareDispatched.emit();
    const copied = await this.shareService.copyLink(this.content());
    this.notify(copied ? 'Enlace copiado' : 'No se pudo copiar el enlace. Inténtalo de nuevo.');
  }

  /** Cierra el submenú al pulsar fuera de este componente. */
  @HostListener('document:click', ['$event'])
  handleOutsideClick(event: MouseEvent): void {
    if (!this.open()) return;
    if (!this.elementRef.nativeElement.contains(event.target as Node)) {
      this.open.set(false);
    }
  }

  private notify(message: string): void {
    this.snackBar.open(message, 'Cerrar', {
      duration: 3000,
      horizontalPosition: 'center',
      verticalPosition: 'top',
    });
  }
}
