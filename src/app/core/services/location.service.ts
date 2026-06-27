import { Injectable, inject } from '@angular/core';
import { Observable, delay, map } from 'rxjs';
import { MainCategory } from '../models/category.model';
import { MapLocation } from '../models/location.model';
import { CategoryService } from './category.service';

interface MockLocationSeed {
  id: number;
  name: string;
  description?: string;
  locationTypeKey: string;
  lat: number;
  lng: number;
}

const MOCK_LOCATION_SEEDS: MockLocationSeed[] = [
  {
    id: 1,
    name: 'Ruta del sábado – Guadarrama',
    description: 'Salida grupal en bicicleta de montaña. Nivel medio. ¡Apúntate!',
    locationTypeKey: 'ciclismo-quedadas',
    lat: 40.53, lng: -3.99,
  },
  {
    id: 2,
    name: 'Bicicletas López S.L.',
    description: 'Tienda especializada en bicicletas de carretera y MTB. Taller propio.',
    locationTypeKey: 'ciclismo-profesional',
    lat: 40.42, lng: -3.71,
  },
  {
    id: 3,
    name: 'Running en el Retiro',
    description: 'Grupo de running mañanero. Todos los jueves a las 7:30 h.',
    locationTypeKey: 'running-quedadas',
    lat: 40.4153, lng: -3.6844,
  },
  {
    id: 4,
    name: 'Intersport Gran Vía',
    description: 'Tienda de material deportivo con sección especializada en running.',
    locationTypeKey: 'running-profesional',
    lat: 40.42, lng: -3.7025,
  },
  {
    id: 5,
    name: 'Museo del Prado',
    description: 'Uno de los museos de arte más importantes del mundo.',
    locationTypeKey: 'museos-visita',
    lat: 40.4138, lng: -3.6922,
  },
  {
    id: 6,
    name: 'Museo Reina Sofía',
    description: 'Museo nacional de arte contemporáneo. Sede del Guernica de Picasso.',
    locationTypeKey: 'museos-profesional',
    lat: 40.4082, lng: -3.694,
  },
  {
    id: 7,
    name: 'Jam Session – La Riviera',
    description: 'Jam session abierta de jazz. Trae tu instrumento. Miércoles 21 h.',
    locationTypeKey: 'musica-quedadas',
    lat: 40.4065, lng: -3.712,
  },
  {
    id: 8,
    name: 'Cena de amigos – Malasaña',
    description: 'Quedada gastronómica del grupo "Foodies Madrid". Viernes a las 21 h.',
    locationTypeKey: 'restaurantes-quedadas',
    lat: 40.426, lng: -3.708,
  },
  {
    id: 9,
    name: 'Taberna El Botín',
    description: 'El restaurante más antiguo del mundo según el Guinness. Asados tradicionales.',
    locationTypeKey: 'restaurantes-profesional',
    lat: 40.4145, lng: -3.7074,
  },
  {
    id: 10,
    name: 'Ruta La Pedriza – domingo',
    description: 'Senderismo por La Pedriza. Salida desde Manzanares el Real a las 9 h.',
    locationTypeKey: 'senderismo-quedadas',
    lat: 40.611, lng: -3.865,
  },
  {
    id: 11,
    name: 'Decathlon Alcobendas',
    description: 'Gran superficie deportiva con sección especializada en montaña y senderismo.',
    locationTypeKey: 'senderismo-profesional',
    lat: 40.534, lng: -3.642,
  },
  {
    id: 12,
    name: 'Pícnic en Casa de Campo',
    description: 'Quedada familiar en el pinar. Sábado 12 h. Bring your own food!',
    locationTypeKey: 'parques-quedadas',
    lat: 40.408, lng: -3.745,
  },
];

@Injectable({ providedIn: 'root' })
export class LocationService {
  private readonly categoryService = inject(CategoryService);

  getAll(): Observable<MapLocation[]> {
    return this.categoryService.getAll().pipe(
      map(tree => this.resolveSeeds(tree)),
      delay(600)
    );
  }

  getByLocationType(locationTypeId: number): Observable<MapLocation[]> {
    return this.getAll().pipe(
      map(locations => locations.filter(l => l.locationTypeId === locationTypeId))
    );
  }

  getById(id: number): Observable<MapLocation | undefined> {
    return this.getAll().pipe(
      map(locations => locations.find(l => l.id === id))
    );
  }

  private resolveSeeds(tree: MainCategory[]): MapLocation[] {
    const typeIdByKey = this.buildTypeIndex(tree);
    const resolved: MapLocation[] = [];

    for (const seed of MOCK_LOCATION_SEEDS) {
      const resolvedTypeId = typeIdByKey.get(seed.locationTypeKey);
      if (!resolvedTypeId) {
        continue;
      }

      resolved.push({
        id: seed.id,
        name: seed.name,
        description: seed.description,
        locationTypeId: resolvedTypeId,
        lat: seed.lat,
        lng: seed.lng,
      });
    }

    return resolved;
  }

  private buildTypeIndex(tree: MainCategory[]): Map<string, number> {
    const index = new Map<string, number>();
    for (const main of tree) {
      for (const sub of main.subcategories) {
        const subSlug = this.slugify(sub.name);

        for (const type of sub.locationTypes) {
          const typeSlug = this.slugify(type.name);
          index.set(subSlug + '-' + typeSlug, type.id);
        }
      }
    }

    return index;
  }

  private slugify(input: string): string {
    return input
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/&/g, 'y')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }
}