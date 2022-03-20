/* eslint-env node */

/* eslint @typescript-eslint/no-unsafe-assignment: 0 */
/* eslint @typescript-eslint/no-unsafe-call: 0 */
/* eslint @typescript-eslint/no-unsafe-member-access: 0 */

// eslint-disable-next-line
const path = require('path');

// eslint-disable-next-line
const imported = require('./node_modules/@vlsergey/js-config/src/karma');

module.exports = function (config) {
  imported(config);

  /* eslint-disable-next-line */
  config.set({
    files: [
      'test/globals.ts',
      'test/**/*Test.ts',
    ],

    webpack: {
      ...config.webpack,
      output: {
        path: path.resolve(__dirname, './lib/'),
      },
    }
  });
};
