/* Review screen: Mistakes notebook and Saved (starred) questions. */

import { S } from './state.js';
import { loadAllQuestions, questionById } from './data.js';
import { esc, shuffle } from './util.js';
import { subjectName, tx } from './i18n.js';
import { startSession, starButton } from './quiz.js';
import { loadingCard, requestRender } from './ui.js';
import { route } from './router.js';

let activeSegment = 'mistakes';
let questionsLoaded = false;
let loadingPromise = null;

function ensureQuestions() {
  if (questionsLoaded) return Promise.resolve();
  if (!loadingPromise) {
    loadingPromise = loadAllQuestions()
      .then(() => {
        questionsLoaded = true;
        loadingPromise = null;
        requestRender(true);
      })
      .catch((err) => {
        console.error('[PSC Kalari] review questions', err);
        loadingPromise = null;
        requestRender(true);
      });
  }
  return loadingPromise;
}

export function setReviewSegment(seg) {
  activeSegment = seg === 'saved' ? 'saved' : 'mistakes';
}

export function getReviewSegment() {
  return activeSegment;
}

export function startReviewSession(segment = activeSegment) {
  if (segment === 'mistakes') {
    const wrongKeys = Object.keys(S.wrong || {});
    const list = wrongKeys.map(questionById).filter(Boolean);
    if (!list.length) return;
    startSession({
      mode: 'practice',
      review: true,
      title: 'Mistakes review',
      list: shuffle([...list]),
      onAgain: () => startReviewSession('mistakes')
    });
  } else {
    const savedIds = S.marks || [];
    const list = savedIds.map(questionById).filter(Boolean);
    if (!list.length) return;
    startSession({
      mode: 'practice',
      review: false,
      title: 'Saved questions',
      list: shuffle([...list]),
      onAgain: () => startReviewSession('saved')
    });
  }
}

export function viewReview() {
  const currentRoute = route();
  if (currentRoute.param === 'saved' || currentRoute.param === 'mistakes') {
    activeSegment = currentRoute.param;
  }

  if (!questionsLoaded) {
    ensureQuestions();
    return loadingCard('Loading questions…');
  }

  const wrongEntries = Object.entries(S.wrong || {});
  wrongEntries.sort((a, b) => {
    const da = (b[1] && b[1].last) || '';
    const db = (a[1] && a[1].last) || '';
    return da.localeCompare(db);
  });
  const mistakeQuestions = wrongEntries
    .map(([id, info]) => ({ q: questionById(id), info, id }))
    .filter((x) => Boolean(x.q));

  const savedIds = S.marks || [];
  const savedQuestions = savedIds.map(questionById).filter(Boolean);

  let h = '<div class="stack">';

  h += `<div>
    <span class="eyebrow">${tx('Review notebook', 'റിവ്യൂ നോട്ട്ബുക്ക്')}</span>
    <h1 style="font-size:var(--t-xl);margin-top:4px">${tx('Mistakes & Saved', 'തെറ്റിയവയും സേവ് ചെയ്തവയും')}</h1>
    <p class="sub">${tx(
      'Review questions you missed during practice or saved with a star for quick revision.',
      'പരിശീലനത്തിൽ തെറ്റിയ ചോദ്യങ്ങളും നക്ഷത്ര ചിഹ്നമിട്ട് സേവ് ചെയ്ത ചോദ്യങ്ങളും ഇവിടെ കാണാം.'
    )}</p>
  </div>`;

  h += `<div class="row" style="gap:8px" role="tablist" aria-label="Review segments">
    <button type="button" class="btn ${activeSegment === 'mistakes' ? '' : 'ghost'}" data-act="review-tab" data-tab="mistakes" role="tab" aria-selected="${String(activeSegment === 'mistakes')}">
      ${tx('Mistakes', 'തെറ്റിയവ')} (${wrongEntries.length})
    </button>
    <button type="button" class="btn ${activeSegment === 'saved' ? '' : 'ghost'}" data-act="review-tab" data-tab="saved" role="tab" aria-selected="${String(activeSegment === 'saved')}">
      ${tx('Saved', 'സേവ് ചെയ്തവ')} (${savedQuestions.length})
    </button>
  </div>`;

  if (activeSegment === 'mistakes') {
    if (!mistakeQuestions.length) {
      h += `<div class="card stack" style="text-align:center;padding:36px 16px;align-items:center">
        <h3 style="font-size:var(--t-lg)">${tx('No mistakes to retry', 'വീണ്ടും പരിശീലിക്കാൻ ചോദ്യങ്ങളില്ല')}</h3>
        <p class="sub" style="max-width:44ch">${tx(
          'When you miss a question in practice, daily sets, or mock tests, it is saved here automatically so you can retry and master it.',
          'പരിശീലനത്തിലോ മോക്ക് ടെസ്റ്റുകളിലോ തെറ്റുന്ന ചോദ്യങ്ങൾ വീണ്ടും പഠിക്കാനായി ഇവിടെ തനിയെ വരും.'
        )}</p>
        <div style="margin-top:8px"><a class="btn sm" href="#home">${tx('Start practising', 'പരിശീലനം തുടങ്ങുക')}</a></div>
      </div>`;
    } else {
      h += `<div class="row" style="align-items:center;justify-content:space-between">
        <p class="sub">${tx(`${mistakeQuestions.length} to retry`, `പരിശീലിക്കാൻ ${mistakeQuestions.length} ചോദ്യങ്ങൾ`)}</p>
        <button type="button" class="btn" data-act="practise-review" data-seg="mistakes">${tx('Practise these', 'ഇവ പരിശീലിക്കുക')}</button>
      </div>`;

      h += `<div class="stack" style="gap:10px">${mistakeQuestions.map(({ q, info }) => `
        <article class="card stack" style="gap:10px">
          <div class="row" style="align-items:center;justify-content:space-between">
            <span class="chip">${esc(subjectName(q.subject))}</span>
            <div class="row" style="align-items:center;gap:6px">
              <span class="sub" style="font-size:var(--t-xs)">${tx(`Missed ${info.n || 1} time${(info.n || 1) > 1 ? 's' : ''}`, `${info.n || 1} തവണ തെറ്റി`)}</span>
              ${starButton(q.id)}
            </div>
          </div>
          <p class="qtext" style="font-size:1.05rem;line-height:1.45">${tx(q.q.en, q.q.ml)}</p>
        </article>
      `).join('')}</div>`;
    }
  } else {
    if (!savedQuestions.length) {
      h += `<div class="card stack" style="text-align:center;padding:36px 16px;align-items:center">
        <h3 style="font-size:var(--t-lg)">${tx('No saved questions yet', 'സേവ് ചെയ്ത ചോദ്യങ്ങളൊന്നുമില്ല')}</h3>
        <p class="sub" style="max-width:44ch">${tx(
          'Tap the star icon on any question card or result review to keep tricky questions handy for quick revision.',
          'ചോദ്യങ്ങളിലെ സ്റ്റാർ ഐക്കണിൽ തൊട്ട് പ്രധാനപ്പെട്ട ചോദ്യങ്ങൾ ഇവിടെ സൂക്ഷിച്ചു വെക്കാം.'
        )}</p>
        <div style="margin-top:8px"><a class="btn sm" href="#home">${tx('Explore questions', 'ചോദ്യങ്ങൾ കാണുക')}</a></div>
      </div>`;
    } else {
      h += `<div class="row" style="align-items:center;justify-content:space-between">
        <p class="sub">${tx(`${savedQuestions.length} saved questions`, `${savedQuestions.length} സേവ് ചെയ്ത ചോദ്യങ്ങൾ`)}</p>
        <button type="button" class="btn" data-act="practise-review" data-seg="saved">${tx('Practise these', 'ഇവ പരിശീലിക്കുക')}</button>
      </div>`;

      h += `<div class="stack" style="gap:10px">${savedQuestions.map((q) => `
        <article class="card stack" style="gap:10px">
          <div class="row" style="align-items:center;justify-content:space-between">
            <span class="chip">${esc(subjectName(q.subject))}</span>
            ${starButton(q.id)}
          </div>
          <p class="qtext" style="font-size:1.05rem;line-height:1.45">${tx(q.q.en, q.q.ml)}</p>
        </article>
      `).join('')}</div>`;
    }
  }

  return `${h}</div>`;
}
