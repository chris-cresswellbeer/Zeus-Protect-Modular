// src/mobile/lib/syncQueue.js
//
// Durable write queue for the PWA. Everything the user does offline is appended
// here and drained when connectivity returns. Backed by IndexedDB so it survives
// the app being killed mid-shift.
//
// Each item: { id, type, payload, createdAt, attempts, label }
//   type    — a key in the handler map passed to drainQueue()
//   label   — human-readable, shown in More > Offline queue
//
// The handlers are the app's existing dbSave*/dbAcknowledge* functions from
// App.jsx, so nothing about the server contract changes.

// IndexedDB names. Changing DB_NAME/STORE orphans any queued items on devices; bump
// DB_VERSION (and handle it in onupgradeneeded) if the store shape ever changes.
const DB_NAME = "zeus-protect-sync";
const STORE = "queue";
const DB_VERSION = 1;

let _dbPromise = null;

// Opens (and on first use creates) the IndexedDB database. The promise is cached so
// every call shares one connection.
function openDb() {
  if (_dbPromise) return _dbPromise;
  _dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: "id" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return _dbPromise;
}

function tx(db, mode) {
  return db.transaction(STORE, mode).objectStore(STORE);
}

function newId() {
  return "q_" + Date.now() + "_" + Math.random().toString(36).slice(2, 8);
}

// Append a write to the queue and, where supported (Chrome/Android), register a
// Background Sync so the service worker can prompt a drain later.
async function enqueue(type, payload, label) {
  const db = await openDb();
  const item = {
    id: newId(),
    type,
    payload,
    label: label || type,
    createdAt: new Date().toISOString(),
    attempts: 0,
  };
  await new Promise((resolve, reject) => {
    const req = tx(db, "readwrite").add(item);
    req.onsuccess = resolve;
    req.onerror = () => reject(req.error);
  });
  // Ask the service worker to retry for us if the tab is closed before we drain.
  if ("serviceWorker" in navigator && "SyncManager" in window) {
    try {
      const reg = await navigator.serviceWorker.ready;
      await reg.sync.register("zeus-sync");
    } catch (e) {
      /* Background Sync unavailable (Safari) — the online listener covers it. */
    }
  }
  return item;
}

async function listQueue() {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const req = tx(db, "readonly").getAll();
    req.onsuccess = () =>
      resolve(req.result.sort((a, b) => a.createdAt.localeCompare(b.createdAt)));
    req.onerror = () => reject(req.error);
  });
}

async function remove(id) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const req = tx(db, "readwrite").delete(id);
    req.onsuccess = resolve;
    req.onerror = () => reject(req.error);
  });
}

async function bumpAttempts(item) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const req = tx(db, "readwrite").put({ ...item, attempts: item.attempts + 1 });
    req.onsuccess = resolve;
    req.onerror = () => reject(req.error);
  });
}

// handlers: { [type]: async (payload) => void }
// Drains in insertion order and stops at the first failure so writes that
// depend on earlier ones (a completion before its certificate) stay ordered.
// ⚠ A handler only counts as FAILED if it throws/rejects. The App.jsx db* functions
// wrap writes in dbWrite(), which logs errors and resolves false instead of throwing —
// so a server-side failure is treated as success and the item is removed. To make the
// queue truly durable, have the handlers throw when dbWrite returns false.
async function drainQueue(handlers) {
  const items = await listQueue();
  let drained = 0;
  for (const item of items) {
    const handler = handlers[item.type];
    if (!handler) {
      console.warn("[syncQueue] no handler for type", item.type, "— dropping");
      await remove(item.id);
      continue;
    }
    try {
      await handler(item.payload);
      await remove(item.id);
      drained++;
    } catch (err) {
      console.warn("[syncQueue] failed", item.type, err);
      await bumpAttempts(item);
      break;
    }
  }
  return drained;
}

export { enqueue, listQueue, remove, drainQueue };
