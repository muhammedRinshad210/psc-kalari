/* Quiz engine: one session object, practice and mock modes, question screen
   and result screen. Screens return HTML strings; the shell owns the DOM. */

import { isMarked, recordMiss, removeMiss, S, save } from './state.js';
import { loadAllQuestions, loadQuestions, questionById } from './data.js';
import { dayKey, esc, fmtTime, LET, r2, seedRand, shuffle } from './util.js';
import { subjectName, tx, verdict } from './i18n.js';
import { requestRender } from './ui.js';
import { accOf, record, touchStreak } from './progress.js';
import {
  copyIconSvg, shareIconSvg, whatsAppQuestionUrl, whatsAppResultUrl
} from './share.js';
import { clearRunningMock, saveRunningMock, score } from './mock.js';
import { reportButton } from './report.js';

let Z = null;

export function starButton(id) {
  const marked = isMarked(id);
  return `<button type="button" class="star-btn" data-act="mark" data-id="${esc(id)}" aria-label="${marked ? 'Remove saved question' : 'Save question'}" aria-pressed="${String(marked)}"><svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg></button>`;
}

/* ---------- session ---------- */

/** Turn stored questions into session items: options shuffled, answer traced. */
function build(list) {
  return list.map((q) => {
    const order = shuffle([0, 1, 2, 3]);
    return {
      id: q.id,
      s: q.subject,
      q: q.q.en,
      mq: q.q.ml,
      e: q.explanation.en,
      me: q.explanation.ml,
      opts: order.map((i) => q.options.en[i]),
      mopts: order.map((i) => q.options.ml[i]),
      ans: order.indexOf(q.answerIndex),
      order,
      verified: Boolean(q.verified)
    };
  });
}

export function session() {
  return Z;
}

export function endSession() {
  if (Z && Z.timer) clearInterval(Z.timer);
  Z = null;
}

export function saveMockState() {
  if (!Z || Z.mode !== 'mock' || Z.finished) return;
  const answers = {};
  Z.picks.forEach((p, idx) => {
    if (p !== undefined) answers[idx] = p;
  });
  saveRunningMock({
    kind: Z.kind || 'mini',
    title: Z.title,
    limit: Z.limit,
    endsAt: Z.endsAt,
    i: Z.i,
    answers,
    qids: Z.items.map((it) => it.id),
    optOrders: Z.items.map((it) => it.order)
  });
}

export function suspendMock() {
  if (Z && Z.mode === 'mock') {
    saveMockState();
    if (Z.timer) clearInterval(Z.timer);
    Z = null;
  }
}

export function startSession(opts) {
  endSession();
  Z = Object.assign({ i: 0, picks: [], finished: false, confirm: false }, opts);
  Z.items = opts.items || build(opts.list || []);
  if (Z.mode === 'mock') {
    if (!Z.endsAt) Z.endsAt = Date.now() + Z.limit * 1000;
    Z.timer = setInterval(tick, 1000);
    saveMockState();
  }
  requestRender();
}

/* ---------- starters ---------- */

/** Five questions that stay the same for the whole day, seeded by the date. */
export function dailyIds(all) {
  const seed = Number(dayKey().replace(/-/g, ''));
  return shuffle(all.map((q) => q.id), seedRand(seed)).slice(0, 5);
}

export async function startDaily() {
  const all = await loadAllQuestions();
  startSession({
    mode: 'daily',
    title: 'Today’s five',
    list: dailyIds(all).map(questionById),
    onAgain: startDaily
  });
}

export async function startSubject(key) {
  const list = await loadQuestions(key);
  startSession({
    mode: 'practice',
    title: subjectName(key),
    subjectKey: key,
    list,
    onAgain: () => startSubject(key)
  });
}

export async function startMix() {
  const all = await loadAllQuestions();
  startSession({
    mode: 'practice',
    title: 'Quick mix',
    list: shuffle(all).slice(0, 10),
    onAgain: startMix
  });
}

/* ---------- timer ---------- */

function remaining() {
  if (!Z) return 0;
  if (Z.endsAt) {
    return Math.max(0, Math.floor((Z.endsAt - Date.now()) / 1000));
  }
  return Math.max(0, Z.limit - Math.floor((Date.now() - Z.t0) / 1000));
}

export function tick() {
  if (!Z || Z.mode !== 'mock' || Z.finished) return;
  const left = remaining();
  const el = document.getElementById('timer');
  if (el) {
    el.textContent = fmtTime(left);
    el.classList.toggle('low', left <= 120);
  }
  if (left <= 0) finishMock();
}

/* ---------- finishing ---------- */

function finishPractice() {
  Z.finished = true;
  let correct = 0;
  Z.items.forEach((item, i) => { if (Z.picks[i] === item.ans) correct += 1; });
  Z.correct = correct;
  if (Z.mode === 'daily') S.daily[dayKey()] = { c: correct, n: Z.items.length };
  save();
  requestRender();
}

export function finishMock() {
  if (!Z || Z.finished) return;
  clearInterval(Z.timer);
  let c = 0;
  let w = 0;
  let u = 0;
  Z.items.forEach((item, i) => {
    const pick = Z.picks[i];
    if (pick === undefined) { u += 1; return; }
    const ok = pick === item.ans;
    if (ok) {
      c += 1;
    } else {
      w += 1;
      recordMiss(item.id);
    }
    record(item.s, ok);
  });
  Z.finished = true;
  Z.confirm = false;
  Z.res = { c, w, u, n: Z.items.length, sc: score(c, w) };
  Z.spent = Z.limit - remaining();
  if (c + w > 0) touchStreak();
  S.mocks.push({ d: dayKey(), sc: Z.res.sc, c, w, u, n: Z.res.n });
  if (S.mocks.length > 20) S.mocks = S.mocks.slice(-20);
  clearRunningMock();
  save();
  requestRender();
}

/* ---------- interactions ---------- */

function current() {
  return Z.items[Z.i];
}

export function pick(index) {
  if (!Z || Z.finished) return;
  const isMock = Z.mode === 'mock';
  if (isMock) {
    if (Z.picks[Z.i] === index) delete Z.picks[Z.i];
    else Z.picks[Z.i] = index;
    saveMockState();
    requestRender();
    return;
  }
  if (Z.picks[Z.i] !== undefined) return;
  Z.picks[Z.i] = index;
  const item = current();
  const ok = index === item.ans;
  record(item.s, ok);
  touchStreak();
  if (!ok) {
    recordMiss(item.id);
  } else if (Z.mode === 'review' || Z.review) {
    removeMiss(item.id);
  }
  save();
  requestRender();
}

export function next() {
  if (!Z) return;
  if (Z.i < Z.items.length - 1) {
    Z.i += 1;
    if (Z.mode === 'mock') saveMockState();
    requestRender();
    return;
  }
  if (Z.mode !== 'mock') finishPractice();
  requestRender();
}

export function prev() {
  if (Z && Z.i > 0) {
    Z.i -= 1;
    if (Z.mode === 'mock') saveMockState();
    requestRender();
  }
}

export function goTo(index) {
  if (!Z) return;
  Z.i = Math.max(0, Math.min(Z.items.length - 1, index));
  if (Z.mode === 'mock') saveMockState();
  requestRender();
}

export function askSubmit(open) {
  if (!Z) return;
  Z.confirm = open;
  requestRender();
  if (open) window.scrollTo(0, document.body.scrollHeight);
}

/* ---------- views ---------- */

export function viewQuiz() {
  if (!Z || !Z.items || !Z.items.length || !Z.items[Z.i]) {
    endSession();
    return '';
  }
  const item = Z.items[Z.i];
  const n = Z.items.length;
  const isMock = Z.mode === 'mock';
  const picked = Z.picks[Z.i];
  const revealed = !isMock && picked !== undefined;
  const pct = ((Z.i + (revealed ? 1 : 0)) / n) * 100;

  let h = `<div class="stack"><div class="qtop">
    <button type="button" class="icon-btn" data-act="exit" aria-label="Leave this quiz">
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button>
    <div class="grow"><div class="qtitle">${esc(Z.title)} · Question ${Z.i + 1} of ${n}</div>
      <div class="pbar"><i style="width:${pct}%"></i></div></div>
    ${isMock ? `<div class="timer${remaining() <= 120 ? ' low' : ''}" id="timer" role="timer" aria-live="off">${fmtTime(remaining())}</div>` : ''}
  </div>`;

  const repBtn = !isMock ? reportButton(item.id) : '';
  h += `<section class="card qcard"><div class="row" style="align-items:center;justify-content:space-between;gap:8px">
    <div class="row" style="align-items:center;gap:6px">
      <span class="chip">${esc(subjectName(item.s))}</span>
      ${item.verified ? `<span class="chip">${tx('Reviewed', 'പരിശോധിച്ചത്')}</span>` : ''}
    </div>
    <div class="row" style="align-items:center;gap:4px">
      ${!isMock ? starButton(item.id) : ''}
      <a class="qaction-btn share-btn" href="${whatsAppQuestionUrl(item)}" target="_blank" rel="noopener" aria-label="Share question to WhatsApp">
        ${shareIconSvg}
      </a>
      <button type="button" class="qaction-btn copy-btn" data-act="copy-q" data-id="${esc(item.id)}" aria-label="Copy question text">
        ${copyIconSvg}
      </button>
    </div></div>
    <p class="qtext">${tx(item.q, item.mq)}</p><div class="opts">`;

  item.opts.forEach((opt, i) => {
    let cls = 'opt';
    let tag = '';
    if (isMock) {
      if (picked === i) cls += ' sel';
    } else if (revealed) {
      if (i === item.ans) { cls += ' right'; tag = 'Correct'; }
      else if (i === picked) { cls += ' wrong'; tag = 'Your answer'; }
    }
    h += `<button type="button" class="${cls}" data-act="pick" data-i="${i}"${revealed ? ' disabled' : ''}>
      <span class="l" aria-hidden="true">${LET[i]}</span><span class="tx">${tx(opt, item.mopts[i])}</span>
      <span class="tag">${esc(tag)}</span></button>`;
  });

  h += '</div>';
  if (revealed) h += `<div class="explain"><b>${verdict(picked === item.ans, item)}</b>${tx(item.e, item.me)}</div>`;
  if (repBtn) h += `<div class="row" style="margin-top:14px;justify-content:flex-end">${repBtn}</div>`;
  h += '</section>';

  if (isMock) {
    const answered = Z.picks.filter((p) => p !== undefined).length;
    h += `<section aria-label="Question palette"><div class="palette">${Z.items.map((_, i) => {
      const isAns = Z.picks[i] !== undefined;
      return `<button type="button" data-act="go" data-i="${i}" class="${isAns ? 'ans ' : ''}${i === Z.i ? 'cur' : ''}"
        aria-label="Question ${i + 1}${isAns ? ', answered' : ', not answered'}"${i === Z.i ? ' aria-current="true"' : ''}>${i + 1}</button>`;
    }).join('')}</div>
    <p class="sub" style="margin-top:8px">${answered} of ${n} answered</p></section>`;

    h += `<div class="navrow"><button type="button" class="btn ghost" data-act="prev"${Z.i === 0 ? ' disabled' : ''}>Previous</button>
      ${Z.i < n - 1
        ? '<button type="button" class="btn" data-act="next">Next</button>'
        : '<button type="button" class="btn" data-act="ask-submit">Review and submit</button>'}</div>`;

    if (Z.confirm) {
      const un = n - answered;
      h += `<div class="confirm stack"><b>${un ? `${un} question${un > 1 ? 's are' : ' is'} still unanswered.` : 'All questions are answered.'}</b>
        <p class="sub">Submit now to see your score and explanations.</p>
        <div class="row"><button type="button" class="btn" data-act="submit">Submit test</button>
        <button type="button" class="btn ghost" data-act="keep">Keep going</button></div></div>`;
    } else if (Z.i < n - 1) {
      h += '<div><button type="button" class="btn ghost sm" data-act="ask-submit">Submit early</button></div>';
    }
  } else if (revealed) {
    h += `<div class="navrow"><span></span><button type="button" class="btn" data-act="next">
      ${Z.i < n - 1 ? 'Next question' : 'See results'}</button></div>`;
  }

  return `${h}</div>`;
}

function reviewList() {
  return `<div class="stack" style="gap:8px">${Z.items.map((item, i) => {
    const pick = Z.picks[i];
    const state = pick === undefined ? 'skip' : (pick === item.ans ? 'ok' : 'no');
    const label = pick === undefined ? 'Skipped' : (pick === item.ans ? 'Right' : 'Wrong');
    const repBtn = reportButton(item.id);
    return `<details class="rev"><summary><span class="pill ${state}">${label}</span>
      <span style="flex:1;min-width:0">${tx(item.q, item.mq)}</span>
      ${item.verified ? `<span class="chip" style="font-size:0.75rem;padding:2px 8px">${tx('Reviewed', 'പരിശോധിച്ചത്')}</span>` : ''}
      ${starButton(item.id)}</summary><div class="body">
      <span><b>Answer:</b> ${tx(item.opts[item.ans], item.mopts[item.ans])}</span>
      ${pick !== undefined && pick !== item.ans ? `<span><b>You chose:</b> ${tx(item.opts[pick], item.mopts[pick])}</span>` : ''}
      <span class="muted">${tx(item.e, item.me)}</span>
      ${repBtn ? `<div class="row" style="margin-top:10px">${repBtn}</div>` : ''}</div></details>`;
  }).join('')}</div>`;
}

export function viewResult() {
  if (!Z || !Z.items || !Z.items.length) {
    endSession();
    return '';
  }
  const n = Z.items.length;
  let h = '<div class="stack">';

  if (Z.mode === 'mock') {
    const r = Z.res;
    const by = {};
    Z.items.forEach((item, i) => {
      const bucket = by[item.s] || (by[item.s] = { a: 0, c: 0 });
      if (Z.picks[i] !== undefined) {
        bucket.a += 1;
        if (Z.picks[i] === item.ans) bucket.c += 1;
      }
    });
    h += `<section class="card stack"><span class="eyebrow">${esc(Z.title)} · result</span>
      <div class="score">${r.sc} <span class="muted" style="font-size:var(--t-lg)">/ ${r.n}</span></div>
      <p class="sub">Score = correct − wrong ÷ 3. Time used: ${fmtTime(Z.spent)}.</p>
      <div class="stats"><div class="stat"><b>${r.c}</b><span>Correct</span></div>
        <div class="stat"><b>${r.w}</b><span>Wrong</span></div>
        <div class="stat"><b>${r.u}</b><span>Skipped</span></div></div>
      <div class="row" style="margin-top:6px;gap:8px">
        <a class="btn ghost share-btn" href="${whatsAppResultUrl(Z)}" target="_blank" rel="noopener" aria-label="Share result on WhatsApp">
          ${shareIconSvg}
          <span class="btn-label">Share result</span>
        </a>
        <button type="button" class="btn ghost copy-btn" data-act="copy-res" aria-label="Copy result to clipboard">
          ${copyIconSvg}
          <span class="btn-label">Copy result</span>
        </button>
      </div></section>`;
    h += `<section class="card stack"><h2 class="sec" style="margin:0">By subject</h2>${Object.keys(by).map((k) => {
      const b = by[k];
      const p = b.a ? Math.round((b.c / b.a) * 100) : 0;
      return `<div class="brow"><span>${esc(subjectName(k))}</span><b>${b.c}/${b.a}</b>
        <span class="sbar"><i style="width:${p}%"></i></span></div>`;
    }).join('')}</section>`;
  } else {
    const p = Math.round((Z.correct / n) * 100);
    const line = p >= 80
      ? 'Strong round. Keep this level on the mock test.'
      : p >= 50
        ? 'Good progress. Read the explanations below and run it again.'
        : 'This topic needs another pass. Check the syllabus tab and try again.';
    h += `<section class="card stack"><span class="eyebrow">${esc(Z.title)}</span>
      <div class="score">${Z.correct} <span class="muted" style="font-size:var(--t-lg)">/ ${n}</span></div>
      <p>${esc(line)}</p>${Z.subjectKey ? `<p class="sub">Lifetime accuracy in this subject: ${accOf(Z.subjectKey) ?? 0}%</p>` : ''}
      <div class="row" style="margin-top:6px;gap:8px">
        <a class="btn ghost share-btn" href="${whatsAppResultUrl(Z)}" target="_blank" rel="noopener" aria-label="Share result on WhatsApp">
          ${shareIconSvg}
          <span class="btn-label">Share result</span>
        </a>
        <button type="button" class="btn ghost copy-btn" data-act="copy-res" aria-label="Copy result to clipboard">
          ${copyIconSvg}
          <span class="btn-label">Copy result</span>
        </button>
      </div></section>`;
  }

  h += `<h2 class="sec" style="margin:0">Review</h2>${reviewList()}`;
  h += `<div class="row"><button type="button" class="btn" data-act="again">
    ${Z.mode === 'mock' ? 'Take another test' : 'Practise again'}</button>
    <button type="button" class="btn ghost" data-act="exit">Back</button></div></div>`;
  return h;
}
