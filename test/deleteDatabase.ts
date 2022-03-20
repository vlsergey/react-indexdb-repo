export default async function deleteDatabase (
    databaseName: string
): Promise< IDBDatabase > {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = window.indexedDB.deleteDatabase(databaseName);
    request.onsuccess = () => resolve(request.result);
    request.onerror = reject;
  });
}
