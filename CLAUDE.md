# CLAUDE.md

Este archivo da contexto a Claude Code (claude.ai/code) al trabajar con el código de este repositorio.

> **Documento vivo**: el proyecto está en desarrollo activo. Actualiza este archivo cuando el
> estado real del código cambie —no lo trates como una foto fija.

## Proyecto

Frontend Angular 22 (standalone components, signals) de MapIt — consume la API REST del backend
hermano en `../BACK` (Spring Boot + MongoDB). El mapa (Google Maps) es el elemento central de la
app; el resto de la UI (login, registro, publicaciones, dashboard, perfil) gira en torno a él.

Tests reales desde 2026-09-01 (221 tests, 32 suites, todas verdes — ver `../audit/tests/web/
TESTS-DEBT.md` para el detalle). El runner es Vitest vía `@angular/build:unit-test` (`ng test`).
Cobertura garantizada por `test-coverage-reviewer` (ver más abajo): todo `*.service.ts` y guard
funcional tocado por un diff tiene `.spec.ts` no trivial — no así componentes/pipes/
interceptors/directivas, cuya cobertura es todavía parcial y voluntaria (p. ej. `maps.spec.ts`,
reescrito ese mismo día de un smoke test a 40 tests reales con stub propio de `google.maps`).

Tareas de auth pendientes/en curso están documentadas en `docs/TareasLogin.md` — consúltalo antes
de tocar login/registro para no duplicar trabajo ya planificado.

## Despliegue

Se sirve como sitio estático en **Cloudflare** (Workers + Assets, no Angular Universal/SSR
tradicional). Detalles y problemas ya resueltos en `BITACORA.md`:
- Node debe cumplir la versión fijada en `.nvmrc`/`.node-version` (Cloudflare falla el build si no coincide).
- `wrangler.toml` apunta los assets a `./dist/mapit-app/browser` con `not_found_handling = "single-page-application"`.
- Los límites de bundle en el dashboard de Cloudflare deben ampliarse manualmente si el build crece.

Además del despliegue web, hay una integración en curso de **Capacitor** para publicar una app
nativa Android en Google Play Store — la plataforma nativa ya está añadida (`android/`,
versionada) y compilando (`assembleDebug`/`assembleRelease`), con keystore de release y registro
en Android Developer Verification ya hechos; falta completar la ficha de la app en Play Console y
la subida real. Decisiones, pasos ejecutados y pendientes documentados en `docs/CAPACITOR.md`.

## Comandos

```bash
npm start          # ng serve, http://localhost:4200, recarga en caliente
npm run build      # ng build (usa environment.prod.ts en config production)
npm run watch      # build incremental en modo development
npm test           # ng test (Vitest)
npm run lint       # ng lint (ESLint sobre src/**/*.ts + src/**/*.html, ver eslint.config.js)
npm run lint:style # stylelint sobre src/**/*.scss (ver stylelint.config.js)
npm run format       # prettier --write sobre .ts/.html/.scss
npm run format:check # prettier --check (sin escribir), lo que corre CI
```

### Calidad automatizada (ESLint + Stylelint + Prettier + Husky)

Instalado el 2026-08-16. Antes de asumir que una regla de esta sección sigue vigente,
confirma que el archivo de config referenciado (`eslint.config.js`, `stylelint.config.js`)
sigue existiendo y con ese contenido — es tan "documento vivo" como el resto de este
fichero.

- **ESLint** (`eslint.config.js`, `ng add @angular-eslint/schematics`): reglas TS de
  `typescript-eslint`/`angular-eslint` sobre `.ts` + reglas de plantilla/accesibilidad de
  `angular-eslint` sobre `.html`. Además de las reglas de fábrica, dos plugins añadidos a
  medida para reglas de este documento que antes solo se revisaban a mano:
  - `eslint-plugin-boundaries` (`boundaries/dependencies`, resuelto vía
    `eslint-import-resolver-typescript` para que entienda los alias `@core/*` etc.):
    aplica en código la capa de "Arquitectura" de más abajo — `core` puede depender de
    `shared` y de una feature concreta (p. ej. los guards que abren un diálogo de auth
    con `await import(...)`); `shared` solo de `core`/`shared`; `layout` de
    `core`/`shared`/`layout`; cada **feature** solo de sí misma, `core` y `shared` —
    nunca de otra feature. Si dos features necesitan el mismo componente, se promueve a
    `shared/`, no se importa de una feature a otra.
  - `eslint-plugin-rxjs-x` (`rxjs-x/no-nested-subscribe`, requiere parsing con tipos —
    `languageOptions.parserOptions.projectService: true`): un `.subscribe()` anidado
    dentro de otro `.subscribe()` es error. No se activó `no-ignored-subscription`: el
    patrón dominante del proyecto es HTTP one-shot sin gestión explícita de la
    suscripción, así que esa regla generaría ruido, no señal.
- **Stylelint** (`stylelint.config.js`, sobre `stylelint-config-standard-scss`): solo dos
  reglas de color activas a propósito — `color-no-hex` y una
  `declaration-property-value-disallowed-list` custom que prohíbe `rgb()/rgba()`
  literales — automatizan la regla de CLAUDE.md "Colores: solo variables de tema `--c-*`,
  nunca hex hardcodeados" (exentos `src/styles/_themes.scss` y `_variables.scss`, que SON
  la fuente de verdad de esos valores). El resto de reglas de
  `stylelint-config-standard-scss` (modernización de sintaxis de color, notación de media
  queries, espaciado/líneas en blanco, `selector-class-pattern` sin soporte BEM) están
  desactivadas explícitamente en `stylelint.config.js` — no son una convención del
  proyecto y generaban ruido ajeno al objetivo real.
- **Prettier**: ya estaba como dependencia con `.prettierrc` pero sin script ni uso real.
  **`format:check` falla hoy en 125 archivos** — el repo nunca se pasó por Prettier de
  forma sistemática. No se ha aplicado un `npm run format` global todavía (es un diff
  enorme y merece su propio commit aislado, no un efecto colateral de instalar la
  herramienta) — pregunta antes de lanzarlo.
- **Husky + lint-staged**: hook `pre-commit` (`.husky/pre-commit`) que corre
  `npx lint-staged` — `eslint --fix` + `prettier --write` en `.ts`/`.html` tocados,
  `stylelint --fix` + `prettier --write` en `.scss` tocados (config en
  `"lint-staged"` de `package.json`). Solo actúa sobre archivos en stage, no sobre todo
  el repo.
- **CI** (`.github/workflows/ci.yml`): `build` es gate real (bloquea el merge). `lint`
  (ESLint + Stylelint + `format:check`) corre con `continue-on-error: true` —
  **informativo, no bloqueante** — porque a fecha 2026-08-16 el repo arrancó con deuda
  preexistente (~75 avisos de `ng lint`, ~246 de `stylelint`, 125 archivos sin formatear;
  `D-006-W` en `audit/AUDIT-DEBT.md`, sigue abierta). `test` **es gate real desde
  2026-09-01**: las 2 suites en rojo se cerraron ese día (`TP-001-W`/`TP-002-W`, ver
  `audit/tests/web/TESTS-DEBT.md`), la suite completa de WEB quedó verde y se quitó su
  `continue-on-error` — un test roto ahora bloquea el merge. Quitar el de `lint` cuando se
  limpie esa deuda, rule por rule, no todo de golpe.

`angular-conventions-reviewer` y `style-nav-reviewer` ejecutan ESLint/Stylelint sobre los
archivos tocados como primer paso mecánico de su revisión (ver sus checklists) — no
sustituye ninguno de los dos, ya que la mayoría de reglas de este documento no tienen
regla de lint equivalente todavía.

Añadido el 2026-08-17: `angular-performance-reviewer` (tercer subagente exclusivo de este
repo, `.claude/agents/angular-performance-reviewer.md`) cubre lo que los otros dos
excluyen explícitamente — rendimiento propio de Angular: `ChangeDetectionStrategy.OnPush`
(solo lo que ESLint no ve; el decorador que falta ya lo cubre
`@angular-eslint/prefer-on-push-component-change-detection` dentro del paso mecánico de
`angular-conventions-reviewer`), pureza de `computed()` frente a `effect()`, y ciclo de
vida de suscripciones RxJS (cuándo una suscripción nueva necesita `takeUntilDestroyed`
frente al patrón ya aceptado de HTTP one-shot). Se invoca de forma proactiva igual que los
otros dos: cada vez que el diff toque `effect()`/`computed()`, añada una suscripción RxJS
nueva en un componente/directiva, o cree un componente nuevo.

### Revisión proactiva de seguridad

Añadido el 2026-08-17: `security-reviewer` (cuarto subagente exclusivo de este repo,
`.claude/agents/security-reviewer.md`, comando `/security-review-web`) cubre las
superficies de seguridad propias de este frontend estático sin SSR que consume la API vía
JWT: inyección DOM/XSS (`innerHTML`, `bypassSecurityTrust*`, `target="_blank"` sin
`rel="noopener"`), manejo del JWT/sesión (`TOKEN_KEY`, `auth.interceptor.ts`, guards de
`core/guards/`), redirecciones abiertas (`returnUrl` u otro parámetro de URL pasado sin
validar a `navigateByUrl`), secretos de servidor filtrados al bundle cliente,
vulnerabilidades conocidas en dependencias nuevas/actualizadas (`npm audit`) y cabeceras
de despliegue en Cloudflare (`wrangler.toml`, `public/_headers`). Se invoca de forma
**proactiva** — igual que los otros cuatro subagentes — cada vez que un cambio toque
alguna de estas superficies, antes de dar el trabajo por cerrado:
- **Autenticación**: login, registro, recuperación/reseteo de contraseña, manejo del JWT,
  guards de sesión.
- **Entrada de usuario que termina en el DOM, una URL o una query**: cualquier binding
  nuevo que no pase por el sanitizado por defecto de Angular.
- **Llamadas HTTP nuevas**, especialmente las que envían o reciben datos sensibles.
- **`package.json`/`package-lock.json`**: dependencia añadida o actualizada — corre
  `npm audit --omit=dev` acotado al paquete tocado por el diff, no una auditoría completa
  del lockfile.
- **`wrangler.toml`/`public/_headers`**: config de assets/SPA fallback y, si se añade una
  CSP, que no bloquee Google Maps ni la API del backend ni abra `unsafe-inline`/
  `unsafe-eval` en `script-src` sin justificación. `public/_headers` no existe todavía en
  el repo (a fecha 2026-08-17) — su ausencia no es un finding, solo se revisa si un diff
  la crea.

No sustituye una revisión de seguridad completa bajo demanda (`/security-review`, el skill
genérico no exclusivo de este repo) en cambios grandes o antes de un despliegue — sigue
sin auditar el lockfile completo ni la config de despliegue salvo que el diff actual las
toque. Es un gate ligero y determinista para que estas superficies no queden sin pasar por
seguridad solo porque nadie se acordó de invocarlo a mano.

### Revisión proactiva de la superficie nativa Android/Capacitor

Añadido el 2026-08-17: `capacitor-android-reviewer` (quinto subagente exclusivo de este
repo, `.claude/agents/capacitor-android-reviewer.md`, comando
`/capacitor-android-review`) cubre lo que ninguno de los otros cuatro mira — están todos
alcance a `src/app` — sobre el proyecto nativo generado por Capacitor: permisos en
`AndroidManifest.xml`, componentes exportados (`android:exported`), alcance del tráfico
cleartext en `network_security_config.xml`, deep links/esquemas de URL personalizados, y
manejo de credenciales de firma (`signingConfigs`/`key.properties`). Estado ya documentado
y aceptado, que el agente no debe relitigar: un único permiso (`INTERNET`), `MainActivity`
como único componente exportado (necesario, `LAUNCHER`), cleartext acotado a
`10.0.2.2`/`localhost` (backend de dev, ver `docs/CAPACITOR.md`), firma vía
`key.properties` externo al repo. Se invoca de forma **proactiva** cada vez que un cambio
toque `AndroidManifest.xml`, `network_security_config.xml`, `capacitor.config.ts`,
`android/app/build.gradle`, o añada/actualice un plugin `@capacitor/*` que pueda declarar
permisos o componentes nuevos.

### Revisión proactiva de cobertura de tests

Añadido el 2026-08-26: `test-coverage-reviewer` (sexto subagente exclusivo de este repo,
`.claude/agents/test-coverage-reviewer.md`, comando `/test-coverage-review`) cubre lo que
ninguno de los otros cinco mira — todos excluyen tests explícitamente de su alcance —: que
todo servicio (`*.service.ts`) o guard funcional (`*.guard.ts` que exporta
`CanActivateFn`/`CanMatchFn`/`CanDeactivateFn`/`CanActivateChildFn`/`ResolveFn`) tocado por
el diff tenga su `.spec.ts`, que ese test ejercite de verdad el comportamiento
nuevo/modificado (no un shell trivial) y que pase realmente (`npx vitest run` acotado a los
specs tocados, nunca la suite completa). No revisa componentes, pipes, interceptors,
modelos ni directivas, ni exige cobertura exhaustiva de casos límite o porcentaje de
cobertura — solo existencia y no-trivialidad de test para lo que el diff toca. Se invoca de
forma **proactiva** cada vez que se crea o modifica un `.service.ts` o un guard funcional.

Estado a fecha 2026-09-01: el barrido retroactivo detectado el 2026-08-26 (21 servicios, 2 con
spec; 3 guards funcionales sin spec) está **cerrado por completo** — los 21 servicios y los 3
guards funcionales tienen `.spec.ts` no trivial. El 4º archivo `*.guard.ts` (`auth.guard.ts`)
sigue fuera de alcance por definición: no es un guard funcional, solo exporta la constante
`TOKEN_KEY`. El detalle fichero a fichero (con commit de resolución) vive en
`../audit/tests/web/TESTS-DEBT.md`, no en `audit/AUDIT-DEBT.md` — la deuda de tests tiene su
propio registro desde 2026-08-26, separado del resto de hallazgos de auditoría. Por eso, a
diferencia de los otros 5, `test-coverage-reviewer` no se ha añadido a
`docs/SUBAGENT-VALIDATION.md`: se aplica solo hacia delante, sobre diffs nuevos — el barrido del
backlog ya no está en curso, pero `TESTS-DEBT.md` sigue siendo el registro de referencia si
aparece deuda nueva.

Ese mismo día, y sin que lo exija este subagente (fuera de su alcance por ser un componente),
`maps.spec.ts` (`MapsPageComponent`, el mayor de los 4 candidatos a `D-003-W`/`D-004-W` y el
único que toca `google.maps.*` nativo) pasó de smoke test (1 test, sin `detectChanges()`) a 40
tests reales con un stub propio de `google.maps` — iniciativa voluntaria para poder retomar con
seguridad ese refactor, documentada en `../audit/tests/web/TESTS-DEBT.md` igualmente aunque no
sea un `TC-`/`TR-` formal. No implica que el resto de componentes tengan cobertura equivalente
— sigue siendo caso a caso.

### Barrido retroactivo de los 5 subagentes sobre código ya existente

Añadido el 2026-08-17: los 5 subagentes de arriba nacieron para invocarse sobre el diff
de una tarea, así que nunca habían pasado por el código ya escrito antes de que
existieran. `docs/SUBAGENT-VALIDATION.md` registra, bloque a bloque (poco a poco, no en
una sola sesión), qué zona del código ya se validó con qué subagentes y con qué
resultado; los hallazgos no triviales que se difieren en vez de arreglarse al momento se
registran como entradas normales en `audit/AUDIT-DEBT.md` (mismo fichero de deuda que usa
el proceso `/audit` cross-repo, para no mantener dos listas de deuda distintas).

La API local que consume el frontend en dev es el backend en `http://localhost:8081` (perfil
`dev` de `../BACK`, ver `src/environments/environment.ts`).

## Arquitectura

### Mobile-first — regla transversal, no negociable

El framework es Angular, pero el uso real de la app es casi siempre desde **dispositivos
móviles** (comunidades y grupos consultando/publicando eventos sobre el mapa desde el móvil, no
desde escritorio). Esta es una decisión de arquitectura fija, no un detalle de una página
concreta — aplica a **toda** interfaz y flujo nuevo:

- **Mobile-first en diseño y maquetación**: layout, interacción y rendimiento se piensan primero
  para pantalla pequeña; tablet/desktop son una adaptación posterior, nunca el punto de partida
  (mobile → tablet → desktop, nunca al revés).
- **Objetivos táctiles**: botones, FABs y controles con tamaño mínimo cómodo al tacto (≥44px);
  ninguna funcionalidad crítica debe depender de `:hover` (es mejora progresiva para desktop, no
  un requisito).
- **Peso y rendimiento en red móvil**: mantener el lazy loading por ruta (ver más abajo), evitar
  dependencias pesadas si existe alternativa ligera, vigilar el tamaño de bundle.
- **Validar primero en mobile**: cualquier componente o página nueva se revisa primero en
  viewport mobile (breakpoint 0-767, ver `ResponsiveService`) y después en tablet/desktop.
- Esta prioridad se apoya en la arquitectura responsive ya existente (`ResponsiveService`,
  breakpoints centralizados) — ver subsección "Responsive" más abajo, que la implementa a nivel
  técnico.

Organización **por feature/dominio** (guía de estilo moderna de Angular):

```
src/app/
  core/            # transversal singleton: guards, interceptors, models, servicios de dominio, responsive
  layout/
    home-shell/    # shell de la app (cabecera, sidebar, <router-outlet> de las páginas hijas)
  features/        # un directorio por dominio funcional
    auth/          # login-dialog, register-dialog, forgot-password-dialog, check-email-dialog,
                   # password-strength-meter, verify-email-page, reset-password-page
    maps/          # página del mapa (ruta raíz) + publication-detail
    publications/  # create-publication
    dashboard/, profile/, settings/
    info/          # páginas informativas: about, changelog, stack
  shared/          # UI reutilizada entre features (auth-required-dialog, welcome-dialog)
```

Criterio para decidir dónde va algo nuevo: `core` si es lógica transversal sin UI (servicios,
guards, modelos); `features/<dominio>` si pertenece a un dominio concreto (aunque sea un diálogo
o un componente pequeño — p. ej. `password-strength-meter` vive en `auth` porque solo auth lo
usa); `shared` solo cuando lo consumen **varias** features; `layout` para shells/estructura.

**Path aliases** (`tsconfig.json`): `@core/*`, `@shared/*`, `@features/*`, `@layout/*`, `@env/*`.
Usarlos siempre en imports entre capas; los imports relativos solo son aceptables dentro de la
misma feature o dentro de `core`. Para SCSS existe el equivalente en
`angular.json > stylePreprocessorOptions` — importar con `@use 'styles/variables'`, nunca rutas
relativas `../../styles/`.

**Lazy loading**: todas las páginas se cargan con `loadComponent` en `app.routes.ts`; solo
`HomeShellComponent` es eager. Los diálogos que abren los guards (`open-login-dialog.guard`,
`open-register-dialog.guard`, `auth-dialog.guard`) se importan con `await import(...)` dentro del
guard para quedar fuera del bundle inicial — mantener ese patrón en guards/diálogos nuevos.

- **Auth**: JWT guardado en `localStorage` bajo `TOKEN_KEY` (`core/guards/auth.guard.ts`).
  `authInterceptor` (`core/interceptors/auth.interceptor.ts`) añade el header
  `Authorization: Bearer` a cada petición HTTP si hay token; si no lo hay, la petición sale sin
  cabecera (rutas públicas). Varios guards (`auth.guard`, `auth-dialog.guard`,
  `load-user-optional`, `load-user.guard`, `open-login-dialog.guard`,
  `open-register-dialog.guard`) controlan el acceso a rutas y la apertura de diálogos de login/
  registro — login y registro **no son rutas de página**, son diálogos abiertos sobre `HomeShellComponent`
  (ver `app.routes.ts`: `/login` y `/register` activan un guard que abre el diálogo y quedan en el
  mismo componente shell). El flujo "olvidé mi contraseña" añade `forgot-password/` (diálogo,
  abierto desde `login-dialog` vía `MatDialog`, sin ruta propia) y `reset-password/` (página real
  con formulario de contraseña nueva, análoga a `verify-email/` — se llega desde el enlace del
  correo, sin contexto previo del shell).
- **Rutas hijas de `HomeShellComponent`**: `dashboard`, `profile`, `settings`,
  `create-publication`, `groups`, `groups/:id/edit` y `feedback` requieren sesión vía
  `authDialogGuard`; las páginas informativas (`about`, `changelog`, `stack`) también son hijas
  del shell pero **sin guard** (accesibles sin sesión). `verify-email`, `reset-password` y
  `group-invitation` quedan fuera del shell — se llega a ellas desde el enlace de un correo, sin
  contexto previo de la app.

### Páginas nuevas — patrón de integración en el shell

Toda página nueva de la app (plantilla) debe seguir el patrón de Ajustes/Acerca de/Novedades/
Stack; una página fuera de este patrón se percibe como ajena a la app (ya pasó con las primeras
versiones de about/changelog/stack y hubo que rehacerlas):

- **Ruta hija del shell**: declararla como hija de `HomeShellComponent` en `app.routes.ts` para
  heredar cabecera, sidebar, footer y el contenedor `.app-main`. Añadir `authDialogGuard` solo si
  requiere sesión. Nada de rutas standalone salvo el caso "se llega desde un correo".
- **Cabecera**: clases globales `.page-header` + `.page-header__title` / `__subtitle`
  (`styles.scss`) — no definir una cabecera propia por página.
- **Secciones**: `mat-expansion-panel` (dentro de `mat-accordion`) con el mixin global
  `accordion-panel-title` aplicado a la clase del acordeón de la página.
- **Filas de contenido**: mixins globales `data-row` (esqueleto de fila: hover, separador,
  radios) e `icon-wrap` (cajita del icono) de `src/styles/_mixins.scss`; ver `.poi-item`
  (settings), `.about-item`, `.changelog-item`, `.stack-item` como referencia.
- **Colores**: solo variables de tema `--c-*` (`_themes.scss`) — así el modo oscuro queda
  cubierto sin trabajo extra. Nunca hex hardcodeados.
- Efecto colateral conocido: cualquier página del shell muestra el welcome-dialog a invitados
  una vez por sesión (`home-shell.ts`), también si aterrizan directamente en ella desde fuera.

### Responsive — arquitectura obligatoria para toda UI nueva

Implementación técnica del principio mobile-first de la sección anterior. Documento de
referencia completo: `docs/responsive-architecture-portable.md`. Resumen de las reglas que hay
que respetar siempre:

- **Fuente única de verdad**: `core/responsive/responsive.service.ts` (signal `state` +
  `state$`), construido sobre `BreakpointObserver` de Angular CDK y los breakpoints centralizados
  en `core/responsive/breakpoints.constants.ts`. Ningún componente debe leer
  `window.innerWidth` ni calcular el viewport por su cuenta — siempre consumir el servicio.
- **Breakpoints**: mobile 0-767, tablet 768-1023, desktop 1024+. Si se tocan, hay que
  mantenerlos alineados entre `breakpoints.constants.ts` (TS) y `src/styles/_variables.scss`
  (SCSS) — es la causa de bug más común en esta arquitectura (drift entre TS y SCSS).
- **Estilos globales primero**: variables de tema (`--c-*`) y mixins en `src/styles/`
  (`_variables.scss`, `_mixins.scss`, `_themes.scss`, `_index.scss`) son la fuente de verdad
  visual; evitar estilos ad-hoc por componente cuando exista ya un mixin o variable global
  equivalente. Un mismo componente cambia de layout según el `deviceClass` activo, pero reutiliza
  las mismas variables/mixins en todos los tamaños.
- **Reglas de producto MVP** (mapa es prioridad visual siempre):
  - Mobile: mapa a pantalla casi completa; formulario de nueva publicación oculto por defecto,
    se abre con FAB; todo formulario (login/registro/publicación) es full-screen.
  - Tablet: prioridad visual del mapa se mantiene; formularios full-screen si el alto es
    limitado.
  - Desktop: formulario de nueva publicación visible de forma persistente junto al mapa.
- **Paneles/overlays flotantes**: cerrar al tocar fuera (excepto clicks en controles internos,
  con `stopPropagation()`); transiciones cortas (180-250ms); estilo glassmorphism (fondo
  translúcido + blur) en overlays sobre el mapa.

## Convenciones de código

Las mismas convenciones que en el backend (`../BACK/CLAUDE.md`), aplicadas también aquí:

- **Clean code**: nombres descriptivos, funciones/métodos y componentes pequeños con una única
  responsabilidad, evitar duplicación y complejidad innecesaria — priorizar código fácil de leer
  y mantener sobre código ingenioso.
- **Principios SOLID** al diseñar o tocar clases, servicios y componentes (responsabilidad única,
  dependencias inyectadas, evitar acoplar componentes a detalles de implementación ajenos).
- **Buenas prácticas** generales, y comentarios/documentación solo en los bloques relevantes (no
  en lo obvio).
- **Estilos globales y código reutilizable** — por encima de todo: antes de añadir un estilo
  ad-hoc o duplicar lógica en un componente, comprobar si ya existe una variable de tema
  (`--c-*`), un mixin (`src/styles/_mixins.scss`), un servicio o una utilidad reutilizable
  (`core/`, `shared/`) que resuelva el caso, y extender/generalizar lo existente en vez de crear
  una alternativa local. Ver "Responsive" más arriba para el detalle técnico de estilos globales,
  y el criterio `core`/`features`/`shared` de "Arquitectura" para dónde vive el código reutilizable
  nuevo.
- **Consistencia visual entre componentes del mismo tipo**: todo elemento repetido en la app
  (botones, inputs, cards, chips, badges, etc.) debe verse y comportarse igual en todas partes —
  nunca un estilo distinto por página o feature para el mismo tipo de elemento. Si ya existe un
  estilo global para ese tipo de elemento, reutilizarlo tal cual; si no existe y hace falta,
  crearlo como clase/mixin global en `src/styles/` (nunca como estilo local del componente que lo
  necesitó primero).
- **Componentes candidatos a reutilización**: al crear un componente nuevo que por su naturaleza
  podría usarse en otras partes de la app (p. ej. un diálogo genérico, un componente de
  confirmación), diseñarlo desde el principio para ser reutilizable (inputs/outputs genéricos, sin
  lógica ni copy acoplados a la feature donde nace) y ubicarlo en `shared/` en vez de en la feature
  de origen. Si hay duda sobre si un componente nuevo es candidato a extraerse como pieza
  reutilizable, **preguntar al usuario** antes de decidir su diseño o ubicación.

Aquí además:

- **Stack/arquitectura sincronizados**: `docs/STACK.md` (este repo) es pareja de
  `../BACK/docs/STACK.md`, y ambos se resumen en
  `src/app/features/info/stack/stack-page.data.ts` (página pública `/stack`). Si cambia una
  decisión de stack o de arquitectura del backend (ver `../BACK/docs/ARQUITECTURA.md`),
  reflejarla también aquí en el mismo cambio.

- **Standalone components + signals** (no NgModules, no RxJS puro donde un signal basta — ver
  `ResponsiveService` como referencia de patrón: signal interno + `computed()` derivados +
  `toObservable()` solo para consumidores que lo necesiten en RxJS).
- Documentar con bloques JSDoc (`@file`/`@description`) a nivel de módulo/servicio cuando el
  archivo lo justifique — varios servicios de `core/` ya siguen ese estilo; mantenerlo consistente
  en servicios nuevos.
- **Logging de desarrollo, separado en dos categorías**:
  - **Flujo/info**: trazas para entender el comportamiento en desarrollo (p. ej. cambios de
    estado, eventos de servicios como `ResponsiveService`). Deben quedar **muy aislados** —
    agrupados o fácilmente identificables (p. ej. un único punto de log por servicio, o un helper
    dedicado) para poder comentarlos o borrarlos sin rastrear llamadas sueltas por todo el
    componente a medida que dejen de ser necesarios. Nunca deben incluir tokens, contraseñas ni
    payloads completos de usuario.
  - **Errores**: para fallos que el usuario debe percibir (petición HTTP fallida, validación,
    etc.) — estos sí deben capturarse explícitamente y traducirse en algo visible en pantalla
    (mensaje de error, estado de error en el componente), no solo loguearse a consola.
  - En producción no debe quedar logging de flujo/depuración activo ni datos sensibles en
    consola — condicionar por `environment.production` o retirarlo antes de mergear.
