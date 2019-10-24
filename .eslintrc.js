/* eslint-env node */
const imported = require( '@vlsergey/eslint-config' );
module.exports = {
  ...imported,
  rules: {
    ...imported.rules,
    'import/no-unused-modules': [ 1, {
      missingExports: true,
      unusedExports: true,
      src: [ './src/' ],
      ignoreExports: [
        '.*.js',
        './*.js',
        'src/index.js',
      ],
    } ],
  },
};
