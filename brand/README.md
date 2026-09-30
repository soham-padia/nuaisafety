# Brand assets

Generated from the live site, so the type and spacing match the header exactly.
The dark variants are recoloured from the light ones by
`node scripts/make-brand-dark.mjs`, so every version shares the same letterforms.

In the filenames, `-white` and `-black` name the **background**. `-inverse` names
the **ink**: white marks on a transparent background.

| File | Use |
|---|---|
| `logo-wordmark.png` | Transparent, ink text. Slides, docs, anything on a light surface. |
| `logo-wordmark-inverse.png` | Transparent, white text. Anything on a dark surface. |
| `logo-wordmark-white.png` | White background, padded. Where transparency is not supported. |
| `logo-wordmark-black.png` | Black background, white text, padded. Dark slide decks. |
| `logo-square.png` | 1024x1024, white. Slack, Discord, any square avatar slot. |
| `logo-square-black.png` | 1024x1024, black. The same slots on a dark theme. |
| `perceptron.png` | Hero diagram, transparent, dark marks. Light surfaces. |
| `perceptron-inverse.png` | Hero diagram, transparent, light marks. Dark surfaces. |
| `../public/favicon.svg` | Browser tab only. Just the accent dot. |

Colors: ink `#14161a`, accent `#c8102e`. The accent is an accent. It appears as
the dot and nothing else, and it stays the same red on dark backgrounds.

There is no Northeastern wordmark, seal or logo in any of these, and none should
be added. The group licenses none of them.
