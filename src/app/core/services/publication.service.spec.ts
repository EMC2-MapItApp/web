import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { PublicationService } from './publication.service';
import { EnrolledUser } from '../models/publication.model';
import { environment } from '@env/environment';

describe('PublicationService', () => {
  let service: PublicationService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(PublicationService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('getEnrollments pide los inscritos y los tipa como EnrolledUser (modelo en core/models)', () => {
    const enrolled: EnrolledUser[] = [
      { userId: 'u1', userName: 'Ana', enrolledAt: '2026-07-15T10:00:00Z' },
    ];

    let result: EnrolledUser[] | undefined;
    service.getEnrollments('pub-7').subscribe((r) => (result = r));

    const req = httpMock.expectOne(`${environment.apiPublicationsUrl}/pub-7/enrollments`);
    expect(req.request.method).toBe('GET');
    req.flush(enrolled);

    expect(result).toEqual(enrolled);
  });

  it('enroll hace POST al endpoint de inscripción', () => {
    service.enroll('pub-7').subscribe();

    const req = httpMock.expectOne(`${environment.apiPublicationsUrl}/pub-7/enroll`);
    expect(req.request.method).toBe('POST');
    req.flush({
      publicationId: 'pub-7',
      userId: 'u1',
      occupiedSlots: 1,
      maxSlots: 10,
      full: false,
    });
  });

  it('remove hace DELETE de la publicación', () => {
    service.remove('pub-7').subscribe();

    const req = httpMock.expectOne(`${environment.apiPublicationsUrl}/pub-7`);
    expect(req.request.method).toBe('DELETE');
    req.flush(null);
  });
});
