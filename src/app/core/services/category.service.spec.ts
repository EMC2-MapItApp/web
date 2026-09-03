import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { CategoryService } from './category.service';
import { environment } from '@env/environment';

describe('CategoryService', () => {
  let service: CategoryService;
  let httpMock: HttpTestingController;

  const apiTree = [
    {
      id: 'main-1',
      name: 'Deporte',
      icon: 'sports',
      color: '#ff0000',
      subCategories: [
        {
          id: 'sub-1',
          name: 'Ciclismo',
          icon: 'bike',
          locationTypes: [{ id: 'lt-1', name: 'Quedadas', description: 'Rutas en grupo' }],
        },
      ],
    },
  ];

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(CategoryService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('getAll pide /tree y mapea el árbol, propagando mainCategoryId/subcategoryId a cada nivel', () => {
    let result: unknown;
    service.getAll().subscribe((r) => (result = r));

    httpMock.expectOne(`${environment.apiCategoriesUrl}/tree`).flush(apiTree);

    expect(result).toEqual([
      {
        id: 'main-1',
        name: 'Deporte',
        icon: 'sports',
        color: '#ff0000',
        subcategories: [
          {
            id: 'sub-1',
            name: 'Ciclismo',
            icon: 'bike',
            mainCategoryId: 'main-1',
            locationTypes: [
              {
                id: 'lt-1',
                name: 'Quedadas',
                description: 'Rutas en grupo',
                subcategoryId: 'sub-1',
              },
            ],
          },
        ],
      },
    ]);
  });

  it('comparte una única petición HTTP entre varios llamantes (shareReplay)', () => {
    service.getAll().subscribe();
    service.getAll().subscribe();

    httpMock.expectOne(`${environment.apiCategoriesUrl}/tree`).flush(apiTree);
  });

  it('antes de la primera carga, los lookups síncronos devuelven undefined/vacío', () => {
    expect(service.getMainCategoryById('main-1')).toBeUndefined();
    expect(service.getSubCategoryById('sub-1')).toBeUndefined();
    expect(service.getLocationTypeById('lt-1')).toBeUndefined();
    expect(service.resolveBreadcrumb('lt-1')).toBeUndefined();
    expect(service.resolveColor('lt-1')).toBe('#6b7280');
    expect(service.resolveIcon('lt-1')).toBe('📍');
  });

  it('tras getAll(), los lookups síncronos resuelven contra la cache', () => {
    service.getAll().subscribe();
    httpMock.expectOne(`${environment.apiCategoriesUrl}/tree`).flush(apiTree);

    expect(service.getMainCategoryById('main-1')?.name).toBe('Deporte');
    expect(service.getSubCategoryById('sub-1')?.name).toBe('Ciclismo');
    expect(service.getLocationTypeById('lt-1')?.name).toBe('Quedadas');
    expect(service.resolveColor('lt-1')).toBe('#ff0000');
    expect(service.resolveIcon('lt-1')).toBe('bike');

    const breadcrumb = service.resolveBreadcrumb('lt-1');
    expect(breadcrumb?.mainCategory.id).toBe('main-1');
    expect(breadcrumb?.subCategory.id).toBe('sub-1');
    expect(breadcrumb?.locationType.id).toBe('lt-1');
  });
});
