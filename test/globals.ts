const installGlobals = () => {
  if (window.indexedDB === undefined) {
    /* eslint no-undef: 0 */
    console.log('indexedDB is missing, installing fake-indexeddb...');
    // eslint-disable-next-line @typescript-eslint/no-var-requires, @typescript-eslint/no-unsafe-member-access
    require('fake-indexeddb/auto').default;
    console.log('indexedDB is missing, installing fake-indexeddb... Done.');
  }
};

installGlobals();
beforeEach(installGlobals);
