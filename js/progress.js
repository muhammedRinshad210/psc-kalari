/* Progress maths, the progress screen, backup/restore and the reset flow. */

import { S, replaceState, resetState } from './state.js';
import { isPersistent } from './storage.js';
import { subjectKeys, subjectInfo } from './data.js';
import { dayKey, dayOffset, esc } from './util.js';
import { subjectName } from './i18n.js';
import { bars, ring } from './ui.js';
import { sylStats, sylAll } from './syllabus.js';

/* ---------- statistics ---------- */

export function accOf(key) {
  const s = S.subj[key];
  return s && s.a ? Math.round((s.c / s.a) * 100) : null;
}

export function totals() {
  let a = 0;
  let c = 0;
  subjectKeys().forEach((k) => {
    const s = S.subj[k];
    if (s) { a += s.a; c += s.c; }
  });
  return { a, c, p: a ? Math.round((c / a) * 100) : 0 };
}

/** Weakest subject with at least three answers and under 85% accuracy. */
export function weakest() {
  let best = null;
  subjectKeys().forEach((k) => {
    const s = S.subj[k];
    if (s && s.a >= 3) {
      const p = s.c / s.a;
      if (!best || p < best.p) best = { k, p };
    }
  });
  return best && best.p < 0.85 ? best.k : null;
}

export function currentStreak() {
  const today = dayKey();
  return S.streak.last === today || S.streak.last === dayOffset(-1) ? S.streak.count : 0;
}

/** Called after an answer is recorded; keeps the streak honest per calendar day. */
export function touchStreak() {
  const today = dayKey();
  if (S.streak.last === today) return;
  S.streak.count = S.streak.last === dayOffset(-1) ? S.streak.count + 1 : 1;
  S.streak.last = today;
  S.streak.best = Math.max(S.streak.best || 0, S.streak.count);
}

export function record(subjectKey, correct) {
  const s = S.subj[subjectKey] || (S.subj[subjectKey] = { a: 0, c: 0 });
  s.a += 1;
  if (correct) s.c += 1;
}

/* ---------- view ---------- */

let ui = { reset: false, importMsg: '', copyMsg: '' };

export function progressUi() {
  return ui;
}

export function viewProgress() {
  const t = totals();
  const st = currentStreak();
  const mocks = S.mocks.slice(-8);
  const all = sylAll();
  const stored = isPersistent();
  let h = '<div class="stack">';

  h += `<section class="card"><div class="row" style="align-items:center;flex-wrap:nowrap;gap:18px">
      ${ring(t.p, `Overall accuracy ${t.p} percent`)}
      <div class="stack" style="gap:8px;min-width:0"><span class="eyebrow">Overall accuracy</span>
      <p>${t.a ? `${t.c} right out of ${t.a} answered.` : 'Answer a few questions and your accuracy will show here.'}</p>
      <div class="row" style="gap:8px"><span class="chip gold">${st}-day streak</span><span class="chip">Best ${S.streak.best || 0} days</span></div></div></div></section>`;

  h += `<section class="card stack"><h2 class="sec" style="margin:0">By subject</h2>${subjectKeys().map((k) => {
    const a = accOf(k);
    const s = S.subj[k] || { a: 0, c: 0 };
    return `<div class="brow"><span>${esc(subjectName(k))}</span>
      <b style="font-variant-numeric:tabular-nums">${a === null ? 'Not started' : `${a}% · ${s.c}/${s.a}`}</b>
      <span class="sbar"><i style="width:${a || 0}%"></i></span></div>`;
  }).join('')}</section>`;

  if (mocks.length) {
    const size = mocks[mocks.length - 1].n;
    h += `<section class="card stack"><div><h2 class="sec" style="margin:0">Mock test scores</h2>
      <p class="sub">Out of ${size}, after negative marking.</p></div>${bars(mocks, size)}</section>`;
  }

  h += `<section class="card"><div class="brow"><span>Syllabus covered</span>
    <b style="font-variant-numeric:tabular-nums">${all.d}/${all.n}</b>
    <span class="sbar"><i style="width:${all.n ? (all.d / all.n) * 100 : 0}%"></i></span></div></section>`;

  h += `<section class="card stack"><h2 class="sec" style="margin:0">Backup and restore</h2>
    <p class="sub">${stored
      ? 'Your data lives in this browser only. Copy the backup text to move it to another phone or browser.'
      : 'This browser is blocking storage, so progress will be lost when you close the page. Copy the backup text to keep it.'}</p>
    <label for="exp" class="sub">Backup text</label><textarea id="exp" readonly>${esc(JSON.stringify(S))}</textarea>
    <div class="row"><button type="button" class="btn sm" data-act="copy">Copy backup</button>
    <span class="sub" id="copyMsg" role="status">${esc(ui.copyMsg)}</span></div>
    <label for="imp" class="sub">Restore from backup text</label>
    <textarea id="imp" placeholder="Paste backup text here"></textarea>
    <div class="row"><button type="button" class="btn sm ghost" data-act="import">Restore</button>
    <span class="sub" role="status">${esc(ui.importMsg)}</span></div></section>`;

  if (ui.reset) {
    h += `<section class="confirm stack"><b>Erase all progress on this device?</b>
      <p class="sub">Scores, streak, mock history and syllabus ticks will be removed. This cannot be undone.</p>
      <div class="row"><button type="button" class="btn warn" data-act="reset-yes">Erase everything</button>
      <button type="button" class="btn ghost" data-act="reset-no">Cancel</button></div></section>`;
  } else {
    h += '<div><button type="button" class="btn ghost sm" data-act="reset">Erase my progress</button></div>';
  }
  return `${h}</div>`;
}

/* ---------- actions ---------- */

export function setResetPrompt(open) {
  ui.reset = open;
}

export function copyBackup() {
  const area = document.getElementById('exp');
  const msg = document.getElementById('copyMsg');
  const done = () => { ui.copyMsg = 'Copied.'; if (msg) msg.textContent = 'Copied.'; };
  const fallback = () => {
    if (area) { area.focus(); area.select(); }
    ui.copyMsg = 'Select and copy the text above.';
    if (msg) msg.textContent = ui.copyMsg;
  };
  if (!area) return;
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(area.value).then(done, fallback);
  } else {
    fallback();
  }
}

export function importBackup(text) {
  try {
    const parsed = JSON.parse(text);
    if (!parsed || typeof parsed !== 'object' || !parsed.subj || !parsed.streak) throw new Error('shape');
    replaceState(parsed);
    ui.importMsg = 'Restored.';
    return true;
  } catch (err) {
    ui.importMsg = 'That text is not a valid backup.';
    return false;
  }
}

export function eraseAll() {
  resetState();
  ui.reset = false;
  ui.importMsg = '';
  ui.copyMsg = '';
}

/** Small helper reused by the landing pages' "your progress" block. */
export function subjectProgressText(key) {
  const acc = accOf(key);
  const info = subjectInfo(key);
  if (acc === null) return `${info ? info.count : 0} questions · not started`;
  return `${acc}% right · ${S.subj[key].a} answered`;
}
