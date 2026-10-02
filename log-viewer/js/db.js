/* ================= IndexedDB ================= */
const DB = (() => {
  let dbp;
  const open = () => dbp ??= new Promise((res, rej) => {
    const r = indexedDB.open('ccf-log-viewer', 1);
    r.onupgradeneeded = () => {
      r.result.createObjectStore('meta', { keyPath: 'id' });
      r.result.createObjectStore('html');
    };
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
  const run = async (stores, mode, fn) => {
    const db = await open();
    return new Promise((res, rej) => {
      const t = db.transaction(stores, mode);
      const req = fn(t);
      t.oncomplete = () => res(req?.result);
      t.onerror = t.onabort = () => rej(t.error);
    });
  };
  return {
    list: () => run(['meta'], 'readonly', (t) => t.objectStore('meta').getAll()),
    html: (id) => run(['html'], 'readonly', (t) => t.objectStore('html').get(id)),
    put: (meta, html) => run(['meta', 'html'], 'readwrite', (t) => {
      t.objectStore('meta').put(meta);
      t.objectStore('html').put(html, meta.id);
    }),
    putMeta: (meta) => run(['meta'], 'readwrite', (t) => { t.objectStore('meta').put(meta); }),
    del: (id) => run(['meta', 'html'], 'readwrite', (t) => {
      t.objectStore('meta').delete(id);
      t.objectStore('html').delete(id);
    }),
  };
})();
navigator.storage?.persist?.();
