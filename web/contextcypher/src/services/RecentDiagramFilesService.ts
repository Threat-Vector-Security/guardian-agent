const RECENT_DIAGRAM_FILES_DB = 'contextcypher-recent-diagram-files';
const FILE_HANDLES_STORE = 'fileHandles';
const DB_VERSION = 1;

const isIndexedDbSupported = (): boolean => typeof indexedDB !== 'undefined';

const openRecentFilesDb = (): Promise<IDBDatabase> =>
  new Promise((resolve, reject) => {
    if (!isIndexedDbSupported()) {
      reject(new Error('IndexedDB is not available in this environment.'));
      return;
    }

    const request = indexedDB.open(RECENT_DIAGRAM_FILES_DB, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(FILE_HANDLES_STORE)) {
        db.createObjectStore(FILE_HANDLES_STORE);
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('Failed to open recent diagram files database.'));
  });

const withStore = async <T>(
  mode: IDBTransactionMode,
  operation: (store: IDBObjectStore, resolve: (value: T) => void, reject: (reason?: unknown) => void) => void
): Promise<T> => {
  const db = await openRecentFilesDb();

  return new Promise<T>((resolve, reject) => {
    const transaction = db.transaction(FILE_HANDLES_STORE, mode);
    const store = transaction.objectStore(FILE_HANDLES_STORE);

    transaction.oncomplete = () => {
      db.close();
    };
    transaction.onerror = () => {
      db.close();
      reject(transaction.error || new Error('IndexedDB transaction failed.'));
    };
    transaction.onabort = () => {
      db.close();
      reject(transaction.error || new Error('IndexedDB transaction aborted.'));
    };

    operation(store, resolve, reject);
  });
};

export const saveRecentDiagramFileHandle = async (
  id: string,
  handle: FileSystemFileHandle
): Promise<boolean> => {
  if (!id || !handle || !isIndexedDbSupported()) {
    return false;
  }

  try {
    await withStore<void>('readwrite', (store, resolve, reject) => {
      const request = store.put(handle, id);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error || new Error('Failed to store recent diagram file handle.'));
    });
    return true;
  } catch (error) {
    console.warn('[RecentDiagramFilesService] Failed to save file handle', error);
    return false;
  }
};

export const getRecentDiagramFileHandle = async (id: string): Promise<FileSystemFileHandle | null> => {
  if (!id || !isIndexedDbSupported()) {
    return null;
  }

  try {
    return await withStore<FileSystemFileHandle | null>('readonly', (store, resolve, reject) => {
      const request = store.get(id);
      request.onsuccess = () => {
        const result = request.result as FileSystemFileHandle | undefined;
        resolve(result || null);
      };
      request.onerror = () => reject(request.error || new Error('Failed to read recent diagram file handle.'));
    });
  } catch (error) {
    console.warn('[RecentDiagramFilesService] Failed to get file handle', error);
    return null;
  }
};

export const deleteRecentDiagramFileHandle = async (id: string): Promise<void> => {
  if (!id || !isIndexedDbSupported()) {
    return;
  }

  try {
    await withStore<void>('readwrite', (store, resolve, reject) => {
      const request = store.delete(id);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error || new Error('Failed to delete recent diagram file handle.'));
    });
  } catch (error) {
    console.warn('[RecentDiagramFilesService] Failed to delete file handle', error);
  }
};
