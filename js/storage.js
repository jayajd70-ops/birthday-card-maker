// IndexedDB storage: templates + photo blobs.
const DB_NAME = 'birthday-card-studio';
const DB_VERSION = 2;
const STORE_TEMPLATES = 'templates';
const STORE_PHOTOS = 'photos';
const STORE_PRESETS = 'presets';

let dbPromise = null;
function openDB() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_TEMPLATES)) {
        db.createObjectStore(STORE_TEMPLATES, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORE_PHOTOS)) {
        db.createObjectStore(STORE_PHOTOS, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORE_PRESETS)) {
        db.createObjectStore(STORE_PRESETS, { keyPath: 'id' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror  = () => reject(req.error);
  });
  return dbPromise;
}

function tx(storeName, mode = 'readonly') {
  return openDB().then(db => db.transaction(storeName, mode).objectStore(storeName));
}

export async function saveTemplate(record) {
  const store = await tx(STORE_TEMPLATES, 'readwrite');
  return new Promise((resolve, reject) => {
    const r = store.put(record);
    r.onsuccess = () => resolve(record);
    r.onerror   = () => reject(r.error);
  });
}

export async function getTemplate(id) {
  const store = await tx(STORE_TEMPLATES);
  return new Promise((resolve, reject) => {
    const r = store.get(id);
    r.onsuccess = () => resolve(r.result || null);
    r.onerror   = () => reject(r.error);
  });
}

export async function listTemplates() {
  const store = await tx(STORE_TEMPLATES);
  return new Promise((resolve, reject) => {
    const r = store.getAll();
    r.onsuccess = () => resolve((r.result || []).sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0)));
    r.onerror   = () => reject(r.error);
  });
}

export async function deleteTemplate(id) {
  const store = await tx(STORE_TEMPLATES, 'readwrite');
  return new Promise((resolve, reject) => {
    const r = store.delete(id);
    r.onsuccess = () => resolve(true);
    r.onerror   = () => reject(r.error);
  });
}

export async function savePhotoBlob(id, blob) {
  const store = await tx(STORE_PHOTOS, 'readwrite');
  return new Promise((resolve, reject) => {
    const r = store.put({ id, blob, savedAt: Date.now() });
    r.onsuccess = () => resolve(id);
    r.onerror   = () => reject(r.error);
  });
}

export async function getPhotoBlob(id) {
  const store = await tx(STORE_PHOTOS);
  return new Promise((resolve, reject) => {
    const r = store.get(id);
    r.onsuccess = () => resolve(r.result ? r.result.blob : null);
    r.onerror   = () => reject(r.error);
  });
}

export async function deletePhotoBlob(id) {
  const store = await tx(STORE_PHOTOS, 'readwrite');
  return new Promise((resolve, reject) => {
    const r = store.delete(id);
    r.onsuccess = () => resolve(true);
    r.onerror   = () => reject(r.error);
  });
}

export async function savePreset(record) {
  const store = await tx(STORE_PRESETS, 'readwrite');
  return new Promise((resolve, reject) => {
    const r = store.put(record);
    r.onsuccess = () => resolve(record);
    r.onerror   = () => reject(r.error);
  });
}

export async function listPresets() {
  const store = await tx(STORE_PRESETS);
  return new Promise((resolve, reject) => {
    const r = store.getAll();
    r.onsuccess = () => resolve((r.result || []).sort((a, b) => {
      // Pinned first (both pinned → keep by order; both unpinned → order)
      const pa = a.pinned ? 0 : 1, pb = b.pinned ? 0 : 1;
      if (pa !== pb) return pa - pb;
      return (a.order ?? a.createdAt ?? 0) - (b.order ?? b.createdAt ?? 0);
    }));
    r.onerror   = () => reject(r.error);
  });
}

export async function deletePreset(id) {
  const store = await tx(STORE_PRESETS, 'readwrite');
  return new Promise((resolve, reject) => {
    const r = store.delete(id);
    r.onsuccess = () => resolve(true);
    r.onerror   = () => reject(r.error);
  });
}
