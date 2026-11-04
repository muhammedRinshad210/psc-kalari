/* Mock test hub and presets. The quiz engine runs the paper; this module only
   decides how many questions and how long. */

import { loadAllQuestions } from './data.js';
import { shuffle, esc } from './util.js';
import { startSession } from './quiz.js';
import { S } from './state.js';
import { bars } from './ui.js';

export const PAPERS = {
  mini: { n: 20, minutes: 20, label: 'Mini mock test', blurb: '20 questions, 20 minutes' }
};

export async function startMock(kind = 'mini') {
  const paper = PAPERS[kind] || PAPERS.mini;
  const all = await loadAllQuestions();
  startSession({
    mode: 'mock',
    title: paper.label,
    list: shuffle(all).slice(0, paper.n),
    limit: paper.minutes * 60,
    onAgain: () => startMock(kind)
  });
}

export function viewMock() {
  const paper = PAPERS.mini;
  const attempts = S.mocks.slice(-8);
  const best = S.mocks.length ? Math.max(...S.mocks.map((m) => m.sc)) : null;
  let h = `<div class="stack"><section class="card stack"><span class="eyebrow">${esc(paper.label)}</span>
    <h2 style="font-size:var(--t-xl)">${esc(paper.blurb)}</h2>
    <ul class="list" style="margin-top:-4px">
      <li><span>Marks per correct answer</span><b>1</b></li>
      <li><span>Negative marking per wrong answer</span><b>1/3</b></li>
      <li><span>Unanswered</span><b>0</b></li>
      <li><span>Questions drawn from</span><b>every subject</b></li>
    </ul>
    <button type="button" class="btn" data-act="mock" data-kind="mini" style="align-self:flex-start">Start the test</button>
    <p class="sub">The timer starts as soon as you tap Start. Leaving the page ends the test without saving.</p></section>`;

  if (attempts.length) {
    h += `<section class="card stack"><div><h2 class="sec" style="margin:0">Your last ${attempts.length} attempt${attempts.length > 1 ? 's' : ''}</h2>
      <p class="sub">Score out of ${attempts[attempts.length - 1].n} · best ${best}</p></div>${bars(attempts, attempts[attempts.length - 1].n)}</section>`;
  } else {
    h += '<section class="card"><p class="sub">No attempts yet. Your scores will appear here after the first test.</p></section>';
  }

  return `${h}</div>`;
}
