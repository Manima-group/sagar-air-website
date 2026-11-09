import '../styles/base.css';
import '../styles/header.css';
import '../styles/hero.css';
import '../styles/sections.css';
import '../styles/views.css';
import '../styles/footer.css';
import '../styles/responsive.css';
import '../styles/search.css';

import D from '../data/content.json';
import { $, $$, idle } from './core/dom.js';
import { renderMenu, renderHome, createProducts, createIndustry, splitHeadline } from './features/render.js';
import { createRouter, VIEWS } from './features/router.js';
import { createReveal, pauseOffscreenMarquees, bindPointerEffects } from './features/effects.js';
import { ScrubHero } from './scrub/ScrubHero.js';
import { createSearch } from './search/ui.js';
import { AirflowHero } from './hero/AirflowHero.js';

// Frames live in /public and are served next to index.html; BASE_URL keeps that working under any sub-path.
const BASE = import.meta.env.BASE_URL;

// 1. Static, data-driven markup (one pass, before first paint of interactive parts)
renderMenu(D);
renderHome(D);
splitHeadline($('#h1'));
const products = createProducts(D);
const industry = createIndustry(D);

// 2. Scroll-scrubbed hero
const hero = new ScrubHero($('#scrub'), D.hotspots, BASE);

// 3. Router
const reveal = createReveal();
const router = createRouter({
  onShow(view, o) {
    if (view === 'products') products.show(o);
    if (view === 'industry' && o.t) industry.show(o.t);
    if (view === 'contact') {
      if (o.p) $('#prod').value = o.p;
      if (o.s) $('#subj').value = o.s;
    }
    if (view === 'home') hero.resume();
    reveal.scan();
    if (o.focus || o.p || o.code) requestAnimationFrame(() => requestAnimationFrame(() => focusTarget(view, o)));
  },
});

/** Keep a target centred while lazily rendered sections above it settle (max ~1 s). */
function settle(target) {
  let frames = 0, stable = 0;
  const tick = () => {
    const r = target.getBoundingClientRect();
    const off = r.top + r.height / 2 - innerHeight / 2;
    if (Math.abs(off) > 6) { target.scrollIntoView({ block: 'center', behavior: 'instant' }); stable = 0; } else stable++;
    if (stable < 4 && ++frames < 60) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

/** Bring a deep-linked item (from search or a menu) into view and flash it. */
function focusTarget(view, o) {
  let el = o.focus ? $(o.focus) : null;
  if (!el && view === 'products' && o.p) el = $(`.sc[data-name="${CSS.escape(o.p)}"]`);
  if (!el) return;
  const row = o.code ? el.querySelector(`[data-code="${CSS.escape(o.code)}"]`) : null;
  const target = row || el;
  // short hops glide; long jumps are instant (and re-aimed once lazily rendered sections above settle)
  const far = Math.abs(target.getBoundingClientRect().top) > innerHeight * 1.5;
  const smooth = !far && !matchMedia('(prefers-reduced-motion: reduce)').matches;
  target.scrollIntoView({ block: 'center', behavior: smooth ? 'smooth' : 'instant' });
  if (far) settle(target);
  target.classList.remove('flash');
  void target.offsetWidth; // restart the animation
  target.classList.add('flash');
}

// 4. Navigation: one delegated click handler for the whole page
const menu = $('#menu');
const touchMenu = () => matchMedia('(max-width:1160px)').matches;
document.addEventListener('click', (e) => {
  const t = e.target;
  if (t.closest('[data-sol]')) {
    e.preventDefault();
    menu.classList.remove('open');
    const go = () => $('#solutions').scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
    if (router.current !== 'home') { router.show('home'); requestAnimationFrame(go); } else go();
    return;
  }
  if (t.closest('[data-more]')) e.preventDefault();
  // first tap on a top-level item with a submenu opens it (touch / small screens)
  if (touchMenu()) {
    const li = t.closest('.menu>li');
    if (li && li.querySelector('.dd') && t.closest('.menu>li>a') && !li.classList.contains('open')) {
      e.preventDefault();
      $$('.menu>li.open').forEach((x) => x.classList.remove('open'));
      li.classList.add('open');
      return;
    }
  }
  const a = t.closest('[data-go]');
  if (a) {
    e.preventDefault();
    const { go, c, p, t: tab, s } = a.dataset;
    router.navigate(go, { c, p, t: tab, s }, e);
  }
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && e.target.matches?.('.pcard,.it')) e.target.click();
  if (e.key === 'Escape') menu.classList.remove('open');
});
$('#bg').addEventListener('click', () => {
  const open = menu.classList.toggle('open');
  $('#bg').setAttribute('aria-expanded', open);
});

// 5. Site-wide search (top bar field, header icon, "/" or Ctrl/⌘+K)
createSearch({ data: D, onGo: (go) => router.navigate(go.view, go) });

// 6. Contact form (demo: not connected to a backend)
$('#f').addEventListener('submit', (e) => {
  e.preventDefault();
  e.target.hidden = true;
  $('#ok').classList.add('on');
});

// 7. Initial view
const start = location.hash.slice(1);
router.show(VIEWS.includes(start) ? start : 'home');

// 8. Non-critical work after first paint
pauseOffscreenMarquees();
bindPointerEffects();
hero.start(); // frame 0 + last frame first, the rest coarse-to-fine at low priority
// hero airflow starts after the first paint so it never delays the headline or image
requestAnimationFrame(() => new AirflowHero($('#hero')).start());
idle(() => reveal.scan());
