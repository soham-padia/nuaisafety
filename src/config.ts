/**
 * Site-wide constants. Everything a non-developer might need to change lives here.
 *
 * SIGNUP_URL: the Google Form that collects mailing-list signups.
 *   Until it is set, every "Join the mailing list" CTA routes to /join, and /join
 *   falls back to emailing the group address. Nothing ships broken either way.
 *   To switch it on: paste the form's share link below. That is the only edit needed.
 */
export const SIGNUP_URL: string | null = 'https://forms.gle/dVHJ8bix2VHz8PUk9';

export const EMAIL = 'nuaisafety@gmail.com';

export const SITE = {
  name: 'NU AI Safety',
  tagline: 'AI safety and interpretability at Northeastern.',
  description:
    'A student-led AI safety and interpretability group at Northeastern University. ' +
    'Weekly reading group, guest talks, and support for members’ own research. ' +
    'Open to every discipline, no prerequisites.',
};

/** Where a signup CTA should point right now. */
export const signupHref = SIGNUP_URL ?? '/join';

export const NAV = [
  { href: '/about', label: 'About' },
  { href: '/join', label: 'Join' },
  { href: '/team', label: 'Team' },
  { href: '/contact', label: 'Contact' },
];
