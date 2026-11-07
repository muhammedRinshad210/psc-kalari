/* App shell: boots the data manifest, paints the active screen and routes
   every click/change to its module. Screens never touch the DOM directly. */

import { loadIndex, questionById } from './data.js';
import { S, save } from './state.js';
import { setLang, syncLangBar } from './i18n.js';
import { route, syncTabs } from './router.js';
import { viewHome } from './home.js';
import {
  autoSubmitSavedMock, discardMock, loadRunningMock, resumeMock, startMock, tickMockResume, viewMock
} from './mock.js';
import { refreshHeading, setTopic, togglePanel, viewSyllabus } from './syllabus.js';
import { viewPapers } from './papers.js';
import {
  copyBackup, eraseAll, importBackup, setResetPrompt, viewProgress
} from './progress.js';
import { setReviewSegment, startReviewSession, viewReview } from './review.js';
import { onSearchInput, setSearchQuery, viewSearch } from './search.js';
import * as quiz from './quiz.js';
import { applyTheme, toggleTheme } from './theme.js';
import { toggleMark } from './state.js';
import { errorCard, loadingCard, scrollTop } from './ui.js';
import {
  copyToClipboard, formatQuestionShare, formatResultShare, showCopiedConfirmation
} from './share.js';
import {
  dismissInstall, initPwa, prefetchQuestions, reloadApp, triggerInstall, updateNoticeArea
} from './pwa.js';

const viewEl = document.getElementById('view');

let pendingHtml = '';
let loadError = '';

/* ---------- render ---------- */

function screen(name) {
  switch (name) {
    case 'mock': return viewMock();
    case 'syllabus': return viewSyllabus();
    case 'papers': return viewPapers();
    case 'progress': return viewProgress();
    case 'review': return viewReview();
    case 'search': return viewSearch();
    default: return viewHome();
  }
}

function render(keepScroll = false) {
  const z = quiz.session();
  syncTabs(route().name);

  if (route().name === 'mock' && (!z || z.finished)) {
    const saved = loadRunningMock();
    if (saved && saved.endsAt <= Date.now()) {
      run(() => autoSubmitSavedMock(saved), 'Submitting your test…');
      return;
    }
  }

  if (z) viewEl.innerHTML = z.finished ? quiz.viewResult() : quiz.viewQuiz();
  else if (pendingHtml) viewEl.innerHTML = pendingHtml;
  else if (loadError) viewEl.innerHTML = errorCard(loadError);
  else viewEl.innerHTML = screen(route().name);

  if (!keepScroll) scrollTop();
}

document.addEventListener('kalari:render', (event) => {
  render(Boolean(event.detail && event.detail.keepScroll));
});

/* ---------- async work with a loading state ---------- */

async function run(task, label = 'Loading questions…') {
  loadError = '';
  pendingHtml = loadingCard(label);
  render();
  try {
    await task();
  } catch (err) {
    console.error('[PSC Kalari]', err);
    loadError = 'The question bank could not be loaded.';
  }
  pendingHtml = '';
  render();
}

/* ---------- events ---------- */

document.addEventListener('click', (event) => {
  const shareLink = event.target.closest('a.share-btn');
  if (shareLink && shareLink.closest('summary')) {
    event.stopPropagation();
  }

  const tab = event.target.closest('#tabs a');
  if (tab) {
    const z = quiz.session();
    if (z) {
      if (z.mode !== 'mock' || z.finished) quiz.endSession();
      else quiz.suspendMock();
    }
  }

  const el = event.target.closest('[data-act]');
  if (!el) return;
  const act = el.dataset.act;

  switch (act) {
    case 'reload-app':
      reloadApp();
      return;
    case 'install-pwa':
      triggerInstall();
      return;
    case 'dismiss-install':
      dismissInstall();
      return;
    case 'resume-mock':
      run(() => resumeMock(), 'Resuming your test…');
      return;
    case 'discard-mock':
      discardMock();
      render();
      return;
    case 'copy-q': {
      event.stopPropagation();
      event.preventDefault();
      const qId = el.dataset.id;
      const z = quiz.session();
      let item = null;
      if (z && z.items && z.items[z.i] && z.items[z.i].id === qId) {
        item = z.items[z.i];
      } else {
        item = questionById(qId);
      }
      if (item) {
        const text = formatQuestionShare(item);
        copyToClipboard(text).then(() => {
          showCopiedConfirmation(el);
        });
      }
      return;
    }
    case 'copy-res': {
      event.stopPropagation();
      event.preventDefault();
      const z = quiz.session();
      if (z) {
        const text = formatResultShare(z);
        copyToClipboard(text).then(() => {
          showCopiedConfirmation(el);
        });
      }
      return;
    }
    case 'daily':
      run(() => quiz.startDaily(), 'Setting up today’s five…');
      return;
    case 'mix':
      run(() => quiz.startMix(), 'Pulling questions from every subject…');
      return;
    case 'subj':
      run(() => quiz.startSubject(el.dataset.k), 'Loading this subject…');
      return;
    case 'mock':
      run(() => startMock(el.dataset.kind || 'mini'), 'Building your paper…');
      return;
    case 'retry':
      run(() => loadIndex(), 'Trying again…');
      return;
    case 'papers-retry':
      render();
      return;
    case 'exit': {
      const z = quiz.session();
      if (z && z.mode === 'mock' && !z.finished) {
        quiz.suspendMock();
        window.location.hash = '#mock';
      } else {
        quiz.endSession();
        if (route().name === 'practice') {
          window.location.hash = '#home';
        }
      }
      render();
      return;
    }
    case 'mark': {
      event.stopPropagation();
      event.preventDefault();
      const nextMarked = toggleMark(el.dataset.id);
      const sel = `button[data-act="mark"][data-id="${CSS.escape ? CSS.escape(el.dataset.id) : el.dataset.id}"]`;
      document.querySelectorAll(sel).forEach((btn) => {
        btn.setAttribute('aria-pressed', String(nextMarked));
        btn.setAttribute('aria-label', nextMarked ? 'Remove saved question' : 'Save question');
      });
      return;
    }
    case 'review-tab':
      setReviewSegment(el.dataset.tab);
      render(true);
      return;
    case 'practise-review':
      run(() => startReviewSession(el.dataset.seg), 'Setting up review session…');
      return;
    case 'search-example':
      setSearchQuery(el.dataset.q);
      return;
    case 'again': {
      const z = quiz.session();
      const again = z && z.onAgain;
      quiz.endSession();
      if (again) run(again, 'Preparing another set…');
      else render();
      return;
    }
    case 'pick':
      quiz.pick(Number(el.dataset.i));
      return;
    case 'next':
      quiz.next();
      return;
    case 'prev':
      quiz.prev();
      return;
    case 'go':
      quiz.goTo(Number(el.dataset.i));
      return;
    case 'ask-submit':
      quiz.askSubmit(true);
      return;
    case 'keep':
      quiz.askSubmit(false);
      return;
    case 'submit':
      quiz.finishMock();
      return;
    case 'sylopen':
      togglePanel(el.dataset.k, el);
      return;
    case 'copy':
      copyBackup();
      return;
    case 'import': {
      const box = document.getElementById('imp');
      importBackup(box ? box.value : '');
      applyTheme();
      syncLangBar();
      render(true);
      return;
    }
    case 'reset':
      setResetPrompt(true);
      render(true);
      return;
    case 'reset-no':
      setResetPrompt(false);
      render(true);
      return;
    case 'reset-yes':
      eraseAll();
      applyTheme();
      syncLangBar();
      render();
      return;
    default:
  }
});

document.addEventListener('change', (event) => {
  const el = event.target.closest('[data-act="syl"]');
  if (!el) return;
  setTopic(el.dataset.id, el.checked);
  el.parentElement.classList.toggle('done', el.checked);
  refreshHeading();
});

document.addEventListener('input', (event) => {
  if (event.target && event.target.id === 'searchInput') {
    onSearchInput(event.target.value);
  }
});

document.querySelector('.langbar').addEventListener('click', (event) => {
  const btn = event.target.closest('button[data-lang]');
  if (!btn) return;
  setLang(btn.dataset.lang);
  save();
  syncLangBar();
  updateNoticeArea();
  render(true);
});

document.getElementById('themeBtn').addEventListener('click', () => {
  toggleTheme();
  save();
});

window.addEventListener('hashchange', () => {
  const z = quiz.session();
  if (z) {
    if (z.mode !== 'mock' || z.finished) {
      quiz.endSession();
    } else {
      quiz.suspendMock();
    }
  }
  const r = route();
  if (r.name === 'practice' && r.param) {
    run(() => quiz.startSubject(r.param), 'Loading this subject…');
    return;
  }
  render();
});

document.addEventListener('visibilitychange', () => {
  if (!document.hidden) {
    quiz.tick();
    tickMockResume();
  }
});

/* ---------- boot ---------- */

async function boot() {
  S.visits = (typeof S.visits === 'number' ? S.visits : 0) + 1;
  save();
  applyTheme();
  syncLangBar();
  initPwa();
  try {
    await loadIndex();
  } catch (err) {
    console.error('[PSC Kalari]', err);
    loadError = 'The question bank could not be loaded.';
  }
  const r = route();
  if (r.name === 'practice' && r.param) {
    run(() => quiz.startSubject(r.param), 'Loading this subject…');
  } else {
    render();
  }
  prefetchQuestions();
}

boot();

