import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { vi } from 'vitest';
import { MapViewportService } from './map-viewport.service';
import { GeoIpService } from './geo-ip.service';
import { GeoIpCenter } from '../models/geo-ip.model';

describe('MapViewportService', () => {
  let service: MapViewportService;
  let geoIpService: { resolveCenter: ReturnType<typeof vi.fn> };

  const center: GeoIpCenter = {
    lat: 40.4, lng: -3.7, city: 'Madrid', country: 'ES', resolvedIp: '1.2.3.4', source: 'geoip',
  };

  beforeEach(() => {
    geoIpService = { resolveCenter: vi.fn().mockReturnValue(of(center)) };
    TestBed.configureTestingModule({
      providers: [{ provide: GeoIpService, useValue: geoIpService }],
    });
    service = TestBed.inject(MapViewportService);
  });

  it('primera llamada: resuelve por IP y aplica el zoom por defecto (12)', () => {
    let result: unknown;
    service.resolveInitialViewport().subscribe(v => (result = v));

    expect(geoIpService.resolveCenter).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ lat: 40.4, lng: -3.7, zoom: 12 });
  });

  it('segunda llamada: reutiliza el viewport guardado sin volver a resolver por IP', () => {
    service.resolveInitialViewport().subscribe();
    service.resolveInitialViewport().subscribe();

    expect(geoIpService.resolveCenter).toHaveBeenCalledTimes(1);
  });

  it('setViewport actualiza el estado compartido, que resolveInitialViewport reutiliza después', () => {
    service.setViewport({ lat: 41.0, lng: 2.0 }, 15);

    let result: unknown;
    service.resolveInitialViewport().subscribe(v => (result = v));

    expect(geoIpService.resolveCenter).not.toHaveBeenCalled();
    expect(result).toEqual({ lat: 41.0, lng: 2.0, zoom: 15 });
  });
});
