/* The single in-memory copy of the user's progress, plus the save helper.
   UI modules mutate this object and call save(). */

import { blankState, loadState, saveState } from './storage.js';

export const S = loadState();

export function save() {
  return saveState(S);
}

/** Wipe progress in place so every importing module keeps the same reference. */
export function resetState() {
  Object.keys(S).forEach((k) => delete S[k]);
  Object.assign(S, blankState());
  save();
  return S;
}

export function replaceState(next) {
  resetState();
  Object.assign(S, next);
  save();
  return S;
}
