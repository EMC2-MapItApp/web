import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { ShareService } from './share.service';
import { ResponsiveService } from '@core/responsive/responsive.service';
import { ShareContent } from '@core/models/share.model';
import { DEFAULT_SHARE_CONTENT } from '@core/constants/share.constants';

describe('ShareService', () => {
  let service: ShareService;
  let responsiveState: { pointerCoarse: boolean };

  const content: ShareContent = { text: 'Mira esto', url: 'https://mapit-web.com/x' };

  function configure(pointerCoarse: boolean): void {
    responsiveState = { pointerCoarse };
    TestBed.configureTestingModule({
      providers: [
        { provide: ResponsiveService, useValue: { state: () => responsiveState } },
      ],
    });
    service = TestBed.inject(ShareService);
  }

  describe('shareViaWhatsApp', () => {
    it('en dispositivo táctil, navega al deep link nativo whatsapp://', () => {
      configure(true);
      // jsdom no permite espiar el setter de window.location.href directamente
      // (TypeError: Cannot redefine property) — se sustituye el objeto entero.
      const originalLocation = window.location;
      const fakeLocation = { ...originalLocation, href: originalLocation.href };
      Object.defineProperty(window, 'location', { value: fakeLocation, writable: true, configurable: true });

      service.shareViaWhatsApp(content);

      expect(fakeLocation.href).toBe(
        `whatsapp://send?text=${encodeURIComponent('Mira esto\n\nhttps://mapit-web.com/x')}`,
      );

      Object.defineProperty(window, 'location', { value: originalLocation, writable: true, configurable: true });
    });

    it('en escritorio, abre WhatsApp Web en pestaña nueva', () => {
      configure(false);
      const openSpy = vi.spyOn(window, 'open').mockReturnValue(null);

      service.shareViaWhatsApp(content);

      expect(openSpy).toHaveBeenCalledWith(
        `https://web.whatsapp.com/send?text=${encodeURIComponent('Mira esto\n\nhttps://mapit-web.com/x')}`,
        '_blank',
        'noopener',
      );
    });

    it('sin contenido explícito, usa DEFAULT_SHARE_CONTENT', () => {
      configure(false);
      const openSpy = vi.spyOn(window, 'open').mockReturnValue(null);

      service.shareViaWhatsApp();

      const expectedMessage = `${DEFAULT_SHARE_CONTENT.text}\n\n${DEFAULT_SHARE_CONTENT.url}`;
      expect(openSpy).toHaveBeenCalledWith(
        `https://web.whatsapp.com/send?text=${encodeURIComponent(expectedMessage)}`,
        '_blank',
        'noopener',
      );
    });
  });

  describe('copyLink', () => {
    it('copia la url si el contenido la trae, y devuelve true', async () => {
      configure(false);
      const writeText = vi.fn().mockResolvedValue(undefined);
      Object.assign(navigator, { clipboard: { writeText } });

      const result = await service.copyLink(content);

      expect(writeText).toHaveBeenCalledWith(content.url);
      expect(result).toBe(true);
    });

    it('sin url en el contenido, copia el texto como último recurso', async () => {
      configure(false);
      const writeText = vi.fn().mockResolvedValue(undefined);
      Object.assign(navigator, { clipboard: { writeText } });

      await service.copyLink({ text: 'Solo texto' });

      expect(writeText).toHaveBeenCalledWith('Solo texto');
    });

    it('si el portapapeles falla, devuelve false en vez de lanzar', async () => {
      configure(false);
      Object.assign(navigator, {
        clipboard: { writeText: vi.fn().mockRejectedValue(new Error('denegado')) },
      });

      const result = await service.copyLink(content);

      expect(result).toBe(false);
    });
  });

  describe('isNativeShareSupported / shareNative', () => {
    afterEach(() => {
      Reflect.deleteProperty(navigator, 'share');
    });

    it('isNativeShareSupported refleja si navigator.share existe', () => {
      configure(false);
      expect(service.isNativeShareSupported()).toBe(false);

      Object.assign(navigator, { share: vi.fn() });
      expect(service.isNativeShareSupported()).toBe(true);
    });

    it('shareNative invoca navigator.share y devuelve true si tiene éxito', async () => {
      configure(false);
      const share = vi.fn().mockResolvedValue(undefined);
      Object.assign(navigator, { share });

      const result = await service.shareNative(content);

      expect(share).toHaveBeenCalledWith({ text: content.text, url: content.url });
      expect(result).toBe(true);
    });

    it('shareNative devuelve true si el usuario cancela el share sheet (AbortError)', async () => {
      configure(false);
      Object.assign(navigator, {
        share: vi.fn().mockRejectedValue(new DOMException('cancelado', 'AbortError')),
      });

      const result = await service.shareNative(content);

      expect(result).toBe(true);
    });

    it('shareNative devuelve false ante cualquier otro error', async () => {
      configure(false);
      Object.assign(navigator, { share: vi.fn().mockRejectedValue(new Error('fallo real')) });

      const result = await service.shareNative(content);

      expect(result).toBe(false);
    });
  });
});
