# Hallazgos del barrido retroactivo de subagentes

Registro breve de cada hallazgo encontrado al pasar los 5 subagentes sobre código ya
existente (ver proceso y progreso por bloque en `docs/SUBAGENT-VALIDATION.md`). Un
fichero aparte del progreso para no mezclar la tabla de estado con el detalle de cada
problema — se amplía en cada sesión según se cierran bloques nuevos.

Formato por hallazgo: **problema encontrado → cómo se resolvió** (o su estado si no se
resolvió al momento).

---

## Bloque 1 — `core/constants` + `core/models` (2026-08-17)

1. **`dialog.constants.ts` sin cabecera JSDoc de módulo**, a diferencia de su fichero
   hermano `share.constants.ts` → **Resuelto**: añadida cabecera `@file`/`@description`.

2. **`map-settings.model.ts` con 2 bloques JSDoc mal formados** (`@file`/`@description`
   en la misma línea, `@example` sin saltos de línea) → **Resuelto**: reformateados al
   patrón estándar de una línea por asterisco.

3. **`MapItUser`/`UserMeResponse` no distingue perfil propio (completo) de perfil ajeno**
   — el backend enmascara `email`/`phone`/`city`/`province`/`birthDate` a `null` para
   `GET /users/{id}` cuando el viewer no es self/ADMIN, pero el tipo los declara como
   `string` no opcional → **Diferido** (`D-003-W` en el registro interno de deuda técnica, revisar antes
   de 2026-11-17). No es una fuga activa hoy: `userService.getById()` no tiene ningún
   consumidor real en el repo todavía, así que el riesgo es para la próxima pantalla que
   se construya sobre él. Corrección requiere separar el tipo, no es un arreglo puntual.

## Bloque 2 — `core/guards` + `core/interceptors` + `app.routes.ts`/`app.config.ts`/`app.ts` (2026-08-17)

4. **Open redirect vía `returnUrl`** — el guard `open-login-dialog.guard.ts` leía
   `returnUrl` de la query string sin validar y lo pasaba hasta
   `router.navigateByUrl()` en `login-dialog.ts` tras un login correcto. Un enlace tipo
   `/login?returnUrl=//dominio-externo.com` habría desviado a la víctima fuera de la SPA
   justo después de autenticarse → **Resuelto**: añadida `isSafeReturnUrl()` en el propio
   guard (solo acepta rutas internas que empiecen por `/` simple, rechaza `//` y `://`).

5. **Import estático de `AuthRequiredDialogComponent` en `unauthorized.interceptor.ts`**
   anulaba el lazy-loading que sí aplican los 3 guards que abren el mismo diálogo — al
   registrarse el interceptor eager en `app.config.ts`, el componente quedaba en el
   bundle inicial de todas formas → **Resuelto**: pasado a `await import(...)` dentro de
   un helper, igual que los guards.

6. **Lógica `compactViewport` (`state().isMobile || state().isTablet`) duplicada
   carácter por carácter en 4 sitios** (3 guards + el interceptor) → **Resuelto**:
   extraída a un `computed` nuevo, `ResponsiveService.isCompact`, reutilizado en los 4.

7. **JSDoc de módulo inconsistente en `core/guards/`** — `auth-dialog.guard.ts`,
   `open-register-dialog.guard.ts` y `open-login-dialog.guard.ts` tenían solo un
   comentario de bloque suelto, sin el formato `@file`/`@description` que sí siguen
   `auth.guard.ts`/`load-user-optional.ts` del mismo directorio → **Resuelto**:
   normalizados los 3 al mismo formato.

8. **`CLAUDE.md` con la lista de rutas hijas del shell desactualizada** — no
   mencionaba `groups`, `groups/:id/edit`, `feedback` (con `authDialogGuard`) ni
   `group-invitation` (fuera del shell) → **Resuelto**: actualizada la lista.

## Bloque 3a — `core/services` (auth/user/notificaciones, 2026-08-17)

9. **Import `UserType` sin usar en `current-user.service.ts`** → **Resuelto**: eliminado.

10. **`(environment as any).devSimIp` con cast innecesario en `geo-ip.service.ts`** —
    `devSimIp` ya está tipado como `string` en `environment.ts`/`environment.prod.ts`,
    el `any` solo desactivaba el chequeo de tipos sin necesidad → **Resuelto**: quitado
    el cast.

11. **JSDoc de `current-user.service.ts` describiendo un `MOCK_USER` ya inexistente** —
    la cabecera seguía diciendo "actualmente devuelve datos mock" y daba instrucciones
    para "migrar a auth real", pero `AuthService`/`UserService` ya alimentan el servicio
    con datos reales de la API desde hace tiempo → **Resuelto**: reescrita la cabecera.

12. **`effect()` de `NotificationService`/`NotificationPreferencesService` dependía del
    objeto `cu.user()` completo, no de la sesión** — `CurrentUserService.patch()` (p. ej.
    al marcar/desmarcar un tipo de lugar favorito desde el perfil) crea un `MapItUser`
    nuevo por referencia sin cambiar la sesión, y eso reejecutaba el `effect()`,
    disparando de nuevo `GET /notifications`, `/unread-count` y `/preferences` en cada
    toggle de favorito — tráfico HTTP redundante, más notorio en red móvil → **Resuelto**:
    añadido `CurrentUserService.userId` (computed que solo cambia en login/logout) y los
    dos `effect()` ahora dependen de él en vez de `user()`.

## Bloque 3b — `core/services` (mapa/publicaciones/resto, 2026-08-17)

13. **`changelog.service.ts` con DI legacy** (`constructor(private http: HttpClient)`),
    único de los 13 servicios del bloque que no usaba `inject()` → **Resuelto**: migrado
    a `private readonly http = inject(HttpClient)`.

14. **Import `computed` sin usar en `group.service.ts`** → **Resuelto**: eliminado.

15. **Ternario usado como sentencia en `theme.service.ts:86`**
    (`dark ? this._startObserver() : this._stopObserver();`), marcado por ESLint
    (`no-unused-expressions`) → **Resuelto**: reescrito como `if/else`.

16. **Mismo bug del bloque 3a (hallazgo 12), reproducido en `group.service.ts`** — el
    `effect()` que recalcula el badge de invitaciones pendientes dependía de `cu.user()`
    completo, así que un `patch()` de perfil sin relación con grupos volvía a disparar
    `GET /invitations/pending` → **Resuelto**: usa `cu.userId()`, igual que en
    `NotificationService`/`NotificationPreferencesService`.

## Bloque 4 — `core/notifications` + `core/responsive` (2026-08-17)

17. **`web-push.provider.ts` con 3 `console.log` de depuración (permiso, registro del
    service worker, endpoint de la suscripción push) sin gatear por
    `environment.production`**, pese a estar marcados `TODO(debug-push)` como
    temporales — el endpoint es un identificador estable del canal push del dispositivo
    y quedaba expuesto en la consola de producción → **Resuelto**: los 3 gateados por
    `!environment.production`.

18. **`web-push.provider.ts:60` logueaba el objeto `json` completo de la suscripción
    (incluye `keys.p256dh`/`keys.auth`, claves de cifrado del dispositivo) en el caso
    borde de suscripción incompleta**, sin redacción ni gating → **Resuelto**: el
    `console.warn` ahora solo indica qué campos faltan (`endpoint`/`p256dh`/`auth` como
    booleanos), nunca el valor real.

## Bloque 5 — `shared/*` (2026-08-17)

19. **`private router = inject(Router)` sin `readonly` en `auth-required-dialog.ts`**,
    rompiendo el patrón `private readonly foo = inject(Foo)` seguido en el resto del
    proyecto (incluida la línea `dialogRef` del mismo fichero) → **Resuelto**: añadido
    `readonly`.

20. **Mismo patrón en `welcome-dialog.ts`** (`router` y `changelogService` sin
    `readonly`) → **Resuelto**: añadido `readonly` a ambos.

---

_Próximo bloque a validar: bloque 6 (`layout/home-shell`), ver
`docs/SUBAGENT-VALIDATION.md`._
