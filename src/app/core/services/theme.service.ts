/**
 * @file theme.service.ts
 * @description Servicio singleton que gestiona el tema visual de la aplicación
 * (claro / oscuro) y adapta los componentes de terceros que viven fuera
 * del árbol de Angular — específicamente el InfoWindow de Google Maps.
 *
 * Estrategia de theming por capa:
 * 1. **CSS custom properties** — `[data-theme="dark"]` en `<html>` activa la
 *    paleta oscura definida en `_themes.scss` para todos los componentes Angular.
 * 2. **Inline styles via MutationObserver** — cuando Google Maps inyecta el
 *    InfoWindow en el DOM, {@link ThemeService._styleInfoWindow} aplica estilos
 *    inline con prioridad `!important`, que no pueden ser sobreescritos por
 *    ninguna hoja de estilos externa (incluyendo las de Google).
 * 3. **Mini `<style>` tag** — los pseudo-elementos (`::after` de la flecha)
 *    no son accesibles vía JavaScript, por lo que se manejan con un tag CSS
 *    mínimo inyectado en `<head>`.
 *
 * Persistencia: `localStorage` con clave `mapit_theme`.
 * Valor inicial: preferencia del sistema operativo si no hay dato guardado.
 */

import {effect, Injectable, signal} from '@angular/core';

/** Clave de `localStorage` para persistir la preferencia de tema. */
const STORAGE_KEY = 'mapit_theme';

/**
 * ID del `<style>` tag inyectado en `<head>` para los pseudo-elementos
 * del InfoWindow de Google Maps que no son accesibles vía JavaScript.
 */
const MAPS_STYLE_ID = 'mapit-gmaps-dark';

@Injectable({ providedIn: 'root' })
export class ThemeService {

  /** Signal interno escribible con el estado del tema oscuro. */
  private readonly _dark = signal(false);

  /**
   * Signal de solo lectura que indica si el tema oscuro está activo.
   * Consumido por {@link MapSettingsService} (estilos del mapa) y por el
   * toggle en {@link SettingsPageComponent}.
   */
  readonly isDark = this._dark.asReadonly();

  /**
   * Referencia al `MutationObserver` activo.
   * `null` cuando el tema claro está activo (observer desconectado).
   */
  private _observer: MutationObserver | null = null;

  /**
   * Inicializa el tema desde `localStorage` o desde la preferencia del
   * sistema operativo, aplica el tema inmediatamente para evitar FOUC
   * (_flash of unstyled content_) y registra el `effect()` de persistencia.
   */
  constructor() {
    const saved       = localStorage.getItem(STORAGE_KEY);
    const prefersDark = window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false;
    const isDark      = saved === 'dark' || (!saved && prefersDark);

    // Aplicación síncrona antes del primer render para evitar FOUC
    this._applyTheme(isDark);
    this._dark.set(isDark);

    effect(() => {
      this._applyTheme(this._dark());
      localStorage.setItem(STORAGE_KEY, this._dark() ? 'dark' : 'light');
    });
  }

  /** Alterna entre tema claro y oscuro. */
  toggle(): void {
    this._dark.update(v => !v);
  }

  /**
   * Aplica el tema a nivel de documento.
   * - Establece `data-theme` en `<html>` para activar las CSS custom properties.
   * - Inicia o detiene el `MutationObserver` del InfoWindow de Google Maps.
   *
   * @param dark - `true` para activar el tema oscuro.
   */
  private _applyTheme(dark: boolean): void {
    document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
    dark ? this._startObserver() : this._stopObserver();
  }

  /**
   * Inicia el `MutationObserver` que vigila el DOM en busca del InfoWindow
   * de Google Maps (`.gm-style-iw-c`).
   *
   * @remarks
   * Google Maps inyecta el InfoWindow dinámicamente fuera del árbol de Angular,
   * por lo que los estilos globales de la aplicación no llegan a él. Al detectar
   * su aparición, {@link ThemeService._styleInfoWindow} aplica estilos inline
   * que tienen prioridad absoluta sobre cualquier CSS externo.
   *
   * El flag `data-darkStyled` en el `dataset` del elemento evita re-procesar
   * el mismo InfoWindow en cada mutación del DOM.
   */
  private _startObserver(): void {
    if (this._observer) return;

    this._observer = new MutationObserver(() => {
      const iw = document.querySelector<HTMLElement>('.gm-style-iw-c');
      if (iw && !iw.dataset['darkStyled']) {
        this._styleInfoWindow(iw);
      }
    });

    this._observer.observe(document.body, { childList: true, subtree: true });
  }

  /**
   * Desconecta el `MutationObserver` y revierte los estilos inline
   * del InfoWindow si estuviera visible al cambiar al tema claro.
   */
  private _stopObserver(): void {
    this._observer?.disconnect();
    this._observer = null;

    const iw = document.querySelector<HTMLElement>('.gm-style-iw-c');
    if (iw) {
      delete iw.dataset['darkStyled'];
      iw.querySelectorAll<HTMLElement>('*').forEach(el => {
        el.style.removeProperty('background-color');
        el.style.removeProperty('color');
      });
    }

    document.getElementById(MAPS_STYLE_ID)?.remove();
  }

  /**
   * Aplica el tema oscuro directamente al InfoWindow de Google Maps
   * mediante estilos inline con prioridad `!important`.
   *
   * @remarks
   * Los estilos inline aplicados con `setProperty(..., 'important')` no pueden
   * ser sobreescritos por ninguna hoja de estilos, lo que garantiza la
   * consistencia visual aunque Google Maps reinyecte sus propios estilos.
   *
   * Las clases objetivo (`.gm-title`, `.address-line`, `.view-link`, etc.) se
   * obtienen inspeccionando el DOM real del InfoWindow nativo de Google Maps.
   *
   * @param root - Elemento raíz del InfoWindow (`.gm-style-iw-c`).
   */
  private _styleInfoWindow(root: HTMLElement): void {
    root.dataset['darkStyled'] = '1';

    const bg = '#1e293b';

    root.style.setProperty('background-color', bg, 'important');
    root.querySelectorAll<HTMLElement>('div').forEach(el =>
      el.style.setProperty('background-color', bg, 'important')
    );
    root.querySelectorAll<HTMLElement>('.gm-title, h2, h3').forEach(el =>
      el.style.setProperty('color', '#f1f5f9', 'important')
    );
    root.querySelectorAll<HTMLElement>('.address-line, span:not(.gm-ui-hover-effect span)').forEach(el =>
      el.style.setProperty('color', '#94a3b8', 'important')
    );
    root.querySelectorAll<HTMLElement>('a, a span').forEach(el => {
      el.style.setProperty('color', '#818cf8', 'important');
      el.style.setProperty('background-color', 'transparent', 'important');
    });
    // El botón cerrar usa mask-image SVG: el color del icono se controla
    // con background-color del <span> que actúa como máscara.
    root.querySelectorAll<HTMLElement>('.gm-ui-hover-effect > span').forEach(el =>
      el.style.setProperty('background-color', '#94a3b8', 'important')
    );

    this._injectArrowStyle();
  }

  /**
   * Inyecta un `<style>` tag mínimo en `<head>` para estilizar la flecha
   * del InfoWindow, cuyos pseudo-elementos (`::after`) no son accesibles
   * mediante JavaScript y no pueden recibir estilos inline.
   *
   * @remarks
   * El tag se identifica por {@link MAPS_STYLE_ID} y solo se crea una vez.
   * {@link ThemeService._stopObserver} lo elimina al desactivar el tema oscuro.
   */
  private _injectArrowStyle(): void {
    if (document.getElementById(MAPS_STYLE_ID)) return;
    const el = document.createElement('style');
    el.id = MAPS_STYLE_ID;
    el.textContent = `
      .gm-style-iw-tc::after,
      .gm-style-iw-t::after { background: #1e293b !important; }
    `;
    document.head.appendChild(el);
  }
}
