# Build brief: nuaisafety.com

You are building the first website for a new student-led AI safety and interpretability
group at Northeastern University. Domain is already acquired: **nuaisafety.com**.

Read `FACTS.md` before writing any copy. It lists what is true, what is not yet true, and
what must not be claimed. Getting this wrong creates a real institutional problem, because the
group is not yet a recognized student organization.

Copy lives in `CONTENT.md`. Use it close to verbatim. Do not invent testimonials, event
history, member counts, or partnerships.

Stack decisions are in `BUILD.md`.

## Repository state

Astro site, built 7 September 2026. Five pages, Lighthouse 100 across accessibility,
performance, best practices and SEO on every page.

Ships one client script: Motion (`motion`, the vanilla build, not Framer Motion's React
package) at about 23 KB gzipped, for scroll reveals and spring easing. It measured at 0 ms
total blocking time, so it did not cost a point. Page transitions and hover states are still
pure CSS. See the comment block in `src/layouts/Base.astro` for the rules the reveal script
follows, the important one being that content the visitor can already see is never hidden.

Documents, and what each is authoritative for:

| File | Authority over |
|---|---|
| `FACTS.md` | Public subset: the copy rules, with no private evidence |
| `_local/FACTS.md` | The real record: sourcing, quotes, where each relationship stands. Gitignored. |
| `CONTENT.md` | Page copy, near-verbatim |
| `DESIGN.md` | Layout and visual register, with the peer-site research behind it |
| `BUILD.md` | Stack, palette, deploy, DNS, pre-launch checklist |
| `CLAUDE.md` | Scope, priorities |

When they conflict, `FACTS.md` wins. It is the only file with institutional consequences.

**This repository is public**, because GitHub Pages requires it. Never commit private
correspondence, anything quoting a person who has not agreed to be published, or an
assessment of where a relationship stands. That belongs in `_local/`, which is gitignored.

```bash
npm run dev        # local dev server
npm run build      # static output to dist/
npm run preview    # serve the built output
```

`src/config.ts` holds everything a non-developer would need to change: the signup URL, the group
email, the nav. Prefer editing it over editing components.

## Copy rules that cannot be got wrong

The full list is in `FACTS.md` and you should read it. These four are the ones that would cause
real institutional damage, so they are repeated here where they are always in context:

- **Never** "official", "Northeastern's", or any phrasing implying recognition. The group is not
  a recognized student organization and cannot be until CSI forms open at the end of fall term.
- **Never** "our faculty advisor" for David Bau. He *has agreed to advise the group and give
  guest talks*. The formal advisor request is pending. Use that wording.
- **Never** render Harvard AISST, MIT MAIA or BU AISA as a partner logo grid. They *offered
  help*; BU is a coordination conversation. Name them in a sentence or not at all.

Never invent: events, dates, member counts, testimonials, partnerships, or a bio for someone
whose bio you were not given. When a fact is missing, omit the element. Do not fill it with a
placeholder. Several pages are deliberately shorter than they could be for this reason.

## What this site has to do, in priority order

1. Convince a strong Northeastern student to give an email address. That is the only
   conversion that matters right now, because the group has zero members.
2. Make the group legible to a Khoury administrator, an external funder, and other AI safety
   groups, all of whom will look it up before replying.
3. Look like it was built by people who can build things.

## Scope

Five pages. Do not build more.

- `/` Home
- `/about`
- `/join`
- `/team`
- `/contact`

**No events page.** There are no events yet, and an empty or placeholder events page is worse
than no page. Add it when there is a first event with a date.

**No resources page in v1.** It is a nice-to-have and it competes with the signup CTA.

## Design direction

Look at MIT MAIA, Harvard AISST, Princeton PAIA and BU AISA for register. The pattern that
works: restrained, text-forward, one accent color, generous whitespace, no stock photography
of robots or glowing brains. Serious rather than slick.

Northeastern red is `#C8102E`. Use it as an accent only.

Mobile first. Most traffic will be a student on a phone who saw a flyer.

## Definition of done

- Builds clean, deploys, custom domain resolves
- Every page passes a read-through against `FACTS.md` with no overclaim
- Signup form actually delivers somewhere a human checks
- Lighthouse accessibility 95+
- No lorem ipsum, no TODO, no placeholder headshots that look like real people
