import 'core-js/stable';
import 'regenerator-runtime/runtime';

const installGlobals = () => {
  if ( window.indexedDB === undefined ) {
    /* eslint no-undef: 0 */
    console.log( 'indexedDB is missing, installing fake-indexeddb...' );
    require( 'fake-indexeddb/auto' ).default;
    console.log( 'indexedDB is missing, installing fake-indexeddb... Done.' );
  }
};

installGlobals();
beforeEach( installGlobals );
