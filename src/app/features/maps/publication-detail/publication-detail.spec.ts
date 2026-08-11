import { TestBed, ComponentFixture } from '@angular/core/testing';
import { vi } from 'vitest';
import { PublicationDetailComponent, PublicationDetailInput } from './publication-detail';
import { CategoryBreadcrumb } from '@core/models/category.model';

describe('PublicationDetailComponent', () => {
  let fixture: ComponentFixture<PublicationDetailComponent>;
  let component: PublicationDetailComponent;

  const breadcrumb: CategoryBreadcrumb = {
    mainCategory: { id: 1, name: 'Deporte', icon: '🏃', color: '#3f51b5', subcategories: [] },
    subCategory: { id: 1, name: 'Ciclismo', icon: '🚴', mainCategoryId: 1, locationTypes: [] },
    locationType: { id: 1, name: 'Quedadas', description: 'Rutas en grupo', subcategoryId: 1 },
  };

  const baseItem: PublicationDetailInput = {
    id: 1,
    name: 'Ruta en bici',
    locationTypeId: 1,
    startDate: '2026-08-10T10:00:00Z',
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PublicationDetailComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(PublicationDetailComponent);
    component = fixture.componentInstance;
    component.item = { ...baseItem };
    component.breadcrumb = breadcrumb;
  });

  function render(): void {
    fixture.detectChanges();
  }

  it('publicación pública: muestra el badge "Abierta a todos" y el CTA "Apuntarse"', () => {
    component.visibility = 'PUBLIC';
    render();

    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('Abierta a todos');
    expect(component.joinButtonText).toBe('Apuntarse');
    expect(component.joinDisabled).toBe(false);
  });

  it('publicación privada, usuario miembro: muestra el aforo real y el CTA "Apuntarse"', () => {
    component.visibility = 'PRIVATE_GROUP';
    component.isGroupMember = true;
    component.groupName = 'Club de Ciclismo';
    component.groupMemberCount = 8;
    component.joinedCount = 3;
    render();

    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('3 plazas de 8 miembros del grupo');
    expect(component.joinButtonText).toBe('Apuntarse');
  });

  it('publicación privada, usuario no miembro: badge de candado, sin números de aforo, CTA "Solicitar invitación"', () => {
    component.visibility = 'PRIVATE_GROUP';
    component.isGroupMember = false;
    component.groupName = 'Club de Ciclismo';
    component.groupMemberCount = 8;
    component.joinedCount = 3;
    render();

    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('Plazas visibles solo para miembros del grupo');
    // No debe filtrarse ningún número de aforo real (3 apuntados / 8 miembros) a quien no es miembro.
    expect(text).not.toContain('3 plazas');
    expect(text).not.toContain('3 / 8');
    expect(component.joinButtonText).toBe('Solicitar invitación');
    expect(component.joinDisabled).toBe(false);
  });

  it('publicación privada, no miembro con solicitud pendiente: CTA deshabilitado con texto "Solicitud enviada"', () => {
    component.visibility = 'PRIVATE_GROUP';
    component.isGroupMember = false;
    component.accessRequestPending = true;
    render();

    expect(component.joinButtonText).toBe('Solicitud enviada');
    expect(component.joinDisabled).toBe(true);

    const button = fixture.nativeElement.querySelector('.detail__join-btn') as HTMLButtonElement;
    expect(button.disabled).toBe(true);
    expect(button.textContent?.trim()).toBe('Solicitud enviada');
  });

  it('onJoin() emite joinRequestRequested (no joinRequested) cuando la publicación es privada y no se es miembro', () => {
    component.visibility = 'PRIVATE_GROUP';
    component.isGroupMember = false;
    render();

    const joinRequestedSpy = vi.fn();
    const joinRequestRequestedSpy = vi.fn();
    component.joinRequested.subscribe(joinRequestedSpy);
    component.joinRequestRequested.subscribe(joinRequestRequestedSpy);

    component.onJoin();

    expect(joinRequestRequestedSpy).toHaveBeenCalledTimes(1);
    expect(joinRequestedSpy).not.toHaveBeenCalled();
  });

  it('onJoin() emite joinRequested (flujo normal) para una publicación pública', () => {
    component.visibility = 'PUBLIC';
    render();

    const joinRequestedSpy = vi.fn();
    const joinRequestRequestedSpy = vi.fn();
    component.joinRequested.subscribe(joinRequestedSpy);
    component.joinRequestRequested.subscribe(joinRequestRequestedSpy);

    component.onJoin();

    expect(joinRequestedSpy).toHaveBeenCalledTimes(1);
    expect(joinRequestRequestedSpy).not.toHaveBeenCalled();
  });
});
