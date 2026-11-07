/* Mock test hub and presets. The quiz engine runs the paper; this module only
   decides how many questions, how long, balanced drawing, and persistence. */

import { loadAllQuestions, questionById, totalQuestions } from './data.js';
import { esc, fmtTime, r2, shuffle } from './util.js';
import { endSession, finishMock, session, startSession } from './quiz.js';
import { S } from './state.js';
import { bars, requestRender } from './ui.js';
import { tx } from './i18n.js';

export const FULL_QUESTIONS = 100;
export const FULL_MINUTES = 75;
/* Assumption: 100 questions in 75 minutes is typical for Kerala PSC Degree/Plus Two Prelims,
   but check the specific exam notification for the exact duration and question count. */

export const PAPERS = {
  mini: { n: 20, minutes: 20, label: 'Mini mock test', blurb: '20 questions, 20 minutes' },
  full: { n: FULL_QUESTIONS, minutes: FULL_MINUTES, label: 'Full mock paper', blurb: `${FULL_QUESTIONS} questions, ${FULL_MINUTES} minutes` }
};

export const MOCK_STORAGE_KEY = 'pscKalari.mock';

/** Pure scoring formula: +1 per correct, -1/3 per wrong, rounded to 2 decimals. */
export function score(correct, wrong) {
  return r2(correct - wrong / 3);
}

/**
 * Balanced draw: round-robin across subjects that have questions,
 * so one subject cannot dominate.
 */
export function drawBalanced(all, count, rnd = Math.random) {
  const bySubject = new Map();
  for (const q of all) {
    const s = q.subject;
    if (!bySubject.has(s)) bySubject.set(s, []);
    bySubject.get(s).push(q);
  }

  const pools = [];
  for (const list of bySubject.values()) {
    if (list.length > 0) pools.push(shuffle(list, rnd));
  }
  shuffle(pools, rnd);

  const picked = [];
  let i = 0;
  while (picked.length < count && pools.some((p) => p.length > 0)) {
    const pool = pools[i % pools.length];
    if (pool.length > 0) {
      picked.push(pool.pop());
    }
    i += 1;
  }

  return shuffle(picked, rnd);
}

export function saveRunningMock(data) {
  try {
    localStorage.setItem(MOCK_STORAGE_KEY, JSON.stringify(data));
  } catch (err) {
    console.warn('[PSC Kalari] Could not save mock test', err);
  }
}

export function loadRunningMock() {
  try {
    const raw = localStorage.getItem(MOCK_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (err) {
    return null;
  }
}

export function clearRunningMock() {
  try {
    localStorage.removeItem(MOCK_STORAGE_KEY);
  } catch (err) {}
}

let resumeTimer = null;

export function stopResumeTimer() {
  if (resumeTimer) {
    clearInterval(resumeTimer);
    resumeTimer = null;
  }
}

export function tickMockResume() {
  const btn = document.getElementById('mockResumeBtn');
  if (!btn) {
    stopResumeTimer();
    return;
  }
  const saved = loadRunningMock();
  if (!saved) {
    stopResumeTimer();
    requestRender();
    return;
  }
  const left = Math.max(0, Math.floor((saved.endsAt - Date.now()) / 1000));
  if (left <= 0) {
    stopResumeTimer();
    autoSubmitSavedMock(saved);
  } else {
    btn.textContent = `Resume your test (${fmtTime(left)} left)`;
  }
}

export async function startMock(kind = 'mini') {
  if (kind === 'full' && totalQuestions() < 300) return;
  const paper = PAPERS[kind] || PAPERS.mini;
  const all = await loadAllQuestions();
  const list = drawBalanced(all, paper.n);
  const limit = paper.minutes * 60;
  const endsAt = Date.now() + limit * 1000;

  startSession({
    mode: 'mock',
    kind,
    title: paper.label,
    list,
    limit,
    endsAt,
    onAgain: () => startMock(kind)
  });
}

export function restoreMockSession(saved) {
  const items = saved.qids.map((id, i) => {
    const q = questionById(id);
    const order = saved.optOrders[i];
    return {
      id: q.id,
      s: q.subject,
      q: q.q.en,
      mq: q.q.ml,
      e: q.explanation.en,
      me: q.explanation.ml,
      opts: order.map((idx) => q.options.en[idx]),
      mopts: order.map((idx) => q.options.ml[idx]),
      ans: order.indexOf(q.answerIndex),
      order
    };
  });

  const picks = [];
  if (saved.answers) {
    for (const [k, v] of Object.entries(saved.answers)) {
      if (v !== null && v !== undefined) picks[Number(k)] = v;
    }
  }

  startSession({
    mode: 'mock',
    kind: saved.kind || 'mini',
    title: saved.title || (PAPERS[saved.kind] && PAPERS[saved.kind].label) || 'Mock test',
    items,
    i: typeof saved.i === 'number' ? saved.i : 0,
    picks,
    limit: saved.limit,
    endsAt: saved.endsAt,
    onAgain: () => startMock(saved.kind || 'mini')
  });
}

export async function resumeMock() {
  stopResumeTimer();
  const saved = loadRunningMock();
  if (!saved) return;
  const left = Math.max(0, Math.floor((saved.endsAt - Date.now()) / 1000));
  if (left <= 0) {
    await autoSubmitSavedMock(saved);
    return;
  }
  await loadAllQuestions();
  restoreMockSession(saved);
  requestRender();
}

export function discardMock() {
  stopResumeTimer();
  clearRunningMock();
  if (session() && session().mode === 'mock') {
    endSession();
  }
}

export async function autoSubmitSavedMock(saved) {
  stopResumeTimer();
  await loadAllQuestions();
  restoreMockSession(saved);
  finishMock();
}

export function viewMock() {
  const saved = loadRunningMock();
  const attempts = S.mocks.slice(-8);
  const best = S.mocks.length ? Math.max(...S.mocks.map((m) => m.sc)) : null;
  let h = '<div class="stack">';

  if (saved) {
    const left = Math.max(0, Math.floor((saved.endsAt - Date.now()) / 1000));
    if (left > 0) {
      const answered = Object.keys(saved.answers || {}).length;
      const total = saved.qids ? saved.qids.length : (PAPERS[saved.kind] ? PAPERS[saved.kind].n : 20);
      h += `<section class="card stack" id="mockResumeCard">
        <span class="eyebrow">${esc(saved.title || 'Mock test')} · in progress</span>
        <h2 style="font-size:var(--t-xl)">${tx('Test in progress', 'പരീക്ഷ പുരോഗമിക്കുന്നു')}</h2>
        <p class="sub">${answered} of ${total} answered · ${fmtTime(left)} remaining</p>
        <div class="row" style="gap:8px;margin-top:4px">
          <button type="button" class="btn" data-act="resume-mock" id="mockResumeBtn">Resume your test (${fmtTime(left)} left)</button>
          <button type="button" class="btn ghost" data-act="discard-mock">Discard</button>
        </div>
      </section>`;
      stopResumeTimer();
      resumeTimer = setInterval(tickMockResume, 1000);
    }
  }

  // Mini mock paper card
  const mini = PAPERS.mini;
  h += `<section class="card stack"><span class="eyebrow">${esc(mini.label)}</span>
    <h2 style="font-size:var(--t-xl)">${esc(mini.blurb)}</h2>
    <ul class="list" style="margin-top:-4px">
      <li><span>Marks per correct answer</span><b>1</b></li>
      <li><span>Negative marking per wrong answer</span><b>1/3</b></li>
      <li><span>Unanswered</span><b>0</b></li>
      <li><span>Questions drawn from</span><b>every subject</b></li>
    </ul>
    <button type="button" class="btn" data-act="mock" data-kind="mini" style="align-self:flex-start">Start the test</button>
    <p class="sub">The timer starts as soon as you tap Start. Leaving the page keeps the timer running, like a real exam.</p></section>`;

  // Full mock paper card
  const full = PAPERS.full;
  const tot = totalQuestions();
  if (tot >= 300) {
    h += `<section class="card stack"><span class="eyebrow">${esc(full.label)}</span>
      <h2 style="font-size:var(--t-xl)">${esc(full.blurb)}</h2>
      <ul class="list" style="margin-top:-4px">
        <li><span>Marks per correct answer</span><b>1</b></li>
        <li><span>Negative marking per wrong answer</span><b>1/3</b></li>
        <li><span>Unanswered</span><b>0</b></li>
        <li><span>Questions drawn from</span><b>every subject</b></li>
      </ul>
      <button type="button" class="btn" data-act="mock" data-kind="full" style="align-self:flex-start">Start the test</button>
      <p class="sub">The timer starts as soon as you tap Start. Leaving the page keeps the timer running, like a real exam.</p></section>`;
  } else {
    h += `<section class="card stack"><span class="eyebrow">${esc(full.label)}</span>
      <h2 style="font-size:var(--t-xl)">${esc(full.blurb)}</h2>
      <p class="sub" style="font-weight:600">${tx(`Full paper unlocks at 300 questions (now ${tot})`, `300 ചോദ്യങ്ങൾ തികയുമ്പോൾ പൂർണ്ണ പരീക്ഷ ലഭ്യമാകും (ഇപ്പോൾ ${tot})`)}</p>
      <p class="sub">${tx(
        'More verified questions are being added across syllabus subjects to build the 100-question paper.',
        '100 ചോദ്യങ്ങളുള്ള പരീക്ഷ ഒരുക്കുന്നതിനായി കൂടുതൽ ചോദ്യങ്ങൾ ചേർത്തുകൊണ്ടിരിക്കുന്നു.'
      )}</p></section>`;
  }

  if (attempts.length) {
    h += `<section class="card stack"><div><h2 class="sec" style="margin:0">Your last ${attempts.length} attempt${attempts.length > 1 ? 's' : ''}</h2>
      <p class="sub">Score out of ${attempts[attempts.length - 1].n} · best ${best}</p></div>${bars(attempts, attempts[attempts.length - 1].n)}</section>`;
  } else {
    h += '<section class="card"><p class="sub">No attempts yet. Your scores will appear here after the first test.</p></section>';
  }

  return `${h}</div>`;
}
