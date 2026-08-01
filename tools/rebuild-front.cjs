/* Replace the couple illustration on the envelope front.

   The old art was a black-and-white sketch with an opaque white body, so it read
   as a light drawing on the dark green. The new art is gold LINE work with a
   genuinely transparent interior — dropped straight onto dark green the faces
   would read as hollow voids (verified against a dark proof).

   So: cover the old sketch with a soft-edged ivory vignette (which both hides it
   and gives the line work the light ground it was drawn for), then lay the gold
   art on top. */
const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

const A = path.join(__dirname, '..', 'public', 'assets');
const FRONT = path.join(A, 'front-paper.png');
const SKETCH = path.join(A, 'couple-gold.png');
const BACKUP = path.join(A, 'front-paper.original.png');

(async () => {
  if (!fs.existsSync(BACKUP)) { fs.copyFileSync(FRONT, BACKUP); console.log('backed up original'); }

  const base = sharp(BACKUP);
  const meta = await base.metadata();
  const W = meta.width, H = meta.height;
  const { data } = await sharp(BACKUP).ensureAlpha().raw().toBuffer({ resolveWithObject: true });

  // find the OLD sketch: it is neutral (grey/white/black) while the card is green
  let minX = W, maxX = -1, minY = H, maxY = -1;
  const x0 = Math.floor(W * 0.15), x1 = Math.floor(W * 0.87);
  const y0 = Math.floor(H * 0.26), y1 = Math.floor(H * 0.76);
  for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
    const i = (y * W + x) * 4;
    const r = data[i], g = data[i + 1], b = data[i + 2], a = data[i + 3];
    if (a < 40) continue;
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
    if (mx - mn < 26 && mx > 60) {           // neutral and not near-black shadow
      if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y;
    }
  }
  console.log('old sketch bbox: x ' + minX + '-' + maxX + '  y ' + minY + '-' + maxY +
    '  (' + (maxX - minX) + 'x' + (maxY - minY) + ')');

  // ivory vignette, comfortably larger than the old art so nothing peeks out
  const padX = 46, padTop = 40, padBot = 34;
  const vx = minX - padX, vy = minY - padTop;
  const vw = (maxX - minX) + padX * 2, vh = (maxY - minY) + padTop + padBot;
  const cx = vw / 2, cy = vh / 2;

  const vignette = Buffer.from(
    '<svg xmlns="http://www.w3.org/2000/svg" width="' + vw + '" height="' + vh + '">' +
      '<defs><radialGradient id="g" cx="50%" cy="50%" r="50%">' +
        '<stop offset="0%"   stop-color="#fdf6e6" stop-opacity="1"/>' +
        '<stop offset="62%"  stop-color="#fbf1de" stop-opacity="1"/>' +
        '<stop offset="82%"  stop-color="#f7ead2" stop-opacity="0.92"/>' +
        '<stop offset="94%"  stop-color="#f3e4c8" stop-opacity="0.45"/>' +
        '<stop offset="100%" stop-color="#efdfc0" stop-opacity="0"/>' +
      '</radialGradient></defs>' +
      '<ellipse cx="' + cx + '" cy="' + cy + '" rx="' + cx + '" ry="' + cy + '" fill="url(#g)"/>' +
    '</svg>'
  );

  // scale the gold art to sit inside the vignette
  const bb = JSON.parse(fs.readFileSync(path.join(__dirname, 'sketch-bbox.json'), 'utf8'));
  const artW = bb.maxX - bb.minX + 1, artH = bb.maxY - bb.minY + 1;
  const targetW = Math.round(vw * 0.90), targetH = Math.round(targetW * artH / artW);

  const art = await sharp(SKETCH)
    .extract({ left: bb.minX, top: bb.minY, width: artW, height: artH })
    .resize(targetW, targetH, { fit: 'fill' })
    .toBuffer();

  const ax = Math.round(vx + (vw - targetW) / 2);
  const ay = Math.round(vy + (vh - targetH) / 2);

  await sharp(BACKUP)
    .composite([
      { input: vignette, left: Math.round(vx), top: Math.round(vy) },
      { input: art, left: ax, top: ay }
    ])
    .png({ compressionLevel: 9 })
    .toFile(FRONT + '.tmp');

  fs.renameSync(FRONT + '.tmp', FRONT);
  console.log('vignette at ' + vx + ',' + vy + ' size ' + vw + 'x' + vh);
  console.log('art at ' + ax + ',' + ay + ' size ' + targetW + 'x' + targetH);
  console.log('wrote front-paper.png (' + (fs.statSync(FRONT).size / 1024).toFixed(0) + ' KB)');
})();
