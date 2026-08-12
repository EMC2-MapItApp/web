/**
 * @file feedback.service.ts
 * @description Envío de feedback (bug/sugerencia/otro) del usuario actual al equipo de
 * desarrollo, contra `POST /api/v1/feedback` (ver FeedbackController/FeedbackService en el
 * backend). Requiere sesión; el remitente lo resuelve el backend a partir del JWT, no se envía
 * en el body.
 */
import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '@env/environment';

export type FeedbackCategory = 'BUG' | 'SUGGESTION' | 'OTHER';

export interface SendFeedbackRequest {
  category: FeedbackCategory;
  subject: string;
  message: string;
}

@Injectable({ providedIn: 'root' })
export class FeedbackService {

  private readonly http = inject(HttpClient);
  private readonly baseUrl = environment.apiFeedbackUrl;

  send(request: SendFeedbackRequest): Observable<void> {
    return this.http.post<void>(this.baseUrl, request);
  }
}
