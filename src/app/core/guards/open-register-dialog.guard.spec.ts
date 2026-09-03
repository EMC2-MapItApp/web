import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { vi } from 'vitest';
import { openRegisterDialogGuard } from './open-register-dialog.guard';
import { RegisterDialogComponent } from '@features/auth/register-dialog/register-dialog';

describe('openRegisterDialogGuard', () => {
  let dialog: { open: ReturnType<typeof vi.fn>; openDialogs: { componentInstance: unknown }[] };
  let router: Router;

  beforeEach(() => {
    dialog = { open: vi.fn(), openDialogs: [] };
    TestBed.configureTestingModule({
      providers: [provideRouter([]), { provide: MatDialog, useValue: dialog }],
    });
    router = TestBed.inject(Router);
  });

  const runGuard = () =>
    TestBed.runInInjectionContext(() => openRegisterDialogGuard({} as never, {} as never));

  it('abre RegisterDialogComponent y redirige a /', async () => {
    const result = await runGuard();

    expect(dialog.open).toHaveBeenCalledTimes(1);
    expect(dialog.open.mock.calls[0][0]).toBe(RegisterDialogComponent);
    expect(result).toEqual(router.createUrlTree(['/']));
  });

  it('no abre un segundo diálogo si ya hay uno abierto', async () => {
    dialog.openDialogs.push({
      componentInstance: Object.create(RegisterDialogComponent.prototype),
    });

    await runGuard();

    expect(dialog.open).not.toHaveBeenCalled();
  });
});
