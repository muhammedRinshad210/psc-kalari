/* Previous papers hub.
   We only describe papers and link out to the official Kerala PSC site.
   No paper PDFs are hosted here and no paper questions are reproduced. */

import { loadPapers } from './data.js';
import { subjectName, tx } from './i18n.js';
import { esc } from './util.js';
import { errorCard, loadingCard, requestRender } from './ui.js';

let store = { status: 'idle', data: null };

function ensure() {
  if (store.status === 'loading' || store.status === 'ready') return;
  store.status = 'loading';
  loadPapers()
    .then((data) => {
      store = { status: 'ready', data };
      requestRender(true);
    })
    .catch((err) => {
      console.error('[PSC Kalari] papers', err);
      store = { status: 'error', data: null };
      requestRender(true);
    });
}

function outbound(url, label, cls = 'btn sm ghost') {
  return `<a class="${cls}" href="${esc(url)}" target="_blank" rel="noopener noreferrer"
    aria-label="${esc(label)} (opens in a new tab)">${esc(label)}</a>`;
}

function noticeCard(data) {
  return `<section class="card stack" role="note">
    <span class="eyebrow">Read this first</span>
    <p><b>${esc(data.notice)}</b></p>
    <p class="sub">${esc(data.linkNote)}</p>
    <div class="row">${outbound(data.officialHome, data.officialHomeLabel)}</div>
  </section>`;
}

function paperCard(paper, home) {
  const year = paper.year ? esc(paper.year) : 'Year not yet listed';
  const tags = paper.topicsCovered.map((t) => `<span>${esc(t)}</span>`).join('');
  const link = paper.officialUrl
    ? outbound(paper.officialUrl, 'Open the paper')
    : outbound(home, 'Find it on the official site');
  return `<article class="card stack">
    <div>
      <b style="font-family:var(--f-display);font-size:var(--t-md)">${esc(paper.post)}</b>
      <p class="sub">${esc(paper.exam)}</p>
    </div>
    <p class="pmeta"><span>${year}</span><span>${esc(paper.language)}</span></p>
    <div class="ptags">${tags}</div>
    <p class="sub">${esc(paper.note)}</p>
    <div class="row">${link}</div>
  </article>`;
}

function analysisCard(item) {
  const often = item.often.map((t) => `<li>${esc(t)}</li>`).join('');
  const types = item.types.map((t) => `<li>${esc(t)}</li>`).join('');
  return `<details class="rev">
    <summary><b>${tx(subjectName(item.key, 'en'), subjectName(item.key, 'ml'))}</b></summary>
    <div class="body">
      <b>Topics that come up</b><ul class="ptopics">${often}</ul>
      <b>Question types</b><ul class="ptopics">${types}</ul>
      <span class="sub">${esc(item.tip)}</span>
    </div>
  </details>`;
}

export function viewPapers() {
  ensure();
  if (store.status === 'idle' || store.status === 'loading') return loadingCard('Loading the papers hub…');
  if (store.status === 'error') {
    store = { status: 'idle', data: null };
    return errorCard('The papers hub could not be loaded.', 'papers-retry');
  }

  const data = store.data;
  const papers = data.papers || [];
  const analysis = data.analysis || {};

  let h = '<div class="stack">';
  h += `<div>
    <span class="eyebrow">Previous papers</span>
    <h1 style="font-size:var(--t-xl);margin:4px 0 6px">Previous papers, from the source</h1>
    <p class="sub">Kerala PSC publishes its own question papers. This page shows which paper belongs to which post,
      what each paper usually covers, and then hands you over to the official site to download it.</p>
  </div>`;

  h += noticeCard(data);

  h += `<div><h2 class="sec">Papers by post</h2>
    <p class="sub">A description of each stream, not a substitute for the notification.</p></div>`;
  h += papers.map((p) => paperCard(p, data.officialHome)).join('');

  if (analysis.bySubject && analysis.bySubject.length) {
    h += `<div><h2 class="sec">What to expect, subject by subject</h2>
      <p class="sub">${esc(analysis.meta || '')}</p></div>`;
    h += analysis.bySubject.map(analysisCard).join('');
  }

  h += `<p class="note">${esc(data.notice)}</p>`;
  return `${h}</div>`;
}
