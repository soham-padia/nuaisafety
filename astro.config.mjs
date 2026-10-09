// @ts-check
import { defineConfig } from 'astro/config';

// Directory output (/about/index.html) so extensionless URLs resolve on GitHub Pages
// without relying on its .html fallback. `site` drives canonical + Open Graph URLs.
/* Set PREVIEW_BASE to build a throwaway copy onto a GitHub project page, which
   is served from a subpath rather than a domain root. Unset, nothing changes. */
const preview = process.env.PREVIEW_BASE;

export default defineConfig({
  site: preview ? 'https://soham-padia.github.io' : 'https://nuaisafety.com',
  base: preview || undefined,
  trailingSlash: 'never',
  // About became Resources. Keep old links and shares working.
  redirects: {
    '/about': '/resources',
  },
});
