/* Rebuild alpha for the gold couple sketch.

   The source is a JPEG, so the transparency checkerboard is baked in as real
   pixels at two neutral levels (~248 and ~200, 17px squares). JPEG also smears
   those edges, so a flat colour-key would leave grey fringing.

   What makes this clean: the background is strictly NEUTRAL (chroma < 10) and the
   artwork is strictly WARM gold (R-B between roughly 30 and 110). So alpha comes
   from warmth, and the colour is un-matted against the light background it was
   composited over — otherwise the gold stays milky when placed on a dark card. */
const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

const SRC = path.join(process.env.USERPROFILE, 'Downloads', '4fa43c39-875c-4f13-821f-df48943120a9.jpg');
const OUT = path.join(__dirname, '..', 'public', 'assets', 'couple-gold.png');

const WARM_LO = 6;    // R-B at/below this is background
const WARM_HI = 38;   // R-B at/above this is solid artwork
const BG = 248;       // the lighter checker level; used to un-matte

function smooth(t) { return t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t); }

(async () => {
  const { data, info } = await sharp(SRC).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width: W, height: H } = info;
  const out = Buffer.alloc(W * H * 4);

  for (let i = 0, o = 0; i < data.length; i += 3, o += 4) {
    const r = data[i], g = data[i + 1], b = data[i + 2];
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
    const chroma = mx - mn;
    const warm = r - b;

    let a = smooth((warm - WARM_LO) / (WARM_HI - WARM_LO));

    // Hard kill: anything neutral and light is checkerboard, full stop. This is what
    // guarantees there is no residue rather than "almost none".
    if (chroma < 9 && mn > 150) a = 0;

    if (a <= 0.004) { out[o] = out[o + 1] = out[o + 2] = out[o + 3] = 0; continue; }

    // un-matte: observed = art*a + BG*(1-a)  ->  art = (observed - BG*(1-a)) / a
    const un = (v) => Math.max(0, Math.min(255, Math.round((v - BG * (1 - a)) / a)));
    out[o] = un(r); out[o + 1] = un(g); out[o + 2] = un(b);
    out[o + 3] = Math.round(a * 255);
  }

  await sharp(out, { raw: { width: W, height: H, channels: 4 } }).png({ compressionLevel: 9 }).toFile(OUT);
  console.log('wrote ' + OUT + '  (' + W + 'x' + H + ', ' + (fs.statSync(OUT).size / 1024).toFixed(0) + ' KB)');

  // ---------------- verification ----------------
  const v = await sharp(OUT).raw().toBuffer({ resolveWithObject: true });
  const D = v.data, C = 4;
  const al = (x, y) => D[(y * W + x) * C + 3];

  let bad = [];
  // 1. the outer frame is pure background — every pixel must be exactly 0
  for (let y = 0; y < H; y++) for (const x of [0, 1, 2, W - 3, W - 2, W - 1]) if (al(x, y) !== 0) bad.push([x, y, al(x, y)]);
  for (let x = 0; x < W; x++) for (const y of [0, 1, 2, H - 3, H - 2, H - 1]) if (al(x, y) !== 0) bad.push([x, y, al(x, y)]);
  console.log('\n1. border pixels non-transparent: ' + bad.length + (bad.length ? '  e.g. ' + JSON.stringify(bad.slice(0, 3)) : '  OK'));

  // 2. dense sweep of the known-empty margins (top 25%, and left/right 15%)
  let residue = 0, checked = 0;
  for (let y = 0; y < H * 0.25; y++) for (let x = 0; x < W; x++) { checked++; if (al(x, y) > 0) residue++; }
  for (let y = 0; y < H; y++) for (let x = 0; x < W * 0.05; x++) { checked++; if (al(x, y) > 0) residue++; }
  console.log('2. residue in empty margins: ' + residue + ' / ' + checked + '  ' + (residue ? 'FAIL' : 'OK'));

  // 3. artwork survived
  let opaque = 0, partial = 0, clear = 0;
  for (let p = 3; p < D.length; p += C) { const a = D[p]; if (a === 0) clear++; else if (a === 255) opaque++; else partial++; }
  const tot = W * H;
  console.log('3. clear ' + (clear / tot * 100).toFixed(1) + '%  partial ' + (partial / tot * 100).toFixed(1) +
    '%  opaque ' + (opaque / tot * 100).toFixed(1) + '%');

  // 4. artwork bounding box
  let minX = W, maxX = -1, minY = H, maxY = -1;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (al(x, y) > 24) {
    if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y;
  }
  console.log('4. artwork bbox: x ' + minX + '-' + maxX + '  y ' + minY + '-' + maxY);
  fs.writeFileSync(path.join(__dirname, 'sketch-bbox.json'), JSON.stringify({ W, H, minX, maxX, minY, maxY }));

  // 5. proof sheets — composite over dark and over white
  await sharp({ create: { width: W, height: H, channels: 4, background: '#0d2b22' } })
    .composite([{ input: OUT }]).png().toFile(path.join(__dirname, 'proof-dark.png'));
  await sharp({ create: { width: W, height: H, channels: 4, background: '#ffffff' } })
    .composite([{ input: OUT }]).png().toFile(path.join(__dirname, 'proof-white.png'));
  console.log('5. wrote proof-dark.png and proof-white.png');
})();
