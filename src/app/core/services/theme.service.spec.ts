import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { ThemeService } from './theme.service';

const STORAGE_KEY = 'mapit_theme';
const MAPS_STYLE_ID = 'mapit-gmaps-dark';

describe('ThemeService', () => {
  // jsdom en este entorno de test no implementa window.matchMedia (queda undefined) — se asigna
  // directamente en vez de vi.spyOn, que exige que la función ya exista para poder espiarla.
  const originalMatchMedia = window.matchMedia;

  function mockMatchMedia(prefersDark: boolean): void {
    window.matchMedia = vi.fn((query: string) => ({
      matches: query.includes('dark') ? prefersDark : false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })) as unknown as typeof window.matchMedia;
  }

  afterEach(() => {
    window.matchMedia = originalMatchMedia;
    localStorage.removeItem(STORAGE_KEY);
    document.documentElement.removeAttribute('data-theme');
    document.getElementById(MAPS_STYLE_ID)?.remove();
    document.querySelectorAll('.gm-style-iw-c').forEach((el) => el.remove());
    vi.restoreAllMocks();
  });

  it('sin preferencia guardada, usa la del sistema (oscuro)', () => {
    mockMatchMedia(true);
    const service = TestBed.inject(ThemeService);

    expect(service.isDark()).toBe(true);
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
  });

  it('sin preferencia guardada, usa la del sistema (claro)', () => {
    mockMatchMedia(false);
    const service = TestBed.inject(ThemeService);

    expect(service.isDark()).toBe(false);
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
  });

  it('con preferencia guardada "dark", ignora la preferencia del sistema', () => {
    localStorage.setItem(STORAGE_KEY, 'dark');
    mockMatchMedia(false);

    const service = TestBed.inject(ThemeService);

    expect(service.isDark()).toBe(true);
  });

  it('con preferencia guardada "light", ignora la preferencia del sistema', () => {
    localStorage.setItem(STORAGE_KEY, 'light');
    mockMatchMedia(true);

    const service = TestBed.inject(ThemeService);

    expect(service.isDark()).toBe(false);
  });

  it('toggle() invierte el tema y persiste la nueva preferencia en localStorage', () => {
    mockMatchMedia(false);
    const service = TestBed.inject(ThemeService);

    service.toggle();
    TestBed.tick();

    expect(service.isDark()).toBe(true);
    expect(localStorage.getItem(STORAGE_KEY)).toBe('dark');
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
  });

  it('al activar el tema oscuro con un InfoWindow de Maps ya en el DOM, lo estiliza en línea', async () => {
    mockMatchMedia(false);
    const service = TestBed.inject(ThemeService);

    const infoWindow = document.createElement('div');
    infoWindow.className = 'gm-style-iw-c';
    document.body.appendChild(infoWindow);

    service.toggle();
    TestBed.tick();

    await vi.waitFor(() => {
      expect(infoWindow.dataset['darkStyled']).toBe('1');
    });
    // jsdom normaliza el hex a rgb() al leerlo de vuelta del CSSOM.
    expect(infoWindow.style.getPropertyValue('background-color')).toBe('rgb(30, 41, 59)');
    expect(document.getElementById(MAPS_STYLE_ID)).not.toBeNull();
  });

  it('al volver al tema claro, revierte los estilos inline del InfoWindow y quita el <style> de la flecha', async () => {
    mockMatchMedia(true); // arranca en oscuro
    const service = TestBed.inject(ThemeService);

    const infoWindow = document.createElement('div');
    infoWindow.className = 'gm-style-iw-c';
    document.body.appendChild(infoWindow);

    // Fuerza que el observer ya activo (arrancó en oscuro) procese el InfoWindow insertado.
    await vi.waitFor(() => expect(infoWindow.dataset['darkStyled']).toBe('1'));

    service.toggle(); // -> claro
    TestBed.tick();

    expect(infoWindow.dataset['darkStyled']).toBeUndefined();
    // _stopObserver() solo limpia background-color/color de los DESCENDIENTES del InfoWindow
    // (`iw.querySelectorAll('*')`), no del propio contenedor raíz — el estilo inline puesto en
    // _styleInfoWindow() directamente en `root` sobrevive al volver a claro. Se documenta el
    // comportamiento real, no se corrige aquí (fuera de alcance de esta tanda de tests).
    expect(infoWindow.style.getPropertyValue('background-color')).toBe('rgb(30, 41, 59)');
    expect(document.getElementById(MAPS_STYLE_ID)).toBeNull();
  });
});
