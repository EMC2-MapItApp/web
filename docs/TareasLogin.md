# 🗺️ Roadmap de Evolución: Registro y Login Incremental

Este documento detalla las tareas necesarias para transformar nuestro sistema de autenticación actual en un sistema moderno, seguro y adaptado a diferentes roles de usuario.

---

## 🛠️ Reglas de desarrollo

- [ ] **Comentarios explicativos:** Añadir documentación interna en cada elemento relevante o complejo del código.
- [ ] **Principios SOLID:** Garantizar un código modular, escalable y con una clara separación de responsabilidades.
- [ ] **Buenas prácticas:** Mantener funciones limpias con una sola responsabilidad y escribir código legible.
- [ ] **Estilos globales:** Reutilizar componentes de UI y tokens de diseño en la medida de lo posible para evitar duplicar código.
- [ ] **Manejo seguro de errores:** Diseñar mensajes de error genéricos en el Login/Registro (ej: "Credenciales incorrectas") para evitar la enumeración de usuarios y proteger la privacidad.
- [ ] **Prohibición estricta de logs sensibles:** Queda terminantemente prohibido registrar contraseñas en texto plano, tokens, JWTs o datos personales en los logs del sistema (tanto en cliente como en servidor).

---

## 🚀 FASE 1: Registro Tradicional Seguro (Email + `zxcvbn`)
**Objetivo:** Eliminar la vulnerabilidad de contraseñas débiles y asegurar que los correos electrónicos sean reales y verificados.

### 🔹 Backend
- [ ] **Actualizar esquema de base de datos:** Modificar las restricciones de la contraseña (eliminar el límite máximo corto, ajustar validaciones).
- [ ] **Cambiar validación de contraseña:** Implementar un validador en el servidor que rechace contraseñas con puntuación baja según criterios de entropía (mínimo equivalente a lo recomendado por `zxcvbn`).
- [ ] **Robustecer validación de Email:** Implementar sintaxis estricta de email en el endpoint de registro (evitar correos mal formados o dominios de un solo carácter no válidos).
- [ ] **Sistema de Verificación de Email:**
  - [ ] Crear tabla/colección para tokens de verificación temporales (expiración de 15-30 min).
  - [ ] Configurar servicio de envío de correos (SMTP / SendGrid / AWS SES).
  - [ ] Diseñar plantilla HTML para el correo de verificación.
  - [ ] Crear endpoint `/api/auth/verify-email` que valide el token y active al usuario.
- [ ] **Bloqueo del estado del usuario:** Impedir el login a usuarios cuyo `is_verified` sea `false`.
- [x] **Recuperación de contraseña ("olvidé mi contraseña"):**
  - [x] Colección/token de un solo uso para el reset (`PasswordResetToken`, expiración 15 min), mismo patrón que la verificación de email.
  - [x] Endpoints `/api/v1/auth/forgot-password` (a diferencia de `resend-verification`, sí distingue si el email existe — 404 si no) y `/api/v1/auth/reset-password`.
  - [x] Plantilla HTML del correo de restablecimiento.

### 🔹 Frontend / Mobile
- [ ] **Carga diferida (Lazy Loading) de `zxcvbn`:** Configurar la importación asíncrona de la librería para que se descargue únicamente cuando el usuario haga foco (*focus*) en el campo de la contraseña, optimizando el tamaño inicial de la app.
- [ ] **Componente de barra de fuerza de contraseña:** Crear un indicador visual (colores: rojo, amarillo, verde) que reaccione en tiempo real mientras el usuario escribe mediante la puntuación de `zxcvbn`.
- [ ] **Deshabilitar botón de Registro:** El botón debe permanecer inactivo si el email no es válido o si la puntuación de la contraseña es insuficiente (inferior a 3 en la escala de 0-4).
- [ ] **Pantalla de Espera de Verificación:** Redirigir al usuario tras el registro a una pantalla que le indique revisar su bandeja de entrada.
- [ ] **Flujo de reenvío de enlace:** Añadir botón de "Reenviar correo de verificación" con *debounce* (espera de 60 segundos entre reenvíos).
- [x] **Recuperación de contraseña:** Diálogo "¿Olvidaste tu contraseña?" (`forgot-password/`, abierto desde el login) y página real `reset-password/` con formulario de contraseña nueva + medidor de fuerza (reutiliza `PasswordStrengthMeterComponent`).

---

## 🌐 FASE 2: Autenticación Social (OAuth 2.0)
**Objetivo:** Reducir la fricción en el registro permitiendo el acceso con un solo clic a través de plataformas de confianza.

### 🔹 Tareas de Configuración (Dev Consoles)
- [ ] Crear cuenta y configurar proyecto en **Google Cloud Console** (obtener Client ID y Client Secret).
- [ ] Crear cuenta y configurar proyecto en **Apple Developer Program** (Configurar Sign in with Apple, llaves y dominios).

### 🔹 Backend
- [ ] **Evolución del Modelo de Usuario:** Modificar la entidad de usuario para soportar múltiples métodos de autenticación (ej. añadir `provider: 'local' | 'google' | 'apple'` e `oauth_id`).
- [ ] **Endpoint de Callback de Redes Sociales:**
  - [ ] Crear `/api/auth/callback/google` y `/api/auth/callback/apple`.
  - [ ] Implementar la lógica para verificar la firma del token recibido desde el proveedor externo.
- [ ] **Lógica de Autovinculación:** Si el email de Google/Apple ya existe como cuenta tradicional, decidir si se vinculan automáticamente (aplica si el proveedor garantiza que el mail está verificado).

### 🔹 Frontend / Mobile
- [ ] **Diseño de Interfaz:** Añadir botones "Continuar con Google" y "Continuar con Apple" en las pantallas de Login y Registro.
- [ ] **Integración de SDKs / Redirecciones:** Implementar el flujo de autenticación (web redirigida/popup o librerías nativas en iOS/Android).

---

## 🔒 FASE 3: Registro con Biometría (Passkeys / WebAuthn)
**Objetivo:** Implementar el estándar criptográfico moderno de acceso mediante huella/rostro, gestionando las limitaciones de hardware en PCs.

### 🔹 Backend
- [ ] **Instalar biblioteca WebAuthn:** Integrar una librería compatible con el lenguaje del backend (ej: `@simplewebauthn/server` para Node.js).
- [ ] **Endpoints de Registro de Passkey:**
  - [ ] `/api/auth/passkey/register-options` (genera el desafío criptográfico).
  - [ ] `/api/auth/passkey/register-verify` (valida la clave pública enviada por el dispositivo y la guarda).
- [ ] **Endpoints de Login con Passkey:**
  - [ ] `/api/auth/passkey/login-options`.
  - [ ] `/api/auth/passkey/login-verify`.

### 🔹 Frontend / Mobile (Lógica de Detección y Fallback)
- [ ] **Detección de Hardware:** Implementar validación al cargar la pantalla mediante `PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable()` para saber si el dispositivo soporta biometría nativa.
- [ ] **Flujo Condicional:**
  - [ ] **Si soporta biometría:** Mostrar la opción "Registrarse con Huella / Rostro (Passkey)" de manera destacada.
  - [ ] **Si NO soporta biometría (PC de escritorio antiguo, etc.):** Ocultar/deshabilitar la opción de biometría y obligar al usuario a realizar el registro de la **Fase 1** (Email + Contraseña robusta) de manera mandatoria.
- [ ] **Flujo de Login rápido:** Si el usuario ya configuró Passkey, activar automáticamente el prompt biométrico del sistema operativo al pulsar en el campo de email.

---

## 💼 FASE 4: Passwordless Exclusivo (Profesionales y Entidades)
**Objetivo:** Ofrecer una capa de conveniencia premium (sin contraseñas) mediante Magic Links u OTP solo a los roles corporativos o profesionales una vez que su perfil esté disponible.

### 🔹 Backend
- [ ] **Middleware de Verificación de Rol:** Crear lógica que valide si el usuario que intenta loguearse en modo passwordless tiene asignado el rol de `PROFESIONAL` o `ENTIDAD`.
- [ ] **Módulo de Código de Un Solo Uso (OTP) / Magic Links:**
  - [ ] Crear endpoint `/api/auth/passwordless/request`.
  - [ ] Generar tokens de un solo uso muy cortos (expiración de 5 minutos).
  - [ ] Enviar por correo el enlace con el token incrustado (o un código numérico de 6 dígitos).
- [ ] **Endpoint de Verificación Passwordless:** `/api/auth/passwordless/verify` que valide el token/OTP, compruebe el rol y emita el JWT de sesión.

### 🔹 Frontend / Mobile
- [ ] **Pantalla de login condicional:** Al introducir el email en el login, el frontend consulta de manera asíncrona si ese mail pertenece a un Profesional/Entidad.
- [ ] **UI Adaptativa:** Si el rol coincide, se le muestra la pantalla *"Te enviaremos un acceso directo a tu correo"* en lugar de pedirle contraseña.
- [ ] Pantalla para introducir el código OTP (si se elige método de dígitos) o pantalla de confirmación *"Revisa tu bandeja de entrada para entrar"*.
- [ ] 