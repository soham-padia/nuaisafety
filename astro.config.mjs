// @ts-check
import { defineConfig } from 'astro/config';

// Directory output (/about/index.html) so extensionless URLs resolve on GitHub Pages
// without relying on its .html fallback. `site` drives canonical + Open Graph URLs.
export default defineConfig({
  site: 'https://nuaisafety.com',
  trailingSlash: 'never',
});
