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
import { CategoryBreadcrumb } from '@core/models/category.model';
import { FieldContext, LocationFieldDef } from '@core/models/location-field.model';
import { LocationFieldService } from '@core/services/location-field.service';
import { CurrentUserService } from '@core/services/current-user.service';
import { EnrolledUser, PublicationVisibility } from '@core/models/publication.model';

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
  /** Solo Publication: plazas ocupadas actuales. Ausente si el backend lo enmascara (no-miembro de una publicación privada). */
  occupiedSlots?: number;
  /** Lista de usuarios inscritos en la publicación. */
  enrolledUsers?: EnrolledUser[];
  /** Solo Publication: visibilidad ('PUBLIC' por defecto si el item no la trae, p. ej. un Place). */
  visibility?: PublicationVisibility;
  /** Solo Publication PRIVATE_GROUP: nombre del grupo. */
  groupName?: string;
  /** Solo Publication PRIVATE_GROUP: nº de miembros del grupo (no es el aforo, ver metadata.slots). */
  groupMemberCount?: number;
  /** Solo Publication PRIVATE_GROUP: true si el usuario actual es miembro del grupo. */
  isGroupMember?: boolean;
  /** Solo Publication PRIVATE_GROUP: true si el usuario actual tiene una solicitud de acceso pendiente. */
  accessRequestPending?: boolean;
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
  private currentUser = inject(CurrentUserService);

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

  /** Notifica al padre que el usuario intenta salir de la publicación. */
  @Output() leaveRequested = new EventEmitter<void>();

  /** Visibilidad de la publicación. 'PUBLIC' para cualquier otro tipo de detalle (p. ej. Place). */
  @Input() visibility: PublicationVisibility = 'PUBLIC';

  /** Nombre del grupo, solo relevante si `visibility === 'PRIVATE_GROUP'`. */
  @Input() groupName?: string;

  /** Nº de miembros del grupo, solo relevante si `visibility === 'PRIVATE_GROUP'`. */
  @Input() groupMemberCount?: number;

  /** true si el usuario actual es miembro del grupo. Solo relevante en publicaciones privadas. */
  @Input() isGroupMember = false;

  /** true si ya hay una solicitud de acceso pendiente del usuario actual para este grupo. */
  @Input() accessRequestPending = false;

  /** Notifica al padre que un no-miembro solicita acceso al grupo de una publicación privada. */
  @Output() joinRequestRequested = new EventEmitter<void>();

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
  /** Niveles de actividad predefinidos */
  readonly ACTIVITY_LEVELS = [
    { label: 'Básico', description: 'Apto para todos', value: 0 },
    { label: 'Iniciado', description: 'Algo de experiencia', value: 3 },
    { label: 'Intermedio', description: 'Bastante experiencia y preparación', value: 5 },
    { label: 'Avanzado', description: 'Alta preparación y experiencia', value: 7 },
    { label: 'Experto', description: 'Máximo nivel', value: 10 },
  ];

  normalizeLevel(level: number | undefined): string {
    if (level === undefined || level === null) return '–';
    if (level <= 0) return 'Ninguno';

    if (level == 0 || level == 1) return 'Básico';
    if (level == 2 || level == 3) return 'Iniciado';
    if (level == 4 || level == 5) return 'Intermedio';
    if (level == 6 || level == 7) return 'Avanzado';
    if (level == 8 || level == 9 || level == 10) return 'Experto';


    return level.toString();
  }

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

  /** Verifica si el userId corresponde al usuario autenticado actual. */
  isCurrentUser(userId: string): boolean {
    const currentUserId = this.currentUser.user()?.id?.toString();
    return currentUserId === userId;
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

  /** true si el detalle tiene una captura de mapa de ruta asociada. */
  get hasRouteCapture(): boolean {
    return !!this.item.metadata?.['routeMapCapture'];
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

  /** true si la publicación es privada de grupo. */
  get isPrivateGroup(): boolean {
    return this.visibility === 'PRIVATE_GROUP';
  }

  /** true si es una publicación privada y el usuario actual no pertenece al grupo. */
  get isPrivateNonMember(): boolean {
    return this.isPrivateGroup && !this.isGroupMember;
  }

  /** true si el botón de apuntarse/solicitar debe estar deshabilitado. */
  get joinDisabled(): boolean {
    if (this.isPrivateNonMember) return this.accessRequestPending;
    return this.isFull || this.alreadyJoined;
  }

  /** Etiqueta contextual del botón según estado de inscripción/solicitud. */
  get joinButtonText(): string {
    if (this.isPrivateNonMember) {
      return this.accessRequestPending ? 'Solicitud enviada' : 'Solicitar invitación';
    }
    if (this.alreadyJoined) return 'Ya apuntado';
    if (this.isFull) return 'Plazas completas';
    return 'Apuntarse';
  }

  /** Solicita el alta en el evento/localización, o el acceso al grupo si no es miembro. */
  onJoin(): void {
    if (this.joinDisabled) return;
    if (this.isPrivateNonMember) {
      this.joinRequestRequested.emit();
      return;
    }
    this.joinRequested.emit();
  }

  /** Solicita salir del evento. */
  onLeave(): void {
    this.leaveRequested.emit();
  }
}
