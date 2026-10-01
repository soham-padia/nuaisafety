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

/**
 * LUMA_CALENDAR_ID - the Luma calendar shown in the Events section on the home page.
 *   It starts with "cal-". Find it in Luma under the calendar's Settings → Embed.
 *   Set it to null to hide the Events section entirely.
 *   TEMPORARY: this is South Park Commons' calendar, a stand-in until ours exists.
 */
export const LUMA_CALENDAR_ID: string | null = 'cal-Ve0M7LoDOpdnF3z';

/** The calendar's public Luma page, where the "Subscribe on Luma" button goes. */
export const LUMA_CALENDAR_URL = 'https://luma.com/southparkcommons-events';

export const EMAIL = 'nuaisafety@gmail.com';

export const SITE = {
  name: 'NU AI Safety',
  tagline: 'AI Safety at Northeastern',
  description:
    'A student-led AI safety and interpretability group at Northeastern University. ' +
    'Weekly reading group, guest talks, and support for members’ own research. ' +
    'Open to every discipline, no prerequisites.',
};

/** Where a signup CTA should point right now. */
export const signupHref = SIGNUP_URL ?? '/join';
export const execHref = EXEC_URL ?? '/join';

export const NAV = [
  { href: '/join', label: 'Join' },
  { href: '/team', label: 'Team' },
  { href: '/resources', label: 'Resources' },
];
