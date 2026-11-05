import { $, $$, media } from '../core/dom.js';

/**
 * Hash router over in-page views (#home, #about, #products, #industry, #contact)
 * with the circular "wipe" transition. Views stay in the DOM; only visibility changes.
 */
export const VIEWS = ['home', 'about', 'products', 'industry', 'contact'];

export function createRouter({ onShow }) {
  let current = null, busy = false;
  const wipe = $('#wipe'), menu = $('#menu');

  function show(view, opts = {}) {
    if (!VIEWS.includes(view)) view = 'home';
    document.body.classList.remove('pinned');
    $$('.view').forEach((v) => {
      const on = v.id === 'v-' + view;
      v.classList.toggle('on', on);
      v.hidden = !on;
    });
    let hit = false;
    $$('.menu>li>a').forEach((a) => {
      const m = !hit && a.dataset.go === view;
      if (m) hit = true;
      a.classList.toggle('on', m);
      if (m) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
    });
    current = view;
    scrollTo(0, 0);
    onShow(view, opts);
  }

  function setHash(view) {
    try { history.replaceState(null, '', view === 'home' ? location.pathname + location.search : '#' + view); }
    catch { location.hash = view; }
  }

  function navigate(view, opts = {}, ev) {
    menu.classList.remove('open');
    if (busy) return;
    if (media.reducedMotion.matches) { show(view, opts); setHash(view); return; }
    busy = true;
    wipe.style.setProperty('--x', (ev?.clientX ?? innerWidth / 2) + 'px');
    wipe.style.setProperty('--y', (ev?.clientY ?? innerHeight / 2) + 'px');
    wipe.classList.add('go');
    const done = () => { wipe.classList.remove('go'); busy = false; };
    setTimeout(() => { show(view, opts); setHash(view); }, 420);
    wipe.addEventListener('animationend', done, { once: true });
    setTimeout(() => busy && done(), 1500); // safety if animationend never fires
  }

  addEventListener('hashchange', () => {
    const v = location.hash.slice(1);
    if (v && v !== current && VIEWS.includes(v)) show(v);
  });

  return { show, navigate, get current() { return current; } };
}
