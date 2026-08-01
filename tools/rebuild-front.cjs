/* Rebuild the envelope front.

   Earlier attempts did pixel maths through sharp's raw round-trip, whose 1-channel
   stride is not guaranteed to match — that silently corrupted the mask and smeared
   the whole card. This version does no raw round-trips at all: the cartouche is
   covered by an SVG green patch with a blurred mask, sampled to match the card's
   own field, and the couple is composited over it with a soft paper shadow.
*/
const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

const A = path.join(__dirname, '..', 'public', 'assets');
const FRONT = path.join(A, 'front-paper.png');
const ORIGINAL = path.join(A, 'front-paper.original.png');
const SKETCH = path.join(A, 'couple-gold.png');

// cartouche footprint, inset so the patch never reaches the floral wreath
const P = { x: 205, y: 225, w: 492, h: 640 };

(async () => {
  const meta = await sharp(ORIGINAL).metadata();
  const W = meta.width, H = meta.height;

  const patch = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
       <defs>
         <linearGradient id="field" x1="0" y1="0" x2="0" y2="1">
           <stop offset="0%"   stop-color="#123a2b"/>
           <stop offset="45%"  stop-color="#0e3325"/>
           <stop offset="100%" stop-color="#0a2c20"/>
         </linearGradient>
         <filter id="soft" x="-30%" y="-30%" width="160%" height="160%">
           <feGaussianBlur stdDeviation="30"/>
         </filter>
         <mask id="m">
           <rect x="${P.x}" y="${P.y}" width="${P.w}" height="${P.h}" rx="26" fill="#fff" filter="url(#soft)"/>
         </mask>
       </defs>
       <rect x="0" y="0" width="${W}" height="${H}" fill="url(#field)" mask="url(#m)"/>
     </svg>`);

  const healed = await sharp(ORIGINAL).composite([{ input: patch, left: 0, top: 0 }]).png().toBuffer();

  // ---- couple + paper drop shadow ----
  const bb = JSON.parse(fs.readFileSync(path.join(__dirname, 'sketch-bbox.json'), 'utf8'));
  const aw = bb.maxX - bb.minX + 1, ah = bb.maxY - bb.minY + 1;
  const slotW = 648, slotH = 580, slotX = 135, slotY = 301;
  const scale = Math.min(slotW / aw, slotH / ah);
  const tw = Math.round(aw * scale), th = Math.round(ah * scale);

  const art = await sharp(SKETCH)
    .extract({ left: bb.minX, top: bb.minY, width: aw, height: ah })
    .resize(tw, th, { fit: 'fill' }).png().toBuffer();

  // shadow: the art's own silhouette, darkened and blurred
  const shadow = await sharp(art).ensureAlpha()
    .composite([{
      input: Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${tw}" height="${th}"><rect width="${tw}" height="${th}" fill="#07231a"/></svg>`),
      blend: 'in'
    }])
    .blur(11).png().toBuffer();

  const ax = Math.round(slotX + (slotW - tw) / 2);
  const ay = Math.round(slotY + (slotH - th));

  await sharp(healed)
    .composite([
      { input: shadow, left: ax + 4, top: ay + 10, opacity: 0.42 },
      { input: art, left: ax, top: ay }
    ])
    .png({ compressionLevel: 9 })
    .toFile(FRONT + '.tmp');
  fs.renameSync(FRONT + '.tmp', FRONT);

  console.log('cartouche covered, art ' + tw + 'x' + th + ' at ' + ax + ',' + ay + ' + shadow');
  console.log('wrote front-paper.png (' + (fs.statSync(FRONT).size / 1024).toFixed(0) + ' KB)');
})();
