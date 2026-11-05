import { $$, media } from '../core/dom.js';

/** Scroll reveals + count-up numbers, via one shared IntersectionObserver. */
export function createReveal() {
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) {
      if (!e.isIntersecting) continue;
      const t = e.target;
      t.classList.add('in');
      if (t.dataset.n) countUp(t);
      t.querySelectorAll('[data-n]').forEach(countUp);
      io.unobserve(t);
    }
  }, { threshold: 0.12 });
  const scan = () => $$('.rv:not(.in),[data-n]:not(.done)').forEach((x) => io.observe(x));
  scan();
  return { scan };
}

function countUp(n) {
  if (n.classList.contains('done')) return;
  n.classList.add('done');
  const T = +n.dataset.n, plain = n.hasAttribute('data-nc');
  const fmt = (v) => (plain ? String(v) : v.toLocaleString('en-IN'));
  if (media.reducedMotion.matches) { n.textContent = fmt(T); return; }
  const t0 = performance.now();
  const tick = (t) => {
    const k = Math.min(1, (t - t0) / 1600);
    n.textContent = fmt(Math.round(T * (1 - Math.pow(1 - k, 3))));
    if (k < 1) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

/** Marquees animate only while on screen (saves compositor work and battery). */
export function pauseOffscreenMarquees() {
  const io = new IntersectionObserver((es) => es.forEach((e) => e.target.classList.toggle('off', !e.isIntersecting)));
  $$('.mq').forEach((m) => io.observe(m));
}

/** Card tilt (fine pointers only) and button ripples, via delegated listeners. */
export function bindPointerEffects() {
  let card = null, px = 0, py = 0, queued = false;
  document.addEventListener('pointermove', (e) => {
    if (!media.finePointer.matches || media.reducedMotion.matches) return;
    const c = e.target.closest?.('.pcard');
    if (card && card !== c) card.style.transform = '';
    card = c;
    if (!c) return;
    px = e.clientX; py = e.clientY;
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => {
      queued = false;
      if (!card) return;
      const r = card.getBoundingClientRect();
      card.style.transform = `translateY(-6px) perspective(800px) rotateX(${((0.5 - (py - r.top) / r.height) * 6).toFixed(2)}deg) rotateY(${(((px - r.left) / r.width - 0.5) * 8).toFixed(2)}deg)`;
    });
  }, { passive: true });
  document.addEventListener('pointerleave', () => { if (card) card.style.transform = ''; card = null; });

  document.addEventListener('click', (e) => {
    const b = e.target.closest('.btn');
    if (!b || media.reducedMotion.matches) return;
    const r = b.getBoundingClientRect(), s = document.createElement('span'), z = Math.max(r.width, 60);
    s.className = 'rp';
    s.style.cssText = `width:${z}px;height:${z}px;left:${e.clientX - r.left - z / 2}px;top:${e.clientY - r.top - z / 2}px`;
    b.append(s);
    s.addEventListener('animationend', () => s.remove(), { once: true });
  });
}
