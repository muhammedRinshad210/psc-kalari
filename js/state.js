/* The single in-memory copy of the user's progress, plus the save helper.
   UI modules mutate this object and call save(); storage.js does the writing. */

import { blankState, clearAll, getAll, pruneWrong, setAll } from './storage.js';
import { dayKey } from './util.js';

export const S = getAll();

export function save() {
  return setAll(S);
}

/** Record a missed question, bumping its count and timestamp, capped at 300. */
export function recordMiss(id, date = dayKey()) {
  if (!S.wrong || typeof S.wrong !== 'object') S.wrong = {};
  const prev = S.wrong[id];
  S.wrong[id] = {
    n: (prev && prev.n ? prev.n : 0) + 1,
    last: date
  };
  pruneWrong(S.wrong);
  save();
}

/** Remove a question from the mistakes notebook. */
export function removeMiss(id) {
  if (S.wrong && S.wrong[id]) {
    delete S.wrong[id];
    save();
  }
}

export function isMarked(id) {
  return Array.isArray(S.marks) && S.marks.includes(id);
}

export function toggleMark(id) {
  if (!Array.isArray(S.marks)) S.marks = [];
  const idx = S.marks.indexOf(id);
  if (idx > -1) {
    S.marks.splice(idx, 1);
  } else {
    S.marks.push(id);
  }
  save();
  return isMarked(id);
}

/** Wipe progress in place so every importing module keeps the same reference. */
export function resetState() {
  clearAll();
  Object.keys(S).forEach((k) => delete S[k]);
  Object.assign(S, blankState());
  save();
  return S;
}

/** Replace progress with a backup document, keeping defaults for new keys. */
export function replaceState(next) {
  Object.keys(S).forEach((k) => delete S[k]);
  Object.assign(S, blankState(), next);
  save();
  return S;
}
