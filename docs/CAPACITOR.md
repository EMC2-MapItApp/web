# Capacitor — integración nativa (Android / Google Play Store)

> Documento vivo. Registra decisiones, pasos ejecutados y pendientes de la integración de
> Capacitor en MapIt de cara a publicar en Google Play Store. A diferencia de `BITACORA.md`
> (notas internas de despliegue, no versionado — ver `.gitignore`), este documento **sí** se sube
> al repo porque describe decisiones de arquitectura que el resto del equipo necesita conocer.

## Estado actual

- **Iteración 1 (2026-08-03)**: instalados `@capacitor/core` (`^8.5.0`, dependency) y
  `@capacitor/cli` (`^8.5.0`, devDependency), generado `capacitor.config.ts` vía `cap init`.
  Verificado que el build web (`npm run build` → `dist/mapit-app/browser`) es byte-idéntico
  antes y después del cambio. **No** se ha añadido todavía la plataforma Android
  (`npx cap add android`) — queda para una iteración futura.
- **Iteración 2 (2026-08-03)**: instalado `@capacitor/android` (`^8.5.0`, dependency), ejecutado
  `npx cap add android` (genera la carpeta `android/`, proyecto Gradle nativo) y
  `npx cap sync android`. Verificado que el proyecto Android compila
  (`./gradlew assembleDebug` → `BUILD SUCCESSFUL`, APK de debug generado en
  `android/app/build/outputs/apk/debug/app-debug.apk`) y que el build web sigue intacto
  (`npm run build` byte-idéntico, `angular.json`/`wrangler.toml` sin cambios).
- **Iteración 3 (2026-08-03)**: instalada y lanzada la app en el emulador `Medium_Tablet`
  (único AVD creado hasta ahora; no hay emulador de móvil todavía, ver nota más abajo). App
  arranca sin crash, carga el JS/CSS de Angular y **el mapa de Google Maps carga y renderiza
  correctamente** — la restricción de la API key por referrer web, que anticipábamos como
  bloqueante, **no ha resultado ser un problema** en este WebView. Encontrado un problema visual
  nuevo (ver hallazgo "Hueco en blanco..." más abajo), sin resolver todavía.
- **Iteración 4 (2026-08-03)**: generado el keystore de upload/release (`keytool`, RSA 2048,
  alias `mapitapp-upload`, validez 10000 días) para completar el registro del package
  `com.emc.mapitapp` en **Android Developer Verification** de Play Console (funcionalidad nueva
  de Google que exige subir el certificado público antes de poder publicar nada, independiente
  de Play App Signing). Keystore guardado **fuera del repo**, en
  `G:\Mi unidad\MapItApp\keystores\` (Google Drive del usuario) — ver `README.txt` en esa carpeta
  para alias, huellas SHA1/SHA256 y contraseña (entregada una única vez por chat, no persistida
  en ningún fichero). El mismo keystore sirve también para el paso 10 de "Próximos pasos" más
  abajo (firma de release), así que ese punto queda completado por adelantado.

  **Formato exacto que acepta el formulario "Añadir clave"**: pese a que el campo se llama
  "Huella digital del certificado SHA-256" y su caja de texto es multilínea (invita a pegar el
  PEM completo con `-----BEGIN CERTIFICATE-----`), **rechaza el PEM** con el error "Huella
  digital de certificado SHA-256 no válida". Tampoco acepta la huella con separadores `:`
  (formato que devuelve `keytool -list -v`). El único formato que aceptó fue el **hex en
  minúsculas/mayúsculas sin separadores**, los 64 caracteres seguidos:
  `0A34604DA78755AA5898774F25238FBE110A69BE9CB61E61AC6093B2C82F38A3` (misma huella SHA-256 del
  `README.txt`, solo sin los `:`).

  Confirmado en Play Console: `com.emc.mapitapp` aparece como **Registrada**, con 1 clave.
  **Nota (ver iteración 6): esa clave quedó huérfana**, el keystore que la generó se
  regeneró por un error de contraseña y ya no existe.
- **Iteración 5 (2026-08-03)**: creado `G:\Mi unidad\MapItApp\keystores\key.properties` (fuera
  del repo, junto al keystore) con `storeFile`/`storePassword`/`keyAlias`/`keyPassword`
  apuntando a `mapitapp-upload.jks`. Es el primer medio paso hacia el punto 11 de "Próximos
  pasos" (firma de release en Gradle) — **falta todavía** modificar
  `android/app/build.gradle` para que lo lea y lo use en `signingConfigs`/`buildTypes.release`
  (ver detalle en ese punto); sin ese cambio, `key.properties` no tiene efecto todavía.
- **Iteración 6 (2026-08-03) — corrección de la iteración 4**: la contraseña del keystore
  mostrada en el chat durante la iteración 4 **era incorrecta** (nunca se releyó del fichero
  antes de mostrarla). Se detectó al añadir la firma de release en `build.gradle` (iteración 5
  completada, ver punto 11 abajo): `gradlew assembleRelease` falló con
  `KeytoolException: ... keystore password was incorrect`. El fichero temporal con la
  contraseña real ya se había borrado, así que era irrecuperable — se regeneró el keystore
  desde cero (mismo alias `mapitapp-upload`, mismos parámetros RSA 2048/10000 días), esta vez
  verificando con `keytool -list` que la contraseña mostrada abre el keystore antes de darla
  por buena. Nueva contraseña entregada por chat, nuevo certificado exportado
  (`mapitapp-upload-public.pem`, sobrescribe el anterior), **nueva huella SHA-256**:
  `954025F0ACE31D5EE1C30642048A145CDF9BC2C4F6971C006A9216491A5F8265`. `gradlew assembleRelease`
  verificado como `BUILD SUCCESSFUL` con esta segunda versión.

  **Pendiente de acción manual en Play Console**: la huella `0A34604D...` (iteración 4) sigue
  registrada ahí, pero corresponde a un keystore que ya no existe — está huérfana, no sirve
  para firmar nada. Hay que entrar en Play Console > Verificación de desarrolladores de
  Android > MapItApp y **añadir la nueva huella** `954025F0ACE31D5EE1C30642048A145CDF9BC2C4F6971C006A9216491A5F8265`
  como clave adicional (y valorar si conviene eliminar la huérfana, si el panel lo permite).
- **Iteración 7 (2026-08-03)**: creado un AVD de móvil (Pixel 9, aportado por el usuario) para
  validar el layout mobile-first real, sustituyendo a `Medium_Tablet` como referencia principal.
  **El hueco en blanco bajo el contenido (hallazgo de la iteración 3) no se reproduce en
  Pixel 9** — queda confirmado como algo específico de la resolución/densidad del AVD de
  tablet, no bloqueante para el objetivo mobile-first del proyecto. Se cierra sin más
  investigación por ahora.

  Al probar login real en el Pixel 9, la app conectaba contra el **backend público** (Cloud
  Run) en lugar del local (`localhost:8081`) — porque el build nativo instalado hasta ahora
  se generó con `npm run build` (config `production`, ver iteración 2), que sustituye
  `environment.ts` por `environment.prod.ts` vía `fileReplacements` (`angular.json`). No es un
  bug, es la config que tocaba usar para probar contra el backend de dev.

  **Fix aplicado** para que el build de dev del móvil hable con el backend local, igual que
  `ng serve` en web:
  - `src/environments/environment.ts`: las URLs de API ahora se construyen con un `apiHost`
    calculado en tiempo de carga vía `Capacitor.isNativePlatform()` — `10.0.2.2` en nativo
    (alias que el AVD de Android Studio resuelve al loopback del host), `localhost` en web. Es
    el primer uso real de `@capacitor/core` en código de la app (hasta ahora solo estaba
    instalado, sin importarse — ver iteración 1). **Solo afecta a `environment.ts` (dev)**;
    `environment.prod.ts` no cambia, la build de producción nativa debe seguir hablando con el
    mismo backend público que la web de producción.
  - `android/app/src/main/res/xml/network_security_config.xml` (nuevo) +
    `android:networkSecurityConfig` en `AndroidManifest.xml`: Android bloquea cleartext HTTP
    por defecto desde API 28, y el backend de dev es HTTP plano. Se permite cleartext
    **únicamente** hacia `10.0.2.2` y `localhost`, no de forma general — la build de producción
    (HTTPS a Cloud Run) no lo necesita y no queda expuesta a nada adicional.
  - Flujo para reproducir: `ng build --configuration=development` → `npx cap sync android` →
    `gradlew assembleDebug` → `adb install -r ...` (backend local de `../BACK` debe estar
    arrancado en `:8081`).
  - **Límite conocido**: `10.0.2.2` solo funciona en el AVD oficial de Android Studio. Un
    dispositivo físico por USB/Wi-Fi o un emulador Genymotion necesitarían la IP LAN real del
    host en su lugar — no contemplado todavía, no bloquea el flujo actual con AVD.

  **Segundo bloqueante encontrado tras el fix de arriba**: con `10.0.2.2` + cleartext
  permitido, la petición seguía sin llegar — `logcat` mostraba `Mixed Content: The page at
  'https://localhost/' ... requested an insecure resource 'http://10.0.2.2:8081/...'. This
  request has been blocked`. El `network_security_config` solo controla si el socket cleartext
  está permitido a nivel de SO; el bloqueo por Mixed Content es una política aparte, a nivel de
  página, del propio WebView (Chromium), y no la evita. Capacitor sirve el WebView por defecto
  bajo el esquema virtual `https://localhost` (`server.androidScheme`), así que cualquier
  llamada `http://` desde ahí cuenta como contenido mixto y se bloquea pase lo que pase con el
  network security config.

  **Fix**: `capacitor.config.ts` → `server.androidScheme: 'http'`. No afecta a producción — una
  página `http` pidiendo un recurso `https` (Cloud Run) no es contenido mixto, solo lo es al
  revés; y `http://localhost` sigue considerándose "secure context" en Chromium (localhost es
  una excepción a la regla), así que APIs que lo requieren (geolocalización, etc.) no deberían
  verse afectadas. `npx cap sync android` + `gradlew assembleDebug` + reinstalación aplicados.
  **Confirmado por el usuario**: login funciona correctamente contra el backend local con este
  fix.
- **Iteración 8 (2026-08-03)**: icono y splash screen generados con `@capacitor/assets`
  (instalado como devDependency), sustituyendo los recursos por defecto de `cap add android`
  (punto 9 de "Próximos pasos"). **Es un placeholder, no branding definitivo** — no existía
  ningún logo real en el proyecto (la cabecera solo usa el glifo Material `map` + texto
  "MapIt", sin imagen); sustituir en cuanto haya diseño real.

  - Fuente única: `assets/logo.svg` (nuevo, fuera de `src/` — esta carpeta no tiene relación
    con `src/assets`/`public` de Angular, es la carpeta que `@capacitor/assets` espera en la
    raíz del repo y solo la usa esta herramienta de desarrollo, no el bundle web). Contiene el
    glifo Material "place" (pin de ubicación) en blanco sobre fondo transparente, modo "Easy
    Mode" de la herramienta (un único logo + colores de fondo por flag, en vez de tener que
    preparar icon-foreground/icon-background/splash por separado a mano).
  - Colores de fondo pasados por CLI, sacados de `_themes.scss`: `#3f51b5` (`--c-primary`
    claro) / `#1e293b` (`--c-surface` oscuro) para el icono adaptativo, `#3f51b5` /
    `#0f172a` (`--c-bg` oscuro) para el splash.
  - Comando: `npx capacitor-assets generate --android --iconBackgroundColor '#3f51b5'
    --iconBackgroundColorDark '#1e293b' --splashBackgroundColor '#3f51b5'
    --splashBackgroundColorDark '#0f172a'`. Genera 74 ficheros en
    `android/app/src/main/res/` (mipmap adaptativos + splash claro/oscuro en todas las
    densidades) — sobrescribe directamente los recursos nativos, no pasa por `cap sync`.
  - `gradlew assembleDebug` verificado como `BUILD SUCCESSFUL` con los recursos nuevos.
    **Sin verificación visual todavía** — no había ningún emulador arrancado en el momento de
    generar los assets para comprobar icono/splash en pantalla; pendiente de que el usuario lo
    revise la próxima vez que abra un AVD.
- **Iteración 9 (2026-08-04)**: scripts dedicados para no repetir a mano el flujo de build +
  `cap sync` + `gradlew` + `adb` cada vez (punto 8 de "Próximos pasos"). Dos scripts
  PowerShell en `scripts/`, con lógica común (setup de `ANDROID_HOME`/`JAVA_HOME` y arranque de
  emulador) extraída a `scripts/android-common.ps1`, expuestos como `npm run android:dev` /
  `npm run android:release`:
  - **`android-dev.ps1`**: build `development` (backend local `10.0.2.2:8081`) → `cap sync
    android` → `gradlew assembleDebug` → instala y lanza el APK en un emulador. Mismo flujo que
    ya se documentó a mano en la iteración 7.
  - **`android-release.ps1`**: build `production` (backend real de Cloud Run, ver
    `environment.prod.ts` — sin environment nuevo, "pre-producción" es simplemente el build de
    producción antes de subirlo a Play Store) → `cap sync android` → `gradlew bundleRelease`
    (firmado con el keystore de `key.properties`, falla con un mensaje claro si ese fichero no
    existe en la máquina) → genera `android/app/build/outputs/bundle/release/app-release.aab`.
  - Un `.aab` no se puede instalar directamente en un emulador/dispositivo (Play Store lo
    trocea en APKs por dispositivo en el momento de instalar). `android-release.ps1` usa
    **bundletool** (herramienta oficial de Google, no forma parte del Android SDK) para derivar
    un APK universal instalable a partir del `.aab` firmado y verificarlo en el emulador antes
    de darlo por bueno. El jar se descarga la primera vez desde las releases de GitHub de
    `google/bundletool` y se cachea en `scripts/.tools/bundletool.jar` (ignorado en git). El
    modo `universal` no es exactamente el artefacto que Play Store serviría a un dispositivo
    real, pero usa el mismo `.aab` firmado — suficiente para verificación local de que el build
    de producción funciona.
  - AVD por defecto fijo: `Pixel 9` (parametrizable con `-Avd`), el mismo usado para validar
    mobile-first desde la iteración 7. Si ya hay un emulador/dispositivo conectado, los scripts
    lo reutilizan en vez de arrancar uno nuevo.
  - **Fuera de alcance deliberadamente**: ninguno de los dos scripts toca
    `versionCode`/`versionName` en `android/app/build.gradle` (siguen en `1`/`"1.0"`, nunca se
    ha publicado nada) — el incremento antes de cada subida real a Play Store sigue siendo
    manual.

## Decisiones y motivos

### App ID: `com.emc.mapitapp`

Formato reverse-domain, **prácticamente irreversible** una vez publicada la app en Play Store
(cambiarlo implicaría publicarla como una app nueva, perdiendo reseñas/instalaciones/histórico).
Elegido ahora de forma deliberada para no tener que revisitarlo más adelante.

### appName: `MapIt`

Coincide con el nombre de marca ya usado en `src/index.html` (`<title>`) y en el resto del
proyecto — sin motivo para introducir un nombre alternativo solo para el paquete nativo.

### webDir: `dist/mapit-app/browser`

Debe coincidir **exactamente** con `[assets] directory` en `wrangler.toml` (despliegue web en
Cloudflare). Son dos ficheros de configuración independientes, **sin sincronización
automática** — si en el futuro cambia el output de Angular (p. ej. se añade `outputPath`
explícito en `angular.json`), hay que actualizar ambos sitios a mano.

### Alcance limitado en esta iteración (sin `cap add android`)

Añadir la plataforma Android implica Android Studio, JDK y Android SDK instalados localmente, y
genera una superficie de cambio mucho mayor (proyecto Gradle completo). Se separa en una
iteración futura para poder verificar primero, de forma aislada, que instalar Capacitor no rompe
nada del pipeline web actual.

### `@capacitor/core` como dependency, `@capacitor/cli` como devDependency

`core` es runtime (viajará en el bundle que corre en el WebView, cuando el código de la app
empiece a importarlo); `cli` es tooling de desarrollo (scaffolding/sync: `cap init`, `cap add`,
`cap sync`), igual que `@angular/cli`. `@capacitor/android` (añadido en la iteración 2) es
también runtime nativo (código Java/Kotlin que corre dentro de la app Android), de ahí que vaya
como dependency igual que `core`.

### JDK usado para Gradle: el embebido de Android Studio, no el `JAVA_HOME` del sistema

El `JAVA_HOME` de la máquina apuntaba a Corretto 18 (`C:\Users\<usuario>\.jdks\corretto-18.0.2`),
una versión que el Android Gradle Plugin actual no soporta oficialmente (soporta JDK 17 o 21).
Android Studio trae su propio JDK embebido (JBR, en
`C:\Program Files\Android\Android Studio\jbr`, JDK 21.0.8 en esta instalación), que es el que usa
la propia IDE para compilar. Se usó ese JDK embebido solo para el comando `gradlew` de
verificación (variable `JAVA_HOME` fijada únicamente para esa invocación, sin tocar la
configuración global del sistema) — es también lo que Android Studio usará por defecto al abrir
el proyecto, así que no hace falta ninguna configuración adicional para el resto del equipo,
siempre que abran `android/` con Android Studio (que gestiona su JDK y su `local.properties`
automáticamente al abrir el proyecto).

### `ANDROID_HOME` no estaba configurado como variable de entorno

El SDK de Android estaba instalado en la ruta por defecto
(`%LOCALAPPDATA%\Android\Sdk`) pero sin `ANDROID_HOME`/`ANDROID_SDK_ROOT` exportadas en el
sistema. Se fijaron temporalmente solo para los comandos de esta sesión (`cap add android`,
`cap sync android`, `gradlew`). Android Studio no necesita esta variable para abrir el proyecto
(detecta el SDK por su propia configuración interna y genera `android/local.properties` con
`sdk.dir` automáticamente al abrir/sincronizar) — pero **si algún día se builda desde línea de
comandos o CI sin pasar por Android Studio**, hará falta `ANDROID_HOME` en el entorno (o un
`local.properties` manual, fichero que ya está en `android/.gitignore` y nunca se versiona por
ser específico de cada máquina).

## Pasos ejecutados

```bash
npm install @capacitor/core
npm install --save-dev @capacitor/cli
npx cap init "MapIt" com.emc.mapitapp --web-dir=dist/mapit-app/browser
```

`capacitor.config.ts` generado en la raíz del repo, fuera de `tsconfig.app.json`
(`include: src/**/*.ts`) — `ng build` no lo toca ni lo compila.

**Verificación (iteración 1)**: build de línea base (`npm run build`) antes de instalar, listado
de ficheros de `dist/mapit-app/browser` guardado, build de nuevo después de instalar + `cap
init`, y comparación (`Compare-Object` en PowerShell) del listado de ficheros — **sin
diferencias**. Los hashes de los chunks (`outputHashing: "all"` en `angular.json`, config
`production`) fueron idénticos en ambas ejecuciones, confirmando que ningún fichero fuente
cambió de contenido.

### Iteración 2 — añadir la plataforma Android

```bash
npm install @capacitor/android
npx cap add android
npx cap sync android
```

```powershell
# Solo para esta sesión de terminal, no persiste ni toca configuración global
$env:ANDROID_HOME = "$env:LOCALAPPDATA\Android\Sdk"
$env:ANDROID_SDK_ROOT = $env:ANDROID_HOME
$env:JAVA_HOME = "C:\Program Files\Android\Android Studio\jbr"
cd android
.\gradlew.bat assembleDebug
```

`cap add android` requiere que `@capacitor/android` esté instalado primero (falla con un error
claro si no lo está). Genera `android/` con proyecto Gradle completo, copia
`dist/mapit-app/browser` a `android/app/src/main/assets/public` y crea
`android/app/src/main/assets/capacitor.config.json` a partir de `capacitor.config.ts`. `cap sync
android` (copy + update) se verificó también de forma independiente, ya que es el comando que
se ejecutará después de cada build futuro.

**Verificación**: `./gradlew assembleDebug` → `BUILD SUCCESSFUL`, APK de debug generado en
`android/app/build/outputs/apk/debug/app-debug.apk` (~5 MB). Build web (`npm run build`)
repetido tras añadir la plataforma — mismos hashes de chunk que antes, `angular.json` y
`wrangler.toml` sin cambios en `git status`.

### Iteración 3 — probar en el emulador

No hay ningún AVD (Android Virtual Device) de móvil creado en esta máquina — solo
`Medium_Tablet`. Se usó ese por ser el único disponible; **pendiente crear un AVD de móvil**
(p. ej. Pixel de gama media) antes de validar en serio el layout mobile-first del proyecto.

```bash
# Arrancar el emulador (tarda 1-2 min en bootear)
emulator -avd Medium_Tablet

# Instalar y lanzar el APK de debug ya compilado
adb install -r android/app/build/outputs/apk/debug/app-debug.apk
adb shell am start -n com.emc.mapitapp/.MainActivity
```

**Resultado**: la app arranca sin crash (sin `FATAL`/`AndroidRuntime` en `logcat`), carga los
chunks de Angular vía `https://localhost/...` y **el mapa de Google Maps renderiza
correctamente** — el hallazgo de la API key de abajo, que anticipábamos como bloqueante, en la
práctica no impidió que el mapa cargara en este WebView.

## Hallazgos a vigilar (no resueltos aún)

### Huellas de certificado desconocidas en Android Developer Verification

Tras añadir nuestra clave (iteración 6), la tabla "Verificación de desarrolladores de Android"
de Play Console para `com.emc.mapitapp` muestra **5 huellas**, no 2:

- `95:40:25:F0:...:82:65` — la nuestra (iteración 6), estado **En revisión**.
- `0A:34:60:4D:...:38:A3` — la huérfana de la iteración 4 (keystore borrado), estado
  **Verificado**.
- `2D:82:08:50:...:6D:68`, `AD:95:49:9F:...:86:B6`, `C8:5B:DE:4A:...:DC:38` — **3 huellas que
  nadie de este proyecto añadió**, ya en estado **Verificado**. Comprobado que ninguna coincide
  con el keystore de debug de esta máquina (`6B:1D:80:BF:...:6E:3D`); el usuario tampoco las
  reconoce de otro entorno (otro equipo, CI, build antigua). Sin explicación confirmada — no
  hay manera de investigarlo con herramientas locales, solo Google tiene esa información
  (posiblemente telemetría de Play Protect sobre cualquier dispositivo que haya visto ese
  `applicationId` firmado con esas claves). **Pendiente**: confirmar con soporte de Play
  Console el origen antes de publicar nada bajo este package name, para descartar que otro
  desarrollador ya lo esté usando.

### ~~Hueco en blanco debajo del contenido~~ — cerrado, específico del AVD de tablet

En capturas de pantalla del `Medium_Tablet`, el contenido de la app (cabecera + sidebar + mapa)
solo ocupaba la parte superior de la pantalla, dejando un hueco en blanco grande debajo. En el
`logcat` aparecía en paralelo un aviso: `Error injecting safe area CSS: TypeError: Cannot read
property 'style' of null`, del plugin `SystemBars` **integrado en `@capacitor/core` 8.x** (no es
código nuestro) — en Android ese plugin inyecta variables CSS `--safe-area-inset-*` en el
`<html>` para compensar un bug conocido de versiones antiguas de Android WebView
(`insetsHandling: "css"` es el comportamiento por defecto, configurable en
`capacitor.config.ts`). **Actualización (iteración 7)**: no se reproduce en el AVD Pixel 9 — era
específico de la resolución/densidad del emulador de tablet, no del proyecto ni del plugin en
sí. Como el objetivo del proyecto es mobile-first (ver `CLAUDE.md`), se cierra sin seguir
investigando; si reaparece en tablet real conviene retomarlo. Referencia:
https://github.com/ionic-team/capacitor/blob/main/core/system-bars.md (mismo contenido que
`node_modules/@capacitor/core/system-bars.md`).

### Google Maps API key

Se carga con un servicio custom de inyección de `<script>`
(`src/app/core/services/google-maps.service.ts`), no con `@angular/google-maps` ni con
`@googlemaps/js-api-loader` (retirado de `package.json` por auditoría, no tenía uso real). La key
está hardcodeada e idéntica en `environment.ts` y `environment.prod.ts`, pensada para restricción
por referrer HTTP (web). **Actualización (iteración 3)**: probado en el emulador y el mapa carga
sin problemas — la restricción de referrer no está bloqueando la carga en el WebView de
Capacitor. Se deja abierto igualmente si conviene una key separada con restricción por paquete
Android + SHA-1 antes de publicar en Play Store (buena práctica de seguridad,
aunque no sea estrictamente necesario para que funcione).

### Token JWT en localStorage

`TOKEN_KEY = 'token'` (`src/app/core/guards/auth.guard.ts`), usado directamente en
guards/interceptor/servicios sin ninguna capa de abstracción. En el WebView de Capacitor debería
seguir funcionando igual (mismo origen para toda la app). **Actualización (iteración 7)**: el
primer intento de probar login real falló porque el build instalado hablaba con el backend
público, no el local (ver iteración 7 arriba) — ya corregido (`10.0.2.2` + cleartext
config). **Pendiente de confirmación del usuario**: repetir login/registro con el APK
reinstalado y verificar que el token se guarda y se reenvía bien contra el backend local.

### Node/npm

`packageManager: "npm@10.9.8"` y `engines.node: ">=22.22.3"` en `package.json`. Nota aparte (no
relacionada con Capacitor): `.nvmrc` (`24`) y `.node-version` (`22.22.3`) ya estaban
desincronizados antes de esta integración — pendiente de alinear en otro momento.

## `.gitignore` de esta iteración

Añadidas reglas transversales:

```gitignore
.capacitor/
*.keystore
*.jks
```

`/dist` ya estaba ignorado (cubre el output de Capacitor, que vive dentro de `dist/`, sin
cambios necesarios ahí). **No** se añaden reglas específicas de `android/`/`ios/` en esta
iteración: `cap add android`/`cap add ios` generan su propio `.gitignore` anidado dentro de esas
carpetas que ya cubre sus artefactos de build (Gradle `build/`, `.gradle/`, `local.properties`,
etc.). **Importante**: las carpetas nativas `android/`/`ios/` en sí **se versionan**, no se
ignoran — no son "generadas y descartables" como `node_modules`.

## Próximos pasos hacia Google Play Store

1. ~~Instalar Android Studio + JDK + Android SDK localmente.~~ Hecho (ya estaban instalados).
2. ~~`npx cap add android` — genera la carpeta `android/`.~~ Hecho (iteración 2).
3. ~~Probar la app en un emulador~~ Hecho (iteración 3, `Medium_Tablet`). Arranca sin crash y el
   mapa carga.
4. ~~Crear un AVD de móvil (no solo tablet).~~ Hecho (iteración 7, Pixel 9).
5. ~~Investigar el hueco en blanco / warning de `SystemBars`.~~ Cerrado (iteración 7) — no se
   reproduce en Pixel 9, específico del AVD de tablet (ver hallazgo arriba).
6. ~~Probar el flujo de login/registro real en el emulador.~~ Hecho (iteración 7) — dos
   bloqueantes resueltos (build hablando con el backend equivocado, luego Mixed Content),
   login confirmado funcionando contra el backend local.
7. Revisar si conviene una Google Maps API key separada con restricción por paquete Android +
   SHA-1 antes de publicar (no bloqueante hoy, pero es buena práctica de seguridad).
8. ~~`npx cap sync android` después de cada build, incorporado al flujo de trabajo habitual.~~
   Hecho (iteración 9) — `npm run android:dev` / `npm run android:release`
   (`scripts/android-dev.ps1` / `scripts/android-release.ps1`).
9. ~~Icono y splash screen (`@capacitor/assets`).~~ Hecho (iteración 8) — placeholder (pin
   Material sobre el color primario del tema), pendiente de sustituir por diseño real y de
   verificación visual en emulador.
10. ~~Generar keystore de release (`keytool`) y guardarlo **fuera** del repo.~~ Hecho
    (iteración 4) — `G:\Mi unidad\MapItApp\keystores\mapitapp-upload.jks`, provocado por el
    registro en Android Developer Verification, no por necesidad inmediata de publicar.
11. Configurar firma de release en Gradle. `key.properties` ya creado (iteración 5,
    `G:\Mi unidad\MapItApp\keystores\key.properties`) — falta editar
    `android/app/build.gradle` para leerlo y usarlo en `signingConfigs`/`buildTypes.release`.
12. Build de release (`.aab`) automatizado en `npm run android:release` (iteración 9) — genera
    el `.aab` firmado y lo verifica en emulador vía bundletool. Falta el incremento de
    `versionCode`/`versionName` (manual, fuera de alcance del script) y la subida real.
13. Alta en Google Play Console: ficha de la app, política de privacidad, clasificación de
    contenido, testing interno/cerrado antes de producción.
14. Revisar permisos nativos que añadan los plugins de Capacitor que se vayan incorporando
    (geolocalización, notificaciones push, etc.) en `AndroidManifest.xml`.
15. Evaluar si conviene CI/CD también para el build/firma Android (hoy no hay CI/CD versionado
    ni siquiera para el despliegue web actual). Si se monta, necesitará `ANDROID_HOME`/JDK 17-21
    configurados en el runner (ver decisión de JDK arriba) y, para builds de release, el keystore
    inyectado como secreto.

## Referencias

- https://capacitorjs.com/docs
- https://capacitorjs.com/docs/android
