import { TestBed } from '@angular/core/testing';
import { CurrentUserService } from './current-user.service';
import { MapItUser } from '../models/user.model';

describe('CurrentUserService', () => {
  let service: CurrentUserService;

  const individual: MapItUser = {
    id: 'u1', name: 'Ana', nick: 'ana', email: 'ana@test.com', userType: 'individual',
    level: 3, xp: 120, unlockedCapabilities: ['cap-a'], favoriteLocationTypeIds: ['lt-1', 'lt-2'],
  };

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(CurrentUserService);
  });

  it('sin usuario, los computed derivados devuelven valores neutros', () => {
    expect(service.user()).toBeNull();
    expect(service.userId()).toBeNull();
    expect(service.isIndividual()).toBe(false);
    expect(service.hasCapability('cap-a')).toBe(false);
    expect(service.favoriteTypeIds()).toEqual([]);
  });

  it('setUser puebla el usuario y los computed derivados', () => {
    service.setUser(individual);

    expect(service.userId()).toBe('u1');
    expect(service.userType()).toBe('individual');
    expect(service.userName()).toBe('Ana');
    expect(service.userLevel()).toBe(3);
    expect(service.userXp()).toBe(120);
    expect(service.isIndividual()).toBe(true);
    expect(service.isProfessional()).toBe(false);
    expect(service.isEntity()).toBe(false);
    expect(service.hasCapability('cap-a')).toBe(true);
    expect(service.hasCapability('cap-otra')).toBe(false);
    expect(service.favoriteTypeIds()).toEqual(['lt-1', 'lt-2']);
  });

  it('patch actualiza solo los campos indicados, preservando el resto', () => {
    service.setUser(individual);

    service.patch({ name: 'Ana María' });

    expect(service.userName()).toBe('Ana María');
    expect(service.userId()).toBe('u1');
    expect(service.hasCapability('cap-a')).toBe(true);
  });

  it('patch sin usuario activo no hace nada (no lanza)', () => {
    expect(() => service.patch({ name: 'x' })).not.toThrow();
    expect(service.user()).toBeNull();
  });

  it('clear vacía el usuario activo', () => {
    service.setUser(individual);
    service.clear();

    expect(service.user()).toBeNull();
    expect(service.userId()).toBeNull();
  });

  it('userId() mantiene la misma referencia primitiva entre dos patch() (no fuerza recomputar effects atados solo a sesión)', () => {
    service.setUser(individual);
    const idAfterSet = service.userId();

    service.patch({ name: 'Otro nombre' });

    expect(service.userId()).toBe(idAfterSet);
  });
});
