// @ts-check
const eslint = require("@eslint/js");
const { defineConfig } = require("eslint/config");
const tseslint = require("typescript-eslint");
const angular = require("angular-eslint");
const boundaries = require("eslint-plugin-boundaries");
const rxjsX = require("eslint-plugin-rxjs-x").default;

module.exports = defineConfig([
  {
    files: ["**/*.ts"],
    extends: [
      eslint.configs.recommended,
      tseslint.configs.recommended,
      tseslint.configs.stylistic,
      angular.configs.tsRecommended,
    ],
    processor: angular.processInlineTemplates,
    languageOptions: {
      parserOptions: {
        // rxjs-x necesita info de tipos para distinguir Observable/Subscription de
        // cualquier otro valor con `.subscribe`/`.pipe`.
        projectService: true,
        tsconfigRootDir: __dirname,
      },
    },
    plugins: {
      boundaries,
      "rxjs-x": rxjsX,
    },
    settings: {
      // Sin esto, boundaries ve cada import por alias (@core/*, @features/*...) como
      // módulo "external" desconocido en vez de resolverlo al archivo real de src/app/
      // — y sin resolverlo no puede clasificarlo ni aplicar boundaries/dependencies.
      "import/resolver": {
        typescript: { project: "./tsconfig.json" },
      },
      "boundaries/elements": [
        { type: "core", pattern: "src/app/core/**" },
        { type: "shared", pattern: "src/app/shared/**" },
        { type: "layout", pattern: "src/app/layout/**" },
        { type: "feature", pattern: "src/app/features/*/**", capture: ["feature"] },
      ],
    },
    rules: {
      "@angular-eslint/directive-selector": [
        "error",
        {
          type: "attribute",
          prefix: "app",
          style: "camelCase",
        },
      ],
      "@angular-eslint/component-selector": [
        "error",
        {
          type: "element",
          prefix: "app",
          style: "kebab-case",
        },
      ],
      // Capas de arquitectura de CLAUDE.md: core es transversal y puede depender de
      // shared y de una feature concreta (p. ej. los guards que abren el diálogo de
      // login/registro con `await import(...)`, patrón ya documentado en CLAUDE.md);
      // shared es UI reutilizada sin conocer features concretas; layout es el shell;
      // cada feature solo puede depender de sí misma, core y shared — nunca de otra
      // feature (si dos features necesitan el mismo componente, ese componente se
      // promueve a shared/, no se importa de una feature a otra).
      "boundaries/dependencies": [
        "error",
        {
          default: "disallow",
          rules: [
            { from: "core", allow: ["core", "shared", "feature"] },
            { from: "shared", allow: ["core", "shared"] },
            { from: "layout", allow: ["core", "shared", "layout"] },
            { from: "feature", allow: ["core", "shared", ["feature", { feature: "${feature}" }]] },
          ],
        },
      ],
      // subscribe() anidado (un .subscribe dentro de otro) es el anti-patrón RxJS más
      // claro: rompe el manejo de errores del pipe y complica el teardown. No se activa
      // "no-ignored-subscription" — el patrón dominante del proyecto es HTTP one-shot
      // sin gestión explícita de la suscripción (se completa sola), así que esa regla
      // sería ruido, no señal, en este código base.
      "rxjs-x/no-nested-subscribe": "error",
    },
  },
  {
    files: ["**/*.html"],
    extends: [
      angular.configs.templateRecommended,
      angular.configs.templateAccessibility,
    ],
    rules: {},
  }
]);
