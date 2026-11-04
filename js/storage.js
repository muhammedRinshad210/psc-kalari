/* Persistence for PSC Kalari.
 *
 * Everything the app remembers is one JSON document. Only this module touches
 * real storage, so phase 2 can move progress to Supabase or Django REST by
 * installing a different driver:
 *
 *   useDriver({
 *     id: 'remote',
 *     read(key)  { ... },   // may be backed by a local cache
 *     write(key, value) { ... },
 *     remove(key) { ... }
 *   });
 *
 * A remote driver should keep a synchronous local cache (hydrated once in
 * boot()) so the rest of the app, which is synchronous, does not change.
 */

export const STORAGE_KEY = 'pscKalari.v1';
export const SCHEMA_VERSION = 1;
export const EXPORT_FORMAT = 'psc-kalari-backup';

/* ---------- drivers ---------- */

const localDriver = {
  id: 'localStorage',
  read(key) { return localStorage.getItem(key); },
  write(key, value) { localStorage.setItem(key, value); },
  remove(key) { localStorage.removeItem(key); }
};

const memoryDriver = (() => {
  const map = new Map();
  return {
    id: 'memory',
    read(key) { return map.has(key) ? map.get(key) : null; },
    write(key, value) { map.set(key, value); },
    remove(key) { map.delete(key); }
  };
})();

let driver = localDriver;
let persistent = null;

/** Swap the storage engine. Call before boot for a remote-backed driver. */
export function useDriver(next) {
  driver = next || localDriver;
  persistent = null;
}

/** True when writes really survive a reload. Flips to the memory driver when
 *  the browser blocks storage (private mode, full quota, blocked cookies). */
export function storageStatus() {
  if (persistent === null) {
    try {
      driver.write('__psc_probe__', '1');
      driver.remove('__psc_probe__');
      persistent = driver.id !== 'memory';
    } catch (err) {
      driver = memoryDriver;
      persistent = false;
    }
  }
  return { persistent, driver: driver.id };
}

/* ---------- the progress document ---------- */

export function blankState() {
  return {
    v: SCHEMA_VERSION,
    subj: {},                       // { subjectKey: { a, c } }
    daily: {},                      // { 'YYYY-MM-DD': { c, n } }
    streak: { last: '', count: 0, best: 0 },
    mocks: [],                      // [{ d, sc, c, w, u, n }]
    syl: {},                        // { 'subject-topicIndex': 1 }
    theme: 'auto',
    lang: 'both'
  };
}

/** Fill in keys added since the document was written. */
function migrate(doc) {
  const base = blankState();
  const next = Object.assign(base, doc);
  next.streak = Object.assign(base.streak, doc && doc.streak);
  next.v = SCHEMA_VERSION;
  return next;
}

export function getAll() {
  storageStatus();
  try {
    const raw = driver.read(STORAGE_KEY);
    if (!raw) return blankState();
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? migrate(parsed) : blankState();
  } catch (err) {
    return blankState();
  }
}

export function setAll(state) {
  try {
    driver.write(STORAGE_KEY, JSON.stringify(state));
    persistent = driver.id !== 'memory';
    return true;
  } catch (err) {
    persistent = false;
    return false;
  }
}

/** Read one top-level field, e.g. get('theme', 'auto'). */
export function get(key, fallback) {
  const doc = getAll();
  return doc[key] === undefined ? fallback : doc[key];
}

/** Write one top-level field without touching the others. */
export function set(key, value) {
  const doc = getAll();
  doc[key] = value;
  return setAll(doc);
}

export function remove(key) {
  const doc = getAll();
  delete doc[key];
  return setAll(doc);
}

export function clearAll() {
  storageStatus();
  try {
    driver.remove(STORAGE_KEY);
  } catch (err) {
    /* nothing to clear */
  }
  return blankState();
}

/* ---------- portable backup ---------- */

/** Text the user can keep, move to another phone, or feed a backend later. */
export function exportState(state = getAll()) {
  return JSON.stringify({
    format: EXPORT_FORMAT,
    version: SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    data: state
  });
}

/** Accepts both the current envelope and the raw document the old
 *  single-file prototype produced, so early users keep their progress. */
export function importState(text) {
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch (err) {
    return { ok: false, error: 'That text is not valid JSON.' };
  }
  if (!parsed || typeof parsed !== 'object') {
    return { ok: false, error: 'That backup is empty.' };
  }
  const doc = parsed.format === EXPORT_FORMAT ? parsed.data : parsed;
  if (!doc || typeof doc !== 'object' || typeof doc.streak !== 'object' || !doc.subj) {
    return { ok: false, error: 'That backup is missing the progress fields.' };
  }
  const next = migrate(doc);
  setAll(next);
  return { ok: true, state: next };
}

/** Keep two open tabs in step. No-op until something actually changes. */
export function onChange(callback) {
  window.addEventListener('storage', (event) => {
    if (event.key === STORAGE_KEY) callback(getAll());
  });
}
