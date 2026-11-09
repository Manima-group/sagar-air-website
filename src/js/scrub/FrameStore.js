/**
 * FrameStore — loads an image sequence and keeps a small window of frames decoded.
 *
 * Why: drawing an <img> whose pixels the browser has discarded forces a synchronous
 * decode on the main thread (visible jank while scrubbing), while keeping all 167
 * frames decoded would hold ~600 MB of pixels. So we:
 *   1. fetch compressed bytes coarse-to-fine (key frames first, gaps filled later),
 *   2. decode off the main thread with createImageBitmap,
 *   3. keep only an LRU window of decoded bitmaps around the playhead.
 */
export class FrameStore {
  /**
   * @param {object} o
   * @param {number} o.count            frames in the set
   * @param {(i:number)=>string} o.url  URL for frame i
   * @param {number} [o.maxDecoded]     decoded bitmaps kept in memory
   * @param {number} [o.concurrency]    parallel downloads
   * @param {(i:number)=>void} [o.onDecoded]
   * @param {(loaded:number,total:number)=>void} [o.onProgress]
   */
  constructor({ count, url, maxDecoded = 24, concurrency = 6, onDecoded, onProgress }) {
    this.count = count;
    this.url = url;
    this.maxDecoded = maxDecoded;
    this.concurrency = concurrency;
    this.onDecoded = onDecoded || (() => {});
    this.onProgress = onProgress || (() => {});
    this.blobs = new Array(count).fill(null);
    this.decoded = new Map(); // index -> ImageBitmap | HTMLImageElement (Map keeps LRU order)
    this.decoding = new Set();
    this.loaded = 0;
    this.head = 0;
    this.aborter = new AbortController();
    this.canBitmap = typeof createImageBitmap === 'function';
  }

  /** Key frames first so the whole range is scrubbable early, then fill the gaps. */
  order() {
    const n = this.count, seen = new Uint8Array(n), out = [];
    const push = (i) => { if (i >= 0 && i < n && !seen[i]) { seen[i] = 1; out.push(i); } };
    push(0); push(n - 1);
    for (let step = 16; step >= 1; step >>= 1) for (let i = 0; i < n; i += step) push(i);
    return out;
  }

  /** Fetch every frame. Resolves when all have been attempted. */
  async load(firstPriority = []) {
    // frame 0 is what the visitor sees first: fetch and decode it alone, with the connection to itself
    await this.fetchOne(0, 'high');
    await this.decode(0);
    const queue = [...new Set([...firstPriority, ...this.order()])].filter((i) => i !== 0);
    const worker = async () => {
      while (queue.length) {
        const i = queue.shift();
        await this.fetchOne(i, i === 0 || i === this.count - 1 ? 'high' : 'low');
      }
    };
    await Promise.all(Array.from({ length: this.concurrency }, worker));
  }

  async fetchOne(i, priority, attempt = 0) {
    if (this.blobs[i]) return;
    try {
      const res = await fetch(this.url(i), { signal: this.aborter.signal, priority });
      if (!res.ok) throw new Error(res.status);
      this.blobs[i] = await res.blob();
      this.loaded++;
      this.onProgress(this.loaded, this.count);
      // decode straight away if it lands near the playhead
      if (Math.abs(i - this.head) <= 4) this.decode(i);
    } catch (e) {
      if (e.name === 'AbortError') return;
      if (attempt < 2) return this.fetchOne(i, priority, attempt + 1);
      this.loaded++; // give up on this frame; neighbours will stand in
      this.onProgress(this.loaded, this.count);
    }
  }

  async decode(i) {
    if (this.decoded.has(i) || this.decoding.has(i) || !this.blobs[i]) return;
    this.decoding.add(i);
    try {
      let img;
      if (this.canBitmap) {
        img = await createImageBitmap(this.blobs[i]);
      } else {
        img = new Image();
        img.src = URL.createObjectURL(this.blobs[i]);
        await img.decode();
      }
      this.decoded.set(i, img);
      this.evict();
      this.onDecoded(i);
    } catch {
      /* corrupt frame: ignore, nearest neighbour is used */
    } finally {
      this.decoding.delete(i);
    }
  }

  /** Drop the decoded frames farthest from the playhead once over budget. */
  evict() {
    if (this.decoded.size <= this.maxDecoded) return;
    const far = [...this.decoded.keys()].sort((a, b) => Math.abs(b - this.head) - Math.abs(a - this.head));
    while (this.decoded.size > this.maxDecoded) {
      const k = far.shift();
      const img = this.decoded.get(k);
      if (img && img.close) img.close();
      else if (img && img.src) URL.revokeObjectURL(img.src);
      this.decoded.delete(k);
    }
  }

  /**
   * Ask for frame i. Schedules decoding of i and a look-ahead window in the
   * direction of travel, and returns the nearest frame that is drawable now.
   */
  get(i, dir = 1) {
    this.head = i;
    this.decode(i);
    const ahead = 6, behind = 2;
    for (let k = 1; k <= ahead; k++) this.decode(i + dir * k);
    for (let k = 1; k <= behind; k++) this.decode(i - dir * k);
    if (this.decoded.has(i)) return [i, this.decoded.get(i)];
    for (let d = 1; d < this.count; d++) {
      if (this.decoded.has(i - d)) return [i - d, this.decoded.get(i - d)];
      if (this.decoded.has(i + d)) return [i + d, this.decoded.get(i + d)];
    }
    return [-1, null];
  }

  destroy() {
    this.aborter.abort();
    for (const img of this.decoded.values()) img.close && img.close();
    this.decoded.clear();
  }
}
