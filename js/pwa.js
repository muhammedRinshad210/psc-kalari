/* PWA and Service Worker management for PSC Kalari.
   Handles offline status, service worker updates, idle prefetching, and install prompts. */

import { S, save } from './state.js';
import { loadIndex } from './data.js';
import { lang, tx, txPlain } from './i18n.js';

let waitingWorker = null;
let deferredPrompt = null;
let refreshing = false;

export function hasDeferredPrompt() {
  return Boolean(deferredPrompt);
}

export function isIosSafari() {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  const isIos = /iphone|ipad|ipod/i.test(ua) && !window.MSStream;
  const isStandalone = (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) || Boolean(navigator.standalone);
  return isIos && !isStandalone;
}

export function updateNoticeArea() {
  const el = document.getElementById('noticeArea');
  if (!el) return;

  const notices = [];

  // 1. Offline indicator bar
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    notices.push(`<div class="notice-bar offline-bar" role="status">
      <div class="notice-text">
        <svg viewBox="0 0 24 24" class="notice-icon" aria-hidden="true">
          <path d="M1 1l22 22M16.72 11.06A10.94 10.94 0 0 1 19 12.55M5 12.55a10.94 10.94 0 0 1 5.17-2.39M10.71 5.05A16 16 0 0 1 22.58 9M1.42 9a15.91 15.91 0 0 1 4.7-2.88M8.53 16.11a6 6 0 0 1 6.95 0M12 20h.01"/>
        </svg>
        <span>${tx('You are offline. Saved questions still work.', 'നിങ്ങൾ ഓഫ്‌ലൈനിലാണ്. സേവ് ചെയ്ത ചോദ്യങ്ങൾ പ്രവർത്തിക്കും.')}</span>
      </div>
    </div>`);
  }

  // 2. Service worker update bar
  if (waitingWorker) {
    notices.push(`<div class="notice-bar update-bar" role="status">
      <div class="notice-text">
        <span>${tx('New version ready.', 'പുതിയ പതിപ്പ് തയ്യാറാണ്.')}</span>
      </div>
      <button type="button" class="btn sm" data-act="reload-app" aria-label="${txPlain('Refresh for new version', 'പുതിയ പതിപ്പിലേക്ക് പുതുക്കുക')}">
        ${tx('Refresh', 'പുതുക്കുക')}
      </button>
    </div>`);
  }

  el.innerHTML = notices.join('');
}

export function reloadApp() {
  if (waitingWorker) {
    waitingWorker.postMessage({ type: 'SKIP_WAITING' });
    waitingWorker.postMessage('SKIP_WAITING');
  } else {
    window.location.reload();
  }
}

export async function resetApp() {
  try {
    if ('serviceWorker' in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      for (const reg of registrations) {
        await reg.unregister();
      }
    }
    if ('caches' in window) {
      const keys = await caches.keys();
      for (const key of keys) {
        await caches.delete(key);
      }
    }
  } catch (err) {
    console.warn('[PWA] Reset app failed:', err);
  } finally {
    window.location.reload();
  }
}

export async function triggerInstall() {
  if (!deferredPrompt) return;
  deferredPrompt.prompt();
  try {
    await deferredPrompt.userChoice;
  } catch (err) {
    // ignore
  }
  deferredPrompt = null;
  S.installDismissed = true;
  save();
  document.dispatchEvent(new CustomEvent('kalari:render', { detail: { keepScroll: true } }));
}

export function dismissInstall() {
  S.installDismissed = true;
  save();
  document.dispatchEvent(new CustomEvent('kalari:render', { detail: { keepScroll: true } }));
}

export function renderInstallCard() {
  if (S.visits < 2 || S.installDismissed) return '';
  const isStandalone = (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) || Boolean(navigator.standalone);
  if (isStandalone) return '';

  const l = lang();
  const dismissLabel = l === 'ml' ? 'ഒഴിവാക്കുക' : (l === 'both' ? 'Dismiss · ഒഴിവാക്കുക' : 'Dismiss');

  if (isIosSafari()) {
    return `<div class="card install-card">
      <div class="row" style="align-items:flex-start;justify-content:space-between;gap:12px">
        <div style="flex:1">
          <div class="eyebrow">${tx('Install app', 'ആപ്പ് ഇൻസ്റ്റാൾ ചെയ്യുക')}</div>
          <b style="font-family:var(--f-display);font-size:1.1rem;display:block;margin-top:2px">
            ${tx('Install PSC Kalari', 'പി.എസ്.സി കളരി ഇൻസ്റ്റാൾ ചെയ്യുക')}
          </b>
          <p class="sub" style="margin-top:4px">
            ${tx('Tap Share, then Add to Home Screen', 'ഷെയർ (Share) അമർത്തി Add to Home Screen തിരഞ്ഞെടുക്കുക')}
          </p>
        </div>
        <button type="button" class="icon-btn" data-act="dismiss-install" aria-label="${dismissLabel}">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18 6L6 18M6 6l12 12"/></svg>
        </button>
      </div>
    </div>`;
  }

  if (hasDeferredPrompt()) {
    return `<div class="card install-card">
      <div class="row" style="align-items:flex-start;justify-content:space-between;gap:12px">
        <div style="flex:1">
          <div class="eyebrow">${tx('Fast & offline', 'വേഗതയുള്ളതും ഓഫ്‌ലൈനും')}</div>
          <b style="font-family:var(--f-display);font-size:1.1rem;display:block;margin-top:2px">
            ${tx('Install PSC Kalari', 'പി.എസ്.സി കളരി ഇൻസ്റ്റാൾ ചെയ്യുക')}
          </b>
          <p class="sub" style="margin-top:4px">
            ${tx('Install as an app for fast offline practice.', 'വേഗത്തിലുള്ള ഓഫ്‌ലൈൻ പരിശീലനത്തിനായി ആപ്പായി ഇൻസ്റ്റാൾ ചെയ്യുക.')}
          </p>
        </div>
        <button type="button" class="icon-btn" data-act="dismiss-install" aria-label="${dismissLabel}">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18 6L6 18M6 6l12 12"/></svg>
        </button>
      </div>
      <div class="row" style="margin-top:12px;gap:8px">
        <button type="button" class="btn sm" data-act="install-pwa">
          ${tx('Install', 'ഇൻസ്റ്റാൾ ചെയ്യുക')}
        </button>
        <button type="button" class="btn sm ghost" data-act="dismiss-install">
          ${tx('Not now', 'ഇപ്പോൾ വേണ്ട')}
        </button>
      </div>
    </div>`;
  }

  return '';
}

export function prefetchQuestions() {
  const schedule = window.requestIdleCallback || ((cb) => setTimeout(cb, 1000));
  schedule(async () => {
    try {
      const idx = await loadIndex();
      if (!idx || !Array.isArray(idx.subjects)) return;
      for (const subj of idx.subjects) {
        fetch(`data/q/${subj.key}.json`).catch(() => {});
      }
      fetch('data/papers.json').catch(() => {});
    } catch (err) {
      // offline prefetch errors are harmless
    }
  });
}

export function initPwa() {
  // Service Worker Registration
  if ('serviceWorker' in navigator) {
    let swRegistration = null;

    navigator.serviceWorker.register('./sw.js').then((reg) => {
      swRegistration = reg;
      if (reg.waiting) {
        waitingWorker = reg.waiting;
        updateNoticeArea();
      }

      reg.addEventListener('updatefound', () => {
        const newWorker = reg.installing;
        if (!newWorker) return;
        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            waitingWorker = newWorker;
            updateNoticeArea();
          }
        });
      });
    }).catch((err) => {
      console.warn('[PWA] Service worker registration failed:', err);
    });

    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (!refreshing) {
        refreshing = true;
        // Guard against infinite reload loops
        const last = Number(sessionStorage.getItem('kalari:sw-reload') || 0);
        if (Date.now() - last < 5000) {
          console.warn('[PWA] Suppressing rapid SW reload loop');
          return;
        }
        sessionStorage.setItem('kalari:sw-reload', String(Date.now()));
        window.location.reload();
      }
    });

    // Call registration.update() when the tab becomes visible again
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible' && swRegistration) {
        swRegistration.update().catch(() => {});
      }
    });
  }

  // Network online/offline indicators
  window.addEventListener('online', () => updateNoticeArea());
  window.addEventListener('offline', () => updateNoticeArea());

  // Install prompt capture
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    document.dispatchEvent(new CustomEvent('kalari:render', { detail: { keepScroll: true } }));
  });

  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    S.installDismissed = true;
    save();
    document.dispatchEvent(new CustomEvent('kalari:render', { detail: { keepScroll: true } }));
  });

  updateNoticeArea();
}
