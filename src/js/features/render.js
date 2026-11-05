import { $, esc } from '../core/dom.js';

/** Data-driven markup. Everything is rendered once; views only toggle visibility. */

const go = (g, label, attrs = '') => `<a href="#${g}" data-go="${g}" ${attrs}>${label}</a>`;
const ext = (href, label) => `<a href="${href}" target="_blank" rel="noopener">${label}</a>`;
const arrow = '<svg><use href="#i-arrow"/></svg>';
const dbl = (arr, f) => { const h = arr.map(f).join(''); return h + h; };

export function renderMenu(D) {
  const series = D.cats.map((c) => {
    const head = `<li>${go('products', esc(c.c), `data-c="${esc(c.c)}" class="h"`)}</li>`;
    const list = /Retrofit|Distribution/.test(c.c) ? '' :
      c.items.map((i) => `<li>${go('products', '&nbsp;&nbsp;' + esc(i.n), `data-c="${esc(c.c)}" data-p="${esc(i.n)}"`)}</li>`).join('');
    return head + list;
  }).join('');
  $('#menu').innerHTML = `
<li>${go('home', 'Home')}</li><li>${go('about', 'About us')}</li><li><a href="#home" data-sol>Our solutions</a></li>
<li>${go('products', 'Our products', 'aria-haspopup="true"')}<ul class="dd">${series}</ul></li>
<li>${go('industry', 'Industry', 'aria-haspopup="true"')}<ul class="dd">${D.ind.map((i) => `<li>${go('industry', esc(i.n), `data-t="${esc(i.n)}"`)}</li>`).join('')}</ul></li>
<li>${go('industry', 'Case studies')}</li>
<li>${go('contact', 'Service requests', 'aria-haspopup="true"')}<ul class="dd"><li>${ext('https://sagarair.frappe.cloud/login#login', 'Service portal login ↗')}</li><li>${go('contact', 'Service request', 'data-s="Service request"')}</li><li>${ext('https://www.sagarair.com/dehumidifier-survey-sheet', 'Dehumidifier survey sheet ↗')}</li></ul></li>
<li>${go('about', 'Careers')}</li><li>${go('contact', 'Contact')}</li>
<li><a href="#home" data-more aria-haspopup="true">More…</a><ul class="dd"><li>${ext('https://www.sagarair.com/download-center', 'Download Center ↗')}</li><li>${ext('https://www.sagarair.com/qualitypolicy', 'Quality Policy ↗')}</li><li>${ext('https://www.sagarair.com/safetypolicy', 'Safety Policy ↗')}</li><li>${ext('https://sagarair.frappe.cloud/login#login', 'Sagar Air ERP Portal ↗')}</li></ul></li>`;
}

export function renderHome(D) {
  $('#m1').innerHTML = dbl(D.stats, (s) => `<span>${esc(s[0])}<small>${esc(s[1])}</small><em>✦</em></span>`);
  $('#m2').innerHTML = dbl(D.clients, (c) => `<span>${esc(c)}</span>`);

  $('#pgrid').innerHTML = D.cats.map((c, i) => `
<div class="pcard rv" style="--dl:${(i % 3) * 0.08}s" data-go="products" data-c="${esc(c.c)}" tabindex="0" role="link">
 <div class="ico ${c.i}"><svg><use href="#${D.catIcon[c.i]}"/></svg></div><span class="ar">${arrow}</span>
 <h3>${esc(c.c)}</h3><p>${esc(D.catBlurb[c.c])}</p>
 ${/wrench|grille/.test(c.i) ? '' : `<div class="tags">${c.items.map((x) => `<span>${esc(x.n.replace(/ Series$/, '').toUpperCase())}</span>`).join('')}</div>`}
</div>`).join('');

  $('#sol').innerHTML = D.sol.map((s, i) => {
    const [g, c] = D.solLinks[i].split('|');
    return `<div class="c"><span class="big">0${i + 1}</span><h3>${esc(s.replace('DEMAND CONTROLLED VENTILATION', 'Demand Controlled Ventilation'))}</h3>
<a class="lk" style="margin-top:24px;position:relative" href="#${g}" data-go="${g}" ${c ? `data-c="${esc(c)}"` : 'data-s="Rental enquiry"'}>Find out more ${arrow}</a></div>`;
  }).join('');

  $('#igrid').innerHTML = D.ind.map((x, i) => `
<div class="it rv" style="--g:${D.indStyle[i][1]};--dl:${i * 0.05}s" data-go="industry" data-t="${esc(x.n)}" tabindex="0" role="link">
 <svg aria-hidden="true"><use href="#${D.indStyle[i][0]}"/></svg><svg class="bgi" aria-hidden="true"><use href="#${D.indStyle[i][0]}"/></svg>
 <h4>${esc(x.n)}</h4><ul>${x.a.map((a) => `<li>${esc(a)}</li>`).join('')}</ul></div>`).join('');

  $('#prom').innerHTML = D.promises.map((p, i) => `<div class="rv" style="--dl:${i * 0.06}s"><i>0${i + 1}</i>${esc(p)}</div>`).join('');

  $('#prod').insertAdjacentHTML('beforeend', D.cats.map((c) =>
    `<optgroup label="${esc(c.c)}">${c.items.map((p) => `<option>${esc(p.n)}</option>`).join('')}</optgroup>`).join(''));
}

/** Products view: category chips + expandable series cards. */
export function createProducts(D) {
  let cat = D.cats[0].c;
  const chips = $('#chips'), grid = $('#sgrid');
  function render(open) {
    chips.innerHTML = D.cats.map((c) => `<button class="chip ${c.c === cat ? 'on' : ''}" aria-pressed="${c.c === cat}">${esc(c.c)}</button>`).join('');
    const c = D.cats.find((x) => x.c === cat);
    grid.innerHTML = c.items.map((p, i) => `
<div class="sc ${p.n === open ? 'op' : ''}" style="animation-delay:${i * 60}ms" tabindex="0" aria-expanded="${p.n === open}">
 <small>${esc(c.c)}</small><h3>${esc(p.n)}</h3><div class="s2">${esc(p.s)}</div><p class="s3">${esc(p.d)}</p>
 <div class="ex"><div>${p.f.length ? `<dl class="spec">${p.f.map((f) => `<div><dt>${esc(f[0])}</dt><dd>${esc(f[1])}</dd></div>`).join('')}</dl>` : '<div style="height:14px"></div>'}
 <a class="btn sm" href="#contact" data-go="contact" data-p="${esc(p.n)}">Enquire about ${esc(p.n)}</a></div></div>
 <div class="pl">${p.f.length ? 'Specifications' : 'Details'}<b>+</b></div></div>`).join('');
  }
  chips.addEventListener('click', (e) => { const b = e.target.closest('.chip'); if (b) { cat = b.textContent; render(); } });
  grid.addEventListener('click', (e) => {
    const c = e.target.closest('.sc');
    if (c && !e.target.closest('.btn')) { c.classList.toggle('op'); c.setAttribute('aria-expanded', c.classList.contains('op')); }
  });
  grid.addEventListener('keydown', (e) => { if ((e.key === 'Enter' || e.key === ' ') && e.target.matches('.sc')) { e.preventDefault(); e.target.click(); } });
  render();
  return { show({ c, p } = {}) { if (c) cat = c; render(p); } };
}

/** Industry view: tabs + panel. */
export function createIndustry(D) {
  const tabs = $('#tabs'), panel = $('#panel');
  function show(t) {
    const d = D.ind.find((x) => x.n === t) || D.ind[0];
    tabs.innerHTML = D.ind.map((n) => `<button class="chip ${n.n === d.n ? 'on' : ''}" aria-pressed="${n.n === d.n}">${esc(n.n)}</button>`).join('');
    panel.innerHTML = `<div class="panel"><h3>${esc(d.n)}</h3><p>${esc(d.t || `Sagar Air designs temperature, humidity and ventilation systems for ${d.n.toLowerCase()} spaces.`)}</p>
<h4>Key applications</h4>${d.a.map((a) => `<span class="pill">${esc(a)}</span>`).join('')}
${d.r ? `<h4>Client requirements we meet</h4><ul>${d.r.map((r) => `<li>${esc(r)}</li>`).join('')}</ul>` : ''}
<div style="margin-top:30px"><a class="btn" href="#contact" data-go="contact" data-s="${esc(d.n)} enquiry">Discuss a ${esc(d.n.toLowerCase())} project ${arrow}</a></div></div>`;
  }
  tabs.addEventListener('click', (e) => { const b = e.target.closest('.chip'); if (b) show(b.textContent); });
  show(D.ind[0].n);
  return { show };
}

/** Split the headline into per-character spans for the reveal animation. */
export function splitHeadline(el) {
  const html = 'Your HVAC needs are our <span class="y">responsibility.</span>';
  el.innerHTML = html.split(/ (?![^<]*>)/).map((w, k) => {
    const y = w.includes('responsibility');
    const t = w.replace(/<[^>]+>/g, '');
    return `<span class="wd ${y ? 'y' : ''}">${[...t].map((c, i) => `<span class="ch" style="--i:${i + k * 3}">${c}</span>`).join('')}</span>`;
  }).join('');
  el.setAttribute('aria-label', 'Your HVAC needs are our responsibility.');
}
