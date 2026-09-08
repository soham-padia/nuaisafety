# Design reference

Field notes from four peer sites, listed in the order Soham ranked them. Gathered 7 September 2026.

The purpose of this file is to make design decisions arguable instead of arbitrary. When a
choice below conflicts with `FACTS.md`, `FACTS.md` wins.

---

## The four references

### 1. BAISH, Buenos Aires AI Safety Hub · `baish.com.ar/en` · closest to the target

The only one of the four that leads with the reader's trajectory rather than the world's peril.

- Hero: **"From Curious to Contributing"** over **"Supporting your path into AI safety research."**
  The headline is a promise about *you*, not a claim about *them*. No doom register anywhere
  above the fold.
- Two CTAs, deliberately different in kind: `View open courses →` (concrete, programmatic) and
  `Join the community` (social, low commitment). Not two buttons doing the same job.
- Programs as equal-weight cards carrying **metadata**: status badge (`Expression of interest
  open`), duration (`30 hours`, `5 weeks`). The metadata is what makes it feel real.
- Sans-serif throughout, neutral base, one accent held back to links and button states.
- Social proof via chat member counts (190+ Telegram, 140+ WhatsApp).

**Take:** the journey framing, the two-different-CTAs pattern, and program metadata.
**Cannot take:** member counts. We have zero members and `FACTS.md` forbids implying otherwise.

### 2. Cornell AIA · `cornell-aia.org`

- Hero is a thesis sentence: *"Managing risks from advanced AI is one of the most important
  challenges of our time."* Subhead grounds it in who they are: *"a community of student
  technical and policy researchers at Cornell."*
- **Mailing list appears three times**: hero CTA, mid-body inside a sentence (*"If you want to
  get involved, start by joining our mailing list"*), and footer.
- Abstract SVG only: orbital patterns, beam lines. No photography, no robots.
- Alternating banded section backgrounds to segment a long homepage.
- Partner organisation logo grid.

**Take:** mailing list three times, abstract SVG over photography, alternating bands.
**Cannot take:** the partner logo grid. Harvard AISST and MIT MAIA *offered help*; BU AISA is a
coordination conversation. Rendering their marks in a grid reads as institutional partnership
and is exactly the overclaim `FACTS.md` exists to prevent. Say it in a sentence instead.

### 3. Princeton PAIA · `princetonalignment.org`

- Hero: *"We're a group of Princeton students working to reduce catastrophic risk from advanced
  AI."* Plain, declarative, first person, and it says **students** in the first four words.
- Single column, generous whitespace, no cards on the homepage at all.
- Time-bound urgency in the secondary CTA: *"Applications open now until Sept. 11!"*

**Take:** the first-person student sentence. This is the cheapest solution to our hardest
constraint: being unmistakably student-run without ever writing the word "unofficial."

### 4. UChicago AI Safety · `uchicagoaisafety.com`

- Hero uses lowercase with *italic* emphasis rather than caps for stress: *"UChicago's
  student-led initiative to shape the future of AI safety."*
- Every CTA carries a trailing `→`. Consistent, cheap, and it makes text links read as actions.
- "Get Involved" offers three equal-weight doors: leadership application, mailing list, Slack.
- Maroon accent confined almost entirely to the logo.

**Take:** the `→` affordance on text CTAs; accent restricted to near-logo-only.
**Cannot take:** three equal-weight doors. We have one conversion that matters. Splitting
attention three ways is right for a group with programs to staff, wrong for a group at zero.

---

## What the four agree on

Worth noting because unanimity across four independent sites is a strong signal:

- Sans-serif, system-ish stack. Not one of the four uses a serif for body text.
- Neutral base (white / near-white / grey), exactly one accent, accent used sparingly.
- Abstract vector graphics or nothing. **Zero** of the four use stock photography.
- Generous vertical whitespace; conservative max content width.
- The mailing list is the primary CTA on every single one.
- Copy is first-person plural and says "students" early.

This is the register `CLAUDE.md` asks for, independently confirmed.

---

## Decisions for nuaisafety.com

| Decision | Choice | Source |
|---|---|---|
| Hero framing | Reader's path, not civilisational risk | BAISH |
| Hero sentence | First person, "student", declarative | Princeton |
| CTA count in hero | Two, different in kind | BAISH |
| CTA affordance | Trailing `→` on text links | UChicago |
| Mailing list placement | Three times: hero, mid-body, footer | Cornell |
| Imagery | Abstract SVG or nothing. No photography. | All four |
| Type | One sans, system stack, weight for hierarchy | All four |
| Accent `#c8102e` | Links, primary button, nothing else | UChicago, `BUILD.md` |
| Section rhythm | Alternating `--paper` / `--wash` bands | Cornell |
| Peer groups | Named in a sentence, never as a logo grid | `FACTS.md` |
| Social proof | None. We have none. Say we are new instead. | `FACTS.md` |

### The move none of the four make

All four are established enough to project confidence. We are four people with no events, and
`CONTENT.md` already has the right instinct:

> We are new. Four people, a faculty researcher who agreed to help, and no events yet. If you
> join now you are shaping what this is rather than attending something finished.

Treat that as the design's organising idea, not an apology buried at the bottom. Newness is the
offer: early members get influence. It is also the only honest position available, which makes
it both safe and distinctive. None of the four references can say it.

### Program metadata, adapted

BAISH's cards work because of concrete numbers. We have exactly one honest number, from
`CONTENT.md` `/join`: **around ninety minutes a week**. Use it on the reading group block.
Do not invent dates, session counts, or cohort sizes to fill out the pattern.
