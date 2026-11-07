/* Search: in-memory full-text search across questions, options, and explanations. */

import { loadAllQuestions, loadIndex } from './data.js';
import { esc, LET } from './util.js';
import { lang, subjectName, tx, txPlain } from './i18n.js';
import { starButton } from './quiz.js';
import { loadingCard, requestRender } from './ui.js';
import {
  copyIconSvg, shareIconSvg, whatsAppQuestionUrl
} from './share.js';

let index = null;
let indexPromise = null;
let currentQuery = '';
let debounceTimer = null;

/** Normalise query and question text: lowercase, Unicode NFC, strip ZWNJ/ZWJ, collapse spaces. */
export function normalizeText(str) {
  if (!str) return '';
  return str
    .normalize('NFC')
    .toLowerCase()
    .replace(/[\u200C\u200D]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Highlight matched query words with <mark>, escaping all raw text to avoid XSS. */
export function highlight(text, words) {
  if (!text) return '';
  if (!words || !words.length) return esc(text);

  const intervals = [];
  for (const word of words) {
    if (!word || word.length < 1) continue;
    const re = new RegExp(escapeRegex(word), 'gi');
    let match;
    while ((match = re.exec(text)) !== null) {
      intervals.push([match.index, match.index + match[0].length]);
    }
  }

  if (!intervals.length) return esc(text);

  intervals.sort((a, b) => a[0] - b[0]);
  const merged = [intervals[0]];
  for (let i = 1; i < intervals.length; i++) {
    const prev = merged[merged.length - 1];
    const curr = intervals[i];
    if (curr[0] <= prev[1]) {
      prev[1] = Math.max(prev[1], curr[1]);
    } else {
      merged.push(curr);
    }
  }

  let out = '';
  let last = 0;
  for (const [start, end] of merged) {
    if (start > last) {
      out += esc(text.slice(last, start));
    }
    out += `<mark>${esc(text.slice(start, end))}</mark>`;
    last = end;
  }
  if (last < text.length) {
    out += esc(text.slice(last));
  }
  return out;
}

export function highlightTx(en, ml, words) {
  const l = lang();
  const hEn = highlight(en || '', words);
  if (!ml || ml === en || l === 'en') return hEn;
  const hMl = `<span class="ml" lang="ml">${highlight(ml, words)}</span>`;
  return l === 'ml' ? highlight(ml, words) : hEn + hMl;
}

/** Build an in-memory index from all questions. */
export function buildIndex(questions) {
  return questions.map((q) => {
    const parts = [
      q.q.en,
      q.q.ml,
      ...(q.options?.en || []),
      ...(q.options?.ml || []),
      q.explanation?.en,
      q.explanation?.ml,
      q.topic
    ];
    return {
      q,
      corpus: normalizeText(parts.join(' '))
    };
  });
}

export function ensureSearchIndex() {
  if (index) return Promise.resolve(index);
  if (!indexPromise) {
    indexPromise = (async () => {
      await loadIndex();
      const all = await loadAllQuestions();
      index = buildIndex(all);
      return index;
    })();
  }
  return indexPromise;
}

/** Search indexed questions; all words must match (AND). Max 30 results. */
export function searchQuestions(query) {
  if (!index) return { query, words: [], results: [], count: 0 };
  const norm = normalizeText(query);
  if (norm.length < 2) {
    return { query, words: [], results: [], count: 0 };
  }
  const words = norm.split(' ').filter((w) => w.length > 0);
  const matches = [];
  for (const item of index) {
    const allMatch = words.every((w) => item.corpus.includes(w));
    if (allMatch) matches.push(item.q);
  }
  return {
    query,
    words,
    results: matches.slice(0, 30),
    count: matches.length
  };
}

function renderOptions(q, words) {
  const en = q.options?.en || [];
  const ml = q.options?.ml || [];
  return `<div class="opts" style="margin-top:8px">${en.map((opt, i) => {
    const isCorrect = i === q.answerIndex;
    const tag = isCorrect ? tx('Correct', 'ശരിയുത്തരം') : '';
    return `<div class="opt${isCorrect ? ' right' : ''}" style="cursor:default">
      <span class="l" aria-hidden="true">${LET[i]}</span>
      <span class="tx">${highlightTx(opt, ml[i], words)}</span>
      ${tag ? `<span class="tag" style="color:var(--ok)">${tag}</span>` : ''}
    </div>`;
  }).join('')}</div>`;
}

function renderExplanation(q, words) {
  return `<div class="explain" style="margin-top:8px">
    <b>${tx('Explanation', 'വിശദീകരണം')}</b>
    ${highlightTx(q.explanation?.en, q.explanation?.ml, words)}
  </div>`;
}

export function renderResultsHtml(query) {
  const norm = normalizeText(query);

  if (norm.length < 2) {
    return `<div class="card stack" style="gap:12px">
      <span class="eyebrow">${tx('Example searches', 'ഉദാഹരണ തിരയലുകൾ')}</span>
      <p class="sub">${tx(
        'Type at least 2 characters above, or tap an example to search across questions, options, and explanations:',
        'തിരയാൻ മുകളിലെ ബോക്സിൽ രണ്ട് അക്ഷരമെങ്കിലും നൽകുക, അല്ലെങ്കിൽ താഴെയുള്ള ഉദാഹരണത്തിൽ തൊടുക:'
      )}</p>
      <div class="row" style="gap:8px">
        <button type="button" class="chip" data-act="search-example" data-q="Ayyankali">Ayyankali</button>
        <button type="button" class="chip" data-act="search-example" data-q="Preamble">Preamble</button>
        <button type="button" class="chip" data-act="search-example" data-q="ഭരണഘടന">ഭരണഘടന</button>
      </div>
    </div>`;
  }

  const { words, results, count } = searchQuestions(query);

  if (count === 0) {
    return `<div class="card stack" style="text-align:center;padding:32px 16px;align-items:center">
      <h3 style="font-size:var(--t-lg)">${tx('No matches found', 'ചോദ്യങ്ങളൊന്നും കണ്ടെത്തിയില്ല')}</h3>
      <p class="sub" style="max-width:44ch">${tx(
        `No questions matched "${query}". Try searching with fewer words or checking spelling.`,
        `"${query}" എന്നതിന് അനുയോജ്യമായ ചോദ്യങ്ങൾ കണ്ടെത്തിയില്ല. കുറഞ്ഞ വാക്കുകളോ മറ്റ് പദങ്ങളോ ഉപയോഗിച്ച് നോക്കുക.`
      )}</p>
    </div>`;
  }

  const countLabel = count === 1
    ? tx('Found 1 question', '1 ചോദ്യം കണ്ടെത്തി')
    : (count > 30
      ? tx(`Found ${count} questions (showing first 30)`, `${count} ചോദ്യങ്ങൾ കണ്ടെത്തി (ആദ്യ 30 എണ്ണം കാണിക്കുന്നു)`)
      : tx(`Found ${count} questions`, `${count} ചോദ്യങ്ങൾ കണ്ടെത്തി`));

  let h = `<div class="sub" style="font-weight:600;padding-inline:2px">${countLabel}</div>`;
  h += `<div class="stack" style="gap:8px">${results.map((q) => `
    <details class="rev qresult">
      <summary style="cursor:pointer">
        <div class="stack" style="gap:6px;flex:1;min-width:0">
          <div class="row" style="align-items:center;justify-content:space-between;gap:8px">
            <span class="chip">${esc(subjectName(q.subject))}</span>
            <div class="row" style="align-items:center;gap:4px">
              ${starButton(q.id)}
              <a class="qaction-btn share-btn" href="${whatsAppQuestionUrl(q)}" target="_blank" rel="noopener" aria-label="Share question to WhatsApp">
                ${shareIconSvg}
              </a>
              <button type="button" class="qaction-btn copy-btn" data-act="copy-q" data-id="${esc(q.id)}" aria-label="Copy question text">
                ${copyIconSvg}
              </button>
            </div>
          </div>
          <div class="qtext" style="font-size:1.05rem;line-height:1.4">${highlightTx(q.q.en, q.q.ml, words)}</div>
        </div>
      </summary>
      <div class="body">
        ${renderOptions(q, words)}
        ${renderExplanation(q, words)}
        <div class="row" style="margin-top:10px;align-items:center;gap:8px;flex-wrap:wrap">
          <button type="button" class="btn sm" data-act="subj" data-k="${esc(q.subject)}">
            ${tx('Practise this subject', 'ഈ വിഷയം പരിശീലിക്കുക')}
          </button>
          <a class="btn sm ghost share-btn" href="${whatsAppQuestionUrl(q)}" target="_blank" rel="noopener" aria-label="Share question to WhatsApp">
            ${shareIconSvg}
            <span class="btn-label">${tx('Share', 'പങ്കിടുക')}</span>
          </a>
          <button type="button" class="btn sm ghost copy-btn" data-act="copy-q" data-id="${esc(q.id)}" aria-label="Copy question text">
            ${copyIconSvg}
            <span class="btn-label">${tx('Copy', 'കോപ്പി')}</span>
          </button>
        </div>
      </div>
    </details>
  `).join('')}</div>`;

  return h;
}

export function onSearchInput(val) {
  currentQuery = val;
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    const el = document.getElementById('searchResults');
    if (el) el.innerHTML = renderResultsHtml(currentQuery);
  }, 200);
}

export function setSearchQuery(q) {
  currentQuery = q;
  const input = document.getElementById('searchInput');
  if (input) input.value = q;
  const el = document.getElementById('searchResults');
  if (el) el.innerHTML = renderResultsHtml(currentQuery);
}

export function viewSearch() {
  if (!index) {
    ensureSearchIndex().then(() => requestRender(true));
    return loadingCard('Preparing search index…');
  }

  let h = '<div class="stack">';

  h += `<div class="stack" style="gap:8px">
    <span class="eyebrow">${tx('Search', 'തിരയുക')}</span>
    <h1 style="font-size:var(--t-xl)">${tx('Question bank search', 'ചോദ്യങ്ങളിൽ തിരയുക')}</h1>
    <div style="position:relative">
      <input type="search" id="searchInput" class="search-input" placeholder="${txPlain('Search in English or Malayalam…', 'ഇംഗ്ലീഷിലോ മലയാളത്തിലോ തിരയുക…')}" value="${esc(currentQuery)}" autocomplete="off" autocorrect="off" spellcheck="false" aria-label="${txPlain('Search query', 'തിരയേണ്ട വാക്ക്')}">
    </div>
  </div>`;

  h += `<div id="searchResults" class="stack" style="gap:12px">
    ${renderResultsHtml(currentQuery)}
  </div>`;

  return `${h}</div>`;
}
