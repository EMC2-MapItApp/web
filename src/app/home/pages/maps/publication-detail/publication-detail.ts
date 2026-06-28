/**
 * @file publication-detail.ts
 * @description Panel de detalle de una localización seleccionada en el mapa.
 *
 * Renderiza:
 *  1. Campos universales: nombre, breadcrumb, descripción.
 *  2. Campos dinámicos de Place.metadata o Publication.metadata
 *     según el schema registrado en LocationFieldService.
 *
 * El componente es agnóstico al tipo concreto: recibe un objeto genérico
 * con la forma mínima necesaria y delega el schema al servicio.
 */
import { Component, EventEmitter, Input, OnChanges, Output, inject } from '@angular/core';
import { CategoryBreadcrumb } from '../../../../core/models/category.model';
import { FieldContext, LocationFieldDef } from '../../../../core/models/location-field.model';
import { LocationFieldService } from '../../../../core/services/location-field.service';

/**
 * Forma mínima del objeto que recibe el componente.
 * Compatible con MapLocation (legacy), Place y Publication.
 */
export interface PublicationDetailInput {
  id: number;
  name: string;
  description?: string;
  locationTypeId: number;
  metadata?: Record<string, unknown>;
  /** Solo Publication: tipo de publicación. */
  publicationType?: 'event' | 'promotion';
  /** Solo Publication: fecha de inicio. */
  startDate?: string;
  /** Solo Publication: fecha de fin. */
  endDate?: string | null;
  /** Solo Publication: nivel mínimo requerido. */
  requiredLevel?: number;
  /** Solo Publication: flag de activo persistido en backend. */
  active?: boolean;
  /** Solo Publication: plazas ocupadas actuales. */
  occupiedSlots?: number;
}

@Component({
  selector: 'app-publication-detail',
  standalone: true,
  imports: [],
  templateUrl: './publication-detail.html',
  styleUrl: './publication-detail.scss',
})
export class PublicationDetailComponent implements OnChanges {

  private fieldService = inject(LocationFieldService);

  /** Datos de la localización a mostrar. */
  @Input() item!: PublicationDetailInput;

  /** Breadcrumb resuelto desde CategoryService. */
  @Input() breadcrumb!: CategoryBreadcrumb;

  /** Número actual de usuarios apuntados en este detalle. */
  @Input() joinedCount = 0;

  /** Indica si el usuario actual ya se apuntó a esta localización. */
  @Input() alreadyJoined = false;

  /** Notifica al padre que el usuario intenta apuntarse. */
  @Output() joinRequested = new EventEmitter<void>();

  /**
   * Contexto que determina qué schema de campos se carga.
   * 'place' | 'promotion' | 'event'
   */
  @Input() context: FieldContext = 'place';

  /** Campos dinámicos resueltos para el item actual. */
  fields: LocationFieldDef[] = [];

  ngOnChanges(): void {
    this.fields = this.fieldService.getFields(this.item.locationTypeId, this.context);
  }

  // ── Helpers de template ───────────────────────────────────────────────────

  getValue(key: string): unknown {
    return this.item.metadata?.[key];
  }

  hasValue(key: string): boolean {
    const v = this.getValue(key);
    return v !== null && v !== undefined && v !== '';
  }

  formatDate(value: unknown): string {
    if (!value) return '–';
    const d = new Date(value as string);
    return d.toLocaleString('es-ES', { dateStyle: 'medium', timeStyle: 'short' });
  }

  formatDateOnly(value: unknown): string {
    if (!value) return '–';
    const d = new Date(value as string);
    return d.toLocaleDateString('es-ES', { dateStyle: 'medium' });
  }

  /** Color de acento heredado de la MainCategory. */
  get accentColor(): string {
    return this.breadcrumb.mainCategory.color;
  }

  /** true si la publicación tiene fecha y aún está activa. */
  get isActive(): boolean {
    if (typeof this.item.active === 'boolean') return this.item.active;
    if (!this.item.endDate) return true;
    return new Date(this.item.endDate) >= new Date();
  }

  /** true si el detalle tiene fechas (es una Publication). */
  get hasDateRange(): boolean {
    return !!this.item.startDate;
  }

  /** true si requiere nivel > 0. */
  get hasLevelRequirement(): boolean {
    return (this.item.requiredLevel ?? 0) > 0;
  }

  /** Máximo de plazas configurado (metadata.slots). null si no existe límite. */
  get maxSlots(): number | null {
    const raw = this.item.metadata?.['slots'];
    if (typeof raw !== 'number' || !Number.isFinite(raw) || raw <= 0) return null;
    return Math.floor(raw);
  }

  /** true si existe límite de plazas para este detalle. */
  get hasCapacityLimit(): boolean {
    return this.maxSlots !== null;
  }

  /** true cuando todas las plazas disponibles están ocupadas. */
  get isFull(): boolean {
    if (this.maxSlots === null) return false;
    return this.joinedCount >= this.maxSlots;
  }

  /** true si el botón de apuntarse debe estar deshabilitado. */
  get joinDisabled(): boolean {
    return this.isFull || this.alreadyJoined;
  }

  /** Etiqueta contextual del botón según estado de inscripción. */
  get joinButtonText(): string {
    if (this.alreadyJoined) return 'Ya apuntado';
    if (this.isFull) return 'Plazas completas';
    return 'Apuntarse';
  }

  /** Solicita el alta en el evento/localización. */
  onJoin(): void {
    if (this.joinDisabled) return;
    this.joinRequested.emit();
  }
}
