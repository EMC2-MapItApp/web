/**
 * @file responsive.service.ts
 * @description Servicio singleton para detectar viewport y exponer estado
 * responsive unificado (mobile/tablet/desktop + capacidades).
 *
 * Flujo:
 *   `BreakpointObserver.observe(...)`
 *     -> recalculo de {@link ResponsiveState}
 *     -> actualizacion de signal {@link ResponsiveService.state}
 *     -> consumo reactivo desde componentes
 */

import { BreakpointObserver } from '@angular/cdk/layout';
import { computed, inject, Injectable, signal } from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';
import { distinctUntilChanged, map } from 'rxjs/operators';
import { DeviceClass, ResponsiveState } from './responsive.model';
import { SCREEN_BREAKPOINTS, SCREEN_QUERIES } from './breakpoints.constants';

/** Estado por defecto para entornos sin acceso a `window` (SSR/tests). */
const DEFAULT_STATE: ResponsiveState = {
    deviceClass: 'desktop',
    isMobile: false,
    isTablet: false,
    isDesktop: true,
    isPortrait: false,
    isLandscape: true,
    width: 0,
    height: 0,
    hasHover: true,
    pointerCoarse: false,
};

@Injectable({ providedIn: 'root' })
export class ResponsiveService {

    /** Utilidad de Angular CDK para observar cambios de media queries. */
    private readonly breakpointObserver = inject(BreakpointObserver);

    /** Signal principal con el estado responsive consolidado. */
    readonly state = signal<ResponsiveState>(this.buildState());

    /** Observable del estado para consumidores que trabajan con RxJS. */
    readonly state$ = toObservable(this.state);

    /** Helpers derivados para templates y logica de componentes. */
    readonly deviceClass = computed(() => this.state().deviceClass);
    readonly isMobile = computed(() => this.state().isMobile);
    readonly isTablet = computed(() => this.state().isTablet);
    readonly isDesktop = computed(() => this.state().isDesktop);

    constructor() {
        this.breakpointObserver.observe([
            SCREEN_QUERIES.mobile,
            SCREEN_QUERIES.tablet,
            SCREEN_QUERIES.desktop,
            SCREEN_QUERIES.portrait,
            SCREEN_QUERIES.landscape,
            SCREEN_QUERIES.hasHover,
            SCREEN_QUERIES.pointerCoarse,
        ])
            .pipe(
                map(() => this.buildState()),
                distinctUntilChanged((a, b) => this.isSameState(a, b)),
            )
            .subscribe(next => this.state.set(next));
    }

    /**
     * Clasifica el dispositivo por ancho de viewport.
     *
     * @param width - Ancho actual del viewport en pixeles.
     */
    private resolveDeviceClass(width: number): DeviceClass {
        if (width <= SCREEN_BREAKPOINTS.mobileMax) return 'mobile';
        if (width <= SCREEN_BREAKPOINTS.tabletMax) return 'tablet';
        return 'desktop';
    }

    /**
     * Construye un snapshot completo del estado responsive actual.
     */
    private buildState(): ResponsiveState {
        if (typeof window === 'undefined') return DEFAULT_STATE;

        const width = window.innerWidth;
        const height = window.innerHeight;
        const deviceClass = this.resolveDeviceClass(width);

        return {
            deviceClass,
            isMobile: deviceClass === 'mobile',
            isTablet: deviceClass === 'tablet',
            isDesktop: deviceClass === 'desktop',
            isPortrait: this.matches(SCREEN_QUERIES.portrait),
            isLandscape: this.matches(SCREEN_QUERIES.landscape),
            width,
            height,
            hasHover: this.matches(SCREEN_QUERIES.hasHover),
            pointerCoarse: this.matches(SCREEN_QUERIES.pointerCoarse),
        };
    }

    /**
     * Evalua una media query contra el viewport actual.
     */
    private matches(query: string): boolean {
        if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
        return window.matchMedia(query).matches;
    }

    /**
     * Comparador interno para evitar emisiones redundantes al signal.
     */
    private isSameState(a: ResponsiveState, b: ResponsiveState): boolean {
        return a.deviceClass === b.deviceClass
            && a.isMobile === b.isMobile
            && a.isTablet === b.isTablet
            && a.isDesktop === b.isDesktop
            && a.isPortrait === b.isPortrait
            && a.isLandscape === b.isLandscape
            && a.width === b.width
            && a.height === b.height
            && a.hasHover === b.hasHover
            && a.pointerCoarse === b.pointerCoarse;
    }
}