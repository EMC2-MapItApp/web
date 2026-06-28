# Arquitectura Responsive Portable (Angular)

## Objetivo
Definir una arquitectura responsive reutilizable para clasificar la experiencia en mobile, tablet y desktop, separando:
- Presentacion visual (SCSS)
- Comportamiento de UI (servicio responsive)
- Contratos compartidos (modelo)

Esta guia aplica a este proyecto y esta pensada para exportarse a otros proyectos Angular con cambios minimos.

## Principios de diseno
1. Fuente unica de verdad: un servicio responsive en core.
2. Sin numeros magicos en componentes: breakpoints centralizados.
3. CSS para look and feel, servicio para decisiones de comportamiento.
4. Estado reactivo: componentes consumen estado, no calculan viewport.
5. Dependencia primaria en viewport/capacidades, no en user-agent.

## Estructura recomendada

### Estructura en este proyecto (MapIt front)
```text
src/
	app/
		core/
			responsive/
				breakpoints.constants.ts
				responsive.model.ts
				responsive.service.ts
	styles/
		_variables.scss
		_mixins.scss
```

### Estructura portable para cualquier Angular
```text
src/
	app/
		core/
			responsive/
				breakpoints.constants.ts
				responsive.model.ts
				responsive.service.ts
```

Nota: el bloque `core/responsive` simplifica exportacion a otros repositorios porque encapsula todo en una carpeta.

## Modelo (contrato de dominio)

### Enum de clase de dispositivo
- Mobile
- Tablet
- Desktop

### Estado responsive sugerido
Campos minimos:
- `deviceClass`: mobile | tablet | desktop
- `isMobile`: boolean
- `isTablet`: boolean
- `isDesktop`: boolean
- `isPortrait`: boolean
- `isLandscape`: boolean
- `width`: number
- `height`: number

Campos opcionales para UX avanzada:
- `hasTouch`: boolean
- `hasHover`: boolean
- `pointerCoarse`: boolean
- `pointerFine`: boolean

## Breakpoints base
Propuesta practica:
- Mobile: `0-767`
- Tablet: `768-1023`
- Desktop: `1024+`

Recomendacion:
- Definirlos una sola vez en `core/responsive/breakpoints.constants.ts`.
- Reflejarlos tambien en SCSS variables/mixins para consistencia visual.

## Flujo funcional (end-to-end)
1. El navegador dispara cambio de viewport u orientacion.
2. `ResponsiveService` escucha con `BreakpointObserver` (Angular CDK) y/o media queries complementarias.
3. El servicio transforma el resultado tecnico en `ResponsiveState` (modelo de dominio).
4. El servicio publica estado reactivo (`Observable` y opcionalmente `Signal`).
5. Los componentes consumen ese estado para decisiones de comportamiento:
	 - abrir dialog full-screen en mobile
	 - cambiar densidad de tarjetas
	 - colapsar/expandir navegacion
6. SCSS aplica ajustes de layout y espaciado por breakpoint.
7. La app mantiene coherencia entre logica y estilo porque ambos usan el mismo contrato.

## Flujo de implementacion en este proyecto

### Paso 1: Contratos y constantes
Crear:
- `src/app/core/responsive/breakpoints.constants.ts`
- `src/app/core/responsive/responsive.model.ts`

Definir:
- rangos mobile/tablet/desktop
- interfaz `ResponsiveState`

### Paso 2: Servicio central
Crear:
- `src/app/core/responsive/responsive.service.ts`

Responsabilidades:
- observar breakpoints
- mapear a `ResponsiveState`
- exponer API publica estable (`state$`, `isMobile$`, etc.)

### Paso 3: Integracion en componentes
Consumir servicio desde componentes de alto impacto (home, shell, dialogs).

Regla:
- componente no calcula `window.innerWidth`
- componente solo consume estado del servicio

### Paso 4: Alineacion SCSS
En `src/styles/_variables.scss` y `src/styles/_mixins.scss`:
- declarar breakpoints equivalentes
- crear mixins reutilizables (`mobile`, `tablet`, `desktop`)

### Paso 5: Validacion
Escenarios minimos:
- 360x800 (mobile)
- 768x1024 (tablet)
- 1366x768 (desktop)

Verificar:
- transiciones de layout
- dialogs y menus
- comportamiento de mapa/listados

## Guia de exportacion a otros proyectos

## Opcion A (recomendada): modulo reutilizable interno
1. Copiar carpeta completa `core/responsive`.
2. Ajustar solo los breakpoints en `breakpoints.constants.ts`.
3. Conectar componentes al contrato `ResponsiveState`.
4. Replicar mixins SCSS.

Ventaja:
- baja friccion y mismo contrato entre apps.

## Opcion B: libreria privada (workspace o paquete interno)
1. Extraer `responsive.model`, `breakpoints.constants` y `responsive.service` a una libreria.
2. Publicar versionada (npm privada o libreria monorepo).
3. Consumir desde multiples apps.

Ventaja:
- versionado central y upgrades controlados.

Costo:
- mayor setup inicial.

## Opcion C: plantilla base de proyecto
1. Incluir arquitectura responsive en un starter.
2. Cada app nueva parte desde la plantilla.

Ventaja:
- estandarizacion por defecto.

## Checklist de portabilidad
- `@angular/cdk` instalado.
- Breakpoints definidos en TS y SCSS con los mismos cortes.
- API publica del servicio documentada y estable.
- Sin referencias directas a componentes especificos del proyecto.
- Pruebas de viewport en al menos 3 tamanos.

## Versionado de contrato (muy recomendado)
Si el estado crece, mantener compatibilidad:
- agregar campos nuevos sin romper los actuales
- evitar renombrar propiedades existentes sin una migracion
- documentar cambios en changelog interno

## Riesgos comunes y mitigaciones
- Riesgo: drift entre breakpoints TS y SCSS.
	Mitigacion: checklist de paridad y revision en PR.

- Riesgo: abuso de flags en componentes.
	Mitigacion: exponer estado compuesto y helpers en el servicio.

- Riesgo: depender de user-agent.
	Mitigacion: usar viewport + capacidades (touch/hover) como base.

## Recomendacion para MapIt
Implementar primero con Opcion A (modulo interno reusable) y, cuando haya 2 o mas proyectos consumidores, migrar a Opcion B (libreria privada).

Con eso se reduce costo inicial y se conserva camino claro a estandarizacion multi-proyecto.

## Directrices especificas de MapIt (MVP)

### Prioridad de producto
El mapa es el elemento principal de la aplicacion y debe ocupar el maximo espacio util posible en todas las resoluciones.

### Reglas de experiencia por dispositivo

1. Mobile
- El mapa se muestra de forma prioritaria y ocupa practicamente toda la pantalla.
- El formulario de nueva publicacion se oculta por completo por defecto.
- El formulario se abre solo mediante un boton flotante (FAB).
- Los formularios (login, registro, nueva publicacion, otros flujos de entrada) se muestran a pantalla completa.
- Los botones principales de Home se presentan como botones flotantes para no reducir el area del mapa.

2. Tablet
- Mantener prioridad visual del mapa.
- Formularios en modalidad full-screen cuando el espacio vertical sea limitado.
- Botones principales de Home en formato flotante o semi-flotante segun densidad de pantalla.

3. Desktop
- El formulario de nueva publicacion permanece visible de forma persistente junto al mapa.
- El mapa sigue siendo protagonista visual, evitando paneles sobredimensionados.
- Los formularios pueden abrirse en dialog/panel, salvo que el caso de uso requiera full-screen.

### Comportamiento del formulario de nueva publicacion
- Desktop: visible siempre.
- Mobile: oculto por defecto.
- Mobile: reaparece al pulsar boton flotante dedicado.
- Al cerrar el formulario en mobile, se vuelve al estado de mapa completo.

### Criterios de aceptacion UX
1. En mobile, el usuario ve primero el mapa sin bloqueos de paneles.
2. En mobile, crear publicacion requiere accion explicita en boton flotante.
3. En desktop, crear publicacion esta siempre disponible sin tapar el mapa principal.
4. Todos los formularios en mobile se renderizan a pantalla completa.
5. Home mantiene acciones clave accesibles mediante botones flotantes.

## Preferencias de interaccion consolidadas (aplicar al resto de plantillas)

### 1. Patron de cierre por toque fuera
- Regla general: paneles flotantes deben cerrarse al tocar fuera.
- Excepcion: no cerrar si el click viene de controles interactivos internos del propio panel.
- Implementacion recomendada: handler en contenedor padre + `stopPropagation()` dentro del panel.

### 2. Home: menu lateral en mobile portrait
- Debe estar completamente oculto por defecto.
- Debe desplegarse hacia abajo justo bajo el header al pulsar hamburguesa.
- Debe mostrarse en overlay, sin desplazar el mapa ni el contenido principal.
- Debe usar fondo casi transparente con blur alto (estilo glass).
- Debe tener ancho ajustado al contenido (icono + padding), no a todo el viewport.
- En mobile portrait se muestran solo iconos (sin etiquetas de texto).

### 3. Home: comportamiento al pulsar opciones del menu
- Al pulsar cualquier opcion del menu (enlace o item bloqueado), el menu se cierra.
- Adicionalmente, si se pulsa fuera del menu abierto, tambien se cierra.

### 4. Maps: panel de categorias
- El boton hamburguesa interno del panel se elimina.
- El texto "Categorias" se convierte en boton para abrir/cerrar el panel.
- Al seleccionar cualquier location type, el panel de categorias se cierra.
- Al pulsar fuera del panel de categorias, tambien se cierra.

### 5. Consistencia visual reusable
- Reutilizar variables de tema (`--c-*`) y mixins globales en lugar de estilos ad hoc.
- En overlays, priorizar glassmorphism suave (fondo translúcido + blur) y bordes sutiles.
- Mantener transiciones cortas (180-250ms) para paneles y menus.

### Checklist de aplicacion por plantilla
1. La plantilla identifica su panel/overlay principal.
2. Se define apertura/cierre por boton principal.
3. Se implementa cierre por toque fuera con exclusion de controles internos.
4. En mobile portrait, el overlay no desplaza el contenido.
5. Se valida que al pulsar opcion interna el panel se cierre solo cuando corresponda.