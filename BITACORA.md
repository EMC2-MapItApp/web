# Bitácora — problemas reales y cómo se resolvieron

> A diferencia de `docs/STACK.md` (qué se usa y por qué), este documento recoge **incidentes
> concretos** encontrados durante el desarrollo y despliegue del frontend, con su causa raíz y la
> solución aplicada. Se actualiza cuando aparece un problema real — no es una lista de riesgos
> hipotéticos. La contraparte de este documento en el backend es
> [`BACK/BITACORA.md`](https://github.com/EMC2-MapItApp/back/blob/main_back/BITACORA.md).

## Cloudflare: interfaz de Workers y Pages fusionada

**Síntoma:** al desplegar el sitio estático desde el dashboard, no aparecían pestañas separadas
para "Workers" y "Pages" como en la documentación antigua de Cloudflare.

**Causa:** Cloudflare fusionó ambas interfaces — "Workers + Assets" es la evolución de Pages, y
desplegar una SPA estática desde el dashboard unificado crea un Worker con Assets, no un proyecto
"Pages" clásico, aunque el resultado funcional sea el mismo (hosting estático + CDN).

**Solución:** tratar el proyecto como un Worker desde "Workers y Pages" en el menú lateral; no
buscar una vista "Pages" separada que ya no existe en la interfaz actual.

## Versión de Node incompatible con Angular en el build de Cloudflare

**Síntoma:**
```
Node.js version v22.16.0 detected.
The Angular CLI requires a minimum Node.js version of v22.22.3 or v24.15.0 or v26.0.0.
```

**Causa:** el sistema de build de Cloudflare Workers/Pages necesita que se le indique
explícitamente qué versión de Node usar; sin esa indicación, usa una versión por defecto que
puede no cumplir el mínimo que exige la versión de Angular CLI del proyecto.

**Solución:** fijar la versión de Node en `.nvmrc` (y `.node-version`) en la raíz del proyecto —
Cloudflare lo respeta tanto en Workers con Assets como en Pages clásico. Cualquier entorno nuevo
(otra máquina, otro CI) debe usar la misma versión fijada ahí, no la que tenga instalada por
defecto.

## Límites de bundle demasiado bajos en Cloudflare

**Síntoma:** el build fallaba por exceder el presupuesto de tamaño de bundle configurado por
defecto en el proyecto de Cloudflare.

**Causa:** los límites iniciales del dashboard son conservadores y no escalan automáticamente con
el tamaño real de la aplicación Angular compilada.

**Solución:** aumentar manualmente los límites en el dashboard. Nota: tras aumentarlos, la
plataforma no recogió los nuevos valores hasta eliminar la implementación (`deployment`) y
volver a desplegar desde cero — un simple re-sync del repo no bastó.

## Pantalla en blanco tras un despliegue "exitoso"

**Síntoma:** el build terminaba sin errores y el despliegue se marcaba como correcto, pero la URL
no mostraba nada.

**Causa:** faltaba decirle a Cloudflare dónde estaban los assets compilados y cómo tratar las
rutas de una SPA — sin esa configuración, servía el proyecto como sitio estático genérico y no
encontraba `index.html` para las rutas de Angular Router.

**Solución:** `wrangler.toml` en la raíz del proyecto:
```toml
name = "web"
compatibility_date = "2024-09-23"

[assets]
directory = "./dist/mapit-app/browser"
not_found_handling = "single-page-application"
```
`not_found_handling = "single-page-application"` es la clave: cualquier ruta no encontrada como
archivo estático cae a `index.html`, que es lo que necesita el router de Angular en un despliegue
sin servidor propio.

## Logs de depuración (`console.log`) sueltos sin gatear por entorno

**Síntoma:** varios `console.log` de desarrollo (estado de `ResponsiveService` en cada cambio de
breakpoint, datos de publicaciones en cada `ngOnChanges`) quedaron activos en el código sin
condicionar por `environment.production`, visibles en la consola del navegador también en
producción.

**Causa:** logs añadidos durante el desarrollo para depurar (arquitectura responsive, ruta de
publicaciones) que no se retiraron ni se aislaron antes de mergear.

**Solución:** eliminados. La convención del proyecto (ver `CLAUDE.md`) exige que los logs de
flujo/depuración queden muy aislados y nunca activos en producción — si vuelve a hacer falta
trazar algo similar, debe ir condicionado por `environment.production` o agrupado en un único
punto fácil de retirar, no como líneas sueltas dentro de la lógica de negocio.
