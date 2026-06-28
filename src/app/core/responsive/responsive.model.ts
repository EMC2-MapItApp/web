/**
 * @file responsive.model.ts
 * @description Contratos de dominio para estado responsive compartido.
 */

/** Clasificacion principal de dispositivo por ancho de viewport. */
export type DeviceClass = 'mobile' | 'tablet' | 'desktop';

/**
 * Estado responsive consolidado para consumo en componentes.
 *
 * @remarks
 * Mantener este contrato estable facilita portar la arquitectura a otros
 * proyectos sin cambios de API en los consumidores.
 */
export interface ResponsiveState {
    deviceClass: DeviceClass;
    isMobile: boolean;
    isTablet: boolean;
    isDesktop: boolean;
    isPortrait: boolean;
    isLandscape: boolean;
    width: number;
    height: number;
    hasHover: boolean;
    pointerCoarse: boolean;
}