/**
 * Fetch team photos from LinkedIn into public/team/, once.
 *
 * LinkedIn blocks direct requests, and its own image links expire, so this
 * asks unavatar.io for each person's LinkedIn photo and saves it as a file
 * the site serves itself. Nothing on the live site depends on LinkedIn or
 * unavatar. Commit the files it writes.
 *
 *   npm run photos            people with a `linkedin` and no photo file yet
 *   npm run photos -- --all   everyone with a `linkedin`, replacing old files
 *
 * People with their own `photo:` in src/config.ts are left alone.
 */
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { TEAM, FELLOWS, photoSlug } from '../src/config.ts';

const all = process.argv.includes('--all');
const dir = join(process.cwd(), 'public', 'team');
mkdirSync(dir, { recursive: true });

const handle = (url: string) => url.match(/linkedin\.com\/in\/([^/?#]+)/i)?.[1];
const saved: string[] = [], skipped: string[] = [], noLinkedin: string[] = [], failed: string[] = [];

for (const person of [...TEAM, ...FELLOWS]) {
  if (person.photo) { skipped.push(`${person.name} (own photo)`); continue; }
  if (!person.linkedin) { noLinkedin.push(person.name); continue; }
  const file = join(dir, `${photoSlug(person.name)}.jpg`);
  if (existsSync(file) && !all) { skipped.push(`${person.name} (already saved)`); continue; }
  const id = handle(person.linkedin);
  if (!id) { failed.push(`${person.name}: not a linkedin.com/in/ link`); continue; }
  try {
    const res = await fetch(`https://unavatar.io/linkedin/${encodeURIComponent(id)}?fallback=false`);
    const type = res.headers.get('content-type') ?? '';
    // LinkedIn's grey silhouette comes back as an SVG: that means no public photo
    if (!res.ok || !/^image\/(jpeg|png|webp)/.test(type)) { failed.push(`${person.name}: no public LinkedIn photo`); continue; }
    writeFileSync(file, Buffer.from(await res.arrayBuffer()));
    saved.push(person.name);
  } catch (e) {
    failed.push(`${person.name}: ${(e as Error).message}`);
  }
}

const list = (label: string, xs: string[]) => xs.length && console.log(`${label}:\n  ${xs.join('\n  ')}`);
list('Saved', saved);
list('Skipped', skipped);
list('No LinkedIn yet', noLinkedin);
list('Failed', failed);
if (failed.length) process.exitCode = 1;
