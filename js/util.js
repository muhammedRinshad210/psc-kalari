/* Pure helpers with no DOM or state dependencies. */

export const LET = ['A', 'B', 'C', 'D'];

/** Escape text for safe use inside HTML text and attribute values. */
export function esc(value) {
  return String(value).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

export function pad2(n) {
  return String(n).padStart(2, '0');
}

/** Local calendar day as YYYY-MM-DD (local time, not UTC). */
export function dayKey(d = new Date()) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

export function shuffle(list, rnd = Math.random) {
  const a = list.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Small deterministic PRNG so "today's five" is the same all day. */
export function seedRand(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function r2(n) {
  return Math.round(n * 100) / 100;
}

export function fmtTime(seconds) {
  const s = Math.max(0, Math.floor(seconds));
  return `${pad2(Math.floor(s / 60))}:${pad2(s % 60)}`;
}

/** Days back from today as YYYY-MM-DD. */
export function dayOffset(n) {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return dayKey(d);
}
