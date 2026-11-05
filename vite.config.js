import { defineConfig } from 'vite';

// Relative base so the build works from any folder or sub-path (artifact host, CDN, /sagar-air/ …)
export default defineConfig({
  base: './',
  build: {
    target: 'es2020',
    cssCodeSplit: false,
    assetsInlineLimit: 0,
    modulePreload: { polyfill: false },
    reportCompressedSize: true,
  },
});
