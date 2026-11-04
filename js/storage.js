/* Persistence for PSC Kalari.
   Everything the app remembers lives in one JSON document. Keep all reads and
   writes inside this module so the storage engine can be swapped later. */

export const STORAGE_KEY = 'pscKalari.v1';
export const SCHEMA_VERSION = 1;

/** Empty progress document. New optional keys must be added here so old
    backups keep working after an upgrade. */
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

let persistFailed = false;

export function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') return Object.assign(blankState(), parsed);
    }
  } catch (err) {
    persistFailed = true;
  }
  return blankState();
}

/** Returns false when the browser refused to store (private mode, full quota). */
export function saveState(state) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    persistFailed = false;
    return true;
  } catch (err) {
    persistFailed = true;
    return false;
  }
}

export function isPersistent() {
  return !persistFailed;
}
