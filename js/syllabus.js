/* Syllabus tracker: tick topics per subject. The topic lists come from
   data/subjects.json and are the same strings used by each question's `topic`. */

import { S, save } from './state.js';
import { subjectList } from './data.js';
import { esc } from './util.js';

const open = {};   // subject key -> panel expanded

export function sylStats(key) {
  const info = subjectList().find((s) => s.key === key);
  const topics = info ? info.topics : [];
  const done = topics.reduce((n, _, i) => n + (S.syl[`${key}-${i}`] ? 1 : 0), 0);
  return { n: topics.length, d: done };
}

export function sylAll() {
  let n = 0;
  let d = 0;
  subjectList().forEach((s) => {
    const st = sylStats(s.key);
    n += st.n;
    d += st.d;
  });
  return { n, d };
}

export function viewSyllabus() {
  const all = sylAll();
  let h = `<div class="stack"><div><span class="eyebrow">Syllabus tracker</span>
    <h2 style="font-size:var(--t-xl);margin-top:4px">${all.d} of ${all.n} topics covered</h2>
    <p class="sub">Tick a topic when you have studied it. This list covers what the practice questions test, so check it against the official notification for your exam.</p></div>`;

  subjectList().forEach((s) => {
    const st = sylStats(s.key);
    const isOpen = Boolean(open[s.key]);
    h += `<section class="card syl"><button type="button" class="syl-h" data-act="sylopen" data-k="${s.key}"
        aria-expanded="${isOpen}" aria-controls="syb-${s.key}">
        <span><b style="font-size:1.05rem" lang="ml">${esc(s.ml)}</b> <span class="sub">· ${esc(s.en)}</span></span>
        <b id="syc-${s.key}" style="font-variant-numeric:tabular-nums">${st.d}/${st.n}</b>
        <span class="sbar"><i id="syp-${s.key}" style="width:${st.n ? (st.d / st.n) * 100 : 0}%"></i></span></button>
      <div class="syl-b" id="syb-${s.key}"${isOpen ? '' : ' hidden'}>${s.topics.map((topic, i) => {
        const id = `${s.key}-${i}`;
        const on = Boolean(S.syl[id]);
        return `<label class="chk${on ? ' done' : ''}" for="sy-${id}">
          <input type="checkbox" id="sy-${id}" data-act="syl" data-id="${id}"${on ? ' checked' : ''}>
          <span>${esc(topic)}</span></label>`;
      }).join('') || '<p class="sub">Topics for this subject will appear here as questions are added.</p>'}</div></section>`;
  });

  return `${h}</div>`;
}

/** Expand/collapse without a full repaint. */
export function togglePanel(key, button) {
  open[key] = !open[key];
  button.setAttribute('aria-expanded', String(open[key]));
  const body = document.getElementById(`syb-${key}`);
  if (body) body.hidden = !open[key];
}

/** Tick a topic; returns the new subject progress so the header can update. */
export function setTopic(id, checked) {
  const key = id.split('-')[0];
  if (checked) S.syl[id] = 1;
  else delete S.syl[id];
  save();
  const st = sylStats(key);
  const count = document.getElementById(`syc-${key}`);
  const bar = document.getElementById(`syp-${key}`);
  if (count) count.textContent = `${st.d}/${st.n}`;
  if (bar) bar.style.width = `${st.n ? (st.d / st.n) * 100 : 0}%`;
  return { key, ...st };
}

/** Called by the change handler to refresh the page heading text. */
export function refreshHeading(root = document) {
  const all = sylAll();
  const h = root.querySelector('#view h2');
  if (h) h.textContent = `${all.d} of ${all.n} topics covered`;
  return all;
}
