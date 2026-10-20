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
// the desktop portal (src/app), so nothing about the server contract changes.

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
  // (getRegistration, not .ready: .ready never resolves when no service worker is
  // registered, which used to leave this function — and the "waiting to send" display — hanging.)
  if ("serviceWorker" in navigator && "SyncManager" in window) {
    try {
      const reg = await navigator.serviceWorker.getRegistration();
      if (reg && reg.sync) await reg.sync.register("zeus-sync");
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

// handlers: { [type]: async (payload) => void } — a handler FAILS by throwing/rejecting
// (MobileApp wraps the desktop saves so that "not saved" throws).
// Drains in insertion order and stops at the first failure so writes that depend on
// earlier ones (a completion before its certificate) stay ordered — except an item that
// has failed MAX_ATTEMPTS times: it's set aside ("couldn't be sent", shown in More) so it
// can't hold up everything queued after it. retry(id) puts it back in line.
const MAX_ATTEMPTS = 30;
const isStuck = item => (item.attempts || 0) >= MAX_ATTEMPTS;

// Only one run at a time: several things can start one (signal back, the 1-minute retry,
// the offline worker's wake-up, "Try again"). A second request while one is running waits
// for it and then runs once more, so an item is never sent twice at the same moment.
let running = null, again = false;
function drainQueue(handlers) {
  if (running) { again = true; return running; }
  running = (async () => {
    let total = 0;
    do { again = false; total += await drainOnce(handlers); } while (again);
    return total;
  })().finally(() => { running = null; });
  return running;
}

async function drainOnce(handlers) {
  const items = await listQueue();
  let drained = 0;
  for (const item of items) {
    if (isStuck(item)) continue;
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
      if ((item.attempts || 0) + 1 < MAX_ATTEMPTS) break;   // keep the order; a newly stuck item steps aside
    }
  }
  return drained;
}

/** Put a set-aside ("couldn't be sent") item back in line. */
async function retry(id) {
  const item = (await listQueue()).find(x => x.id === id);
  if (!item) return;
  const db = await openDb();
  await new Promise((resolve, reject) => {
    const req = tx(db, "readwrite").put({ ...item, attempts: 0 });
    req.onsuccess = resolve; req.onerror = () => reject(req.error);
  });
}

export { enqueue, listQueue, remove, drainQueue, retry, isStuck, MAX_ATTEMPTS };
