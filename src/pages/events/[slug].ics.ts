import type { APIRoute, GetStaticPaths } from 'astro';
import { items, ics, pageUrl, type Item } from '../../lib/events';

/* One file per event, at /events/<slug>.ics. Served as text/calendar, which
   phones open straight into "Add to calendar" and desktops hand to the default
   calendar app. */
export const getStaticPaths = (() =>
  items.map((e) => ({ params: { slug: e.slug }, props: { e } }))) satisfies GetStaticPaths;

export const GET: APIRoute<{ e: Item }> = ({ props, site }) =>
  new Response(ics([props.e], (e) => pageUrl(e, site!), { alarm: true }), {
    headers: { 'Content-Type': 'text/calendar; charset=utf-8' },
  });
