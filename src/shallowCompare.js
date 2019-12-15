// @flow

const hasOwnProperty = Object.prototype.hasOwnProperty;

/* Based on https://stackoverflow.com/a/52323412/7813776 with additional checks
and small optimizations */
export default function shallowCompare( obj1 : any, obj2 : any ) : boolean {
  if ( obj1 === undefined || obj2 === undefined ) return obj1 === undefined && obj2 === undefined;
  if ( obj1 === null || obj2 === null ) return obj1 === null && obj2 === null;
  if ( Object.keys( obj1 ).length !== Object.keys( obj2 ).length ) return false;

  return Object.keys( obj1 ).every( key =>
    hasOwnProperty.call( obj2, key ) && obj1[ key ] === obj2[ key ] );
}
