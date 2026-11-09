// import { clamp, lerp, media } from '../core/dom.js';

// /**
//  * Hero interaction: airflow streams that bend around the cursor, plus a 3D tilt
//  * and moving light on the product image.
//  *
//  * Cost control:
//  *  - one canvas, one requestAnimationFrame loop, only while the hero is on screen
//  *    and the tab is visible (IntersectionObserver + visibilitychange);
//  *  - streams are plain stroked paths (no shadows/filters), gradients cached per resize;
//  *  - fewer streams/particles and a lower pixel ratio on small screens;
//  *  - CSS variables for the tilt are written only when they change;
//  *  - reduced-motion: one static frame, no tilt.
//  */
// export class AirflowHero {
//   constructor(hero) {
//     this.hero = hero;
//     this.canvas = hero.querySelector('#h2air');
//     this.img = hero.querySelector('#h2img');
//     this.ctx = this.canvas.getContext('2d');
//     this.t = 0;
//     this.last = 0;
//     this.visible = false;
//     this.running = false;
//     // pointer in hero coordinates; `inf` eases in/out as the cursor enters/leaves
//     this.p = { x: 0, y: 0, tx: 0, ty: 0, inf: 0, tinf: 0, nx: 0, ny: 0, tnx: 0, tny: 0 };
//     this.css = {};
//     this.loop = this.loop.bind(this);
//   }

//   start() {
//     this.resize();
//     new ResizeObserver(() => { this.resize(); if (!this.running) this.frame(this.last); }).observe(this.hero);
//     new IntersectionObserver(([e]) => { this.visible = e.isIntersecting; this.wake(); }, { rootMargin: '100px' }).observe(this.hero);
//     document.addEventListener('visibilitychange', () => this.wake());

//     const move = (x, y) => {
//       const r = this.hero.getBoundingClientRect();
//       this.p.tx = x - r.left; this.p.ty = y - r.top;
//       this.p.tnx = clamp((x - r.left) / r.width * 2 - 1, -1, 1);
//       this.p.tny = clamp((y - r.top) / r.height * 2 - 1, -1, 1);
//       this.p.tinf = 1;
//       this.wake();
//     };
//     this.hero.addEventListener('pointermove', (e) => move(e.clientX, e.clientY), { passive: true });
//     this.hero.addEventListener('pointerdown', (e) => move(e.clientX, e.clientY), { passive: true });
//     this.hero.addEventListener('pointerleave', () => { this.p.tinf = 0; this.p.tnx = 0; this.p.tny = 0; });
//     this.hero.addEventListener('touchend', () => { this.p.tinf = 0; this.p.tnx = 0; this.p.tny = 0; }, { passive: true });

//     requestAnimationFrame(() => this.canvas.classList.add('on'));
//     this.wake();
//   }

//   resize() {
//     const r = this.hero.getBoundingClientRect();
//     const small = r.width < 760;
//     this.W = r.width; this.H = r.height;
//     // streams fade out on the left (behind the headline), so the canvas starts at 24% of the width
//     this.ox = small ? 0 : Math.round(this.W * 0.24);
//     this.canvas.style.left = this.ox + 'px';
//     this.canvas.style.width = this.W - this.ox + 'px';
//     // soft airflow needs no retina sharpness: cap the pixel ratio (big saving in fill cost)
//     this.dpr = small ? Math.min(devicePixelRatio || 1, 1.25) : (this.W > 1100 ? 0.8 : 1);
//     this.canvas.width = Math.round((this.W - this.ox) * this.dpr);
//     this.canvas.height = Math.round(this.H * this.dpr);
//     this.ctx.setTransform(this.dpr, 0, 0, this.dpr, -this.ox * this.dpr, 0);
//     const ir = this.img.getBoundingClientRect();
//     this.imgBox = { x: ir.left - r.left, y: ir.top - r.top, w: ir.width, h: ir.height };
//     this.ctx.lineCap = 'round';
//     this.ctx.lineJoin = 'round';
//     this.build(small);
//   }

//   /** Streams sweep from lower-left to upper-right like the air leaving the units. */
//   build(small) {
//     const n = small ? 4 : 6, W = this.W, H = this.H;
//     let seed = 7;
//     const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
//     this.streams = Array.from({ length: n }, (_, i) => {
//       const k = i / (n - 1);
//       const s = {
//         base: lerp(0.62, 0.98, k) + (rnd() - 0.5) * 0.06, // y at the left edge (fraction of height)
//         rise: lerp(0.28, 0.5, rnd()),                     // how much it climbs to the right
//         amp: lerp(14, 40, rnd()), wave: lerp(0.8, 1.6, rnd()), speed: lerp(0.3, 0.6, rnd()),
//         phase: rnd() * Math.PI * 2, width: lerp(2.2, 4, rnd()), hue: lerp(200, 212, rnd()),
//         threads: small ? 3 : 4, gap: lerp(3, 5.5, rnd()),
//       };
//       // gradient fades the stream in from the left (behind the headline) and out at the right edge
//       const g = this.ctx.createLinearGradient(0, 0, W, 0);
//       g.addColorStop(0, `hsla(${s.hue},90%,62%,0)`);
//       g.addColorStop(0.28, `hsla(${s.hue},90%,62%,.10)`);
//       g.addColorStop(0.55, `hsla(${s.hue},92%,60%,.55)`);
//       g.addColorStop(0.85, `hsla(${s.hue},92%,64%,.45)`);
//       g.addColorStop(1, `hsla(${s.hue},92%,70%,0)`);
//       s.grad = g;
//       return s;
//     });
//     this.particles = Array.from({ length: small ? 28 : 70 }, () => ({
//       s: rnd(), u: rnd() * this.streams.length | 0, off: (rnd() - 0.5) * 16, v: lerp(0.05, 0.12, rnd()), r: lerp(0.8, 2.2, rnd()),
//     }));
//     this.steps = small ? 36 : 56;
//     this.radius = Math.max(120, Math.min(W, H) * 0.22);
//   }

//   /** y of stream s at x, including the cursor's push. */
//   y(s, x, t) {
//     const { W, H, p } = this;
//     const fx = x / W;
//     let y = H * (s.base - s.rise * fx) + Math.sin(fx * Math.PI * 2 * s.wave + s.phase + t * s.speed) * s.amp;
//     if (p.inf > 0.01) {
//       const dx = x - p.x, dy = y - p.y, R = this.radius;
//       const f = (R * R) / (dx * dx + dy * dy + R * R); // 1 at the cursor, falls off smoothly
//       y += (dy / (Math.abs(dy) + 40)) * f * f * 80 * p.inf; // air parts smoothly around the pointer
//     }
//     return y;
//   }

//   wake() {
//     if (this.running) return;
//     if (!this.visible || document.visibilityState !== 'visible') return;
//     if (media.reducedMotion.matches) { this.frame(0); return; }
//     this.running = true;
//     this.last = performance.now();
//     requestAnimationFrame(this.loop);
//   }

//   loop(now) {
//     if (!this.visible || document.visibilityState !== 'visible' || !this.hero.offsetParent) { this.running = false; return; }
//     const dt = Math.min(0.05, (now - this.last) / 1000);
//     this.last = now;
//     this.t += dt;
//     const p = this.p, e = 1 - Math.pow(0.0015, dt); // frame-rate independent easing
//     p.x = lerp(p.x || p.tx, p.tx, e); p.y = lerp(p.y || p.ty, p.ty, e);
//     p.inf = lerp(p.inf, p.tinf, e * 0.6);
//     p.nx = lerp(p.nx, p.tnx, e * 0.8); p.ny = lerp(p.ny, p.tny, e * 0.8);
//     this.frame(dt);
//     this.tilt();
//     requestAnimationFrame(this.loop);
//   }

//   frame(dt) {
//     const { ctx, W, H, t, streams, steps } = this;
//     ctx.clearRect(this.ox, 0, W - this.ox, H);
//     const dx = W / steps;
//     // each stream is a silk ribbon: a wide soft glow plus a few fine parallel threads
//     const ys = this.ys || (this.ys = new Float32Array(steps + 1));
//     for (const s of streams) {
//       for (let i = 0; i <= steps; i++) ys[i] = this.y(s, i * dx, t);
//       const path = (off) => {
//         ctx.beginPath();
//         for (let i = 0; i <= steps; i++) {
//           const x = i * dx, y = ys[i] + off * (1 + 0.35 * Math.sin(i * 0.18 + t * 0.6 + s.phase));
//           i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
//         }
//       };
//       ctx.strokeStyle = s.grad;
//       path(0);
//       ctx.globalAlpha = 0.22; ctx.lineWidth = s.width * 5; ctx.stroke(); // soft body
//       const mid = (s.threads - 1) / 2;
//       for (let k = 0; k < s.threads; k++) {
//         path((k - mid) * s.gap);
//         const c = 1 - Math.abs(k - mid) / (mid + 1);
//         ctx.globalAlpha = 0.25 + 0.45 * c; ctx.lineWidth = 0.6 + 0.9 * c; ctx.stroke();
//       }
//       path(0);
//       ctx.globalAlpha = 0.55; ctx.lineWidth = 0.9; ctx.strokeStyle = 'rgba(255,255,255,.85)'; ctx.stroke();
//     }
//     // particles riding the streams; faster and brighter near the cursor
//     ctx.globalAlpha = 1;
//     const p = this.p, R2 = this.radius * this.radius * 1.4;
//     for (const q of this.particles) {
//       const s = streams[q.u], x = q.s * W, y = this.y(s, x, t) + q.off;
//       const near = p.inf > 0.01 ? p.inf * Math.max(0, 1 - ((x - p.x) ** 2 + (y - p.y) ** 2) / R2) : 0;
//       q.s += q.v * dt * (1 + near * 2.2);
//       if (q.s > 1.02) { q.s = -0.02; q.off = (Math.random() - 0.5) * 16; }
//       const fade = Math.min(1, q.s / 0.3) * Math.min(1, (1.02 - q.s) / 0.15);
//       if (fade <= 0) continue;
//       ctx.fillStyle = `rgba(${near > 0.2 ? '255,255,255' : '214,236,255'},${(0.35 + near * 0.6) * fade})`;
//       ctx.beginPath(); ctx.arc(x, y, q.r * (1 + near * 0.8), 0, Math.PI * 2); ctx.fill();
//     }
//   }

//   tilt() {
//     if (!this.img || media.reducedMotion.matches) return;
//     const p = this.p, coarse = !media.finePointer.matches;
//     const amt = coarse ? 0.4 : 1;
//     this.setVar('--ry', `${(p.nx * 7 * amt).toFixed(2)}deg`);
//     this.setVar('--rx', `${(-p.ny * 4.5 * amt).toFixed(2)}deg`);
//     this.setVar('--px', `${(-p.nx * 14 * amt).toFixed(1)}px`);
//     this.setVar('--py', `${(-p.ny * 10 * amt).toFixed(1)}px`);
//     const b = this.imgBox;
//     if (b) {
//       this.setVar('--gx2', `${(p.x - b.x).toFixed(0)}px`);
//       this.setVar('--gy2', `${(p.y - b.y).toFixed(0)}px`);
//     }
//     this.setVar('--go', p.inf.toFixed(2));
//   }

//   setVar(k, v) {
//     if (this.css[k] === v) return;
//     this.css[k] = v;
//     this.img.style.setProperty(k, v);
//   }
// }


import { clamp, lerp, media } from '../core/dom.js';

/**
 * Hero interaction: airflow streams that bend around the cursor, plus a 3D tilt
 * and moving light on the product image.
 *
 * Cost control:
 *  - one canvas, one requestAnimationFrame loop, only while the hero is on screen
 *    and the tab is visible (IntersectionObserver + visibilitychange);
 *  - streams are plain stroked paths (no shadows/filters), gradients cached per resize;
 *  - fewer streams/particles and a lower pixel ratio on small screens;
 *  - CSS variables for the tilt are written only when they change;
 *  - responds to the cursor even with the OS "reduce motion" setting (the user drives it);
 *    with that setting the streams' own drift is slowed to 40%.
 */
export class AirflowHero {
  constructor(hero) {
    this.hero = hero;
    this.canvas = hero.querySelector('#h2air');
    this.img = hero.querySelector('#h2img');
    this.ctx = this.canvas.getContext('2d');
    this.t = 0;
    this.last = 0;
    this.visible = false;
    this.running = false;
    // pointer in hero coordinates; `inf` eases in/out as the cursor enters/leaves
    this.p = { x: 0, y: 0, tx: 0, ty: 0, inf: 0, tinf: 0, nx: 0, ny: 0, tnx: 0, tny: 0 };
    this.css = {};
    this.loop = this.loop.bind(this);
  }

  start() {
    this.resize();
    new ResizeObserver(() => { this.resize(); if (!this.running) this.frame(this.last); }).observe(this.hero);
    new IntersectionObserver(([e]) => { this.visible = e.isIntersecting; this.wake(); }, { rootMargin: '100px' }).observe(this.hero);
    document.addEventListener('visibilitychange', () => this.wake());

    const move = (x, y) => {
      const r = this.hero.getBoundingClientRect();
      this.p.tx = x - r.left; this.p.ty = y - r.top;
      this.p.tnx = clamp((x - r.left) / r.width * 2 - 1, -1, 1);
      this.p.tny = clamp((y - r.top) / r.height * 2 - 1, -1, 1);
      this.p.tinf = 1;
      this.wake();
    };
    this.hero.addEventListener('pointermove', (e) => move(e.clientX, e.clientY), { passive: true });
    this.hero.addEventListener('pointerdown', (e) => move(e.clientX, e.clientY), { passive: true });
    this.hero.addEventListener('pointerleave', () => { this.p.tinf = 0; this.p.tnx = 0; this.p.tny = 0; });
    this.hero.addEventListener('touchend', () => { this.p.tinf = 0; this.p.tnx = 0; this.p.tny = 0; }, { passive: true });

    requestAnimationFrame(() => this.canvas.classList.add('on'));
    this.wake();
  }

  resize() {
    const r = this.hero.getBoundingClientRect();
    const small = r.width < 760;
    this.W = r.width; this.H = r.height;
    // streams fade out on the left (behind the headline), so the canvas starts at 24% of the width
    this.ox = small ? 0 : Math.round(this.W * 0.24);
    this.canvas.style.left = this.ox + 'px';
    this.canvas.style.width = this.W - this.ox + 'px';
    // soft airflow needs no retina sharpness: cap the pixel ratio (big saving in fill cost)
    this.dpr = small ? Math.min(devicePixelRatio || 1, 1.25) : (this.W > 1100 ? 0.8 : 1);
    this.canvas.width = Math.round((this.W - this.ox) * this.dpr);
    this.canvas.height = Math.round(this.H * this.dpr);
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, -this.ox * this.dpr, 0);
    const ir = this.img.getBoundingClientRect();
    this.imgBox = { x: ir.left - r.left, y: ir.top - r.top, w: ir.width, h: ir.height };
    this.ctx.lineCap = 'round';
    this.ctx.lineJoin = 'round';
    this.build(small);
  }

  /** Streams sweep from lower-left to upper-right like the air leaving the units. */
  build(small) {
    const n = small ? 4 : 6, W = this.W, H = this.H;
    let seed = 7;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    this.streams = Array.from({ length: n }, (_, i) => {
      const k = i / (n - 1);
      const s = {
        base: lerp(0.62, 0.98, k) + (rnd() - 0.5) * 0.06, // y at the left edge (fraction of height)
        rise: lerp(0.28, 0.5, rnd()),                     // how much it climbs to the right
        amp: lerp(14, 40, rnd()), wave: lerp(0.8, 1.6, rnd()), speed: lerp(0.3, 0.6, rnd()),
        phase: rnd() * Math.PI * 2, width: lerp(2.2, 4, rnd()), hue: lerp(200, 212, rnd()),
        threads: small ? 3 : 4, gap: lerp(3, 5.5, rnd()),
      };
      // gradient fades the stream in from the left (behind the headline) and out at the right edge
      const g = this.ctx.createLinearGradient(0, 0, W, 0);
      g.addColorStop(0, `hsla(${s.hue},90%,62%,0)`);
      g.addColorStop(0.28, `hsla(${s.hue},90%,62%,.10)`);
      g.addColorStop(0.55, `hsla(${s.hue},92%,60%,.55)`);
      g.addColorStop(0.85, `hsla(${s.hue},92%,64%,.45)`);
      g.addColorStop(1, `hsla(${s.hue},92%,70%,0)`);
      s.grad = g;
      return s;
    });
    this.particles = Array.from({ length: small ? 28 : 70 }, () => ({
      s: rnd(), u: rnd() * this.streams.length | 0, off: (rnd() - 0.5) * 16, v: lerp(0.05, 0.12, rnd()), r: lerp(0.8, 2.2, rnd()),
    }));
    this.steps = small ? 36 : 56;
    this.radius = Math.max(120, Math.min(W, H) * 0.22);
  }

  /** y of stream s at x, including the cursor's push. */
  y(s, x, t) {
    const { W, H, p } = this;
    const fx = x / W;
    let y = H * (s.base - s.rise * fx) + Math.sin(fx * Math.PI * 2 * s.wave + s.phase + t * s.speed) * s.amp;
    if (p.inf > 0.01) {
      const dx = x - p.x, dy = y - p.y, R = this.radius;
      const f = (R * R) / (dx * dx + dy * dy + R * R); // 1 at the cursor, falls off smoothly
      y += (dy / (Math.abs(dy) + 40)) * f * f * 80 * p.inf; // air parts smoothly around the pointer
    }
    return y;
  }

  wake() {
    if (this.running) return;
    if (!this.visible || document.visibilityState !== 'visible') return;
    this.running = true;
    this.last = performance.now();
    requestAnimationFrame(this.loop);
  }

  loop(now) {
    if (!this.visible || document.visibilityState !== 'visible' || !this.hero.offsetParent) { this.running = false; return; }
    const dt = Math.min(0.05, (now - this.last) / 1000);
    this.last = now;
    this.t += dt * (media.reducedMotion.matches ? 0.4 : 1);
    const p = this.p, e = 1 - Math.pow(0.0015, dt); // frame-rate independent easing
    p.x = lerp(p.x || p.tx, p.tx, e); p.y = lerp(p.y || p.ty, p.ty, e);
    p.inf = lerp(p.inf, p.tinf, e * 0.6);
    p.nx = lerp(p.nx, p.tnx, e * 0.8); p.ny = lerp(p.ny, p.tny, e * 0.8);
    this.frame(dt);
    this.tilt();
    requestAnimationFrame(this.loop);
  }

  frame(dt) {
    const { ctx, W, H, t, streams, steps } = this;
    ctx.clearRect(this.ox, 0, W - this.ox, H);
    const dx = W / steps;
    // each stream is a silk ribbon: a wide soft glow plus a few fine parallel threads
    const ys = this.ys || (this.ys = new Float32Array(steps + 1));
    for (const s of streams) {
      for (let i = 0; i <= steps; i++) ys[i] = this.y(s, i * dx, t);
      const path = (off) => {
        ctx.beginPath();
        for (let i = 0; i <= steps; i++) {
          const x = i * dx, y = ys[i] + off * (1 + 0.35 * Math.sin(i * 0.18 + t * 0.6 + s.phase));
          i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
        }
      };
      ctx.strokeStyle = s.grad;
      path(0);
      ctx.globalAlpha = 0.22; ctx.lineWidth = s.width * 5; ctx.stroke(); // soft body
      const mid = (s.threads - 1) / 2;
      for (let k = 0; k < s.threads; k++) {
        path((k - mid) * s.gap);
        const c = 1 - Math.abs(k - mid) / (mid + 1);
        ctx.globalAlpha = 0.25 + 0.45 * c; ctx.lineWidth = 0.6 + 0.9 * c; ctx.stroke();
      }
      path(0);
      ctx.globalAlpha = 0.55; ctx.lineWidth = 0.9; ctx.strokeStyle = 'rgba(255,255,255,.85)'; ctx.stroke();
    }
    // particles riding the streams; faster and brighter near the cursor
    ctx.globalAlpha = 1;
    const p = this.p, R2 = this.radius * this.radius * 1.4;
    for (const q of this.particles) {
      const s = streams[q.u], x = q.s * W, y = this.y(s, x, t) + q.off;
      const near = p.inf > 0.01 ? p.inf * Math.max(0, 1 - ((x - p.x) ** 2 + (y - p.y) ** 2) / R2) : 0;
      q.s += q.v * dt * (1 + near * 2.2);
      if (q.s > 1.02) { q.s = -0.02; q.off = (Math.random() - 0.5) * 16; }
      const fade = Math.min(1, q.s / 0.3) * Math.min(1, (1.02 - q.s) / 0.15);
      if (fade <= 0) continue;
      ctx.fillStyle = `rgba(${near > 0.2 ? '255,255,255' : '214,236,255'},${(0.35 + near * 0.6) * fade})`;
      ctx.beginPath(); ctx.arc(x, y, q.r * (1 + near * 0.8), 0, Math.PI * 2); ctx.fill();
    }
  }

  tilt() {
    if (!this.img) return;
    const p = this.p, coarse = !media.finePointer.matches;
    const amt = coarse ? 0.4 : 1;
    this.setVar('--ry', `${(p.nx * 7 * amt).toFixed(2)}deg`);
    this.setVar('--rx', `${(-p.ny * 4.5 * amt).toFixed(2)}deg`);
    this.setVar('--px', `${(-p.nx * 14 * amt).toFixed(1)}px`);
    this.setVar('--py', `${(-p.ny * 10 * amt).toFixed(1)}px`);
    const b = this.imgBox;
    if (b) {
      this.setVar('--gx2', `${(p.x - b.x).toFixed(0)}px`);
      this.setVar('--gy2', `${(p.y - b.y).toFixed(0)}px`);
    }
    this.setVar('--go', p.inf.toFixed(2));
  }

  setVar(k, v) {
    if (this.css[k] === v) return;
    this.css[k] = v;
    this.img.style.setProperty(k, v);
  }
}