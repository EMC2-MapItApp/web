/**
 * @file location.service.ts
 * @description Servicio HTTP que expone las localizaciones geográficas que se
 * pintan en el mapa.
 *
 * La fuente real de datos ahora es la API de publicaciones persistidas.
 * El mock anterior se mantiene únicamente como referencia comentada.
 */
import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { environment } from '../../../environments/environment';
import { MapLocation } from '../models/location.model';
import { Publication } from '../models/publication.model';

/*
 * Legacy mock seed data kept as reference only.
 * No se usa en runtime; el mapa consume datos reales desde backend.
 *
 * interface MockLocationSeed {
 *   id: number;
 *   name: string;
 *   description?: string;
 *   locationTypeKey: string;
 *   lat: number;
 *   lng: number;
 * }
 *
 * const MOCK_LOCATION_SEEDS: MockLocationSeed[] = [
 *   ...
 * ];
 */

/**
 * Servicio para resolver las localizaciones visibles en el mapa.
 *
 * @remarks
 * El backend devuelve publicaciones persistidas, y este servicio las convierte
 * a la forma mínima que consume la capa de mapas.
 */
@Injectable({ providedIn: 'root' })
export class LocationService {
    /** Cliente HTTP para consultas a la API. */
    private readonly http = inject(HttpClient);

    /** Endpoint base de publicaciones. */
    private readonly baseUrl = environment.apiPublicationsUrl;

    /**
     * Recupera todas las localizaciones activas del mapa.
     *
     * @returns Observable con una lista de localizaciones listas para pintar.
     */
    getAll(): Observable<MapLocation[]> {
        return this.http.get<Publication[]>(`${this.baseUrl}?activeOnly=true`).pipe(
            map(publications => this.toMapLocations(publications))
        );
    }

    /**
     * Recupera las localizaciones que pertenecen a un tipo concreto.
     *
     * @param locationTypeId id numérico del LocationType
     * @returns Observable con las localizaciones filtradas por tipo
     */
    getByLocationType(locationTypeId: number): Observable<MapLocation[]> {
        return this.getAll().pipe(
            map(locations => locations.filter(location => location.locationTypeId === locationTypeId))
        );
    }

    /**
     * Recupera una localización concreta por identificador.
     *
     * @param id id de la localización
     * @returns Observable con la localización encontrada o undefined
     */
    getById(id: number): Observable<MapLocation | undefined> {
        return this.getAll().pipe(
            map(locations => locations.find(location => location.id === id))
        );
    }

    /**
     * Convierte las publicaciones persistidas a localizaciones de mapa.
     *
     * @param publications lista de publicaciones devuelta por backend
     * @returns lista de localizaciones consumibles por el mapa
     */
    private toMapLocations(publications: Publication[]): MapLocation[] {
        return publications
            .filter(publication => publication.lat !== null && publication.lng !== null)
            .map(publication => ({
                id: publication.id,
                name: publication.title,
                description: publication.description,
                locationTypeId: publication.locationTypeId,
                lat: publication.lat as number,
                lng: publication.lng as number,
                metadata: publication.metadata,
                publicationType: publication.publicationType,
                startDate: publication.startDate,
                endDate: publication.endDate,
                requiredLevel: publication.requiredLevel,
                occupiedSlots: publication.occupiedSlots,
                active: publication.active,
            }));
    }
}
