import { $, $$, esc, idle } from '../core/dom.js';
import { buildIndex, search, TYPES, typeOrder } from './index.js';

/**
 * Command-palette style search (opens from the top-bar field, the header icon,
 * "/" or Ctrl/⌘+K). Accessible combobox + listbox, full keyboard support,
 * results grouped by type, deep links into the right view and item.
 */
const QUICK = ['Dehumidifiers', 'AHU', 'Brochures', 'IOM manual', 'Kitchen hood', 'Grilles', 'Pharma', 'Contact'];
const MAX_PER_GROUP = 6;

export function createSearch({ data, onGo }) {
  let docs = null;            // built lazily (idle or first open)
  let items = [];             // flat list of rendered result docs
  let active = -1;
  let lastQuery = null, raf = 0, opener = null;

  const ensureIndex = () => (docs ||= buildIndex(data));
  idle(ensureIndex, 3000);

  // ----- markup --------------------------------------------------------------
  document.body.insertAdjacentHTML('beforeend', `
<div class="sx" id="sx" hidden>
  <div class="sx-back" data-close></div>
  <div class="sx-panel" role="dialog" aria-modal="true" aria-label="Search Sagar Air">
    <div class="sx-bar">
      <svg aria-hidden="true"><use href="#i-search"/></svg>
      <input id="sxq" type="search" role="combobox" aria-expanded="true" aria-controls="sxl" aria-autocomplete="list"
        placeholder="Search products, series, brochures, industries…" autocomplete="off" spellcheck="false" enterkeyhint="go">
      <button class="sx-x" data-close aria-label="Close search"><kbd>Esc</kbd></button>
    </div>
    <div class="sx-chips-w"><div class="sx-chips" role="group" aria-label="Quick searches">${QUICK.map((q) => `<button type="button" class="sx-chip">${q}</button>`).join('')}</div><div class="sx-track" aria-hidden="true"><i class="sx-thumb"></i></div></div>
    <div class="sx-body"><ul id="sxl" role="listbox" aria-label="Search results"></ul></div>
    <div class="sx-foot"><span><kbd>↑</kbd><kbd>↓</kbd> move <kbd>Enter</kbd> open <kbd>Esc</kbd> close</span><span id="sxn" aria-live="polite"></span></div>
  </div>
</div>`);
  const root = $('#sx'), input = $('#sxq'), list = $('#sxl'), count = $('#sxn');
  const chips = $('.sx-chips', root), chipsWrap = chips.parentElement;
  const track = $('.sx-track', root), thumb = $('.sx-thumb', root);
  const chipEdges = () => {
    const max = chips.scrollWidth - chips.clientWidth;
    chipsWrap.classList.toggle('more-l', chips.scrollLeft > 4);
    chipsWrap.classList.toggle('more-r', chips.scrollLeft < max - 4);
    track.hidden = max <= 2;
    if (max <= 2) return;
    const tw = track.clientWidth, w = Math.max(28, tw * (chips.clientWidth / chips.scrollWidth));
    thumb.style.width = w + 'px';
    thumb.style.transform = `translateX(${((chips.scrollLeft / max) * (tw - w)).toFixed(1)}px)`;
  };
  // drag or tap the line to scroll the chips
  track.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    track.setPointerCapture(e.pointerId);
    track.classList.add('drag');
    const r = track.getBoundingClientRect(), w = thumb.offsetWidth;
    const startX = e.clientX, onThumb = e.target === thumb, start = chips.scrollLeft;
    const max = chips.scrollWidth - chips.clientWidth, ratio = max / Math.max(1, r.width - w);
    chips.style.scrollBehavior = 'auto';
    if (!onThumb) chips.scrollLeft = (e.clientX - r.left - w / 2) * ratio;
    const base = chips.scrollLeft, move = (ev) => { chips.scrollLeft = (onThumb ? start : base) + (ev.clientX - startX) * ratio; };
    const up = () => { track.classList.remove('drag'); chips.style.scrollBehavior = ''; track.removeEventListener('pointermove', move); };
    track.addEventListener('pointermove', move);
    track.addEventListener('pointerup', up, { once: true });
    track.addEventListener('pointercancel', up, { once: true });
  });
  chips.addEventListener('scroll', chipEdges, { passive: true });
  // a normal mouse wheel scrolls the chip row sideways
  chips.addEventListener('wheel', (e) => {
    if (Math.abs(e.deltaY) > Math.abs(e.deltaX) && chips.scrollWidth > chips.clientWidth) { e.preventDefault(); chips.scrollLeft += e.deltaY; }
  }, { passive: false });
  addEventListener('resize', () => { if (!root.hidden) chipEdges(); });

  // ----- rendering -----------------------------------------------------------
  const hl = (text, terms) => {
    let h = esc(text);
    if (!terms.length) return h;
    const re = new RegExp(`(${terms.filter((t) => t.length > 1).map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`, 'gi');
    return terms.some((t) => t.length > 1) ? h.replace(re, '<mark>$1</mark>') : h;
  };

  function render(q) {
    ensureIndex();
    const { results, exact, terms } = q.trim() ? search(docs, q) : { results: popular(), exact: true, terms: [] };
    const groups = new Map();
    for (const d of results) {
      if (!groups.has(d.type)) groups.set(d.type, []);
      const g = groups.get(d.type);
      if (g.length < MAX_PER_GROUP) g.push(d);
    }
    items = [];
    let html = '';
    if (!q.trim()) html += '<li class="sx-g" role="presentation">Popular</li>';
    else if (!results.length) html = `<li class="sx-empty" role="presentation">No matches for “${esc(q)}”.<br><small>Try a series code (DEWPAC, SAGM), a product type (dehumidifier, grille) or “brochure”.</small></li>`;
    else if (!exact) html += '<li class="sx-g" role="presentation">Closest matches</li>';
    const orderedTypes = q.trim() ? [...groups.keys()] : typeOrder.filter((t) => groups.has(t));
    for (const type of orderedTypes) {
      if (q.trim()) html += `<li class="sx-g" role="presentation">${TYPES[type].label}</li>`;
      for (const d of groups.get(type)) {
        const i = items.push(d) - 1;
        const ext = !!d.go.url;
        html += `<li role="option" id="sxo-${i}" class="sx-o" data-i="${i}" aria-selected="false">
<span class="sx-ic t-${type}"><svg aria-hidden="true"><use href="#${TYPES[type].icon}"/></svg></span>
<span class="sx-tx"><b>${hl(d.title, terms)}</b>${d.sub ? `<small>${hl(d.sub, terms)}</small>` : ''}</span>
<span class="sx-go" aria-hidden="true">${ext ? (d.type === 'download' && !d.go.dc ? 'PDF ↗' : '↗') : '↵'}</span></li>`;
      }
    }
    list.innerHTML = html;
    count.textContent = q.trim() ? `${results.length} result${results.length === 1 ? '' : 's'}` : '';
    setActive(items.length ? 0 : -1, false);
  }

  function popular() {
    ensureIndex();
    const pick = (type, n) => docs.filter((d) => d.type === type).slice(0, n);
    return [...pick('category', 6), ...docs.filter((d) => d.type === 'download' && /brochure/i.test(d.title)).slice(0, 3), ...pick('contact', 1)];
  }

  function setActive(i, scroll = true) {
    const prev = list.querySelector('[aria-selected="true"]');
    if (prev) prev.setAttribute('aria-selected', 'false');
    active = i;
    if (i < 0) { input.removeAttribute('aria-activedescendant'); return; }
    const el = $('#sxo-' + i);
    el.setAttribute('aria-selected', 'true');
    input.setAttribute('aria-activedescendant', el.id);
    if (scroll) el.scrollIntoView({ block: 'nearest' });
  }

  function choose(i) {
    const d = items[i];
    if (!d) return;
    if (d.go.url) {
      // real link click inside the user gesture: opens in a new tab everywhere, including sandboxed viewers
      const a = document.createElement('a');
      a.href = d.go.url; a.target = '_blank'; a.rel = 'noopener';
      document.body.append(a); a.click(); a.remove();
      close();
      return;
    }
    close(true);
    onGo(d.go);
  }

  // ----- open / close --------------------------------------------------------
  function open(prefill = '') {
    if (!root.hidden) { input.focus(); return; }
    opener = document.activeElement;
    root.hidden = false;
    document.documentElement.classList.add('sx-lock');
    requestAnimationFrame(() => root.classList.add('on'));
    input.value = prefill;
    lastQuery = null;
    schedule();
    requestAnimationFrame(chipEdges);
    input.focus({ preventScroll: true });
    $$('[data-search]').forEach((b) => b.setAttribute('aria-expanded', 'true'));
  }
  function close(keepFocusAway = false) {
    if (root.hidden) return;
    root.classList.remove('on');
    root.hidden = true;
    document.documentElement.classList.remove('sx-lock');
    $$('[data-search]').forEach((b) => b.setAttribute('aria-expanded', 'false'));
    if (!keepFocusAway && opener && opener.focus) opener.focus({ preventScroll: true });
  }

  const schedule = () => {
    if (raf) return;
    raf = requestAnimationFrame(() => {
      raf = 0;
      if (input.value === lastQuery) return;
      lastQuery = input.value;
      render(input.value);
    });
  };

  // ----- events --------------------------------------------------------------
  input.addEventListener('input', schedule);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); if (items.length) setActive((active + 1) % items.length); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); if (items.length) setActive((active - 1 + items.length) % items.length); }
    else if (e.key === 'Home' && items.length) { e.preventDefault(); setActive(0); }
    else if (e.key === 'End' && items.length) { e.preventDefault(); setActive(items.length - 1); }
    else if (e.key === 'Enter') { e.preventDefault(); choose(active); }
    else if (e.key === 'Escape') { e.preventDefault(); input.value ? (input.value = '', schedule()) : close(); }
    else if (e.key === 'Tab') { e.preventDefault(); } // focus stays in the dialog
  });
  list.addEventListener('pointermove', (e) => {
    const o = e.target.closest('.sx-o');
    if (o && +o.dataset.i !== active) setActive(+o.dataset.i, false);
  });
  list.addEventListener('click', (e) => { const o = e.target.closest('.sx-o'); if (o) choose(+o.dataset.i); });
  root.addEventListener('click', (e) => {
    if (e.target.closest('[data-close]')) close();
    const chip = e.target.closest('.sx-chip');
    if (chip) { input.value = chip.textContent; schedule(); input.focus(); chip.scrollIntoView({ block: 'nearest', inline: 'nearest' }); }
  });
  document.addEventListener('click', (e) => {
    const t = e.target.closest('[data-search]');
    if (t) { e.preventDefault(); open(); }
  });
  document.addEventListener('keydown', (e) => {
    const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName) || document.activeElement?.isContentEditable;
    if ((e.key === 'k' || e.key === 'K') && (e.ctrlKey || e.metaKey)) { e.preventDefault(); root.hidden ? open() : close(); }
    else if (e.key === '/' && !typing && root.hidden) { e.preventDefault(); open(); }
  });

  return { open, close };
}
