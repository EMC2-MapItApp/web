/**
 * @file publication.service.ts
 * @description Store en memoria para publicaciones. Sustituir add() por HttpClient en el futuro.
 */
import { Injectable, inject, signal } from '@angular/core';
import { Publication } from '../models/publication.model';
import { CurrentUserService } from './current-user.service';

@Injectable({ providedIn: 'root' })
export class PublicationService {

  private readonly cu = inject(CurrentUserService);
  private nextId = 1;

  private readonly _publications = signal<Publication[]>([]);
  readonly publications = this._publications.asReadonly();

  add(draft: Omit<Publication, 'id' | 'authorId'>): Publication {
    const user = this.cu.user();
    if (!user) throw new Error('No hay usuario autenticado');
    const pub: Publication = { ...draft, id: this.nextId++, authorId: user.id };
    this._publications.update(list => [...list, pub]);
    return pub;
  }

  remove(id: number): void {
    this._publications.update(list => list.filter(p => p.id !== id));
  }
}
