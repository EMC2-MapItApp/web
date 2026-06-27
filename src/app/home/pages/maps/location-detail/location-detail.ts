/**
 * @file location-detail.ts
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
import { Component, Input, OnChanges, inject } from '@angular/core';
import { CategoryBreadcrumb } from '../../../../core/models/category.model';
import { FieldContext, LocationFieldDef } from '../../../../core/models/location-field.model';
import { LocationFieldService } from '../../../../core/services/location-field.service';

/**
 * Forma mínima del objeto que recibe el componente.
 * Compatible con MapLocation (legacy), Place y Publication.
 */
export interface DetailInput {
  name: string;
  description?: string;
  locationTypeId: number;
  metadata?: Record<string, unknown>;
  /** Solo Publication: fecha de inicio. */
  startDate?: string;
  /** Solo Publication: fecha de fin. */
  endDate?: string | null;
  /** Solo Publication: nivel mínimo requerido. */
  requiredLevel?: number;
}

@Component({
  selector: 'app-location-detail',
  standalone: true,
  imports: [],
  templateUrl: './location-detail.html',
  styleUrl: './location-detail.scss',
})
export class LocationDetailComponent implements OnChanges {

  private fieldService = inject(LocationFieldService);

  /** Datos de la localización a mostrar. */
  @Input() item!: DetailInput;

  /** Breadcrumb resuelto desde CategoryService. */
  @Input() breadcrumb!: CategoryBreadcrumb;

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
}
