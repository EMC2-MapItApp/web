/**
 * @file location-field.service.ts
 * @description Registry de schemas de campos dinámicos para Place y Publication.
 *
 * La clave interna del registry es `locationTypeId::context`.
 *
 * Para añadir campos a una categoría nueva o existente:
 *   - Añade una entrada en FIELD_SCHEMAS con el locationTypeId y context.
 *   - No hay que tocar ningún componente.
 *
 * Campos universales (name, description, address, startDate, endDate…)
 * los renderiza directamente el componente location-detail sin pasar por aquí.
 * Este servicio solo gestiona los campos de `metadata`.
 */
import { Injectable, inject } from '@angular/core';
import { FieldContext, LocationFieldDef } from '../models/location-field.model';
import { CategoryService } from './category.service';

interface LegacyLocationFieldSchema {
  locationTypeId: string;
  context: FieldContext;
  fields: LocationFieldDef[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Constantes de badge compartidas
// ─────────────────────────────────────────────────────────────────────────────

const DIFFICULTY_COLORS: Record<string, string> = {
  'Fácil':   '#10b981',
  'Medio':   '#f59e0b',
  'Difícil': '#ef4444',
};

// ─────────────────────────────────────────────────────────────────────────────
// Registry de schemas
// ─────────────────────────────────────────────────────────────────────────────

const FIELD_SCHEMAS: LegacyLocationFieldSchema[] = [

  // ── DEPORTES / CICLISMO ───────────────────────────────────────────────────

  {
    locationTypeId: 'ciclismo-profesional',
    context: 'place',
    fields: [
      { key: 'address',  label: 'Dirección',  type: 'text' },
      { key: 'schedule', label: 'Horario',    type: 'text' },
      { key: 'phone',    label: 'Teléfono',   type: 'phone' },
      { key: 'web',      label: 'Web',        type: 'url' },
      { key: 'services', label: 'Servicios',  type: 'text' },
    ],
  },
  {
    locationTypeId: 'ciclismo-profesional',
    context: 'promotion',
    fields: [
      { key: 'discountCode',    label: 'Código',     type: 'code' },
      { key: 'discountPercent', label: 'Descuento',  type: 'number', unit: '%' },
      { key: 'conditions',      label: 'Condiciones',type: 'text' },
      { key: 'maxUses',         label: 'Usos máx.',  type: 'number', unit: 'usos' },
    ],
  },
  {
    locationTypeId: 'ciclismo-quedadas',
    context: 'event',
    fields: [
      { key: 'distance',  label: 'Distancia',     type: 'number', unit: 'km' },
      { key: 'elevation', label: 'Desnivel',      type: 'number', unit: 'm' },
      { key: 'level',     label: 'Nivel',         type: 'badge', badgeColors: DIFFICULTY_COLORS },
      { key: 'slots',     label: 'Plazas libres', type: 'number', unit: 'plazas' },
      { key: 'contact',   label: 'Contacto',      type: 'phone' },
    ],
  },

  // ── DEPORTES / RUNNING ────────────────────────────────────────────────────

  {
    locationTypeId: 'running-profesional',
    context: 'place',
    fields: [
      { key: 'address',  label: 'Dirección', type: 'text' },
      { key: 'schedule', label: 'Horario',   type: 'text' },
      { key: 'phone',    label: 'Teléfono',  type: 'phone' },
      { key: 'web',      label: 'Web',       type: 'url' },
    ],
  },
  {
    locationTypeId: 'running-profesional',
    context: 'promotion',
    fields: [
      { key: 'discountCode',    label: 'Código',     type: 'code' },
      { key: 'discountPercent', label: 'Descuento',  type: 'number', unit: '%' },
      { key: 'conditions',      label: 'Condiciones',type: 'text' },
    ],
  },
  {
    locationTypeId: 'running-quedadas',
    context: 'event',
    fields: [
      { key: 'distance', label: 'Distancia',     type: 'number', unit: 'km' },
      { key: 'level',    label: 'Nivel',         type: 'badge', badgeColors: DIFFICULTY_COLORS },
      { key: 'slots',    label: 'Plazas libres', type: 'number', unit: 'plazas' },
      { key: 'contact',  label: 'Contacto',      type: 'phone' },
    ],
  },

  // ── DEPORTES / FÚTBOL ─────────────────────────────────────────────────────

  {
    locationTypeId: 'futbol-quedadas',
    context: 'event',
    fields: [
      { key: 'slots',   label: 'Jugadores que faltan', type: 'number', unit: 'jugadores' },
      { key: 'contact', label: 'Contacto',             type: 'phone' },
    ],
  },

  // ── DEPORTES / NATACIÓN ───────────────────────────────────────────────────

  {
    locationTypeId: 'natacion-profesional',
    context: 'place',
    fields: [
      { key: 'address',  label: 'Dirección', type: 'text' },
      { key: 'schedule', label: 'Horario',   type: 'text' },
      { key: 'phone',    label: 'Teléfono',  type: 'phone' },
      { key: 'web',      label: 'Web',       type: 'url' },
      { key: 'lanePrice',label: 'Precio/sesión', type: 'number', unit: '€' },
    ],
  },
  {
    locationTypeId: 'natacion-quedadas',
    context: 'event',
    fields: [
      { key: 'slots',   label: 'Plazas libres', type: 'number', unit: 'plazas' },
      { key: 'contact', label: 'Contacto',      type: 'phone' },
    ],
  },

  // ── CULTURA / MUSEOS ──────────────────────────────────────────────────────

  {
    locationTypeId: 'museos-visita',
    context: 'place',
    fields: [
      { key: 'address',      label: 'Dirección',        type: 'text' },
      { key: 'schedule',     label: 'Horario',          type: 'text' },
      { key: 'phone',        label: 'Teléfono',         type: 'phone' },
      { key: 'web',          label: 'Web',              type: 'url' },
      { key: 'admissionFee', label: 'Entrada',          type: 'number', unit: '€' },
      { key: 'free',         label: 'Entrada gratuita', type: 'boolean' },
    ],
  },
  {
    locationTypeId: 'museos-visita',
    context: 'event',
    fields: [
      { key: 'slots',           label: 'Plazas',        type: 'number', unit: 'plazas' },
      { key: 'price',           label: 'Precio',        type: 'number', unit: '€' },
      { key: 'registrationUrl', label: 'Inscripción',   type: 'url' },
    ],
  },
  {
    locationTypeId: 'museos-profesional',
    context: 'place',
    fields: [
      { key: 'address',  label: 'Dirección', type: 'text' },
      { key: 'schedule', label: 'Horario',   type: 'text' },
      { key: 'phone',    label: 'Teléfono',  type: 'phone' },
      { key: 'web',      label: 'Web',       type: 'url' },
    ],
  },
  {
    locationTypeId: 'museos-profesional',
    context: 'event',
    fields: [
      { key: 'slots',           label: 'Plazas',      type: 'number', unit: 'plazas' },
      { key: 'price',           label: 'Precio',      type: 'number', unit: '€' },
      { key: 'registrationUrl', label: 'Inscripción', type: 'url' },
    ],
  },

  // ── CULTURA / MÚSICA ──────────────────────────────────────────────────────

  {
    locationTypeId: 'musica-profesional',
    context: 'place',
    fields: [
      { key: 'address',  label: 'Dirección', type: 'text' },
      { key: 'schedule', label: 'Horario',   type: 'text' },
      { key: 'phone',    label: 'Teléfono',  type: 'phone' },
      { key: 'web',      label: 'Web',       type: 'url' },
    ],
  },
  {
    locationTypeId: 'musica-quedadas',
    context: 'event',
    fields: [
      { key: 'slots',    label: 'Plazas libres', type: 'number', unit: 'plazas' },
      { key: 'price',    label: 'Precio',        type: 'number', unit: '€' },
      { key: 'contact',  label: 'Contacto',      type: 'phone' },
    ],
  },

  // ── CULTURA / TEATRO ──────────────────────────────────────────────────────

  {
    locationTypeId: 'teatro-profesional',
    context: 'place',
    fields: [
      { key: 'address',  label: 'Dirección', type: 'text' },
      { key: 'schedule', label: 'Horario',   type: 'text' },
      { key: 'phone',    label: 'Teléfono',  type: 'phone' },
      { key: 'web',      label: 'Web',       type: 'url' },
    ],
  },
  {
    locationTypeId: 'teatro-quedadas',
    context: 'event',
    fields: [
      { key: 'slots',   label: 'Plazas libres', type: 'number', unit: 'plazas' },
      { key: 'price',   label: 'Precio',        type: 'number', unit: '€' },
      { key: 'contact', label: 'Contacto',      type: 'phone' },
    ],
  },

  // ── GASTRONOMÍA / RESTAURANTES ────────────────────────────────────────────

  {
    locationTypeId: 'restaurantes-profesional',
    context: 'place',
    fields: [
      { key: 'address',  label: 'Dirección',    type: 'text' },
      { key: 'schedule', label: 'Horario',      type: 'text' },
      { key: 'phone',    label: 'Teléfono',     type: 'phone' },
      { key: 'web',      label: 'Web',          type: 'url' },
      { key: 'avgPrice', label: 'Precio medio', type: 'number', unit: '€' },
      { key: 'cuisine',  label: 'Cocina',       type: 'text' },
      { key: 'booking',  label: 'Reservas',     type: 'boolean' },
    ],
  },
  {
    locationTypeId: 'restaurantes-profesional',
    context: 'promotion',
    fields: [
      { key: 'discountCode',    label: 'Código',     type: 'code' },
      { key: 'discountPercent', label: 'Descuento',  type: 'number', unit: '%' },
      { key: 'conditions',      label: 'Condiciones',type: 'text' },
    ],
  },
  {
    locationTypeId: 'restaurantes-quedadas',
    context: 'event',
    fields: [
      { key: 'slots',    label: 'Plazas libres', type: 'number', unit: 'plazas' },
      { key: 'avgPrice', label: 'Precio aprox.', type: 'number', unit: '€/persona' },
      { key: 'contact',  label: 'Contacto',      type: 'phone' },
    ],
  },

  // ── GASTRONOMÍA / BARES ───────────────────────────────────────────────────

  {
    locationTypeId: 'bares-profesional',
    context: 'place',
    fields: [
      { key: 'address',  label: 'Dirección', type: 'text' },
      { key: 'schedule', label: 'Horario',   type: 'text' },
      { key: 'phone',    label: 'Teléfono',  type: 'phone' },
      { key: 'web',      label: 'Web',       type: 'url' },
    ],
  },
  {
    locationTypeId: 'bares-profesional',
    context: 'promotion',
    fields: [
      { key: 'discountCode',    label: 'Código',     type: 'code' },
      { key: 'discountPercent', label: 'Descuento',  type: 'number', unit: '%' },
      { key: 'conditions',      label: 'Condiciones',type: 'text' },
    ],
  },
  {
    locationTypeId: 'bares-quedadas',
    context: 'event',
    fields: [
      { key: 'slots',   label: 'Plazas libres', type: 'number', unit: 'plazas' },
      { key: 'contact', label: 'Contacto',      type: 'phone' },
    ],
  },

  // ── NATURALEZA / SENDERISMO ───────────────────────────────────────────────

  {
    locationTypeId: 'senderismo-profesional',
    context: 'place',
    fields: [
      { key: 'address',  label: 'Dirección', type: 'text' },
      { key: 'schedule', label: 'Horario',   type: 'text' },
      { key: 'phone',    label: 'Teléfono',  type: 'phone' },
      { key: 'web',      label: 'Web',       type: 'url' },
    ],
  },
  {
    locationTypeId: 'senderismo-quedadas',
    context: 'event',
    fields: [
      { key: 'distance',  label: 'Distancia',  type: 'number', unit: 'km' },
      { key: 'elevation', label: 'Desnivel',   type: 'number', unit: 'm' },
      { key: 'level',     label: 'Dificultad', type: 'badge', badgeColors: DIFFICULTY_COLORS },
      { key: 'slots',     label: 'Plazas libres', type: 'number', unit: 'plazas' },
      { key: 'contact',   label: 'Contacto',   type: 'phone' },
    ],
  },

  // ── NATURALEZA / PLAYAS ───────────────────────────────────────────────────

  {
    locationTypeId: 'playas-profesional',
    context: 'place',
    fields: [
      { key: 'address',  label: 'Dirección', type: 'text' },
      { key: 'schedule', label: 'Horario',   type: 'text' },
      { key: 'phone',    label: 'Teléfono',  type: 'phone' },
      { key: 'web',      label: 'Web',       type: 'url' },
    ],
  },
  {
    locationTypeId: 'playas-quedadas',
    context: 'event',
    fields: [
      { key: 'slots',   label: 'Plazas libres', type: 'number', unit: 'plazas' },
      { key: 'contact', label: 'Contacto',      type: 'phone' },
    ],
  },

  // ── NATURALEZA / PARQUES ──────────────────────────────────────────────────

  {
    locationTypeId: 'parques-quedadas',
    context: 'event',
    fields: [
      { key: 'slots',   label: 'Plazas libres', type: 'number', unit: 'personas' },
      { key: 'contact', label: 'Contacto',      type: 'phone' },
    ],
  },

  // ── TECNOLOGÍA / GAMING ───────────────────────────────────────────────────

  {
    locationTypeId: 'gaming-profesional',
    context: 'place',
    fields: [
      { key: 'address',  label: 'Dirección', type: 'text' },
      { key: 'schedule', label: 'Horario',   type: 'text' },
      { key: 'phone',    label: 'Teléfono',  type: 'phone' },
      { key: 'web',      label: 'Web',       type: 'url' },
    ],
  },
  {
    locationTypeId: 'gaming-profesional',
    context: 'promotion',
    fields: [
      { key: 'discountCode',    label: 'Código',     type: 'code' },
      { key: 'discountPercent', label: 'Descuento',  type: 'number', unit: '%' },
      { key: 'conditions',      label: 'Condiciones',type: 'text' },
    ],
  },
  {
    locationTypeId: 'gaming-quedadas',
    context: 'event',
    fields: [
      { key: 'slots',    label: 'Plazas libres', type: 'number', unit: 'plazas' },
      { key: 'price',    label: 'Precio',        type: 'number', unit: '€' },
      { key: 'isOnline', label: 'Online',        type: 'boolean' },
      { key: 'contact',  label: 'Contacto',      type: 'phone' },
    ],
  },

  // ── TECNOLOGÍA / MAKER ────────────────────────────────────────────────────

  {
    locationTypeId: 'maker-profesional',
    context: 'place',
    fields: [
      { key: 'address',  label: 'Dirección', type: 'text' },
      { key: 'schedule', label: 'Horario',   type: 'text' },
      { key: 'phone',    label: 'Teléfono',  type: 'phone' },
      { key: 'web',      label: 'Web',       type: 'url' },
    ],
  },
  {
    locationTypeId: 'maker-quedadas',
    context: 'event',
    fields: [
      { key: 'slots',    label: 'Plazas libres', type: 'number', unit: 'plazas' },
      { key: 'price',    label: 'Precio',        type: 'number', unit: '€' },
      { key: 'isOnline', label: 'Online',        type: 'boolean' },
      { key: 'contact',  label: 'Contacto',      type: 'phone' },
    ],
  },

  // ── EDUCACIÓN / IDIOMAS ───────────────────────────────────────────────────

  {
    locationTypeId: 'idiomas-profesional',
    context: 'place',
    fields: [
      { key: 'address',  label: 'Dirección', type: 'text' },
      { key: 'schedule', label: 'Horario',   type: 'text' },
      { key: 'phone',    label: 'Teléfono',  type: 'phone' },
      { key: 'web',      label: 'Web',       type: 'url' },
    ],
  },
  {
    locationTypeId: 'idiomas-profesional',
    context: 'promotion',
    fields: [
      { key: 'discountCode',    label: 'Código',     type: 'code' },
      { key: 'discountPercent', label: 'Descuento',  type: 'number', unit: '%' },
      { key: 'conditions',      label: 'Condiciones',type: 'text' },
    ],
  },
  {
    locationTypeId: 'idiomas-quedadas',
    context: 'event',
    fields: [
      { key: 'language', label: 'Idioma',        type: 'text' },
      { key: 'level',    label: 'Nivel',         type: 'badge',
        badgeColors: { 'A1': '#10b981', 'A2': '#34d399', 'B1': '#f59e0b',
                       'B2': '#f97316', 'C1': '#ef4444', 'C2': '#7c3aed' } },
      { key: 'slots',    label: 'Plazas libres', type: 'number', unit: 'plazas' },
      { key: 'isOnline', label: 'Online',        type: 'boolean' },
      { key: 'contact',  label: 'Contacto',      type: 'phone' },
    ],
  },

  // ── EDUCACIÓN / FORMACIÓN ─────────────────────────────────────────────────

  {
    locationTypeId: 'formacion-profesional',
    context: 'place',
    fields: [
      { key: 'address',  label: 'Dirección', type: 'text' },
      { key: 'schedule', label: 'Horario',   type: 'text' },
      { key: 'phone',    label: 'Teléfono',  type: 'phone' },
      { key: 'web',      label: 'Web',       type: 'url' },
    ],
  },
  {
    locationTypeId: 'formacion-quedadas',
    context: 'event',
    fields: [
      { key: 'slots',    label: 'Plazas libres', type: 'number', unit: 'plazas' },
      { key: 'price',    label: 'Precio',        type: 'number', unit: '€' },
      { key: 'isOnline', label: 'Online',        type: 'boolean' },
      { key: 'contact',  label: 'Contacto',      type: 'phone' },
    ],
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Servicio
// ─────────────────────────────────────────────────────────────────────────────

@Injectable({ providedIn: 'root' })
export class LocationFieldService {

  private readonly categoryService = inject(CategoryService);

  /**
   * Registry interno. Clave: `locationTypeId::context`.
   * Se construye una sola vez al instanciar el servicio.
   */
  private readonly registry = new Map<string, LegacyLocationFieldSchema>(
    FIELD_SCHEMAS.map(s => [`${s.locationTypeId}::${s.context}`, s])
  );

  /**
   * Devuelve los campos de metadata a mostrar para una combinación
   * de locationTypeId y contexto.
   *
   * @param locationTypeId - Id del tipo de localización.
   * @param context        - Contexto: 'place' | 'promotion' | 'event'.
   * @returns Array de {@link LocationFieldDef} en el orden definido,
   *          o array vacío si no hay schema registrado.
   *
   * @example
   * fieldService.getFields('ciclismo-profesional', 'place')
   * // → [address, schedule, phone, web, services]
   *
   * fieldService.getFields('ciclismo-profesional', 'promotion')
   * // → [discountCode, discountPercent, conditions, maxUses]
   */
  getFields(locationTypeId: number, context: FieldContext): LocationFieldDef[] {
    const key = this.resolveSchemaKey(locationTypeId, context);
    return key ? this.registry.get(key)?.fields ?? [] : [];
  }

  /**
   * Comprueba si existe schema registrado para una combinación dada.
   *
   * @param locationTypeId - Id del tipo de localización.
   * @param context        - Contexto a consultar.
   */
  hasSchema(locationTypeId: number, context: FieldContext): boolean {
    const key = this.resolveSchemaKey(locationTypeId, context);
    return key ? this.registry.has(key) : false;
  }

  private resolveSchemaKey(locationTypeId: number, context: FieldContext): string | null {
    const directKey = `${locationTypeId}::${context}`;
    if (this.registry.has(directKey)) {
      return directKey;
    }

    const legacyKey = this.buildLegacySchemaKey(locationTypeId);
    if (!legacyKey) {
      return null;
    }
    return `${legacyKey}::${context}`;
  }

  private buildLegacySchemaKey(locationTypeId: number): string | null {
    const locationType = this.categoryService.getLocationTypeById(locationTypeId);
    if (!locationType) {
      return null;
    }

    const subCategory = this.categoryService.getSubCategoryById(locationType.subcategoryId);
    if (!subCategory) {
      return null;
    }

    return `${this.slugify(subCategory.name)}-${this.slugify(locationType.name)}`;
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
