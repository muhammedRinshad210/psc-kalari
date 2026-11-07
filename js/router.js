/* Hash router. One screen per route; unknown hashes fall back to home so old
   bookmarks and the SEO landing page links never dead-end. */

const VALID_ROUTES = ['home', 'mock', 'syllabus', 'papers', 'progress', 'review', 'search', 'practice'];

export function route() {
  const raw = (location.hash || '#home').replace(/^#/, '');
  const [name, param = ''] = raw.split('/');
  return { name: VALID_ROUTES.includes(name) ? name : 'home', param };
}

export function syncTabs(name) {
  document.querySelectorAll('#tabs a').forEach((a) => {
    if (a.dataset.tab === name) a.setAttribute('aria-current', 'page');
    else a.removeAttribute('aria-current');
  });
}

export function navigate(hash) {
  if (location.hash === hash) {
    document.dispatchEvent(new CustomEvent('kalari:render'));
  } else {
    location.hash = hash;
  }
}
