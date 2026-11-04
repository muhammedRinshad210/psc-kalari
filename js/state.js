/* The single in-memory copy of the user's progress, plus the save helper.
   UI modules mutate this object and call save(); storage.js does the writing. */

import { blankState, clearAll, getAll, setAll } from './storage.js';

export const S = getAll();

export function save() {
  return setAll(S);
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
