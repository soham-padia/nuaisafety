/**
 * Site-wide constants. Everything a non-developer might need to change lives here.
 *
 * SIGNUP_URL: the Airtable form that collects mailing-list signups.
 *   Until it is set, every "Join the mailing list" CTA routes to /join, and /join
 *   falls back to emailing the group address. Nothing ships broken either way.
 *   To switch it on: paste the form's share link below. That is the only edit needed.
 */
export const SIGNUP_URL: string | null = 'https://airtable.com/appTpg6JO93Aqr1xs/pagh3n1xdPrxEB8nk/form';

/**
 * EXEC_URL - the form for executive core applications.
 *   Same pattern as SIGNUP_URL: while it is null, the CTA falls back to email,
 *   so the button is never broken. Paste the form link to switch it on.
 */
export const EXEC_URL: string | null =
  'https://airtable.com/appTpg6JO93Aqr1xs/pagJpuw954bZSuywr/form';

/**
 * LUMA_CALENDAR_ID - the Luma calendar shown in the Events section on the home page.
 *   It starts with "cal-". Find it in Luma under the calendar's Settings → Embed.
 *   Set it to null to hide the Events section entirely.
 *
 *   Null for now: events live on /events (see EVENTS below) and RSVPs go through
 *   a Google Form, so the Luma calendar is empty and the embed would show an empty
 *   list. Put the ID back ('cal-ttsDYte35jjI4Od') if events move to Luma.
 */
export const LUMA_CALENDAR_ID: string | null = null;

/** The calendar's public Luma page, where the "Subscribe on Luma" button goes. */
export const LUMA_CALENDAR_URL = 'https://luma.com/nuaisafety';

/**
 * SLACK_URL - the invite link for the group's Slack. Joining the Slack is how
 *   someone becomes a member. Same pattern as SIGNUP_URL: while it is null, the
 *   "Join our Slack" button falls back to emailing the group, so it is never
 *   broken. Paste the invite link to switch it on.
 */
export const SLACK_URL: string | null =
  'https://join.slack.com/t/nuaisafety/shared_invite/zt-4bwdf0z1w-DnPKeS6kprWA~7e1_BPCQw';

/**
 * EMAIL - the address published in the footer, or null while there is none to
 *   publish. The gmail address is retired pending a nuaisafety@northeastern.edu.
 *   While this is null the footer drops its Contact line and every email
 *   fallback routes elsewhere, so nothing renders a dead mailto. To switch it
 *   back on, put the address here. That is the only edit needed.
 */
export const EMAIL: string | null = null;

/** A mailto for the group, or null when there is no address to publish. */
export const mailtoHref = (subject?: string): string | null =>
  EMAIL === null
    ? null
    : `mailto:${EMAIL}${subject ? `?subject=${encodeURIComponent(subject)}` : ''}`;

export const SITE = {
  name: 'NU AI Safety',
  tagline: 'AI Safety at Northeastern',
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
  { href: '/join', label: 'Join' },
  { href: '/events', label: 'Events' },
  { href: '/team', label: 'Team' },
  { href: '/resources', label: 'Resources' },
];

/* -------------------------------------------------------------------------
   Events, rendered by /events.

   Add one entry per event. That is the whole job: the page, the RSVP button,
   the "Add to calendar" file and the subscribable feed at /events.ics are all
   built from this list. Order does not matter; the page sorts by date.

   An event stays under "Upcoming" until it ends, then moves to "Past". The site
   rebuilds itself every morning, so that happens without anyone editing it.

   date    'YYYY-MM-DD'.
   start   24-hour Boston time, e.g. '18:00'. Daylight saving is handled for you.
   end     Same format.
   place   As people should read it, e.g. 'Shillman Hall, Room 135'.
   address What a maps app should search for. Defaults to the place plus
           "Northeastern University, Boston, MA", so only set it off campus.
   summary One or two sentences.
   agenda  Optional. Each item is { time: '18:00', item: 'Talk' }.
   rsvp    The RSVP form link. Without one the event shows no RSVP button.
   ------------------------------------------------------------------------- */

export type GroupEvent = {
  title: string;
  date: string;
  start: string;
  end: string;
  place: string;
  address?: string;
  summary: string;
  agenda?: { time: string; item: string }[];
  rsvp?: string;
};

export const EVENTS: GroupEvent[] = [
  {
    title: 'Kickoff',
    date: '2026-11-02',
    start: '18:00',
    end: '19:30',
    place: 'Shillman Hall, Room 135',
    summary:
      'Our first event. We will cover our mission, what we plan to offer this year, ' +
      'and how to get involved. Food and drink provided.',
    agenda: [
      { time: '18:00', item: 'Information session' },
      { time: '18:30', item: 'Questions' },
      { time: '18:40', item: 'Social hour: meet the team and other attendees' },
    ],
    rsvp: 'https://docs.google.com/forms/d/e/1FAIpQLSddxG4cr2x2kuFzTUJIJaQSYo-ys2eRqPRLrMAHatOWeNCTRQ/viewform',
  },
];

/* -------------------------------------------------------------------------
   The exec board, rendered by /team.

   People appear on /team in the order listed. Anyone without a `title` is
   shown as an Exec Board Member.

   Only `name` is required. Every other field renders only when it is filled
   in, so the page never shows an empty label or a half-finished card.

   photo  A file you drop into `public/team/`, written as `/team/name.jpg`.
          Square, around 960x960, compressed. That is the whole job: no layout
          change, no code change, no image import. Without one the tile falls
          back to an initials plate, which reserves exactly the same space, so
          adding a photo shifts nothing on the page.
   level  'Undergraduate', 'Master’s' or 'PhD'.
   title  Overrides the default title, e.g. 'President'.
   ------------------------------------------------------------------------- */

export type Person = {
  name: string;
  title?: string;
  photo?: string;
  program?: string;
  level?: string;
  bio?: string;
  email?: string;
  linkedin?: string;
};

/** The default title, for anyone on the board without their own `title`. */
export const BOARD_TITLE = 'Exec Board Member';

/** Intrinsic size of a headshot file, used for the img width/height so the
    tile reserves its space before the image loads and CLS stays at zero. */
export const PHOTO_PX = 960;

export const TEAM: Person[] = [
  { name: 'Elaine Ly', title: 'President' },
  { name: 'Soham Padia', title: 'President' },
  { name: 'Rohan Kathuria' },
  { name: 'Julia Rowniewski' },
  { name: 'Eric Shi' },
  { name: 'Ryan Baylon' },
  { name: 'Max Eng' },
];

/** Title shown under each fellow's name on /team. */
export const FELLOW_TITLE = 'Fellow';

/* Fellows shown on /team. The section is hidden while this is empty. Add one
   entry per fellow, e.g. { name: 'Jane Doe' }, once someone has completed a
   fellowship. */
export const FELLOWS: Person[] = [];
