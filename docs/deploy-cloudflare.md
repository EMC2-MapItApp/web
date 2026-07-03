# Problemas y Soluciones del Despliegue de MapItApp en Cloudflare

Este documento recoge todos los problemas encontrados durante el despliegue de la aplicación Angular **MapItApp** en Cloudflare, junto con sus soluciones detalladas.

---

## 1. Interfaz unificada: Workers y Pages aparecen mezclados

### Problema
 Ya no aparecen separados en pestañas las implementaciones de Workers y Pages.  

### Causa
Cloudflare ha fusionado la interfaz y **no diferencia visualmente** entre Workers (backend serverless) y Pages (hosting estático).  
Cloudflare Workers + Assets es la evolución de Pages. Cuando despliegas una web estática (Angular ASP) desde el dashboard de Workers y Pages, se crea como un Worker con Assets, no como una "Pages project" tradicional.

### Solución
1. Entrar en **Workers y Pages** desde el menú lateral y tratarlo como un worker.

## 2. Versión de Node incompatible con Angular

### Problema
La version actual probocaba este error:

 - Node.js version v22.16.0 detected.
 - The Angular CLI requires a minimum Node.js version of v22.22.3 or v24.15.0 or v26.0.0.
 - Please update your Node.js version or visit https://nodejs.org/ for additional instructions.

### Causa
 El entorno de compilación (build system) de Cloudflare Workers + Pages necesita saber qué versión de Node.js usar, y por defecto puede no coincidir con lo que espera tu proyecto Angular.

 ### Solución
Crear en la raiz del proyecto .nvmrc con el la version en mi caso la 24. Es la forma más directa y funciona tanto para Workers con Assets como para Pages.

## 3. Límites de presupuesto de bundle

### Problema
Los limites iniciales son demasiado bajos.
### Solución
Aumentar los limites de bundle. Al aumentarlos y sincronizar el repositorio la plataforma no se actualizo y leyó los nuevos valores hasta que no eliminé la implantación y la desplegué de nuevo.

## 4. No se muestra nada!!

### Problema

Ya desplegado sin errores no muestra nada en la url.

### Solución

Crear un wrangler.toml en la raiz del proyecto para darle a la plataforma las rutas de donde está el index.html.

Se ha creado con este contenido: 
name = "web"
compatibility_date = "2024-09-23"

[assets]
directory = "./dist/mapit-app/browser"
not_found_handling = "single-page-application"
