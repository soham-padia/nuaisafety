/**
 * Everything /events needs from the EVENTS list in config.ts: Boston wall-clock
 * times turned into real instants, the display strings, the three "add to
 * calendar" routes, and the iCalendar text for the .ics files.
 *
 * All of it runs at build time. The page ships no script.
 */
import { EVENTS, SITE, type GroupEvent } from '../config';

const TZ = 'America/New_York';
const DEFAULT_ADDRESS = 'Northeastern University, Boston, MA';

/* Paths go through BASE_URL so the page also works on a preview deploy that
   lives under a subpath. On nuaisafety.com it is just '/'. */
const BASE = import.meta.env.BASE_URL.replace(/\/$/, '');
export const href = (path: string) => `${BASE}${path}`;

export type Item = GroupEvent & {
  slug: string;
  begins: Date;
  ends: Date;
};

/* --- time ------------------------------------------------------------------ */

/** How far Boston is ahead of UTC at a given instant, in ms (negative). */
function offset(at: number): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: TZ,
    hourCycle: 'h23',
    year: 'numeric', month: 'numeric', day: 'numeric',
    hour: 'numeric', minute: 'numeric', second: 'numeric',
  }).formatToParts(new Date(at));
  const n = (type: string) => Number(parts.find((p) => p.type === type)!.value);
  return Date.UTC(n('year'), n('month') - 1, n('day'), n('hour'), n('minute'), n('second')) - at;
}

/** '2026-11-02' + '18:00' in Boston, as an instant. The second pass settles
    times near a daylight saving change, where the first guess uses the wrong
    offset. */
function boston(date: string, time: string): Date {
  const [y, m, d] = date.split('-').map(Number);
  const [h, min] = time.split(':').map(Number);
  const wall = Date.UTC(y, m - 1, d, h, min);
  const first = wall - offset(wall);
  return new Date(wall - offset(first));
}

/** '18:00' as '6pm', '19:30' as '7:30pm'. */
function clock(time: string, withSuffix = true): string {
  const [h, m] = time.split(':').map(Number);
  const hour = h % 12 || 12;
  const mins = m ? `:${String(m).padStart(2, '0')}` : '';
  return `${hour}${mins}${withSuffix ? (h < 12 ? 'am' : 'pm') : ''}`;
}

/** '6 to 7:30pm', or '11am to 1pm' when the range crosses noon. */
export function timeRange(e: GroupEvent): string {
  const sameHalf = Number(e.start.slice(0, 2)) < 12 === Number(e.end.slice(0, 2)) < 12;
  return `${clock(e.start, !sameHalf)} to ${clock(e.end)}`;
}

export const agendaTime = (time: string) => clock(time);

/** 'Monday, November 2' */
export const longDate = (d: Date) =>
  d.toLocaleDateString('en-US', { timeZone: TZ, weekday: 'long', month: 'long', day: 'numeric' });

/** 'October 1, 2026', for the past list, where the year starts to matter. */
export const pastDate = (d: Date) =>
  d.toLocaleDateString('en-US', { timeZone: TZ, month: 'long', day: 'numeric', year: 'numeric' });

/** The pieces of the date column: 'Mon', '2', 'Nov'. */
export const dateParts = (d: Date) => ({
  weekday: d.toLocaleDateString('en-US', { timeZone: TZ, weekday: 'short' }),
  day: d.toLocaleDateString('en-US', { timeZone: TZ, day: 'numeric' }),
  month: d.toLocaleDateString('en-US', { timeZone: TZ, month: 'short' }),
});

/* --- the list -------------------------------------------------------------- */

const slugify = (s: string) =>
  s.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

export const items: Item[] = EVENTS.map((e) => {
  const begins = boston(e.date, e.start);
  let ends = boston(e.date, e.end);
  // An end time earlier than the start means it runs past midnight.
  if (ends <= begins) ends = new Date(ends.getTime() + 86_400_000);
  return { ...e, slug: `${e.date}-${slugify(e.title)}`, begins, ends };
}).sort((a, b) => a.begins.getTime() - b.begins.getTime());

/** Split at build time. The deploy workflow rebuilds daily, so an event moves
    to "Past" the morning after it ends. */
export function split(now = new Date()) {
  return {
    upcoming: items.filter((e) => e.ends > now),
    past: items.filter((e) => e.ends <= now).reverse(),
  };
}

/* --- calendar routes --------------------------------------------------------- */

export const icsPath = (e: Item) => href(`/events/${e.slug}.ics`);
export const feedPath = href('/events.ics');
export const pageUrl = (e: Item, site: URL) => new URL(href(`/events#${e.slug}`), site).href;

/* encodeURIComponent rather than URLSearchParams, which writes spaces as '+'
   and Outlook shows those literally. */
const query = (params: Record<string, string>) =>
  Object.entries(params).map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('&');

const summaryLine = (e: Item) => `${SITE.name}: ${e.title}`;
const address = (e: Item) => e.address ?? `${e.place}, ${DEFAULT_ADDRESS}`;

function details(e: Item, pageUrl: string): string {
  const lines = [e.summary];
  if (e.agenda?.length) {
    lines.push('', ...e.agenda.map((a) => `${clock(a.time)}  ${a.item}`));
  }
  if (e.rsvp) lines.push('', `RSVP: ${e.rsvp}`);
  lines.push('', pageUrl);
  return lines.join('\n');
}

/** 20261102T230000Z */
const utcStamp = (d: Date) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');

export function googleUrl(e: Item, pageUrl: string): string {
  const q = query({
    action: 'TEMPLATE',
    text: summaryLine(e),
    dates: `${utcStamp(e.begins)}/${utcStamp(e.ends)}`,
    details: details(e, pageUrl),
    location: address(e),
  });
  return `https://calendar.google.com/calendar/render?${q}`;
}

/** Outlook on the web for a work or school account, which is what a
    northeastern.edu address is. */
export function outlookUrl(e: Item, pageUrl: string): string {
  const q = query({
    path: '/calendar/action/compose',
    rru: 'addevent',
    subject: summaryLine(e),
    startdt: e.begins.toISOString().replace(/\.\d{3}/, ''),
    enddt: e.ends.toISOString().replace(/\.\d{3}/, ''),
    location: address(e),
    body: details(e, pageUrl),
  });
  return `https://outlook.office.com/calendar/0/action/compose?${q}`;
}

/* --- iCalendar (RFC 5545) ---------------------------------------------------- */

const escapeText = (s: string) =>
  s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');

/** Lines longer than 75 octets are folded: CRLF, then a single space. Counted
    in UTF-8 bytes and split only between characters, so an apostrophe or an
    accented name never gets cut in half. */
function fold(line: string): string {
  const enc = new TextEncoder();
  const out: string[] = [];
  let cur = '';
  let bytes = 0;
  for (const ch of line) {
    const size = enc.encode(ch).length;
    if (bytes + size > 75) {
      out.push(cur);
      cur = ' ';
      bytes = 1;
    }
    cur += ch;
    bytes += size;
  }
  out.push(cur);
  return out.join('\r\n');
}

function vevent(e: Item, pageUrl: string, stamp: string, alarm: boolean): string[] {
  const lines = [
    'BEGIN:VEVENT',
    `UID:${e.slug}@nuaisafety.com`,
    `DTSTAMP:${stamp}`,
    `DTSTART:${utcStamp(e.begins)}`,
    `DTEND:${utcStamp(e.ends)}`,
    `SUMMARY:${escapeText(summaryLine(e))}`,
    `LOCATION:${escapeText(address(e))}`,
    `DESCRIPTION:${escapeText(details(e, pageUrl))}`,
    `URL:${pageUrl}`,
  ];
  // A reminder an hour before, for the single-event download only. Subscribed
  // calendars get none, because a reminder in a feed is one the reader cannot
  // easily turn off.
  if (alarm) {
    lines.push(
      'BEGIN:VALARM',
      'ACTION:DISPLAY',
      `DESCRIPTION:${escapeText(`${summaryLine(e)}, ${e.place}`)}`,
      'TRIGGER:-PT1H',
      'END:VALARM',
    );
  }
  lines.push('END:VEVENT');
  return lines;
}

/** One event (alarm: true) or the whole feed (alarm: false). */
export function ics(list: Item[], pageUrl: (e: Item) => string, opts: { alarm: boolean; feed?: boolean }) {
  const stamp = utcStamp(new Date());
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//NU AI Safety//nuaisafety.com//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    ...(opts.feed
      ? [
          `X-WR-CALNAME:${SITE.name}`,
          `X-WR-CALDESC:Events from ${SITE.name}`,
          'REFRESH-INTERVAL;VALUE=DURATION:PT12H',
          'X-PUBLISHED-TTL:PT12H',
        ]
      : []),
    ...list.flatMap((e) => vevent(e, pageUrl(e), stamp, opts.alarm)),
    'END:VCALENDAR',
  ];
  return lines.map(fold).join('\r\n') + '\r\n';
}
