/**
 * @file publication.service.ts
 * @description Servicio HTTP para crear, consultar y eliminar publicaciones persistidas.
 */
import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { EnrolledUser, Publication, PublicationCreateRequest, PublicationEnrollmentResponse, PublicationVisibility } from '../models/publication.model';
import { GroupJoinRequest, GroupJoinRequestStatus } from '../models/group.model';
import { environment } from '@env/environment';
import { CurrentUserService } from './current-user.service';

/** Forma de la API para `POST /publications/{id}/access-requests` — ver `emc.mapIt.groups.GroupJoinRequestResponse`. */
interface ApiGroupJoinRequest {
  id: string;
  groupId: string;
  groupName: string;
  requestedByUserId: string;
  requestedByName: string;
  requestedByNick: string;
  publicationId: string | null;
  status: 'PENDING' | 'ACCEPTED' | 'REJECTED';
  createdAt: string;
  respondedAt: string | null;
}

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

    /**
     * Solicita acceso al grupo de una publicación privada, para poder apuntarse después. Crea una
     * {@link GroupJoinRequest} que el organizador del grupo debe aceptar o rechazar (ver
     * `GroupService.getGroupPendingJoinRequests`/`acceptJoinRequest`/`rejectJoinRequest`).
     */
    requestAccess(id: number): Observable<GroupJoinRequest> {
        return this.http.post<ApiGroupJoinRequest>(`${this.baseUrl}/${id}/access-requests`, {}).pipe(
            map(api => ({
                id: api.id,
                groupId: api.groupId,
                groupName: api.groupName,
                requestedByUserId: api.requestedByUserId,
                requestedByName: api.requestedByName,
                requestedByNick: api.requestedByNick,
                publicationId: api.publicationId,
                status: api.status.toLowerCase() as GroupJoinRequestStatus,
                createdAt: api.createdAt,
                respondedAt: api.respondedAt ?? undefined,
            }))
        );
    }

    /**
     * Cambia la visibilidad de una publicación existente. `PRIVATE_GROUP → PUBLIC` siempre está
     * permitido; `→ PRIVATE_GROUP` puede rechazarse (409 `FOREIGN_ENROLLMENTS`) si hay apuntados
     * que no son miembros del grupo destino.
     */
    changeVisibility(id: number, visibility: PublicationVisibility, groupId: string | null): Observable<Publication> {
        return this.http.patch<Publication>(`${this.baseUrl}/${id}/visibility`, { visibility, groupId });
    }
}
