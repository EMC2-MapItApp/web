// @ts-check

/** @type {import('stylelint').Config} */
module.exports = {
  extends: ['stylelint-config-standard-scss'],
  overrides: [
    {
      // Fuente de verdad de color del proyecto (CLAUDE.md): estos dos ficheros SON los
      // que definen los valores hex/rgb detrás de cada variable --c-*, así que están
      // exentos de la regla que prohíbe color hardcodeado en el resto del árbol.
      files: ['src/styles/_themes.scss', 'src/styles/_variables.scss'],
      rules: {
        'color-no-hex': null,
        'declaration-property-value-disallowed-list': null,
      },
    },
  ],
  rules: {
    // CLAUDE.md: "Colores: solo variables de tema --c-* — nunca hex hardcodeados."
    'color-no-hex': true,
    'declaration-property-value-disallowed-list': [
      { '/./': [/rgba?\(\s*\d/] },
      {
        message:
          'No literal rgb()/rgba() colors — use a var(--c-*) token instead (see src/styles/_themes.scss).',
      },
    ],

    // El resto de "stylelint-config-standard-scss" es modernización de sintaxis
    // (rgb()/% de alpha/media-feature range) y formato (espaciado, líneas en blanco)
    // que no forma parte de ninguna convención de CLAUDE.md y que Prettier ya cubre en
    // lo que le corresponde — desactivado para no generar ruido ajeno al objetivo real
    // (colores hardcodeados) y no pelear con el estilo ya establecido en el proyecto.
    'color-function-notation': null,
    'color-function-alias-notation': null,
    'alpha-value-notation': null,
    'color-hex-length': null,
    'media-feature-range-notation': null,
    'declaration-block-single-line-max-declarations': null,
    'declaration-empty-line-before': null,
    'custom-property-empty-line-before': null,
    'rule-empty-line-before': null,
    'at-rule-empty-line-before': null,
    'comment-empty-line-before': null,
    'scss/dollar-variable-colon-space-after': null,
    'scss/double-slash-comment-whitespace-inside': null,
    'scss/double-slash-comment-empty-line-before': null,
    'scss/comment-no-empty': null,
    // `-webkit-backdrop-filter` sigue haciendo falta para Safari junto al
    // `backdrop-filter` estándar (glassmorphism de overlays, ver CLAUDE.md).
    'property-no-vendor-prefix': null,
    // `::ng-deep` está deprecado por Angular pero sigue siendo la única vía para
    // penetrar el encapsulamiento de estilos de Angular Material (create-publication,
    // home-shell, register-dialog) - no es un selector CSS desconocido por error.
    'selector-pseudo-element-no-unknown': [true, { ignorePseudoElements: ['ng-deep'] }],
    // Naming de clases (BEM en la práctica, `__`/`--`) no está cubierto por el patrón
    // kebab-case por defecto de esta regla — desactivada para no generar falsos
    // positivos masivos sobre una convención ya consistente en el proyecto.
    'selector-class-pattern': null,
  },
};
