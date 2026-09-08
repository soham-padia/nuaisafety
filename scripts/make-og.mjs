/**
 * Generates public/og.png, the 1200x630 card shown when the link is pasted into
 * Slack, Discord, iMessage or a tweet. Run with `npm run og` after changing the
 * hero art or the tagline; the output is committed so the build stays dependency
 * free.
 *
 * Text is drawn as SVG and rasterised by sharp, so it uses a system sans rather
 * than the exact stack in global.css. Close enough for a share card.
 */
import sharp from 'sharp';

const W = 1200, H = 630, PAD = 64;
const ART = 470;

const card = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
  <rect width="${W}" height="${H}" fill="#ffffff"/>
  <rect x="0" y="0" width="${W}" height="8" fill="#c8102e"/>
  <g font-family="Helvetica Neue, Helvetica, Arial, sans-serif" fill="#14161a">
    <text x="${PAD}" y="250" font-size="84" font-weight="700" letter-spacing="-3">NU AI Safety</text>
    <text x="${PAD}" y="316" font-size="34" font-weight="500" fill="#14161a">AI safety and interpretability</text>
    <text x="${PAD}" y="360" font-size="34" font-weight="500" fill="#14161a">at Northeastern.</text>
    <text x="${PAD}" y="440" font-size="25" fill="#5b6169">A student-led group, open to every discipline.</text>
    <text x="${PAD}" y="476" font-size="25" fill="#5b6169">Reading group, guest talks, and research.</text>
    <text x="${PAD}" y="556" font-size="23" font-weight="600" fill="#c8102e">nuaisafety.com</text>
  </g>
</svg>`;

const art = await sharp('src/assets/hero-collage.png')
  .resize(ART, ART, { fit: 'cover' })
  .composite([{
    input: Buffer.from(
      `<svg width="${ART}" height="${ART}"><rect width="${ART}" height="${ART}" rx="20" fill="#fff"/></svg>`
    ),
    blend: 'dest-in',
  }])
  .png()
  .toBuffer();

await sharp(Buffer.from(card))
  .composite([{ input: art, left: W - ART - PAD, top: (H - ART) / 2 }])
  .png({ compressionLevel: 9 })
  .toFile('public/og.png');

console.log('wrote public/og.png');
