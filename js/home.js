/* Home screen: today's set, quick mix, weakest subject and the subject grid. */

import { S } from './state.js';
import { activeSubjects, MIN_QUESTIONS } from './data.js';
import { dayKey, esc } from './util.js';
import { dateLine, subjectName, tx } from './i18n.js';
import { accOf, currentStreak, weakest } from './progress.js';
import { renderInstallCard } from './pwa.js';

function subjectCard(subject) {
  const acc = accOf(subject.key);
  const started = S.subj[subject.key];
  const meta = acc === null
    ? `${subject.count} questions · not started`
    : `${acc}% right · ${started.a} answered`;
  return `<button type="button" class="scard" data-act="subj" data-k="${subject.key}">
    <span class="sml" lang="ml">${esc(subject.ml)}</span><span class="sen">${esc(subject.en)}</span>
    <span class="smeta">${esc(meta)}</span>
    <span class="sbar"><i style="width:${acc || 0}%"></i></span></button>`;
}

export function viewHome() {
  const done = S.daily[dayKey()];
  const streak = currentStreak();
  const weak = weakest();
  const allActive = activeSubjects();
  const ready = allActive.filter((s) => s.count >= MIN_QUESTIONS);
  const coming = allActive.filter((s) => s.count < MIN_QUESTIONS);
  let h = '<div class="stack">';

  const installHtml = renderInstallCard();
  if (installHtml) h += installHtml;

  h += `<section class="hero"><div class="kasavu"></div><div class="hero-in">
    <span class="eyebrow">${esc(dateLine())}</span>
    <h1 style="font-size:var(--t-xl)">${done
      ? `Today’s five are done: ${done.c} of ${done.n} right`
      : 'Five questions, five minutes'}</h1>
    <p>${done
      ? 'Come back tomorrow for a fresh set, or keep going with a subject below.'
      : 'One short set every day builds the habit that clears the cut-off.'}</p>
    <div class="row" style="align-items:center">
      <button type="button" class="btn" data-act="daily">${done ? 'Practise today’s set again' : 'Start today’s five'}</button>
      <span class="chip gold">${streak ? `${streak}-day streak` : 'Start your streak'}</span></div>
    </div></section>`;

  h += '<div class="pick-row">';
  h += '<button type="button" class="pick" data-act="mix"><b>Quick mix</b><span class="sub">10 random questions from every subject</span></button>';
  h += weak
    ? `<button type="button" class="pick" data-act="subj" data-k="${weak}"><b>Strengthen ${esc(subjectName(weak))}</b>
       <span class="sub">Your lowest accuracy so far: ${accOf(weak)}%</span></button>`
    : '<a class="pick" href="#mock" style="text-decoration:none;color:inherit"><b>Try the mini mock</b><span class="sub">20 questions, 20 minutes, negative marking</span></a>';
  h += '</div>';

  const nWrong = Object.keys(S.wrong || {}).length;
  const nSaved = (S.marks || []).length;
  h += `<a class="card" href="#review" style="text-decoration:none;color:inherit;display:block">
    <div class="row" style="align-items:center;justify-content:space-between;gap:12px">
      <div>
        <b style="font-family:var(--f-display);font-size:1.05rem">${tx(`Review: ${nWrong} to retry, ${nSaved} saved`, `റിവ്യൂ: ${nWrong} വീണ്ടും ശ്രമിക്കാൻ, ${nSaved} സേവ് ചെയ്തവ`)}</b>
        <p class="sub">${tx('Practise questions you missed or saved with a star', 'തെറ്റിയ ചോദ്യങ്ങളും സേവ് ചെയ്തവയും ഇവിടെ പരിശീലിക്കാം')}</p>
      </div>
      <span class="btn sm ghost" style="pointer-events:none;flex:none">${tx('Review', 'റിവ്യൂ')}</span>
    </div></a>`;

  h += '<div><h2 class="sec">Subjects</h2><p class="sub">Tap a subject to practise it with an explanation after every answer.</p></div>';
  h += `<div class="grid">${ready.map(subjectCard).join('')}</div>`;
  if (coming.length) {
    h += `<div class="coming-soon"><h3 class="sec muted" style="font-size:var(--t-base);margin-block:16px 8px">${tx('Coming soon', 'ഉടൻ വരുന്നു')}</h3>
    <ul class="coming-list">${coming.map((s) => `<li>${tx(s.en, s.ml)}</li>`).join('')}</ul></div>`;
  }
  return `${h}</div>`;
}
