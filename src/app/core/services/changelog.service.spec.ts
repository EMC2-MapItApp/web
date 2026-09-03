import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ChangelogService } from './changelog.service';
import { ChangelogEntry } from '../models/changelog.model';

describe('ChangelogService', () => {
  let service: ChangelogService;
  let httpMock: HttpTestingController;

  const entries: ChangelogEntry[] = [
    { date: '2026-07-01', type: 'fix', title: 'Primera entrada', description: 'x' },
    { date: '2026-08-15', type: 'feature', title: 'Entrada más reciente', description: 'y' },
    { date: '2026-07-20', type: 'improvement', title: 'Entrada intermedia', description: 'z' },
  ];

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(ChangelogService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('ordena las entradas por fecha descendente', () => {
    let result: ChangelogEntry[] | undefined;
    service.getAll().subscribe(r => (result = r));

    httpMock.expectOne('/assets/changelog.json').flush(entries);

    expect(result?.map(e => e.date)).toEqual(['2026-08-15', '2026-07-20', '2026-07-01']);
  });

  it('comparte una única petición HTTP entre varios suscriptores (shareReplay)', () => {
    service.getAll().subscribe();
    service.getAll().subscribe();

    httpMock.expectOne('/assets/changelog.json').flush(entries);

    // Un tercer subscriber tras completarse la primera petición reutiliza el valor cacheado,
    // sin disparar una segunda llamada HTTP — httpMock.verify() en afterEach lo confirma.
    let cached: ChangelogEntry[] | undefined;
    service.getAll().subscribe(r => (cached = r));
    expect(cached?.length).toBe(3);
  });
});
