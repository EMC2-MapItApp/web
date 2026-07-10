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
tradicional). Detalles y problemas ya resueltos en `docs/deploy-cloudflare.md`:
- Node debe cumplir la versión fijada en `.nvmrc`/`.node-version` (Cloudflare falla el build si no coincide).
- `wrangler.toml` apunta los assets a `./dist/mapit-app/browser` con `not_found_handling = "single-page-application"`.
- Los límites de bundle en el dashboard de Cloudflare deben ampliarse manualmente si el build crece.

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

```
src/app/
  core/            # transversal: guards, interceptors, models, servicios de dominio, responsive
  home/            # shell autenticado + páginas (maps, dashboard, profile, settings, create-publication)
  login/, register/  # diálogos de auth
  shared/          # componentes reutilizables (diálogos genéricos)
```

- **Auth**: JWT guardado en `localStorage` bajo `TOKEN_KEY` (`core/guards/auth.guard.ts`).
  `authInterceptor` (`core/interceptors/auth.interceptor.ts`) añade el header
  `Authorization: Bearer` a cada petición HTTP si hay token; si no lo hay, la petición sale sin
  cabecera (rutas públicas). Varios guards (`auth.guard`, `auth-dialog.guard`,
  `load-user-optional`, `load-user.guard`, `open-login-dialog.guard`,
  `open-register-dialog.guard`) controlan el acceso a rutas y la apertura de diálogos de login/
  registro — login y registro **no son rutas de página**, son diálogos abiertos sobre `HomeComponent`
  (ver `app.routes.ts`: `/login` y `/register` activan un guard que abre el diálogo y quedan en el
  mismo componente shell).
- **Rutas hijas de `HomeComponent`** (`dashboard`, `profile`, `settings`, `create-publication`)
  requieren sesión vía `authDialogGuard`.

### Responsive — arquitectura obligatoria para toda UI nueva

Documento de referencia completo: `docs/responsive-architecture-portable.md`. Resumen de las
reglas que hay que respetar siempre:

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

Las mismas convenciones que en el backend (`../BACK/CLAUDE.md`): SOLID, buenas prácticas, y
comentarios/documentación en los bloques relevantes (no en lo obvio). Aquí además:

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
