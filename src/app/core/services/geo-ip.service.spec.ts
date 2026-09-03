import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { GeoIpService } from './geo-ip.service';
import { GeoIpCenter } from '../models/geo-ip.model';
import { environment } from '@env/environment';

describe('GeoIpService', () => {
  let service: GeoIpService;
  let httpMock: HttpTestingController;

  const center: GeoIpCenter = {
    lat: 40.4,
    lng: -3.7,
    city: 'Madrid',
    country: 'ES',
    resolvedIp: '1.2.3.4',
    source: 'geoip',
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(GeoIpService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
    window.history.replaceState(null, '', '/');
    environment.devSimIp = '';
  });

  it('sin simIp en la URL ni en environment, pide sin ese query param', () => {
    service.resolveCenter().subscribe();

    const req = httpMock.expectOne(`${environment.apiGeoUrl}/me`);
    expect(req.request.params.has('simIp')).toBe(false);
    req.flush(center);
  });

  it('con ?simIp= en la URL, lo añade como query param al backend', () => {
    window.history.replaceState(null, '', '/?simIp=81.2.69.142');

    service.resolveCenter().subscribe();

    const req = httpMock.expectOne(
      (r) => r.url === `${environment.apiGeoUrl}/me` && r.params.get('simIp') === '81.2.69.142',
    );
    req.flush(center);
  });

  it('sin simIp en la URL pero con environment.devSimIp, lo usa como fallback', () => {
    environment.devSimIp = '9.9.9.9';

    service.resolveCenter().subscribe();

    const req = httpMock.expectOne(
      (r) => r.url === `${environment.apiGeoUrl}/me` && r.params.get('simIp') === '9.9.9.9',
    );
    req.flush(center);
  });

  it('el simIp de la URL tiene prioridad sobre environment.devSimIp', () => {
    window.history.replaceState(null, '', '/?simIp=81.2.69.142');
    environment.devSimIp = '9.9.9.9';

    service.resolveCenter().subscribe();

    const req = httpMock.expectOne(
      (r) => r.url === `${environment.apiGeoUrl}/me` && r.params.get('simIp') === '81.2.69.142',
    );
    req.flush(center);
  });

  it('emite el resultado del backend tal cual cuando la petición tiene éxito', () => {
    let result: GeoIpCenter | undefined;
    service.resolveCenter().subscribe((r) => (result = r));

    httpMock.expectOne(`${environment.apiGeoUrl}/me`).flush(center);

    expect(result).toEqual(center);
  });

  it('si el backend falla, emite el fallback local (Madrid) en vez de propagar el error', () => {
    let result: GeoIpCenter | undefined;
    let errored = false;
    service.resolveCenter().subscribe({ next: (r) => (result = r), error: () => (errored = true) });

    httpMock
      .expectOne(`${environment.apiGeoUrl}/me`)
      .flush(null, { status: 500, statusText: 'Server Error' });

    expect(errored).toBe(false);
    expect(result).toEqual(expect.objectContaining({ source: 'fallback', city: 'Madrid' }));
  });
});
