// Tiny DOM + math helpers shared by every module. No dependencies.

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

export const clamp = (v, lo = 0, hi = 1) => (v < lo ? lo : v > hi ? hi : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);

/** Escape text for safe interpolation into innerHTML templates. */
export const esc = (v) =>
  String(v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

/** Mix two #rrggbb colours; t = 0 → a, 1 → b. */
export function mixHex(a, b, t) {
  const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
  const ch = (s) => Math.round(lerp((pa >> s) & 255, (pb >> s) & 255, t));
  return `rgb(${ch(16)},${ch(8)},${ch(0)})`;
}

/** Run fn when the browser is idle (falls back to a short timeout). */
export const idle = (fn, timeout = 1200) =>
  'requestIdleCallback' in window ? requestIdleCallback(fn, { timeout }) : setTimeout(fn, 200);

/** Write a style property only when the value changed: avoids needless style recalcs. */
export function setStyle(el, prop, value) {
  const key = '_s_' + prop;
  if (el[key] === value) return;
  el[key] = value;
  el.style[prop] = value;
}

/** Media/device capabilities, read once and kept current. */
export const media = {
  reducedMotion: matchMedia('(prefers-reduced-motion: reduce)'),
  stacked: matchMedia('(max-width:760px),(orientation:portrait) and (max-width:1100px)'),
  phone: matchMedia('(max-width:760px)'),
  finePointer: matchMedia('(hover:hover) and (pointer:fine)'),
};

/** True when the network or device asks us to go easy on data. */
export function lowDataMode() {
  const c = navigator.connection;
  return !!(c && (c.saveData || /(^|-)2g|3g/.test(c.effectiveType || '')));
}
