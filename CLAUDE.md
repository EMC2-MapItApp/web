# CLAUDE.md

Este archivo da contexto a Claude Code (claude.ai/code) al trabajar con el código de este repositorio.

> **Documento vivo**: el proyecto está en desarrollo activo. Actualiza este archivo cuando el
> estado real del código cambie —no lo trates como una foto fija.

## Proyecto

Frontend Angular 22 (standalone components, signals) de MapIt — consume la API REST del backend
hermano en `../BACK` (Spring Boot + MongoDB). El mapa (Google Maps) es el elemento central de la
app; el resto de la UI (login, registro, publicaciones, dashboard, perfil) gira en torno a él.

Aún no hay tests escritos (están pendientes de implementar). El runner configurado es Vitest vía
`@angular/build:unit-test` (`ng test`), pero no lo des por hecho como cobertura real todavía.

Tareas de auth pendientes/en curso están documentadas en `docs/TareasLogin.md` — consúltalo antes
de tocar login/registro para no duplicar trabajo ya planificado.

## Despliegue

Se sirve como sitio estático en **Cloudflare** (Workers + Assets, no Angular Universal/SSR
tradicional). Detalles y problemas ya resueltos en `BITACORA.md`:
- Node debe cumplir la versión fijada en `.nvmrc`/`.node-version` (Cloudflare falla el build si no coincide).
- `wrangler.toml` apunta los assets a `./dist/mapit-app/browser` con `not_found_handling = "single-page-application"`.
- Los límites de bundle en el dashboard de Cloudflare deben ampliarse manualmente si el build crece.

Además del despliegue web, hay una integración en curso de **Capacitor** para publicar una app
nativa Android en Google Play Store (por ahora solo instalación y configuración base —
`capacitor.config.ts` — sin la plataforma nativa añadida todavía). Decisiones, pasos ejecutados
y pendientes documentados en `docs/CAPACITOR.md`.

## Comandos

```bash
npm start        # ng serve, http://localhost:4200, recarga en caliente
npm run build    # ng build (usa environment.prod.ts en config production)
npm run watch    # build incremental en modo development
npm test         # ng test (Vitest)
```

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
- **Rutas hijas de `HomeShellComponent`**: `dashboard`, `profile`, `settings` y `create-publication`
  requieren sesión vía `authDialogGuard`; las páginas informativas (`about`, `changelog`, `stack`)
  también son hijas del shell pero **sin guard** (accesibles sin sesión). Solo `verify-email` y
  `reset-password` quedan fuera del shell — se llega a ellas desde el enlace de un correo, sin
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
