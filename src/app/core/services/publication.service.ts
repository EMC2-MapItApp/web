/**
 * @file publication.service.ts
 * @description Servicio HTTP para crear, consultar y eliminar publicaciones persistidas.
 */
import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { EnrolledUser, Publication, PublicationCreateRequest, PublicationEnrollmentResponse } from '../models/publication.model';
import { environment } from '@env/environment';
import { CurrentUserService } from './current-user.service';

@Injectable({ providedIn: 'root' })
export class PublicationService {

    private readonly http = inject(HttpClient);
    private readonly cu = inject(CurrentUserService);
    private readonly baseUrl = environment.apiPublicationsUrl;
    private readonly usersBaseUrl = environment.apiUsersUrl;

    /**
     * Crea una publicación persistida.
     */
    add(draft: PublicationCreateRequest): Observable<Publication> {
        return this.http.post<Publication>(this.baseUrl, draft);
    }

    /**
     * Recupera una publicación por su identificador.
     *
     * El id es el ObjectId de Mongo (string), no un número.
     */
    getById(id: string): Observable<Publication> {
        return this.http.get<Publication>(`${this.baseUrl}/${id}`);
    }

    /**
     * Recupera las publicaciones del usuario autenticado.
     *
     * @param activeOnly si true, filtra solo publicaciones activas
     */
    getMine(activeOnly: boolean): Observable<Publication[]> {
        const userId = this.cu.user()?.id;
        if (!userId) {
            throw new Error('No hay usuario autenticado');
        }

        return this.http.get<Publication[]>(`${this.usersBaseUrl}/${userId}/publications`, {
            params: { activeOnly: String(activeOnly) },
        });
    }

    /**
     * Elimina definitivamente una publicación.
     */
    remove(id: number): Observable<void> {
        return this.http.delete<void>(`${this.baseUrl}/${id}`);
    }

    /**
     * Apunta al usuario autenticado a una publicación.
     */
    enroll(id: number): Observable<PublicationEnrollmentResponse> {
        return this.http.post<PublicationEnrollmentResponse>(`${this.baseUrl}/${id}/enroll`, {});
    }

    /**
 * Obtiene la lista de usuarios inscritos en una publicación.
 */
    getEnrollments(id: number): Observable<EnrolledUser[]> {
        return this.http.get<EnrolledUser[]>(`${this.baseUrl}/${id}/enrollments`);
    }

    /**
 * Desapunta al usuario autenticado de una publicación.
 */
    unenroll(id: number): Observable<void> {
        return this.http.delete<void>(`${this.baseUrl}/${id}/unenroll`);
    }
}
