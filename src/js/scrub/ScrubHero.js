import { $, $$, clamp, lerp, easeOutCubic, mixHex, setStyle, media, lowDataMode, esc } from '../core/dom.js';
import { FrameStore } from './FrameStore.js';
import frameBg from '../../data/frame-bg.json';

/**
 * Scroll-scrubbed product video.
 *
 * Performance rules this module follows:
 *  - one requestAnimationFrame loop, running only while the hero is on screen
 *    (IntersectionObserver) or still easing to its target;
 *  - per frame: one layout read (getBoundingClientRect) first, then writes only;
 *  - DOM writes only when a value actually changes (setStyle / cached state);
 *  - canvas sized on resize only (ResizeObserver), opaque 2D context;
 *  - images decoded off-thread by FrameStore, never on the draw path.
 */

const SETS = {
  desktop: { dir: 'frames/desktop', count: 167, w: 1280, h: 720 },
  mobile: { dir: 'frames/mobile', count: 84, w: 800, h: 450 },
};
const PAGE_BG = '#eef6fc';
const pad = (n) => String(n).padStart(3, '0');

// Timeline (fractions of the pinned scroll distance)
const T = { expand: 0.3, play: 0.86, labels: 0.88, labelStep: 0.008 };

export class ScrubHero {
  constructor(root, hotspots, base = '') {
    this.el = {
      root,
      pin: $('.pin', root),
      stage: $('#stage', root),
      tilt: $('#tilt', root),
      canvas: $('#cv', root),
      hs: $('#hs', root),
      copy: $('#copy', root),
      hint: $('#hint', root),
      bar: $('#barf', root),
      steps: $$('#hud .st', root),
      legend: $('#legend', root),
      loader: $('#ld', root),
    };
    this.ctx = this.el.canvas.getContext('2d', { alpha: false, desynchronized: true }) || this.el.canvas.getContext('2d');
    this.hotspots = hotspots;
    this.state = { target: 0, cur: 0, dir: 1, drawKey: '', step: -1, spotsOn: -1, visible: false, running: false };
    this.size = { W: 0, H: 0, IR: { x: 0, y: 0, w: 1, h: 1 }, stacked: false };

    // pick the frame set once: big screens with a good connection get the full-rate set
    const bigScreen = innerWidth * Math.min(devicePixelRatio || 1, 2) >= 1400 && !media.phone.matches;
    this.setName = bigScreen && !lowDataMode() ? 'desktop' : 'mobile';
    this.set = SETS[this.setName];
    this.bg = frameBg[this.setName];

    this.store = new FrameStore({
      count: this.set.count,
      url: (i) => `${base}${this.set.dir}/${pad(i)}.webp`,
      maxDecoded: this.setName === 'desktop' ? 28 : 20, // ≈100 MB desktop, ≈30 MB phone of decoded pixels
      onDecoded: () => this.requestRender(),
      onProgress: (n, t) => {
        this.el.loader.textContent = `Loading ${Math.round((n / t) * 100)}%`;
        if (n >= t) this.el.loader.style.opacity = '0';
      },
    });

    this.buildHotspots();
    this.bind();
  }

  buildHotspots() {
    this.el.hs.innerHTML = this.hotspots
      .map((s, i) => `<div class="spot ${s[4]}"><div class="ln"></div><button class="dot" aria-label="${esc(s[0])}">${i + 1}</button><div class="tg"><b>${esc(s[0])}</b><small>${esc(s[1])}</small></div></div>`)
      .join('');
    this.el.legend.innerHTML = this.hotspots.map((s, i) => `<span><i>${i + 1}</i>${esc(s[0])}</span>`).join('');
    this.spots = $$('.spot', this.el.hs);
  }

  bind() {
    this.loop = this.loop.bind(this);
    // visibility gate: the loop sleeps while the hero is off screen
    this.io = new IntersectionObserver(([e]) => {
      this.state.visible = e.isIntersecting;
      if (e.isIntersecting) this.requestRender();
    }, { rootMargin: '200px 0px' });
    this.io.observe(this.el.root);

    this.ro = new ResizeObserver(() => { this.measure(); this.requestRender(true); });
    this.ro.observe(this.el.pin);

    // scroll can come from window or from any container the host page uses
    const wake = () => { this.lastWake = performance.now(); this.requestRender(); };
    document.addEventListener('scroll', wake, { passive: true, capture: true });
    addEventListener('wheel', wake, { passive: true });
    addEventListener('touchmove', wake, { passive: true });
    document.addEventListener('visibilitychange', wake);

    // pointer tilt (desktop, fine pointer, motion allowed) — rAF-throttled
    let tx = 0, ty = 0, queued = false;
    this.el.pin.addEventListener('pointermove', (e) => {
      if (!media.finePointer.matches || media.reducedMotion.matches || this.size.stacked) return;
      const r = this.el.pin.getBoundingClientRect();
      tx = (e.clientX - r.left) / r.width - 0.5;
      ty = (e.clientY - r.top) / r.height - 0.5;
      if (queued) return;
      queued = true;
      requestAnimationFrame(() => {
        queued = false;
        this.el.tilt.style.transform = `perspective(1400px) rotateY(${(tx * 4).toFixed(2)}deg) rotateX(${(-ty * 3).toFixed(2)}deg) scale(1.02)`;
      });
    });
    this.el.pin.addEventListener('pointerleave', () => (this.el.tilt.style.transform = ''));
  }

  /** Start downloading frames. The first and last frames are requested first. */
  start() {
    this.store.load();
    this.measure();
    this.requestRender(true);
  }

  measure() {
    const r = this.el.pin.getBoundingClientRect();
    const W = r.width, H = r.height;
    if (!W || !H) return;
    const stacked = media.stacked.matches;
    const { w: iw, h: ih } = this.set;
    // fit: cover on wide screens but never crop more than ~11% (keeps the inlet/outlet in view)
    const cover = Math.max(W / iw, H / ih), contain = Math.min(W / iw, H / ih);
    const s = stacked ? contain : Math.min(cover, contain * 1.12);
    const IR = { w: iw * s, h: ih * s };
    IR.x = (W - IR.w) / 2;
    IR.y = (H - IR.h) / 2;

    // Backing-store resolution: never sharper than the source frames (extra pixels add
    // no detail but cost fill-rate and upload time). The browser upscales on the GPU.
    const dpr = clamp(Math.min(devicePixelRatio || 1, iw / IR.w), 0.6, 2);
    const c = this.el.canvas;
    c.width = Math.round(W * dpr);
    c.height = Math.round(H * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.ctx.imageSmoothingQuality = 'high';
    Object.assign(this.size, { W, H, IR, stacked });

    this.spots.forEach((el, i) => {
      el.style.left = `${(IR.x + this.hotspots[i][2] * IR.w).toFixed(1)}px`;
      el.style.top = `${(IR.y + this.hotspots[i][3] * IR.h).toFixed(1)}px`;
    });
    this.state.drawKey = '';
  }

  /** Progress through the pinned section, 0..1 (one layout read). */
  progress() {
    const r = this.el.root.getBoundingClientRect();
    const span = r.height - this.size.H;
    return span > 0 ? clamp(-r.top / span) : 0;
  }

  requestRender(snap = false) {
    if (snap) this.snap = true;
    this.lastWake = performance.now();
    if (this.state.running) return;
    this.state.running = true;
    requestAnimationFrame(this.loop);
  }

  loop() {
    const s = this.state;
    if (!this.el.root.offsetParent) { s.running = false; return; } // view hidden
    const target = this.progress(); // READ
    if (target !== s.target) s.dir = target > s.target ? 1 : -1;
    s.target = target;
    s.cur = this.snap ? target : s.cur + (target - s.cur) * 0.14;
    this.snap = false;
    if (Math.abs(target - s.cur) < 0.0004) s.cur = target;
    this.render(s.cur); // WRITES
    // keep looping while easing, and briefly after the last scroll input; then sleep (no idle CPU/battery use)
    const recent = performance.now() - (this.lastWake || 0) < 400;
    if (s.cur !== target || (recent && s.visible && document.visibilityState === 'visible')) requestAnimationFrame(this.loop);
    else s.running = false;
  }

  render(p) {
    const { W, H, stacked } = this.size;
    const { el } = this;
    const ex = easeOutCubic(clamp(p / T.expand));

    // card → full screen
    const s0 = stacked ? 1 : 0.5;
    const sc = lerp(s0, 1, ex);
    const cx0 = stacked ? W / 2 : W * 0.72, cy0 = stacked ? H * 0.74 : H * 0.52;
    const tx = lerp(cx0 - W / 2, 0, ex), ty = lerp(cy0 - H / 2, 0, ex);
    setStyle(el.stage, 'transform', `translate3d(${tx.toFixed(1)}px,${ty.toFixed(1)}px,0) scale(${sc.toFixed(4)})`);
    setStyle(el.stage, 'borderRadius', stacked ? '0px' : `${(lerp(28, 0, ex) / sc).toFixed(1)}px`);

    // headline fades out first
    const k = clamp(p / 0.11);
    setStyle(el.copy, 'opacity', (1 - k).toFixed(3));
    setStyle(el.copy, 'transform', `${stacked ? '' : 'translateY(-50%) '}translateY(${(-60 * k).toFixed(1)}px)`);
    setStyle(el.copy, 'pointerEvents', k > 0.5 ? 'none' : '');
    setStyle(el.copy, 'visibility', k >= 1 ? 'hidden' : '');
    setStyle(el.hint, 'opacity', (1 - clamp(p / 0.06)).toFixed(3));

    // video frame
    const fi = Math.round(clamp(p / T.play) * (this.set.count - 1));
    this.draw(fi, ex);

    // progress UI — only touched when it changes
    setStyle(el.bar, 'transform', `scaleX(${p.toFixed(3)})`);
    const step = p < T.expand ? 0 : p < T.play ? 1 : 2;
    if (step !== this.state.step) {
      this.state.step = step;
      el.steps.forEach((e, i) => e.classList.toggle('on', i === step));
    }
    const on = p < T.labels ? 0 : Math.min(this.spots.length, 1 + Math.floor((p - T.labels) / T.labelStep));
    if (on !== this.state.spotsOn) {
      this.state.spotsOn = on;
      this.spots.forEach((e, i) => e.classList.toggle('on', i < on));
    }
    setStyle(el.legend, 'opacity', clamp((p - T.labels) / 0.04).toFixed(3));
    document.body.classList.toggle('pinned', p > 0.005 && p < 0.995);
  }

  draw(fi, ex) {
    const [i, img] = this.store.get(fi, this.state.dir);
    if (!img) return;
    const { W, H, IR, stacked } = this.size;
    const key = stacked && ex < 1 ? `${i}|${ex.toFixed(3)}` : `${i}`;
    if (key === this.state.drawKey) return;
    this.state.drawKey = key;
    const ctx = this.ctx, bg = this.bg[i] || '#0b1f45';

    // opaque context: on stacked layouts the backdrop fades from page colour to frame colour
    ctx.fillStyle = stacked ? mixHex(PAGE_BG, bg, ex) : bg;
    ctx.fillRect(0, 0, W, H);
    if (stacked && ex < 1) {
      const r = 18 * (1 - ex);
      ctx.save();
      ctx.beginPath();
      ctx.roundRect ? ctx.roundRect(IR.x, IR.y, IR.w, IR.h, r) : ctx.rect(IR.x, IR.y, IR.w, IR.h);
      ctx.clip();
      ctx.drawImage(img, IR.x, IR.y, IR.w, IR.h);
      ctx.restore();
    } else {
      ctx.drawImage(img, IR.x, IR.y, IR.w, IR.h);
    }
    if (!stacked) setStyle(this.el.stage, 'background', bg);
  }

  /** Called when the home view is shown again. */
  resume() { this.measure(); this.requestRender(true); }
}
