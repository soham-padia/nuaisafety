// @ts-check
import { defineConfig } from 'astro/config';
import react from '@astrojs/react';

// Directory output (/about/index.html) so extensionless URLs resolve on GitHub Pages
// without relying on its .html fallback. `site` drives canonical + Open Graph URLs.
export default defineConfig({
  site: 'https://nuaisafety.com',
  trailingSlash: 'never',
  // React islands: the React Bits components and the Remotion player.
  integrations: [react()],
  // Join, Team and Resources are now sections of the home page, and About became
  // Resources before that. Keep old links and shares working.
  redirects: {
    '/join': '/#join',
    '/team': '/#team',
    '/resources': '/#resources',
    '/about': '/#resources',
  },
});
