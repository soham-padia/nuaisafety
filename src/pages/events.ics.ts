import type { APIRoute } from 'astro';
import { items, ics, pageUrl } from '../lib/events';

/* Every event in one feed, at /events.ics. Subscribe once and each new event
   appears in your calendar after the next rebuild, with no further clicks. */
export const GET: APIRoute = ({ site }) =>
  new Response(ics(items, (e) => pageUrl(e, site!), { alarm: false, feed: true }), {
    headers: { 'Content-Type': 'text/calendar; charset=utf-8' },
  });
