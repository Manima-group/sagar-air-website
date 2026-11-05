import '../styles/base.css';
import '../styles/header.css';
import '../styles/hero.css';
import '../styles/sections.css';
import '../styles/views.css';
import '../styles/footer.css';
import '../styles/responsive.css';

import D from '../data/content.json';
import { $, $$, idle } from './core/dom.js';
import { renderMenu, renderHome, createProducts, createIndustry, splitHeadline } from './features/render.js';
import { createRouter, VIEWS } from './features/router.js';
import { createReveal, pauseOffscreenMarquees, bindPointerEffects } from './features/effects.js';
import { ScrubHero } from './scrub/ScrubHero.js';

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
  },
});

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

// 5. Contact form (demo: not connected to a backend)
$('#f').addEventListener('submit', (e) => {
  e.preventDefault();
  e.target.hidden = true;
  $('#ok').classList.add('on');
});

// 6. Initial view
const start = location.hash.slice(1);
router.show(VIEWS.includes(start) ? start : 'home');

// 7. Non-critical work after first paint
pauseOffscreenMarquees();
bindPointerEffects();
hero.start(); // frame 0 + last frame first, the rest coarse-to-fine at low priority
idle(() => reveal.scan());
