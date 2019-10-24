/* eslint-env node */
module.exports = {
  env: {
    browser: true,
    es6: true,
  },
  globals: {
    // for test:
    describe: true,
    it: true,
  },
  plugins: [ 'promise' ],

  rules: {
    /* Reports:
      modules without any exports
      individual exports not being statically imported or requireed from other modules in the same project */
    'import/no-unused-modules': 0,
    /* Prevent unnecessary path segments in import and require statements. */
    'import/no-useless-path-segments': 1,
  },
  settings: {
    'import/resolver': {
      node: {
        moduleDirectory: [ 'node_modules', 'src', 'test' ],
      },
    },
  },
};
