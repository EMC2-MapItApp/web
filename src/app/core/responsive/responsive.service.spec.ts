import { TestBed } from '@angular/core/testing';
import { BreakpointObserver } from '@angular/cdk/layout';
import { Subject } from 'rxjs';
import { vi } from 'vitest';
import { ResponsiveService } from './responsive.service';
import { SCREEN_QUERIES } from './breakpoints.constants';

describe('ResponsiveService', () => {
  let breakpointChanges: Subject<unknown>;
  const originalInnerWidth = window.innerWidth;
  const originalInnerHeight = window.innerHeight;
  const originalMatchMedia = window.matchMedia;

  /** Todas las media queries "no", salvo las que se pasen explícitamente a true. */
  function mockMatchMedia(matching: Partial<Record<string, boolean>> = {}): void {
    window.matchMedia = vi.fn(
      (query: string) =>
        ({
          matches: matching[query] ?? false,
          media: query,
        }) as MediaQueryList,
    ) as unknown as typeof window.matchMedia;
  }

  function setViewport(width: number, height = 800): void {
    Object.defineProperty(window, 'innerWidth', { value: width, configurable: true });
    Object.defineProperty(window, 'innerHeight', { value: height, configurable: true });
  }

  function configure(): ResponsiveService {
    breakpointChanges = new Subject();
    TestBed.configureTestingModule({
      providers: [
        {
          provide: BreakpointObserver,
          useValue: { observe: () => breakpointChanges.asObservable() },
        },
      ],
    });
    return TestBed.inject(ResponsiveService);
  }

  afterEach(() => {
    Object.defineProperty(window, 'innerWidth', { value: originalInnerWidth, configurable: true });
    Object.defineProperty(window, 'innerHeight', {
      value: originalInnerHeight,
      configurable: true,
    });
    window.matchMedia = originalMatchMedia;
  });

  it('clasifica un viewport móvil (<=767px)', () => {
    setViewport(375);
    mockMatchMedia({ [SCREEN_QUERIES.portrait]: true, [SCREEN_QUERIES.pointerCoarse]: true });

    const service = configure();

    expect(service.deviceClass()).toBe('mobile');
    expect(service.isMobile()).toBe(true);
    expect(service.isTablet()).toBe(false);
    expect(service.isDesktop()).toBe(false);
    expect(service.isCompact()).toBe(true);
    expect(service.state().pointerCoarse).toBe(true);
    expect(service.state().hasHover).toBe(false);
  });

  it('clasifica un viewport de tablet (768-1023px)', () => {
    setViewport(900);
    mockMatchMedia();

    const service = configure();

    expect(service.deviceClass()).toBe('tablet');
    expect(service.isTablet()).toBe(true);
    expect(service.isCompact()).toBe(true);
  });

  it('clasifica un viewport de escritorio (>=1024px)', () => {
    setViewport(1440);
    mockMatchMedia({ [SCREEN_QUERIES.hasHover]: true });

    const service = configure();

    expect(service.deviceClass()).toBe('desktop');
    expect(service.isDesktop()).toBe(true);
    expect(service.isCompact()).toBe(false);
    expect(service.state().hasHover).toBe(true);
  });

  it('recalcula el estado cuando BreakpointObserver notifica un cambio', () => {
    setViewport(375);
    mockMatchMedia();
    const service = configure();
    expect(service.isMobile()).toBe(true);

    setViewport(1440);
    breakpointChanges.next({});

    expect(service.isDesktop()).toBe(true);
  });

  it('no recalcula (misma referencia) si dos notificaciones consecutivas no traen cambios reales', () => {
    setViewport(1440);
    mockMatchMedia();
    const service = configure();

    // distinctUntilChanged compara contra la emisión anterior DEL STREAM del observer, no
    // contra el valor inicial sembrado en el constructor — la primera notificación siempre
    // pasa. Hace falta una segunda notificación sin cambios para que se filtre de verdad.
    breakpointChanges.next({});
    const afterFirst = service.state();

    breakpointChanges.next({}); // mismo viewport, sin cambios reales

    expect(service.state()).toBe(afterFirst); // distinctUntilChanged evita un signal.set() nuevo
  });

  it('width/height del estado reflejan window.innerWidth/innerHeight', () => {
    setViewport(1024, 768);
    mockMatchMedia();

    const service = configure();

    expect(service.state().width).toBe(1024);
    expect(service.state().height).toBe(768);
  });
});
