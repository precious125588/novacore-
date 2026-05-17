// ===== NOVACORE STORAGE SYSTEM =====
const NCStorage = (() => {
  let db = null;
  const DB_NAME = 'NovaCoreDB';
  const DB_VERSION = 1;
  const STORES = ['library','downloads','history','favorites','vault','subtitles','lyrics','settings','files','cache'];

  async function init() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = e => {
        const d = e.target.result;
        STORES.forEach(s => { if (!d.objectStoreNames.contains(s)) d.createObjectStore(s, {keyPath:'id'}); });
      };
      req.onsuccess = e => { db = e.target.result; resolve(); };
      req.onerror = e => reject(e.target.error);
    });
  }

  async function put(store, item) {
    if (!item.id) item.id = Date.now() + Math.random().toString(36).slice(2);
    return new Promise((resolve, reject) => {
      const tx = db.transaction(store, 'readwrite');
      const req = tx.objectStore(store).put(item);
      req.onsuccess = () => resolve(item);
      req.onerror = e => reject(e.target.error);
    });
  }

  async function get(store, id) {
    return new Promise((resolve, reject) => {
      const tx = db.transaction(store, 'readonly');
      const req = tx.objectStore(store).get(id);
      req.onsuccess = e => resolve(e.target.result);
      req.onerror = e => reject(e.target.error);
    });
  }

  async function getAll(store) {
    return new Promise((resolve, reject) => {
      const tx = db.transaction(store, 'readonly');
      const req = tx.objectStore(store).getAll();
      req.onsuccess = e => resolve(e.target.result || []);
      req.onerror = e => reject(e.target.error);
    });
  }

  async function remove(store, id) {
    return new Promise((resolve, reject) => {
      const tx = db.transaction(store, 'readwrite');
      const req = tx.objectStore(store).delete(id);
      req.onsuccess = () => resolve();
      req.onerror = e => reject(e.target.error);
    });
  }

  async function clear(store) {
    return new Promise((resolve, reject) => {
      const tx = db.transaction(store, 'readwrite');
      const req = tx.objectStore(store).clear();
      req.onsuccess = () => resolve();
      req.onerror = e => reject(e.target.error);
    });
  }

  // LocalStorage helpers for settings & small data
  function lsGet(key, def = null) {
    try { const v = localStorage.getItem('nc_' + key); return v !== null ? JSON.parse(v) : def; } catch { return def; }
  }
  function lsSet(key, val) { try { localStorage.setItem('nc_' + key, JSON.stringify(val)); } catch {} }
  function lsDel(key) { try { localStorage.removeItem('nc_' + key); } catch {} }

  async function getStorageUsed() {
    if (navigator.storage && navigator.storage.estimate) {
      const est = await navigator.storage.estimate();
      return { used: est.usage || 0, quota: est.quota || 0 };
    }
    return { used: 0, quota: 0 };
  }

  function formatBytes(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
    if (bytes < 1073741824) return (bytes / 1048576).toFixed(1) + ' MB';
    return (bytes / 1073741824).toFixed(2) + ' GB';
  }

  async function showDetails() {
    const { used, quota } = await getStorageUsed();
    NC.ui.showModal('Storage Details', `
      <div style="display:flex;flex-direction:column;gap:8px">
        <div>Used: <strong>${formatBytes(used)}</strong></div>
        <div>Quota: <strong>${formatBytes(quota)}</strong></div>
        <div style="margin-top:4px">
          <div class="progress-bar"><div class="progress-fill" style="width:${quota ? Math.min(100,(used/quota*100)).toFixed(1) : 0}%"></div></div>
        </div>
      </div>
    `, [{ label:'OK', action: () => NC.ui.closeModal() }]);
  }

  async function clearCache() {
    await clear('cache');
    NC.ui.toast('Cache cleared', 'success');
  }

  return { init, put, get, getAll, remove, clear, lsGet, lsSet, lsDel, getStorageUsed, formatBytes, showDetails, clearCache };
})();
