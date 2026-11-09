# Sagar Air – website (demo template by Manima)

Marketing site for Sagar Air Pvt Ltd: a static hero, then a scroll-scrubbed
product section where the SAMBZ multi box fan opens into an exploded view as the
visitor scrolls and closes again on scroll up, plus site-wide search over all
product data.

## Stack

| Concern | Choice                                              | Why                                                                                   |
| ------- | --------------------------------------------------- | ------------------------------------------------------------------------------------- |
| Build   | **Vite 6**                                    | Minified, hashed bundles; instant dev server; no runtime cost                         |
| UI      | **Vanilla ES modules**                        | No framework runtime to download or hydrate: ~14 KB JS gzipped total                  |
| Styles  | Plain CSS split by area, design tokens in `:root` | One 7 KB gzipped stylesheet                                                           |
| Hero    | `<canvas>` + image sequence                       | Frame-accurate scrubbing in every browser (video seeking is unreliable on iOS/Safari) |

## Folder structure

```
sagar-air-web/
├─ index.html                 page markup (static content, SEO-readable)
├─ vite.config.js             relative base → works from any host / sub-path
├─ public/
│  └─ frames/
│     ├─ desktop/000-166.webp 1280×720, every video frame (≈5.5 MB)
│     └─ mobile/000-083.webp  800×450, every 2nd frame   (≈1.4 MB)
└─ src/
   ├─ data/
   │  ├─ content.json         products, specs, downloads, air-distribution items, industries,
   │  │                       solutions, contact, links, stats, hotspots (single source of truth)
   │  └─ frame-bg.json        pre-computed backdrop colour per frame
   ├─ styles/                 base · header · hero · sections · views · footer · responsive
   └─ js/
      ├─ main.js              bootstraps everything
      ├─ core/dom.js          helpers, media queries, setStyle (write-if-changed)
      ├─ scrub/
      │  ├─ FrameStore.js     coarse-to-fine download, off-thread decode, LRU memory budget
      │  └─ ScrubHero.js      scroll → progress → card expand, frame draw, labels
      ├─ search/
      │  ├─ index.js          search index + ranking (prefix, typo tolerance, HVAC synonyms)
      │  └─ ui.js             search dialog: combobox/listbox, keyboard, deep links
      └─ features/
         ├─ render.js         menu, home grids, products & industry views
         ├─ router.js         hash views (#about, #products …) + wipe transition
         └─ effects.js        reveals, counters, marquee pausing, card tilt, ripples
```

## Search

Open it from the top-bar field, the header icon, `/` or `Ctrl/⌘ + K`.
It covers 134 entries built from `content.json`:

- **Product ranges and series**, including specs (e.g. `dewpac`, `saacu-s`, `10% rh`)
- **Air-distribution items** by code or name (`SA-LND`, `slot diffuser`)
- **Downloads**: 38 brochures, IOM manuals, spec sheets and data sheets
- **Industries, solutions, company pages, policies, clients and contact details**

Matching handles typos (`dewpak`), punctuation (`saacus`) and trade terms (`ahu`, `cleanroom`, `grill`, `iom`).
Results deep-link into the right view and highlight the item.
Downloads whose direct PDF link was not in the scraped data open the official Download Center; add the PDF URL in `content.json` → `downloads[].u` to link it directly.

## Performance design

- **Right-sized frames per device**: phones, small laptops and data-saver/slow connections get the 800 px half-rate set (1.4 MB); large screens get 1280 px full-rate.
- **Coarse-to-fine loading**: first and last frames first, then every 16th, 8th … 1st, so the whole scroll range works within the first second.
- **No main-thread decoding**: frames are decoded with `createImageBitmap` and kept in a small LRU window (20–28 bitmaps, ≈30–100 MB) around the playhead instead of all 167 (≈600 MB).
- **Canvas never sharper than the source**: the backing store is capped at the frame resolution; the GPU upscales.
- **Render loop sleeps**: it runs only while the hero is on screen and the visitor is scrolling (IntersectionObserver plus input events), with one layout read per frame and DOM writes only when values change.
- **Below-the-fold sections** use `content-visibility:auto`; marquees pause off screen; fonts load without blocking first paint.
- **Robust scrolling**: works whether the window, `body` or a host container scrolls; does not depend on the `prefers-reduced-motion` setting (the hero only moves when the user scrolls).

Measured on a CPU-only test machine (no GPU) with 0 long tasks during scrubbing: phones and tablets ran at 60 fps.

## Commands

```bash
npm install
npm run dev       # local dev server
npm run build     # production build → dist/
npm run preview   # serve dist/ locally
```

Deploy by uploading `dist/` to any static host (Netlify, Vercel, S3/CloudFront, cPanel).

## To do before go-live

- Connect the contact form (e.g. Formspree, a FastAPI endpoint or ERPNext Lead API).
- Replace stills with real factory, product and project photography.
- Add the high-resolution Sagar Air logo (SVG).
- Replace `public/img/hero-rooftop.webp` with the full-resolution hero image.
- Add the 20 missing direct PDF links (manuals/specs) to `content.json`.
