import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { vi } from 'vitest';
import { openLoginDialogGuard } from './open-login-dialog.guard';
import { LoginDialogComponent } from '@features/auth/login-dialog/login-dialog';

describe('openLoginDialogGuard', () => {
  let dialog: { open: ReturnType<typeof vi.fn>; openDialogs: { componentInstance: unknown }[] };
  let router: Router;

  beforeEach(() => {
    dialog = { open: vi.fn(), openDialogs: [] };
    TestBed.configureTestingModule({
      providers: [provideRouter([]), { provide: MatDialog, useValue: dialog }],
    });
    router = TestBed.inject(Router);
  });

  const runGuard = (queryParams: Record<string, string> = {}) =>
    TestBed.runInInjectionContext(() =>
      openLoginDialogGuard(
        { queryParamMap: { get: (key: string) => queryParams[key] ?? null } } as never,
        {} as never,
      ),
    );

  it('abre LoginDialogComponent y redirige a /', async () => {
    const result = await runGuard();

    expect(dialog.open).toHaveBeenCalledTimes(1);
    expect(dialog.open.mock.calls[0][0]).toBe(LoginDialogComponent);
    expect(result).toEqual(router.createUrlTree(['/']));
  });

  it('no abre un segundo diálogo si ya hay uno abierto', async () => {
    dialog.openDialogs.push({ componentInstance: Object.create(LoginDialogComponent.prototype) });

    await runGuard();

    expect(dialog.open).not.toHaveBeenCalled();
  });

  it('pasa un returnUrl interno seguro como data del diálogo', async () => {
    await runGuard({ returnUrl: '/groups/abc/edit' });

    expect(dialog.open.mock.calls[0][1]).toMatchObject({ data: { returnUrl: '/groups/abc/edit' } });
  });

  it('descarta un returnUrl absoluto (open redirect)', async () => {
    await runGuard({ returnUrl: 'https://evil.example.com' });

    expect(dialog.open.mock.calls[0][1]).toMatchObject({ data: { returnUrl: null } });
  });

  it('descarta un returnUrl protocol-relative (open redirect)', async () => {
    await runGuard({ returnUrl: '//evil.example.com' });

    expect(dialog.open.mock.calls[0][1]).toMatchObject({ data: { returnUrl: null } });
  });
});
