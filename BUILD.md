# Stack and deploy

## Decision

**Astro + GitHub Pages.** Not Next.js, not Notion. (Was Netlify; changed 7 September 2026;
see "What changed" below.)

- Astro ships static HTML with no client JS by default, so the site is fast and scores well on
  accessibility without effort. Content lives in `.astro` or `.md` files, so a non-developer on
  the team can edit copy via GitHub's web editor without touching a component.
- GitHub Pages is free, deploys on push via Actions, and supports a custom domain with automatic
  TLS. The repo is already where the team works.
- Next.js is overkill for five static pages and adds a build surface nobody on the team wants to
  maintain through a co-op semester.

### What changed, and the one real cost

Netlify was chosen originally for **Netlify Forms**, a backend-free signup form. GitHub Pages
serves static files only and has **no form handling of any kind**. There is no equivalent.

Since the signup form is priority #1 in `CLAUDE.md` and "signup form actually delivers somewhere
a human checks" is in the definition of done, this needs an explicit answer before `/join` ships.
See **Signup form** below. This is currently the only unresolved blocker in the stack.

## Coexisting with the existing user site

`soham-padia.github.io` is a **user site** and lives in its own repo. This project is a
**project site** in a separate repo and does not collide with it. A project site can carry its
own custom domain independently of the user site, so `nuaisafety.com` attaches here without
touching the existing page.

Because the custom domain is at the apex, `base` stays `/`, with no `/nuaisafety` path prefix.

## Build

```bash
npm create astro@latest -- --template minimal
npm install
npm run dev        # local dev server
npm run build      # static output to dist/
npm run preview    # serve the built output; check before pushing
```

Structure:

```
src/
  layouts/Base.astro      # header, footer, meta, one place for nav
  pages/
    index.astro
    about.astro
    join.astro
    team.astro
    contact.astro
  components/
    Hero.astro
    SignupForm.astro
    PersonCard.astro
  styles/global.css       # CSS custom properties, no framework needed
public/
  favicon.svg
  CNAME                   # single line: nuaisafety.com
.github/workflows/deploy.yml
```

Five pages does not need Tailwind. Plain CSS with custom properties for the palette is less to
maintain and there is nothing to upgrade later.

`astro.config.mjs` needs the canonical site URL so sitemaps and Open Graph tags resolve:

```js
export default defineConfig({ site: 'https://nuaisafety.com' });
```

## Deploy

GitHub Actions, using Astro's official action. Repo Settings → Pages → Source: **GitHub Actions**.

```yaml
# .github/workflows/deploy.yml
name: Deploy
on:
  push: { branches: [main] }
  workflow_dispatch:
permissions: { contents: read, pages: write, id-token: write }
concurrency: { group: pages, cancel-in-progress: true }
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: withastro/action@v3
  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment: { name: github-pages, url: '${{ steps.deployment.outputs.page_url }}' }
    steps:
      - id: deployment
        uses: actions/deploy-pages@v4
```

### The `CNAME` file does not set the custom domain here

With a **branch-based** Pages build, `public/CNAME` is authoritative and GitHub resets the custom
domain on every deploy without it. With an **Actions-based** deploy, which is what this repo uses,
that is not true. Verified on the first deploy: `dist/CNAME` was present and served at
`/CNAME` with the right contents, and the Pages API still reported `"cname": null`.

Set the domain on the repo instead, either in Settings, Pages, Custom domain, or:

```bash
gh api repos/soham-padia/nuaisafety/pages -X PUT -f cname=nuaisafety.com
```

Keep `public/CNAME` anyway. It costs nothing and it is what makes the repo portable if Pages is
ever switched back to a branch build.

Setting the domain flips `https_enforced` to false, because GitHub cannot issue a certificate
until DNS resolves. Once the A records are live and the certificate provisions, turn it back on:

```bash
gh api repos/soham-padia/nuaisafety/pages -X PUT -f https_enforced=true
```

## Signup form

**Decided: a Google Form, linked out rather than embedded.** GitHub Pages cannot receive a POST,
and an off-site form is what Cornell, Princeton and UChicago effectively do. Free, no submission
cap, responses land in a Sheet the whole team can see, nothing to maintain.

Until the form exists and its URL is set in `src/config.ts`, every signup CTA falls back to
`mailto:hello@nuaisafety.com`. The site is shippable either way.

### Form contents

**Title:** `NU AI Safety mailing list`

**Description:**

> A student-led AI safety and interpretability group at Northeastern. We will email you before
> the first reading group with a time, a place, and what to read. No application, no interview.
>
> We are new: four people and no events yet. Joining now means shaping what this becomes.

Note the description repeats the honesty from `/join` rather than hiding it. Someone who fills
this in should already know what they are joining.

**Questions.** Only the first two are required; every extra required field costs signups, and
priority #1 in `CLAUDE.md` is the email address.

| # | Question | Type | Required | Notes |
|---|---|---|---|---|
| 1 | Northeastern email | Short answer | Yes | Response validation → Regular expression → *Matches* → `.+@(.+\.)?northeastern\.edu` · error text: "Please use your Northeastern email." |
| 2 | Name | Short answer | Yes | |
| 3 | Programme and year | Short answer | No | e.g. "CS, 2nd year" or "MS AI, first semester" |
| 4 | What are you most interested in? | Paragraph | No | |
| 5 | Anything you would want to help run? | Checkboxes | No | Options: `Reading group` · `Guest talks` · `My own research project` · `Not sure yet, just want to come along` |

Question 5 maps directly to the `/join` line about people who already know the field wanting to
produce research rather than read it. It is the cheapest way to spot those people early.

The domain regex is a deliberate choice: it keeps the list to Northeastern, and anyone else
(another group's organiser, a prospective speaker) has `/contact` instead. Drop the validation if
that turns out to block people you want.

**Confirmation message** (Settings → Presentation → Confirmation message):

> You are on the list. We will email you before the first session.
>
> If you want to tell us anything before then, hello@nuaisafety.com.

### Settings that matter

- Settings → Responses → **Collect email addresses: off.** Question 1 already does it, and the
  Google-account address is often a personal Gmail rather than the Northeastern one.
- Settings → Responses → **Limit to 1 response: off.** It forces a Google sign-in.
- Responses tab → **Link to Sheets.** Create a new spreadsheet and share it with all four
  founders, so the list does not live in one person's account.
- Responses tab → ⋮ → **Get email notifications for new responses: on**, for at least two
  founders. `FACTS.md` flags "where the signup form delivers" as an open question, and a form
  nobody reads is worse than no form.
- Send → 🔗 → **Shorten URL**, then paste that link into `SIGNUP_URL` in `src/config.ts`.

Do not use Google's "embed" HTML. It is an iframe with its own client JS, it will not match the
site, and it costs accessibility and performance points the site currently has at 100.

## Group email

**The site publishes `nuaisafety@gmail.com`,** a free shared Gmail account owned by the group.
A free `hello@nuaisafety.com` Porkbun forward into that account also exists.

Publishing the Gmail rather than the domain address is a deliberate simplification, not an
oversight. It costs some credibility with the priority-2 audience, a Khoury administrator or a
funder, for whom `hello@nuaisafety.com` reads as an organisation and `nuaisafety@gmail.com` reads
as four students. Worth revisiting once the forward is confirmed delivering. `EMAIL` in
`src/config.ts` is the single source of truth, so it is a one-line change either way.
Total cost $0. Porkbun gives 20 forwards free on the domain; Option 2 on the Email page, not the
$3/month hosted inbox.

The shared Gmail matters more than the forward does. It owns the signup Google Form and its
responses Sheet, so the mailing list belongs to the group rather than to whichever founder
happened to create it. Anything the group will still need after this cohort graduates should be
created from this account, not from a personal one.

If a Form ever has to move accounts later, transfer ownership via Drive rather than recreating
it: the file ID survives, so the `forms.gle` link and `SIGNUP_URL` stay valid. Recreating is only
the cheaper option while the link is not yet public anywhere.

Credentials and 2FA belong in a password manager vault all four founders can open, with account
recovery pointed at a founder other than the one who created it. A shared account whose recovery
path is one person is not actually shared.

### Rejected, and why

- **Google Workspace.** Roughly $7 to $8 per user per month, so on the order of $85 to $100 a
  year even for a single seat. Two benefits are real: Google Groups as a proper mailing list with
  an archive, and a send limit around 2,000 recipients a day against free Gmail's ~500. Neither
  binds at four members. The timing argument is the stronger one: CSI recognition opens at the
  end of the fall term, and recognised student organisations often get university-provided
  infrastructure, so committing to an annual contract weeks beforehand is premature. Revisit in
  January once recognition is settled and the mailing list has actual scale.
- **Google for Nonprofits** (the free Workspace tier). Requires registered nonprofit status. The
  group is neither a registered nonprofit nor a recognised student organisation. Do not attempt
  to route around this; it is the same category of claim `FACTS.md` exists to prevent.
- **Porkbun hosted inbox, $3/month.** The only option that allows replying *as*
  `hello@nuaisafety.com`, since free forwarding is receive-only and Gmail's "Send mail as"
  needs SMTP credentials for the domain. Worth revisiting if replying from a Gmail address
  starts costing credibility with Khoury or a funder. It stacks with the shared Gmail rather
  than replacing it.

### Known limitation

Free forwarding is receive-only. Mail arrives at `hello@nuaisafety.com`, but replies go out from
the shared Gmail address. Acceptable because the shared account still reads as a group address
rather than a personal one, which was the actual requirement in `FACTS.md`.

## Domain

`nuaisafety.com` is owned, registered at Porkbun. `nuaisafety.org` is also owned and should
redirect to the `.com`, or stay parked; decide, do not leave it resolving to nothing.

In the repo: Settings → Pages → Custom domain → `nuaisafety.com`, then tick **Enforce HTTPS**
once the certificate provisions (can take up to an hour).

At Porkbun, keep their DNS and add records. Do **not** delegate nameservers:

```
A     @     185.199.108.153
A     @     185.199.109.153
A     @     185.199.110.153
A     @     185.199.111.153
CNAME www   soham-padia.github.io.
```

Apex to the four GitHub Pages A records, `www` as a CNAME to the user's Pages host. GitHub then
redirects `www` to apex automatically once the custom domain is set. TLS is issued by GitHub via
Let's Encrypt and renews on its own.

### Ordering: DNS first, then push

Set the Porkbun records **before** the first push, which is the reverse of the usual advice.
Two reasons:

1. `site` is the apex and no `base` is set, so built assets are root-absolute (`/_astro/...`).
   At the project URL `soham-padia.github.io/nuaisafety/` those resolve against the *user* site
   and 404, so that URL would render unstyled. There is no useful pre-domain preview to wait for.
2. `public/CNAME` sets the custom domain on the very first deploy, which makes GitHub redirect
   the project URL to `nuaisafety.com` anyway.

DNS propagation and GitHub's certificate issuance both take longer than the build, so starting
the records first means the two finish at roughly the same time. Verify locally with
`npm run preview` instead of on github.io.

## Palette

```css
:root {
  --ink:    #14161a;   /* body text */
  --muted:  #5b6169;   /* secondary text */
  --accent: #c8102e;   /* Northeastern red, accent only */
  --paper:  #ffffff;
  --wash:   #f6f7f8;   /* section bands */
  --rule:   #e3e6e9;   /* hairlines */
}
```

One accent colour, used for links, the primary button, and nothing else. No gradients.

Type: one serif for headings or one grotesque for everything. System stack is fine and loads
instantly. If you want a webfont, one weight pair only.

See `DESIGN.md` for the layout and register decisions these support.

## Accessibility, non-negotiable

- Real `<label>` elements on every input, not placeholder text as a label
- Visible focus rings, do not remove the outline
- Contrast 4.5:1 minimum for body text. Northeastern red on white passes for large text but
  check it for anything small
- One `<h1>` per page, headings in order
- Site should be fully usable with CSS disabled

## Before launch

- [ ] Read every page against `FACTS.md`
- [ ] Submit the form and confirm it reaches a human
- [ ] Open on a phone
- [ ] `npx lighthouse https://nuaisafety.com --view`, accessibility 95+
- [ ] Open graph title, description and image, since this link will get shared in Slack and Discord
- [ ] No Northeastern logo, seal, or wordmark anywhere
- [ ] Custom domain is set on the repo, not just in `public/CNAME`:
      `gh api repos/soham-padia/nuaisafety/pages --jq .cname` returns `nuaisafety.com`
- [ ] `https_enforced` is back to `true` once the certificate has provisioned
