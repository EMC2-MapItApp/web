import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { vi } from 'vitest';
import { authDialogGuard } from './auth-dialog.guard';
import { TOKEN_KEY } from './auth.guard';
import { CurrentUserService } from '../services/current-user.service';
import { MapItUser } from '../models/user.model';

describe('authDialogGuard', () => {
  let dialog: { open: ReturnType<typeof vi.fn> };
  let cu: CurrentUserService;

  const user: MapItUser = {
    id: 'u1', name: 'Ana', nick: 'ana', email: 'ana@test.com', userType: 'individual',
    level: 0, xp: 0, unlockedCapabilities: [],
  };

  beforeEach(() => {
    dialog = { open: vi.fn() };
    TestBed.configureTestingModule({
      providers: [provideRouter([]), { provide: MatDialog, useValue: dialog }],
    });
    cu = TestBed.inject(CurrentUserService);
    localStorage.removeItem(TOKEN_KEY);
    cu.clear();
  });

  afterEach(() => localStorage.removeItem(TOKEN_KEY));

  const runGuard = () =>
    TestBed.runInInjectionContext(() =>
      authDialogGuard({} as never, {} as never),
    ) as Promise<boolean>;

  it('con token y usuario cargado, permite el acceso sin abrir diálogo', async () => {
    localStorage.setItem(TOKEN_KEY, 'jwt-abc');
    cu.setUser(user);

    await expect(runGuard()).resolves.toBe(true);
    expect(dialog.open).not.toHaveBeenCalled();
  });

  it('sin token, abre AuthRequiredDialogComponent y bloquea la navegación', async () => {
    await expect(runGuard()).resolves.toBe(false);
    expect(dialog.open).toHaveBeenCalledTimes(1);
  });

  it('con token pero sin usuario aún cargado, abre el diálogo y bloquea la navegación', async () => {
    localStorage.setItem(TOKEN_KEY, 'jwt-abc');
    // cu.user() sigue null: simula la ventana entre tener token y que load-user resuelva.

    await expect(runGuard()).resolves.toBe(false);
    expect(dialog.open).toHaveBeenCalledTimes(1);
  });
});
