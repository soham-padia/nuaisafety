# Brand assets

Generated from the live site, so the type and spacing match the header exactly.
The variants are recoloured from the originals by
`node scripts/make-brand-variants.mjs`, so every version shares the same letterforms.

In the filenames, `-white` and `-black` name the **background**. `-transparent`
and `-inverse` have no background at all: `-transparent` is the ink mark,
`-inverse` is the white one.

| File | Use |
|---|---|
| `logo-wordmark.png` | Transparent, ink. Slides, docs, anything on a light surface. |
| `logo-wordmark-inverse.png` | Transparent, white. Anything on a dark surface. |
| `logo-wordmark-white.png` | White background, padded. Where transparency is not supported. |
| `logo-wordmark-black.png` | Black background, white, padded. Dark slide decks. |
| `logo-square-transparent.png` | 1024px, transparent, ink. The stacked lockup on a light surface. |
| `logo-square-inverse.png` | 1024px, transparent, white. The stacked lockup on a dark surface. |
| `logo-square.png` | 1024px, white. Slack, Discord, any square avatar slot. |
| `logo-square-black.png` | 1024px, black. The same slots on a dark theme. |
| `perceptron.png` | Hero diagram, transparent, dark marks. Light surfaces. |
| `perceptron-inverse.png` | Hero diagram, transparent, light marks. Dark surfaces. |
| `../public/favicon.svg` | Browser tab only. Just the accent dot. |

Avatar slots want one of the filled squares. Slack and Discord composite a
transparent image onto whatever the viewer's theme is, so the mark can land on a
background close to its own colour and disappear.

Colors: ink `#14161a`, accent `#c8102e`. The accent is an accent. It appears as
the dot and nothing else, and it stays the same red on every background.

There is no Northeastern wordmark, seal or logo in any of these, and none should
be added. The group licenses none of them.
