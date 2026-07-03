# Despliegue de Angular SPA en Cloudflare Pages

# Despliegue de Angular SPA en Cloudflare Pages

## 1. Introducción

Al conectar un repositorio Angular a Cloudflare Pages, puede aparecer el mensaje:

> "No se ha detectado ninguna configuración de Wrangler. Cloudflare intentará la configuración automática del proyecto."

Esto es normal.  
Wrangler solo se usa para Cloudflare Workers, no para Pages.  
Las aplicaciones Angular **no necesitan Wrangler**, así que Cloudflare intentará detectar automáticamente:

- comando de build  
- directorio de salida  
- dependencias

---

## 1. Requisitos previos

- Proyecto Angular ya creado (por ejemplo con `@angular/cli`)
- Código en un repositorio Git (idealmente GitHub)
- Cuenta en Cloudflare (gratuita)
- Node.js y npm instalados en tu máquina local

---

## Conclusión sobre la selección de cuenta GitHub

Cloudflare Pages debe conectarse a la cuenta (personal u organización) donde esté el repositorio que se va a desplegar.  
No existe ninguna diferencia técnica entre usar la cuenta personal o la organización: Cloudflare solo necesita acceso al repositorio.

**Regla:**  
- Si el repositorio Angular está en tu cuenta personal → selecciona tu cuenta personal.  
- Si el repositorio Angular está en la organización → selecciona la organización.  

En este proyecto, como los repositorios del frontend y backend están agrupados dentro de la organización, se debe seleccionar **la organización** al conectar Cloudflare Pages.

---

## Conclusión sobre el check “Crear repositorio Git privado”

La opción **“Crear repositorio Git privado”** crea un repositorio nuevo y vacío en GitHub, marcado como privado, dentro de la cuenta u organización seleccionada.

**Importante:**  
- No convierte tu repositorio actual en privado.  
- No modifica tu repositorio existente.  
- No es necesario para desplegar un proyecto ya existente.  
- Si se marca por error, Cloudflare creará un repositorio vacío que no sirve para desplegar tu Angular.

**Regla:**  
- Si ya tienes tu proyecto Angular en GitHub → **NO marcar esta opción**.  
- Solo se usa cuando quieres crear un repositorio nuevo desde cero.

En este proyecto, como el repositorio Angular ya existe dentro de la organización, esta opción debe quedar **desmarcada**.


## 2. Preparar el proyecto Angular para producción

1. Instalar dependencias:
   ```bash
   npm install
