/**
 * Search index built from content.json.
 *
 * Every searchable thing on the site (categories, series, specs, air-distribution
 * product codes, brochures/manuals, industries, solutions, company pages, contact
 * details, clients) becomes one document. Matching is token based with prefix,
 * substring and one-typo tolerance, plus a small HVAC synonym table, so
 * "dehumidifer brochure", "ahu", "saacu-s" or "grill" all find the right items.
 */

export const TYPES = {
  series: { label: 'Products', icon: 'i-ahu' },
  category: { label: 'Product ranges', icon: 'i-grille' },
  part: { label: 'Air distribution items', icon: 'i-grille' },
  download: { label: 'Downloads', icon: 'i-doc' },
  industry: { label: 'Industries', icon: 'i-fac' },
  solution: { label: 'Solutions', icon: 'i-gear' },
  page: { label: 'Company & pages', icon: 'i-link' },
  contact: { label: 'Contact', icon: 'i-chat' },
};
const ORDER = ['series', 'category', 'part', 'download', 'industry', 'solution', 'page', 'contact'];

// query word → extra words it should also match
const SYN = {
  ahu: ['handling'], ahus: ['handling'],
  dehumidifier: ['desiccant', 'dew', 'dehumidifiers'], dehumidifiers: ['desiccant', 'dew'], dehumidification: ['desiccant', 'dew'],
  humidity: ['desiccant', 'rh'], moisture: ['desiccant', 'rh'], dry: ['desiccant'],
  fan: ['fans', 'blower', 'blowers'], fans: ['fan', 'blower'], blower: ['fan', 'blowers'], blowers: ['fan'],
  kitchen: ['hood', 'hoods', 'scrubber'], hood: ['kitchen', 'hoods'], exhaust: ['ventilation', 'kitchen'],
  brochure: ['brochure', 'brochures', 'pdf'], brochures: ['brochure'], pdf: ['brochure', 'manual', 'specs', 'sheet'],
  catalog: ['brochure', 'catalog'], catalogue: ['brochure', 'catalog'], download: ['brochure', 'manual', 'specs', 'sheet', 'download'],
  downloads: ['brochure', 'manual', 'download'], manual: ['iom', 'manual'], iom: ['manual'], datasheet: ['sheet', 'specs'],
  spec: ['specs', 'specsheet', 'sheet'], specs: ['specsheet', 'sheet'],
  grill: ['grilles', 'grille'], grills: ['grilles'], grille: ['grilles'],
  cleanroom: ['clean', 'sacr', 'hygienic'], hygienic: ['clean', 'sacr'], pharma: ['pharmaceutical'],
  food: ['beverage', 'f&b'], datacenter: ['datacenters', 'software'], hospital: ['healthcare'], hotel: ['hospitality'],
  phone: ['tel', 'mobile', 'call'], call: ['tel', 'mobile', 'phone'], number: ['tel', 'mobile'], mobile: ['tel', 'phone'],
  email: ['mail', 'sales'], mail: ['email'], address: ['plot', 'uppal'], location: ['address', 'uppal', 'hyderabad'],
  job: ['careers', 'career'], jobs: ['careers'], career: ['careers'], hiring: ['careers'],
  service: ['support', 'portal'], support: ['service'], complaint: ['service', 'ticket'],
  rent: ['rental'], hire: ['rental'], price: ['quote'], quotation: ['quote'], cost: ['quote'],
  washer: ['washers', 'saacu'], evaporative: ['pre cooling', 'sapcu'], precooling: ['sapcu', 'pre'],
};

export const norm = (s) =>
  String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/&/g, ' and ').replace(/[^a-z0-9.%/+]+/g, ' ').replace(/(^|\s)[./]+|[./]+(\s|$)/g, ' ').trim();

function tokens(s) {
  const n = norm(s);
  if (!n) return [];
  const out = new Set(n.split(/\s+/));
  // joined variants so "saacu-s" == "saacus" and "dew pac" == "dewpac"
  const raw = String(s).toLowerCase();
  (raw.match(/[a-z0-9]+(?:[-/][a-z0-9]+)+/g) || []).forEach((w) => out.add(w.replace(/[-/]/g, '')));
  return [...out];
}

/** Build the documents. Pure function of the content data. */
export function buildIndex(D) {
  const docs = [];
  const add = (type, title, sub, keys, body, go) =>
    docs.push({ type, title, sub, go, f: [tokens(title), tokens(keys), tokens(body)], t: norm(title) });

  for (const c of D.cats) {
    add('category', c.c, D.catBlurb[c.c], c.items.map((i) => i.n).join(' '), '', { view: 'products', c: c.c });
    if (c.c === 'Air Distribution Catalog') continue;
    for (const it of c.items) {
      const specs = (it.f || []).map((f) => f.join(' ')).join(' ');
      add('series', it.n, `${it.s} · ${c.c}`, `${c.c} ${it.s}`, `${it.d} ${specs}`, { view: 'products', c: c.c, p: it.n });
    }
  }
  for (const g of D.airDist || []) {
    for (const p of g.p) {
      add('part', `${p.code} – ${p.n}`, `${g.c} · Air distribution`, `${g.c} ${p.code} air distribution`, p.f.join(' '),
        { view: 'products', c: 'Air Distribution Catalog', p: g.c, code: p.code });
    }
  }
  for (const d of D.downloads || []) {
    add('download', d.l, `${d.dc ? 'Download Center' : 'PDF'}${d.s ? ` · ${d.s}` : ''}`, `${d.s || ''} ${d.c || ''} pdf download`, '', { url: d.u, dc: !!d.dc });
  }
  D.ind.forEach((x) => add('industry', x.n, x.a.slice(0, 3).join(' · '), 'industry application', `${x.a.join(' ')} ${x.t || ''}`, { view: 'industry', t: x.n }));
  D.sol.forEach((s, i) => {
    const [view, c] = D.solLinks[i].split('|');
    add('solution', s.replace('DEMAND CONTROLLED VENTILATION', 'Demand Controlled Ventilation'), 'Our solutions', 'solution', '',
      view === 'contact' ? { view: 'contact', s: 'Rental enquiry' } : { view, c });
  });
  const ct = D.contact || {};
  add('page', 'About Sagar Air', 'Founded in 1987 by V V Murthy, Hyderabad', 'about company history', 'manufacturer hvac uppal portfolio', { view: 'about' });
  add('page', 'Our Management', 'V V Murthy · V V E C Vidyasagar', 'management team founder director', 'murthy vidyasagar', { view: 'about', focus: '.ppl' });
  add('page', 'Vision', 'Our source of strength is our customers', 'vision mission values', '', { view: 'about', focus: '.vis' });
  add('page', 'Careers', `Send your CV to ${ct.careers || 'careers@sagarair.com'}`, 'careers jobs hiring', '', { view: 'about', focus: '#careers' });
  add('page', 'Clientele', 'Voltas, Bluestar, P&G, Natco Pharma and more', 'clients customers clientele', D.clients.map((c) => c.n || c).join(' '), { view: 'home', focus: '.cl' });
  for (const [t, s, u, k] of D.links || []) add('page', t, s, k, '', { url: u });
  add('contact', 'Get a quote / contact us', `${ct.mobile || ''}`, 'contact quote enquiry form', 'message enquiry', { view: 'contact' });
  add('contact', 'Phone numbers', `Tel ${ct.tel} · Mobile ${ct.mobile}`, 'phone tel mobile call number', ct.fax ? `fax ${ct.fax}` : '', { view: 'contact' });
  add('contact', 'Email', (ct.emails || []).join(' · '), 'email mail', '', { view: 'contact' });
  add('contact', 'Factory address', ct.address, 'address location factory visit map', 'hyderabad telangana uppal', { view: 'contact' });
  add('contact', 'Service request', 'Raise a service request with our engineers', 'service request support repair', '', { view: 'contact', s: 'Service request' });
  return docs;
}

function lev1(a, b, max) {
  // bounded Levenshtein: returns true when distance <= max
  if (Math.abs(a.length - b.length) > max) return false;
  const v = new Array(b.length + 1);
  for (let j = 0; j <= b.length; j++) v[j] = j;
  for (let i = 1; i <= a.length; i++) {
    let prev = v[0], best = (v[0] = i);
    for (let j = 1; j <= b.length; j++) {
      const tmp = v[j];
      v[j] = Math.min(v[j] + 1, v[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = tmp;
      if (v[j] < best) best = v[j];
    }
    if (best > max) return false;
  }
  return v[b.length] <= max;
}

function matchToken(q, list) {
  let best = 0;
  for (const t of list) {
    if (t === q) return 1;
    if (t.startsWith(q)) best = Math.max(best, q.length >= 2 ? 0.8 : 0.5);
    else if (q.length >= 3 && t.includes(q)) best = Math.max(best, 0.5);
    else if (best < 0.4 && q.length >= 4 && t.length >= 4 && lev1(q, t.slice(0, q.length + 2), q.length >= 7 ? 2 : 1)) best = 0.4;
  }
  return best;
}

const W = [3, 2, 1];

/** Run a query. Returns ranked docs with a `score`. */
export function search(docs, query, limit = 40) {
  const q = norm(query);
  if (!q) return { results: [], exact: true, terms: [] };
  const qt = [...new Set(q.split(/\s+/))].filter(Boolean);
  const alts = qt.map((t) => [t, ...((SYN[t] || []).flatMap((s) => norm(s).split(' ')))]);
  const scored = [];
  for (const d of docs) {
    let total = 0, hit = 0;
    for (const options of alts) {
      let best = 0;
      for (let k = 0; k < options.length; k++) {
        const o = options[k], penalty = k === 0 ? 1 : 0.85;
        for (let fi = 0; fi < 3; fi++) {
          const m = matchToken(o, d.f[fi]);
          if (m) best = Math.max(best, m * W[fi] * penalty);
        }
      }
      if (best) { hit++; total += best; }
    }
    if (!hit) continue;
    const all = hit === alts.length;
    if (d.t.startsWith(q)) total += 3;
    else if (d.t.includes(q)) total += 1.5;
    scored.push({ d, score: total * (all ? 1 : 0.35), all });
  }
  const strict = scored.filter((s) => s.all);
  let pool = strict.length ? strict : scored;
  pool.sort((a, b) => b.score - a.score || ORDER.indexOf(a.d.type) - ORDER.indexOf(b.d.type));
  // drop weak tail matches (e.g. one-typo hits far below the best result)
  const top = pool.length ? pool[0].score : 0;
  pool = pool.filter((s) => s.score >= top * 0.3);
  return { results: pool.slice(0, limit).map((s) => s.d), exact: !!strict.length, terms: qt };
}

export const typeOrder = ORDER;
