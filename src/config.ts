/**
 * Site-wide constants. Everything a non-developer might need to change lives here.
 *
 * SIGNUP_URL: the Google Form that collects mailing-list signups.
 *   Until it is set, every "Join the mailing list" CTA routes to /join, and /join
 *   falls back to emailing the group address. Nothing ships broken either way.
 *   To switch it on: paste the form's share link below. That is the only edit needed.
 */
export const SIGNUP_URL: string | null = 'https://forms.gle/dVHJ8bix2VHz8PUk9';

/**
 * EXEC_URL - the form for executive core applications.
 *   Same pattern as SIGNUP_URL: while it is null, the CTA falls back to email,
 *   so the button is never broken. Paste the form link to switch it on.
 */
export const EXEC_URL: string | null = 'https://forms.gle/sPaXtz6pq6hDyQBq8';

export const EMAIL = 'nuaisafety@gmail.com';

export const SITE = {
  name: 'NU AI Safety',
  tagline: 'AI safety and interpretability at Northeastern.',
  /**
   * "Khoury" appears here deliberately. Khoury's student club brand guidelines
   * require the name in the site's title or description, and this is the
   * description half of that. One constant feeds the meta description, the
   * Open Graph card and the Discord preview, so it only has to be said once.
   */
  description:
    'A student-led AI safety and interpretability club at Khoury College, ' +
    'Northeastern University. Technical and policy fellowships, guest talks, and ' +
    'support for members’ own research. Open to every discipline, no prerequisites.',
};

/** Where a signup CTA should point right now. */
export const signupHref = SIGNUP_URL ?? '/join';
export const execHref = EXEC_URL ?? '/join';

/**
 * Social. Add Instagram here once the account exists; the footer renders only
 * what is present, so an empty entry never leaves a dead link.
 */
export const SOCIAL = [
  { href: 'https://www.linkedin.com/company/nu-ai-safety/', label: 'LinkedIn' },
];

export const NAV = [
  { href: '/about', label: 'About' },
  { href: '/join', label: 'Join' },
  { href: '/team', label: 'Team' },
  { href: '/contact', label: 'Contact' },
];

/* -------------------------------------------------------------------------
   The exec board, rendered by /team.

   Everyone carries the same title. The group has deliberately not
   differentiated roles, so nobody is a president, chair or lead. Do not add a
   per-person role field. See FACTS.md, "Safe to state".

   Only `name` is required. Every other field renders only when it is filled
   in, so the page never shows an empty label or a half-finished card.

   photo  A file you drop into `public/team/`, written as `/team/name.jpg`.
          Square, around 960x960, compressed. That is the whole job: no layout
          change, no code change, no image import. Without one the tile falls
          back to an initials plate, which reserves exactly the same space, so
          adding a photo shifts nothing on the page.
   level  'Undergraduate', 'Master’s' or 'PhD'.
   ------------------------------------------------------------------------- */

export type Person = {
  name: string;
  photo?: string;
  program?: string;
  level?: string;
  bio?: string;
  email?: string;
  linkedin?: string;
};

/** The one title, used for every person on the board. */
export const BOARD_TITLE = 'Exec Board Member';

/** Intrinsic size of a headshot file, used for the img width/height so the
    tile reserves its space before the image loads and CLS stays at zero. */
export const PHOTO_PX = 960;

export const TEAM: Person[] = [
  { name: 'Elaine Ly' },
  { name: 'Soham Padia' },
  { name: 'Rohan Kathuria' },
  { name: 'Julia Rowniewski' },
  { name: 'Eric Shi' },
];
