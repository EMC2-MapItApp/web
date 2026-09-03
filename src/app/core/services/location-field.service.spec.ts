import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { LocationFieldService } from './location-field.service';
import { CategoryService } from './category.service';
import { LocationType, SubCategory } from '../models/category.model';

describe('LocationFieldService', () => {
  let service: LocationFieldService;
  let categoryService: {
    getLocationTypeById: ReturnType<typeof vi.fn>;
    getSubCategoryById: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    categoryService = { getLocationTypeById: vi.fn(), getSubCategoryById: vi.fn() };
    TestBed.configureTestingModule({
      providers: [{ provide: CategoryService, useValue: categoryService }],
    });
    service = TestBed.inject(LocationFieldService);
  });

  it('getFields resuelve por clave directa (locationTypeId real del registry) sin tocar CategoryService', () => {
    const fields = service.getFields('ciclismo-profesional', 'place');

    expect(fields.map(f => f.key)).toEqual(['address', 'schedule', 'phone', 'web', 'services']);
    expect(categoryService.getLocationTypeById).not.toHaveBeenCalled();
  });

  it('getFields devuelve un schema distinto para el mismo locationTypeId con otro context', () => {
    expect(service.getFields('ciclismo-profesional', 'promotion').map(f => f.key))
      .toEqual(['discountCode', 'discountPercent', 'conditions', 'maxUses']);
  });

  it('sin clave directa, resuelve por el nombre legado (subcategoría-tipo) vía CategoryService', () => {
    const locationType: LocationType = {
      id: 'mongo-id-1', name: 'Quedadas', description: '', subcategoryId: 'sub-1',
    };
    const subCategory: SubCategory = {
      id: 'sub-1', name: 'Ciclismo', icon: 'bike', mainCategoryId: 'main-1', locationTypes: [],
    };
    categoryService.getLocationTypeById.mockReturnValue(locationType);
    categoryService.getSubCategoryById.mockReturnValue(subCategory);

    const fields = service.getFields('mongo-id-1', 'event');

    expect(fields.map(f => f.key)).toEqual(['distance', 'elevation', 'level', 'slots', 'contact']);
    expect(categoryService.getSubCategoryById).toHaveBeenCalledWith('sub-1');
  });

  it('el nombre legado ignora tildes al construir la clave (slugify)', () => {
    // "Quedádas" con tilde debe normalizar igual que "quedadas" en el registry real.
    categoryService.getLocationTypeById.mockReturnValue(
      { id: 'x', name: 'Quedádas', description: '', subcategoryId: 'sub-1' } as LocationType,
    );
    categoryService.getSubCategoryById.mockReturnValue(
      { id: 'sub-1', name: 'Ciclismo', icon: 'bike', mainCategoryId: 'main-1', locationTypes: [] } as SubCategory,
    );

    expect(service.hasSchema('x', 'event')).toBe(true);
    expect(service.getFields('x', 'event').map(f => f.key)).toEqual(
      ['distance', 'elevation', 'level', 'slots', 'contact'],
    );
  });

  it('sin clave directa ni CategoryService pudiendo resolver el locationType, devuelve vacío', () => {
    categoryService.getLocationTypeById.mockReturnValue(undefined);

    expect(service.getFields('no-existe', 'event')).toEqual([]);
    expect(service.hasSchema('no-existe', 'event')).toBe(false);
  });

  it('sin clave directa ni legada resoluble a un schema real, devuelve vacío', () => {
    categoryService.getLocationTypeById.mockReturnValue(
      { id: 'x', name: 'Tipo inventado', description: '', subcategoryId: 'sub-1' } as LocationType,
    );
    categoryService.getSubCategoryById.mockReturnValue(
      { id: 'sub-1', name: 'Categoría inventada', icon: '?', mainCategoryId: 'main-1', locationTypes: [] } as SubCategory,
    );

    expect(service.getFields('x', 'event')).toEqual([]);
    expect(service.hasSchema('x', 'event')).toBe(false);
  });

  it('hasSchema es true para una clave directa registrada', () => {
    expect(service.hasSchema('museos-visita', 'place')).toBe(true);
    expect(service.hasSchema('museos-visita', 'promotion')).toBe(false);
  });
});
