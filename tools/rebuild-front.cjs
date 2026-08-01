/* Put the couple back into the envelope front.

   The first attempt dropped a big ivory oval behind the art, which read exactly like
   a PNG pasted on top of the floral design. The artwork now carries its own
   figure-shaped ivory body, so no backing plate is needed at all — it just occupies
   the same footprint the original illustration did, inside the existing cartouche. */
const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

const A = path.join(__dirname, '..', 'public', 'assets');
const FRONT = path.join(A, 'front-paper.png');
const ORIGINAL = path.join(A, 'front-paper.original.png');
const SKETCH = path.join(A, 'couple-gold.png');

(async () => {
  if (!fs.existsSync(ORIGINAL)) throw new Error('missing pristine original');

  const meta = await sharp(ORIGINAL).metadata();
  const W = meta.width, H = meta.height;
  const { data } = await sharp(ORIGINAL).ensureAlpha().raw().toBuffer({ resolveWithObject: true });

  // Footprint of the ORIGINAL illustration — neutral pixels on a green card.
  let minX = W, maxX = -1, minY = H, maxY = -1;
  for (let y = Math.floor(H * 0.26); y < Math.floor(H * 0.76); y++) {
    for (let x = Math.floor(W * 0.15); x < Math.floor(W * 0.87); x++) {
      const i = (y * W + x) * 4;
      if (data[i + 3] < 40) continue;
      const r = data[i], g = data[i + 1], b = data[i + 2];
      if (Math.max(r, g, b) - Math.min(r, g, b) < 26 && Math.max(r, g, b) > 60) {
        if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y;
      }
    }
  }
  const slotW = maxX - minX + 1, slotH = maxY - minY + 1;
  console.log('original illustration slot: x ' + minX + '-' + maxX + ' y ' + minY + '-' + maxY +
    '  (' + slotW + 'x' + slotH + ')');

  // fit the new art into that slot, preserving aspect
  const bb = JSON.parse(fs.readFileSync(path.join(__dirname, 'sketch-bbox.json'), 'utf8'));
  const aw = bb.maxX - bb.minX + 1, ah = bb.maxY - bb.minY + 1;
  const scale = Math.min(slotW / aw, slotH / ah);
  const tw = Math.round(aw * scale), th = Math.round(ah * scale);

  const art = await sharp(SKETCH)
    .extract({ left: bb.minX, top: bb.minY, width: aw, height: ah })
    .resize(tw, th, { fit: 'fill' })
    .toBuffer();

  const ax = Math.round(minX + (slotW - tw) / 2);
  const ay = Math.round(minY + (slotH - th));   // sit it on the same baseline as the original

  await sharp(ORIGINAL)
    .composite([{ input: art, left: ax, top: ay }])
    .png({ compressionLevel: 9 })
    .toFile(FRONT + '.tmp');
  fs.renameSync(FRONT + '.tmp', FRONT);

  console.log('placed art at ' + ax + ',' + ay + '  ' + tw + 'x' + th);
  console.log('wrote front-paper.png (' + (fs.statSync(FRONT).size / 1024).toFixed(0) + ' KB)');
})();
