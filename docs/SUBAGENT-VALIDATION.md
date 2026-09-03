# Barrido de validación retroactiva con los subagentes del repo

Los 5 subagentes exclusivos de este repo (`angular-conventions-reviewer`,
`angular-performance-reviewer`, `style-nav-reviewer`, `security-reviewer`,
`capacitor-android-reviewer`, ver `CLAUDE.md`) están pensados para invocarse
proactivamente sobre el diff de una tarea concreta. Este documento registra el progreso
de pasarlos, además, sobre el código **ya existente** que nunca pasó por ninguno de los
5 checklists — bloque a bloque, no todo de golpe.

Proceso completo, orden de bloques y criterio de qué subagente aplica a cada uno:
ver el plan `los-subagentes-no-validan-refactored-cascade.md`. Resumen del criterio:

- `angular-conventions-reviewer` / `angular-performance-reviewer`: cualquier bloque con
  TypeScript en `core`/`features`/`layout`/`shared`.
- `style-nav-reviewer`: bloques con plantilla HTML/SCSS o que toquen rutas/guards.
- `security-reviewer`: todos los bloques de `src/app` (checklist barato de aplicar;
  refuerzo especial en auth/guards/interceptors).
- `capacitor-android-reviewer`: solo el bloque `android/`.

**Antes de registrar un hallazgo como nuevo**, comprobar el registro interno de deuda técnica —
si ya está diferido/aceptado/descartado allí, no se duplica.

Detalle breve de cada hallazgo (problema → resolución) en
`docs/SUBAGENT-VALIDATION-FINDINGS.md` — este fichero solo lleva el estado de progreso
por bloque.

Leyenda: ⬜ pendiente · ✅ validado (sin hallazgos nuevos, o hallazgos ya tratados).

## Progreso

| # | Bloque | conventions | performance | style-nav | security | capacitor-android |
|---|---|---|---|---|---|---|
| 1 | `core/constants` + `core/models` | ✅ | ✅ | — | ✅ | — |
| 2 | `core/guards` + `core/interceptors` + `app.routes.ts`/`app.config.ts` | ✅ | ✅ | ✅ | ✅ | — |
| 3a | `core/services` (auth/user/notificaciones) | ✅ | ✅ | — | ✅ | — |
| 3b | `core/services` (mapa/publicaciones/resto) | ✅ | ✅ | — | ✅ | — |
| 4 | `core/notifications` + `core/responsive` | ✅ | ✅ | — | ✅ | — |
| 5 | `shared/*` | ✅ | ✅ | ✅ | ✅ | — |
| 6 | `layout/home-shell` | ⬜ | ⬜ | ⬜ | ⬜ | — |
| 7a | `features/auth` (login/register/password-strength-meter) | ⬜ | ⬜ | ⬜ | ⬜ | — |
| 7b | `features/auth` (forgot/reset/check-email/verify-email) | ⬜ | ⬜ | ⬜ | ⬜ | — |
| 8 | `features/maps` | ⬜ | ⬜ | ⬜ | ⬜ | — |
| 9 | `features/publications` | ⬜ | ⬜ | ⬜ | ⬜ | — |
| 10a | `features/groups` (groups-page, group-form-page) | ⬜ | ⬜ | ⬜ | ⬜ | — |
| 10b | `features/groups` (invitation/contact/notify) | ⬜ | ⬜ | ⬜ | ⬜ | — |
| 11 | `features/dashboard` + `features/profile` | ⬜ | ⬜ | ⬜ | ⬜ | — |
| 12 | `features/settings` | ⬜ | ⬜ | ⬜ | ⬜ | — |
| 13 | `features/feedback` | ⬜ | ⬜ | ⬜ | ⬜ | — |
| 14 | `features/info` | ⬜ | ⬜ | ⬜ | ⬜ | — |
| 15 | `android/` + `capacitor.config.ts` | — | — | — | — | ⬜ |

## Detalle por bloque

_(se completa según se valida cada bloque: fecha, resumen de hallazgos por subagente,
IDs del registro interno de deuda técnica si algo se difiere)_

### Bloque 1 — `core/constants` + `core/models` (2026-08-17)

- **conventions**: 2 hallazgos triviales, corregidos en el momento — `dialog.constants.ts`
  sin cabecera JSDoc de módulo (añadida) y `map-settings.model.ts` con 2 bloques JSDoc mal
  formados (`@file`/`@description` en la misma línea, `@example` sin saltos de línea;
  reformateados).
- **performance**: sin hallazgos (ficheros sin componentes/`effect`/`computed`/RxJS, no
  aplica).
- **security**: 1 hallazgo real, diferido — `MapItUser`/`UserMeResponse` no distingue
  perfil propio (completo) de perfil ajeno (campos enmascarados a `null` por el backend
  pero tipados como `string`). Registrado como `D-003-W` en el registro interno de deuda técnica
  (revisar antes de 2026-11-17).

### Bloque 2 — `core/guards` + `core/interceptors` + `app.routes.ts`/`app.config.ts`/`app.ts` (2026-08-17)

- **conventions**: 3 hallazgos, corregidos en el momento — import estático de
  `AuthRequiredDialogComponent` en `unauthorized.interceptor.ts` (pasado a `await import(...)`,
  igual que los guards); lógica `compactViewport` duplicada carácter por carácter en 4 sitios
  (extraída a `ResponsiveService.isCompact` computed, reutilizada en los 4); JSDoc de módulo
  ausente en `auth-dialog.guard.ts`, `open-register-dialog.guard.ts`, `open-login-dialog.guard.ts`
  (añadido, formato `@file`/`@description` consistente con el resto de `core/guards/`).
- **performance**: sin hallazgos.
- **style-nav**: mismo hallazgo del import estático que conventions (corregido); además señaló
  que `CLAUDE.md` tenía la lista de rutas hijas del shell desactualizada (faltaban `groups`,
  `groups/:id/edit`, `feedback`, `group-invitation`) — corregido en `CLAUDE.md`.
- **security**: 1 hallazgo real, corregido — open redirect vía `returnUrl` (query param) sin
  validar, pasado de `open-login-dialog.guard.ts` a `login-dialog.ts` y usado en
  `router.navigateByUrl()` tras login. Añadida validación `isSafeReturnUrl()` (solo rutas
  internas que empiecen por `/` simple, sin `//` ni `://`) en el propio guard antes de pasarlo
  como dialog data.

### Bloque 3a — `core/services` (auth/user/notificaciones, 2026-08-17)

- **conventions**: 3 hallazgos, corregidos en el momento — import `UserType` sin usar en
  `current-user.service.ts` (eliminado); `(environment as any).devSimIp` en
  `geo-ip.service.ts` con cast innecesario (`devSimIp` ya está tipado como `string` en
  ambos `environment*.ts`, cast quitado); JSDoc de `current-user.service.ts` describiendo
  un `MOCK_USER` ya inexistente (reescrito, mismo hallazgo que reportó `security` como
  nota fuera de alcance).
- **performance**: 1 hallazgo real, corregido — `effect()` de `NotificationService` y
  `NotificationPreferencesService` dependía de `cu.user()` completo (objeto por
  referencia), así que cualquier `patch()` de perfil (p. ej. marcar un favorito) volvía a
  disparar `GET /notifications`, `/unread-count` y `/preferences` sin que cambiara la
  sesión. Añadido `CurrentUserService.userId` (computed derivado, solo cambia en
  login/logout) y usado en los dos `effect()` en vez de `user()`.
- **security**: sin vulnerabilidades.

### Bloque 3b — `core/services` (mapa/publicaciones/resto, 2026-08-17)

- **conventions**: 3 hallazgos, corregidos en el momento — `changelog.service.ts` seguía
  con `constructor(private http: HttpClient)` en vez de `inject()` (único de los 13 con
  DI legacy, `category.service.ts` ya se había migrado en `R-017-W`); `computed` importado
  sin usar en `group.service.ts`; ternario usado como sentencia
  (`dark ? this._startObserver() : this._stopObserver()`) en `theme.service.ts:86`,
  marcado por ESLint (`no-unused-expressions`), pasado a `if/else`.
- **performance**: 1 hallazgo real, corregido — mismo bug que en el bloque 3a
  (`effect()` reaccionando a `cu.user()` completo en vez de a la sesión), reproducido en
  `group.service.ts` (badge de invitaciones pendientes). Corregido igual: usa
  `cu.userId()`.
- **security**: sin hallazgos.

### Bloque 4 — `core/notifications` + `core/responsive` (2026-08-17)

- **conventions**: 1 hallazgo real, corregido — `web-push.provider.ts:60` logueaba el
  objeto `json` completo de la suscripción (incluye claves de cifrado `p256dh`/`auth`)
  en el caso borde de suscripción incompleta, sin gating ni redacción. Corregido junto
  con el hallazgo de security de abajo (mismo fichero, misma sesión de fixes).
- **performance**: sin hallazgos.
- **security**: 1 hallazgo real, corregido — los 3 `console.log` de
  `web-push.provider.ts` (permiso, service worker, endpoint de suscripción) no estaban
  gateados por `environment.production` pese a estar ya marcados `TODO(debug-push)` como
  temporales; el endpoint es un identificador estable del canal push del dispositivo y
  quedaba expuesto en consola en cualquier build de producción. Gateados los 3 por
  `!environment.production`, y el `console.warn` de claves incompletas redactado a solo
  qué campos faltan en vez del objeto completo.

### Bloque 5 — `shared/*` (2026-08-17)

- **conventions**: 2 hallazgos triviales, corregidos en el momento — `private router =
  inject(Router)` sin `readonly` en `auth-required-dialog.ts` y en `welcome-dialog.ts`
  (junto con `changelogService`), rompiendo el patrón `private readonly foo =
  inject(Foo)` que sí sigue el resto del proyecto.
- **performance**: sin hallazgos.
- **style-nav**: sin hallazgos — mixins/variables globales reutilizados correctamente,
  0 hex hardcodeado, objetivos táctiles ≥44px, sin duplicación de estilos ad-hoc.
- **security**: sin hallazgos.
