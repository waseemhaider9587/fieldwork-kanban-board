const DB_NAME = "fieldwork-kanban";
const DB_VERSION = 1;
const STORE_NAME = "boardState";
const RECORD_KEY = "board";

let dbPromise = null;

function openDatabase() {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    if (!("indexedDB" in window)) {
      reject(new Error("IndexedDB is not supported in this browser."));
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "key" });
      }
    };

    request.onsuccess = (event) => resolve(event.target.result);
    request.onerror = (event) => reject(event.target.error);
  });

  return dbPromise;
}

export async function saveBoardState(state) {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    store.put({ key: RECORD_KEY, state, updatedAt: Date.now() });
    tx.oncomplete = () => resolve(true);
    tx.onerror = (event) => reject(event.target.error);
  });
}

export async function loadBoardState() {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const store = tx.objectStore(STORE_NAME);
    const request = store.get(RECORD_KEY);
    request.onsuccess = () => resolve(request.result ? request.result.state : null);
    request.onerror = (event) => reject(event.target.error);
  });
}

export async function clearBoardState() {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).delete(RECORD_KEY);
    tx.oncomplete = () => resolve(true);
    tx.onerror = (event) => reject(event.target.error);
  });
}
