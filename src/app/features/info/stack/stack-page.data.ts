/**
 * @file stack-page.data.ts
 * @description Contenido de la página pública /stack. Es el mismo contenido (resumido) que
 * BACK/docs/STACK.md y WEB/docs/STACK.md — mantenerlos alineados si cambia una pieza real del
 * stack, no tratar esto como texto fijo.
 */

export interface StackLink {
  readonly label: string;
  readonly url: string;
}

export interface StackItem {
  readonly name: string;
  readonly why: string;
  readonly link?: StackLink;
}

export interface StackGroup {
  readonly title: string;
  readonly icon: string;
  readonly items: StackItem[];
}

const BACK_REPO = 'https://github.com/EMC2-MapItApp/back/blob/main_back';
const WEB_REPO = 'https://github.com/EMC2-MapItApp/web/blob/main_web';

export const STACK_GROUPS: StackGroup[] = [
  {
    title: 'Frontend',
    icon: 'web',
    items: [
      {
        name: 'Angular 22 (standalone + signals)',
        why: 'Sin NgModules ni el boilerplate de versiones anteriores; el estado reactivo se resuelve con signals en vez de RxJS puro donde no hace falta.',
        link: { label: 'app.routes.ts', url: `${WEB_REPO}/src/app/app.routes.ts` },
      },
      {
        name: 'TypeScript',
        why: 'Tipado estático en todo el cliente, coherente con el tipado fuerte del backend en Java.',
        link: { label: 'tsconfig.json', url: `${WEB_REPO}/tsconfig.json` },
      },
      {
        name: 'Angular Material',
        why: 'Componentes accesibles (diálogos, botones, spinners) sin reconstruir un UI kit propio.',
        link: { label: 'package.json', url: `${WEB_REPO}/package.json` },
      },
      {
        name: 'Google Maps JavaScript API',
        why: 'El mapa es el elemento central del producto; SDK maduro y mejor cobertura de datos que alternativas gratuitas.',
        link: {
          label: 'google-maps.service.ts',
          url: `${WEB_REPO}/src/app/core/services/google-maps.service.ts`,
        },
      },
      {
        name: '@zxcvbn-ts',
        why: 'Medidor de fuerza de contraseña con la misma escala 0-4 que el zxcvbn Java del backend — feedback consistente en registro.',
      },
      {
        name: 'Arquitectura responsive propia',
        why: 'Fuente única de verdad (signal + BreakpointObserver) en vez de que cada componente calcule el viewport por su cuenta.',
        link: {
          label: 'responsive.service.ts:35',
          url: `${WEB_REPO}/src/app/core/responsive/responsive.service.ts#L35`,
        },
      },
      {
        name: 'Web Push (VAPID) + Service Worker dedicado',
        why: 'Notificaciones nativas del SO en desktop sin depender de un proveedor propietario. El canal vive detrás de una interfaz propia (PushProvider) para poder migrar a push nativo (FCM) en la app Android sin reescribir el resto de la app.',
        link: {
          label: 'push-provider.ts',
          url: `${WEB_REPO}/src/app/core/notifications/push-provider.ts`,
        },
      },
      {
        name: 'Capacitor (Android)',
        why: 'Empaqueta la misma SPA Angular como app nativa Android (WebView) sin reescribir la UI ni mantener un codebase paralelo. Plataforma nativa ya generada y compilando; publicación en Play Store todavía en curso.',
        link: { label: 'capacitor.config.ts', url: `${WEB_REPO}/capacitor.config.ts` },
      },
    ],
  },
  {
    title: 'Backend',
    icon: 'dns',
    items: [
      {
        name: 'Java 21 (LTS) + Spring Boot 3.3',
        why: 'Framework de referencia en backend Java; Security/Data/Validation cubren auth, persistencia y validación sin piezas sueltas.',
        link: { label: 'pom.xml', url: `${BACK_REPO}/pom.xml` },
      },
      {
        name: 'JWT propio (HMAC)',
        why: 'Implementado a mano en vez de una librería externa, como ejercicio de entender el formato JWT y HMAC-SHA a bajo nivel.',
        link: {
          label: 'JwtService.java:20',
          url: `${BACK_REPO}/src/main/java/emc/mapIt/service/JwtService.java#L20`,
        },
      },
      {
        name: 'Spring Security',
        why: 'Rutas públicas/protegidas declarativas; sesiones stateless y CSRF deshabilitado — API de tokens pura, sin cookies.',
        link: {
          label: 'SecurityConfig.java',
          url: `${BACK_REPO}/src/main/java/emc/mapIt/config/SecurityConfig.java`,
        },
      },
      {
        name: 'zxcvbn (puerto Java)',
        why: 'Validación de fortaleza de contraseña en el servidor, misma escala que el frontend.',
        link: {
          label: 'PasswordPolicyService.java',
          url: `${BACK_REPO}/src/main/java/emc/mapIt/service/PasswordPolicyService.java`,
        },
      },
      {
        name: 'JUnit 5 · Mockito · AssertJ · MockMvc',
        why: 'Tests unitarios puros, con mocks y de capa web sin levantar un servidor real.',
        link: { label: 'docs/tests.md', url: `${BACK_REPO}/docs/tests.md` },
      },
      {
        name: 'bucket4j',
        why: 'Rate limiting por IP en login y recuperación de contraseña — sin él, nada limitaba la fuerza bruta ni la enumeración masiva de cuentas.',
        link: {
          label: 'RateLimitFilter.java',
          url: `${BACK_REPO}/src/main/java/emc/mapIt/config/RateLimitFilter.java`,
        },
      },
    ],
  },
  {
    title: 'Arquitectura',
    icon: 'hub',
    items: [
      {
        name: 'Monolito modular por dominio',
        why: 'Un solo desarrollador y tráfico de proyecto personal — dividir en microservicios ahora añadiría complejidad operativa (red, despliegues múltiples) sin ningún problema real que resolver. Los módulos ya se organizan por dominio de negocio, no por capa técnica, así que extraer uno como servicio el día que un criterio objetivo lo justifique es mecánico.',
        link: { label: 'docs/ARQUITECTURA.md', url: `${BACK_REPO}/docs/ARQUITECTURA.md` },
      },
      {
        name: 'Arquitectura hexagonal en geo/ y notifications/',
        why: 'Piloto selectivo, no una regla global: los dos puntos con una dependencia externa reemplazable (proveedor GeoIP, canales de notificación). notifications/ ya tiene dos puertos en producción — NotificationSender (email) y PushSender (push nativo vía VAPID) — cada uno con su adaptador, sustituible sin tocar el caso de uso.',
        link: {
          label: 'PushSender.java',
          url: `${BACK_REPO}/src/main/java/emc/mapIt/notifications/PushSender.java`,
        },
      },
    ],
  },
  {
    title: 'Persistencia',
    icon: 'storage',
    items: [
      {
        name: 'MongoDB Atlas',
        why: 'Free tier gestionado (M0), sin servidor propio que mantener. El dominio (publicaciones geolocalizadas, árbol de categorías) encaja mejor con documentos que con un esquema relacional estricto.',
      },
      {
        name: 'Spring Data MongoDB',
        why: 'Repositorios declarativos (MongoRepository) sin capa de acceso a datos manual.',
        link: { label: 'repository/', url: `${BACK_REPO}/src/main/java/emc/mapIt/repository` },
      },
    ],
  },
  {
    title: 'Cloud & CI/CD',
    icon: 'cloud',
    items: [
      {
        name: 'Google Cloud Run',
        why: 'Serverless: escala a cero sin tráfico (coste ~0 en un proyecto personal), sin gestionar VMs. Despliegue por imagen Docker propia, no buildpack.',
        link: { label: 'docs/GoogleCloudDeploy.md', url: `${BACK_REPO}/docs/GoogleCloudDeploy.md` },
      },
      {
        name: 'GitHub Actions',
        why: 'CI/CD sin infraestructura propia — build, test y deploy en el mismo sitio donde vive el código.',
        link: { label: 'deploy.yml:108', url: `${BACK_REPO}/.github/workflows/deploy.yml#L108` },
      },
      {
        name: 'Google Artifact Registry + Secret Manager',
        why: 'Registro de imágenes privado y secretos (JWT, Mongo URI, SMTP) versionados por nombre desde el propio workflow, nunca solo en la consola.',
      },
      {
        name: 'Cloudflare Workers + Assets',
        why: 'Hosting del frontend como sitio estático (SPA sin SSR): free tier con CDN global, sin servidor Node que mantener.',
        link: { label: 'wrangler.toml', url: `${WEB_REPO}/wrangler.toml` },
      },
      {
        name: 'Docker',
        why: 'Imagen runtime-only (eclipse-temurin JRE Alpine): el WAR se compila en CI, el Dockerfile solo lo empaqueta con un usuario no-root.',
        link: { label: 'Dockerfile', url: `${BACK_REPO}/Dockerfile` },
      },
    ],
  },
  {
    title: 'Servicios externos',
    icon: 'extension',
    items: [
      {
        name: 'Resend (SMTP)',
        why: 'Envío del correo de verificación de cuenta — free tier suficiente para el volumen de un proyecto personal.',
      },
      {
        name: 'ip-api.com',
        why: 'Geolocalización aproximada por IP como fallback cuando el navegador no da permiso de ubicación.',
      },
    ],
  },
];
