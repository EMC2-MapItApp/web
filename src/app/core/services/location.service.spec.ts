import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { LocationService } from './location.service';
import { Publication } from '../models/publication.model';
import { MapLocation } from '../models/location.model';
import { environment } from '@env/environment';

describe('LocationService', () => {
  let service: LocationService;
  let httpMock: HttpTestingController;

  const pub = (over: Partial<Publication> = {}): Publication => ({
    id: 'p1',
    authorId: 'a1',
    publicationType: 'event',
    placeId: null,
    locationTypeId: 'lt1',
    title: 'Evento',
    description: 'Desc',
    startDate: '2026-08-01T10:00:00Z',
    endDate: null,
    lat: 40.4,
    lng: -3.7,
    requiredLevel: 0,
    metadata: {},
    active: true,
    occupiedSlots: 3,
    visibility: 'PUBLIC',
    hasAccess: true,
    accessRequestPending: false,
    ...over,
  });

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(LocationService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('getAll pide activeOnly=true y convierte publicaciones a MapLocation', () => {
    let result: MapLocation[] | undefined;
    service.getAll().subscribe((r) => (result = r));

    const req = httpMock.expectOne(`${environment.apiPublicationsUrl}?activeOnly=true`);
    req.flush([pub()]);

    expect(result).toEqual([
      expect.objectContaining({
        id: 'p1',
        name: 'Evento',
        locationTypeId: 'lt1',
        lat: 40.4,
        lng: -3.7,
      }),
    ]);
  });

  it('descarta publicaciones sin lat/lng (privadas sin acceso, enmascaradas por el backend)', () => {
    let result: MapLocation[] | undefined;
    service.getAll().subscribe((r) => (result = r));

    httpMock
      .expectOne(`${environment.apiPublicationsUrl}?activeOnly=true`)
      .flush([pub({ id: 'p1' }), pub({ id: 'p2', lat: null, lng: null })]);

    expect(result?.map((l) => l.id)).toEqual(['p1']);
  });

  it('cuando el título viene enmascarado a null, usa el placeholder "Publicación privada"', () => {
    let result: MapLocation[] | undefined;
    service.getAll().subscribe((r) => (result = r));

    httpMock
      .expectOne(`${environment.apiPublicationsUrl}?activeOnly=true`)
      .flush([pub({ title: null as unknown as string, hasAccess: false })]);

    expect(result?.[0].name).toBe('Publicación privada');
  });

  it('getByLocationType filtra por locationTypeId sobre el resultado de getAll', () => {
    let result: MapLocation[] | undefined;
    service.getByLocationType('lt1').subscribe((r) => (result = r));

    httpMock
      .expectOne(`${environment.apiPublicationsUrl}?activeOnly=true`)
      .flush([pub({ id: 'p1', locationTypeId: 'lt1' }), pub({ id: 'p2', locationTypeId: 'lt2' })]);

    expect(result?.map((l) => l.id)).toEqual(['p1']);
  });

  it('getById devuelve undefined si no existe ninguna localización con ese id', () => {
    let result: MapLocation | undefined;
    service.getById('no-existe').subscribe((r) => (result = r));

    httpMock
      .expectOne(`${environment.apiPublicationsUrl}?activeOnly=true`)
      .flush([pub({ id: 'p1' })]);

    expect(result).toBeUndefined();
  });
});
