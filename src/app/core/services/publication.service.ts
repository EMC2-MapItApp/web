/**
 * @file publication.service.ts
 * @description Servicio HTTP para crear, consultar y eliminar publicaciones persistidas.
 */
import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import {
  EnrolledUser,
  Publication,
  PublicationAccessRequest,
  PublicationAccessRequestStatus,
  PublicationCreateRequest,
  PublicationEnrollmentResponse,
  PublicationVisibility,
} from '../models/publication.model';
import { environment } from '@env/environment';
import { CurrentUserService } from './current-user.service';

/** Forma de la API para `emc.mapIt.dto.PublicationAccessRequestResponse`. */
interface ApiPublicationAccessRequest {
  id: string;
  publicationId: string;
  publicationTitle: string;
  requestedByUserId: string;
  requestedByName: string;
  requestedByNick: string;
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
  remove(id: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${id}`);
  }

  /**
   * Apunta al usuario autenticado a una publicación.
   */
  enroll(id: string): Observable<PublicationEnrollmentResponse> {
    return this.http.post<PublicationEnrollmentResponse>(`${this.baseUrl}/${id}/enroll`, {});
  }

  /**
   * Obtiene la lista de usuarios inscritos en una publicación.
   */
  getEnrollments(id: string): Observable<EnrolledUser[]> {
    return this.http.get<EnrolledUser[]>(`${this.baseUrl}/${id}/enrollments`);
  }

  /**
   * Desapunta al usuario autenticado de una publicación.
   */
  unenroll(id: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${id}/unenroll`);
  }

  /**
   * Solicita apuntarse a una publicación privada de la que no se tiene acceso todavía. La
   * solicitud es de la publicación, no de ningún grupo — la aprueba su autor (ver
   * `getPendingAccessRequests`/`acceptAccessRequest`/`rejectAccessRequest`).
   */
  requestAccess(id: string): Observable<PublicationAccessRequest> {
    return this.http
      .post<ApiPublicationAccessRequest>(`${this.baseUrl}/${id}/access-requests`, {})
      .pipe(map((api) => this.mapAccessRequest(api)));
  }

  /**
   * Lista las solicitudes de acceso pendientes de una publicación propia. Solo el autor (o un
   * ADMIN) puede verlas.
   */
  getPendingAccessRequests(id: string): Observable<PublicationAccessRequest[]> {
    return this.http
      .get<ApiPublicationAccessRequest[]>(`${this.baseUrl}/${id}/access-requests`)
      .pipe(map((list) => list.map((api) => this.mapAccessRequest(api))));
  }

  /** Acepta una solicitud de acceso a una publicación propia. */
  acceptAccessRequest(requestId: string): Observable<PublicationAccessRequest> {
    return this.http
      .post<ApiPublicationAccessRequest>(`${this.baseUrl}/access-requests/${requestId}/accept`, {})
      .pipe(map((api) => this.mapAccessRequest(api)));
  }

  /** Rechaza una solicitud de acceso a una publicación propia. */
  rejectAccessRequest(requestId: string): Observable<PublicationAccessRequest> {
    return this.http
      .post<ApiPublicationAccessRequest>(`${this.baseUrl}/access-requests/${requestId}/reject`, {})
      .pipe(map((api) => this.mapAccessRequest(api)));
  }

  private mapAccessRequest(api: ApiPublicationAccessRequest): PublicationAccessRequest {
    return {
      id: api.id,
      publicationId: api.publicationId,
      publicationTitle: api.publicationTitle,
      requestedByUserId: api.requestedByUserId,
      requestedByName: api.requestedByName,
      requestedByNick: api.requestedByNick,
      status: api.status.toLowerCase() as PublicationAccessRequestStatus,
      createdAt: api.createdAt,
      respondedAt: api.respondedAt ?? undefined,
    };
  }

  /**
   * Cambia la visibilidad de una publicación existente. `PRIVATE → PUBLIC` siempre está
   * permitido; `→ PRIVATE` puede rechazarse (409 `FOREIGN_ENROLLMENTS`) si hay apuntados sin
   * invitación.
   */
  changeVisibility(id: string, visibility: PublicationVisibility): Observable<Publication> {
    return this.http.patch<Publication>(`${this.baseUrl}/${id}/visibility`, { visibility });
  }
}
