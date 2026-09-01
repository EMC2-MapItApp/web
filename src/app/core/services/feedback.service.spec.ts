import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { FeedbackService } from './feedback.service';
import { environment } from '@env/environment';

describe('FeedbackService', () => {
  let service: FeedbackService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(FeedbackService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('send hace POST con el payload tal cual, sin remitente (lo resuelve el backend por JWT)', () => {
    const payload = { category: 'BUG' as const, subject: 'Título', message: 'Detalle del fallo' };
    service.send(payload).subscribe();

    const req = httpMock.expectOne(environment.apiFeedbackUrl);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(payload);
    req.flush(null);
  });
});
