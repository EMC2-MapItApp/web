# Stack y servicios — Frontend (MapIt WEB)

> Documento vivo, igual que `CLAUDE.md`. Actualízalo cuando cambie una pieza real del stack. La
> contraparte de este documento en el backend es
> [`BACK/docs/STACK.md`](https://github.com/EMC2-MapItApp/back/blob/main_back/docs/STACK.md);
> juntos cubren el sistema completo. Este mismo contenido se reutiliza (resumido, con enlaces
> directos al código) en la página [`/stack`](https://mapit-web.com/stack) de la propia app —
> ver `src/app/stack/`.

## Por qué este stack

Mismo criterio que en el backend: aplicación real y desplegada con el mínimo coste operativo,
usando piezas estándar de la industria en vez de atajos de proyecto de juguete.

## Framework y lenguaje

| Pieza | Versión | Por qué |
|---|---|---|
| [Angular](https://angular.dev/) | 22 | Standalone components + signals desde el arranque — sin NgModules ni el boilerplate de versiones anteriores. Framework completo (router, forms, HTTP) en vez de ensamblar librerías sueltas. |
| [TypeScript](https://www.typescriptlang.org/) | ~6.0 | Tipado estático en todo el cliente, coherente con Java tipado en el backend. |
| [Angular Material](https://material.angular.dev/) | 22 | Componentes accesibles listos (diálogos, botones, spinners) en vez de reconstruir UI kit propio. |
| [RxJS](https://rxjs.dev/) | 7.8 | Solo donde un signal no basta (streams HTTP, interceptors) — `ResponsiveService` es la referencia de patrón: signal interno + `computed()` + `toObservable()` para quien lo necesite en RxJS. |

## Mapa y geolocalización

| Pieza | Por qué |
|---|---|
| [Google Maps JavaScript API](https://developers.google.com/maps/documentation/javascript) (`@googlemaps/js-api-loader`) | El mapa es el elemento central del producto; Maps es el estándar con mejor cobertura de datos y SDK JS maduro. Clave de API restringida por dominio (HTTP referrer), no por IP — es pública en el bundle del cliente por diseño de este tipo de API. |
| `GeoIpService` (frontend) + `/api/v1/geo` (backend) | Fallback de ubicación cuando el navegador no da permiso de geolocalización. |

## Seguridad de contraseñas

| Pieza | Por qué |
|---|---|
| [`@zxcvbn-ts`](https://github.com/zxcvbn-ts/zxcvbn) (`core` + `language-common` + `language-es-es`) | Mismo algoritmo y escala 0-4 que el `zxcvbn` Java del backend — el medidor de fuerza que ve el usuario en el registro coincide con lo que el servidor va a aceptar o rechazar. |

## Testing

| Pieza | Por qué |
|---|---|
| [Vitest](https://vitest.dev/) vía `@angular/build:unit-test` | Runner de test integrado en el builder oficial de Angular CLI — sin configurar Karma/Jasmine a mano. Configurado pero sin specs reales todavía (deuda técnica pendiente). |

## Build y calidad

| Pieza | Por qué |
|---|---|
| [Angular CLI](https://angular.dev/tools/cli) / `@angular/build` | Build, dev server y test runner desde una única herramienta oficial. |
| [Prettier](https://prettier.io/) | Formato de código consistente sin discutir estilo en cada PR. |
| `.nvmrc` / `.node-version` | Fijan la versión de Node exacta — Cloudflare (y cualquier máquina nueva) necesita coincidir o el build falla. |

## Hosting y despliegue

| Servicio | Rol | Por qué |
|---|---|---|
| [Cloudflare Workers + Assets](https://developers.cloudflare.com/workers/static-assets/) | Hosting del sitio estático (`mapit-web.com`) | Free tier generoso, CDN global incluido, sin servidor Node que mantener — la app es una SPA pura, no necesita SSR. Es la evolución de "Cloudflare Pages": el dashboard unificado crea un Worker con Assets aunque el proyecto sea solo estático. |
| `wrangler.toml` | Config de despliegue | Necesario para indicarle a Cloudflare dónde están los assets compilados (`./dist/mapit-app/browser`) y que trate las rutas no encontradas como SPA (`not_found_handling = "single-page-application"`), si no la app despliega en blanco. |

Problemas reales encontrados durante el despliegue (interfaz Workers/Pages fusionada, versión de
Node incompatible, límites de bundle, pantalla en blanco) y su solución exacta:
[BITACORA.md](../BITACORA.md).

## Control de versiones

| Pieza | Por qué |
|---|---|
| [Git](https://git-scm.com/) + [GitHub](https://github.com/) | Repo: [`EMC2-MapItApp/web`](https://github.com/EMC2-MapItApp/web), rama de despliegue `main_web`. Cloudflare se conecta directamente al repo de GitHub (no hay un workflow de GitHub Actions propio en este repo — el build/deploy lo dispara Cloudflare al detectar el push). |

## Lo que deliberadamente NO se usó (y por qué)

- **Angular Universal / SSR**: el producto no necesita SEO de contenido indexable ni
  first-paint server-rendered — es una app autenticada detrás de un mapa interactivo. SSR habría
  añadido complejidad de despliegue (Node runtime en vez de assets estáticos) sin beneficio real
  aquí.
- **NgRx / state management global**: con signals + servicios con estado (`ResponsiveService`,
  `CurrentUserService`) el estado compartido necesario hoy no justifica la sobrecarga de un store
  global.
- **Test e2e (Cypress/Playwright)**: pendiente — priorizado por detrás de tener funcionalidad
  real desplegada primero.
