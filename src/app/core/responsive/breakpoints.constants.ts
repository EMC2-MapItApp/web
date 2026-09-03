/**
 * @file breakpoints.constants.ts
 * @description Breakpoints y media queries compartidas para comportamiento
 * responsive en toda la aplicacion.
 */

/** Rangos numericos base para clasificar dispositivo por ancho de viewport. */
export const SCREEN_BREAKPOINTS = {
  mobileMax: 767,
  tabletMin: 768,
  tabletMax: 1023,
  desktopMin: 1024,
} as const;

/** Media queries derivadas de {@link SCREEN_BREAKPOINTS}. */
export const SCREEN_QUERIES = {
  mobile: `(max-width: ${SCREEN_BREAKPOINTS.mobileMax}px)`,
  tablet: `(min-width: ${SCREEN_BREAKPOINTS.tabletMin}px) and (max-width: ${SCREEN_BREAKPOINTS.tabletMax}px)`,
  desktop: `(min-width: ${SCREEN_BREAKPOINTS.desktopMin}px)`,
  portrait: '(orientation: portrait)',
  landscape: '(orientation: landscape)',
  hasHover: '(hover: hover)',
  pointerCoarse: '(pointer: coarse)',
} as const;
