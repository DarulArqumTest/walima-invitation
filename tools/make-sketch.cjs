/* Rebuild the gold couple sketch as a properly cut-out figure.

   Two separate problems with the naive version:

   1. ALPHA. The source is a JPEG, so the transparency checkerboard is baked in as
      real pixels (two neutral levels, ~17px squares) with JPEG smear on every edge.
      Alpha comes from warmth — the background is strictly neutral, the art strictly
      warm gold — and the colour is un-matted against the light ground it sat on.

   2. THE INTERIORS. The art is LINE work: the skin, clothes and couch were the white
      of the page. Making only the strokes opaque leaves the faces as see-through
      voids, which is why it read as a hollow mask on the dark card. The old artwork
      worked because its figures had a solid light body.

   So the figure interiors are recovered by flood-filling the true background inward
   from the border: anything transparent that the outside CANNOT reach is inside the
   figure, and gets an ivory body. Morphological closing runs first so the flood does
   not leak through gaps in the hatching. */
const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

const SRC = path.join(process.env.USERPROFILE, 'Downloads', '4fa43c39-875c-4f13-821f-df48943120a9.jpg');
const OUT = path.join(__dirname, '..', 'public', 'assets', 'couple-gold.png');

const WARM_LO = 5, WARM_HI = 34;   // R-B -> alpha ramp for the strokes
const BG = 248;                    // lighter checker level, used to un-matte
const CLOSE = 9;                   // radius that seals gaps in the hatching
const BODY = [252, 246, 232];      // ivory body, matched to the card's cream

function boxBlur(src, W, H, r) {
  const tmp = new Uint8Array(W * H), out = new Uint8Array(W * H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    let s2 = 0, n = 0;
    for (let k = -r; k <= r; k++) { const xx = x + k; if (xx < 0 || xx >= W) continue; s2 += src[y * W + xx]; n++; }
    tmp[y * W + x] = s2 / n;
  }
  for (let x = 0; x < W; x++) for (let y = 0; y < H; y++) {
    let s2 = 0, n = 0;
    for (let k = -r; k <= r; k++) { const yy = y + k; if (yy < 0 || yy >= H) continue; s2 += tmp[yy * W + x]; n++; }
    out[y * W + x] = s2 / n;
  }
  return out;
}

function smooth(t) { return t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t); }

// separable box dilate / erode on a Uint8 mask
function morph(mask, W, H, r, grow) {
  const pick = grow ? Math.max : Math.min;
  const tmp = new Uint8Array(W * H), out = new Uint8Array(W * H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    let v = grow ? 0 : 255;
    for (let k = -r; k <= r; k++) { const xx = x + k; if (xx < 0 || xx >= W) continue; v = pick(v, mask[y * W + xx]); }
    tmp[y * W + x] = v;
  }
  for (let x = 0; x < W; x++) for (let y = 0; y < H; y++) {
    let v = grow ? 0 : 255;
    for (let k = -r; k <= r; k++) { const yy = y + k; if (yy < 0 || yy >= H) continue; v = pick(v, tmp[yy * W + x]); }
    out[y * W + x] = v;
  }
  return out;
}

(async () => {
  const { data, info } = await sharp(SRC).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width: W, height: H } = info;
  const N = W * H;

  // ---- 1. stroke alpha + un-matted stroke colour ----
  const lineA = new Float32Array(N);
  const lineRGB = new Uint8Array(N * 3);
  for (let p = 0; p < N; p++) {
    const i = p * 3;
    const r = data[i], g = data[i + 1], b = data[i + 2];
    const chroma = Math.max(r, g, b) - Math.min(r, g, b);
    let a = smooth((r - b - WARM_LO) / (WARM_HI - WARM_LO));
    if (chroma < 9 && Math.min(r, g, b) > 150) a = 0;   // hard-kill the checkerboard
    lineA[p] = a;
    if (a > 0.004) {
      const un = (v) => Math.max(0, Math.min(255, Math.round((v - BG * (1 - a)) / a)));
      lineRGB[i] = un(r); lineRGB[i + 1] = un(g); lineRGB[i + 2] = un(b);
    }
  }

  /* ---- 2. a body that follows the FIGURE, not a box ----
     The interiors really are transparent — measured checkerness inside the figures
     (42.8) matches the empty background (46.2), so there is no white body hiding in
     the source and a flood fill has nothing watertight to stop at. Instead the body
     is grown from the line work itself: the hatching is dense, so dilating the strokes
     and easing back fills the figure and tapers naturally at the silhouette. */
  // Confident strokes only. A loose threshold also catches JPEG ringing near the
  // image edge, which the dilation then smeared into a blob on the border.
  const strokes = new Uint8Array(N);
  for (let p2 = 0; p2 < N; p2++) strokes[p2] = lineA[p2] > 0.10 ? 255 : 0;
  let sx0 = W, sx1 = -1, sy0 = H, sy1 = -1;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (lineA[y * W + x] > 0.30) {
    if (x < sx0) sx0 = x; if (x > sx1) sx1 = x; if (y < sy0) sy0 = y; if (y > sy1) sy1 = y;
  }
  console.log('confident stroke bbox: x ' + sx0 + '-' + sx1 + '  y ' + sy0 + '-' + sy1);
  const PAD = 22;
  const gx0 = Math.max(0, sx0 - PAD), gx1 = Math.min(W - 1, sx1 + PAD);
  const gy0 = Math.max(0, sy0 - PAD), gy1 = Math.min(H - 1, sy1 + PAD);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (x < gx0 || x > gx1 || y < gy0 || y > gy1) { strokes[y * W + x] = 0; lineA[y * W + x] = 0; }
  }
  const grown  = morph(strokes, W, H, 14, true);
  const pulled = morph(grown,   W, H, 12, false);
  // closing (dilate then erode by the same radius) seals small holes where the
  // hatching thins out, without pushing the outer silhouette any further
  const sealed = morph(morph(pulled, W, H, 11, true), W, H, 11, false);
  const soft = boxBlur(sealed, W, H, 3);

  // ---- 3. gold strokes over an ivory body ----
  const out = Buffer.alloc(N * 4);
  for (let p = 0; p < N; p++) {
    const o = p * 4, i = p * 3;
    const la = lineA[p];
    const ba = (soft[p] / 255) * 0.97;                    // body slightly under full so it stays paper-like
    const a = Math.min(1, la + ba * (1 - la));
    if (a <= 0.004) { out[o] = out[o + 1] = out[o + 2] = out[o + 3] = 0; continue; }
    // composite stroke over body
    const w = la / a;
    out[o]     = Math.round(lineRGB[i]     * w + BODY[0] * (1 - w));
    out[o + 1] = Math.round(lineRGB[i + 1] * w + BODY[1] * (1 - w));
    out[o + 2] = Math.round(lineRGB[i + 2] * w + BODY[2] * (1 - w));
    out[o + 3] = Math.round(a * 255);
  }

  await sharp(out, { raw: { width: W, height: H, channels: 4 } }).png({ compressionLevel: 9 }).toFile(OUT);
  console.log('wrote couple-gold.png  ' + W + 'x' + H + '  ' + (fs.statSync(OUT).size / 1024).toFixed(0) + ' KB');

  // ---- verification ----
  const v = (await sharp(OUT).raw().toBuffer({ resolveWithObject: true })).data;
  const al = (x, y) => v[(y * W + x) * 4 + 3];
  let border = 0;
  for (let y = 0; y < H; y++) for (const x of [0, 1, W - 2, W - 1]) if (al(x, y)) border++;
  for (let x = 0; x < W; x++) for (const y of [0, 1, H - 2, H - 1]) if (al(x, y)) border++;
  let margin = 0, checked = 0;
  for (let y = 0; y < H * 0.22; y++) for (let x = 0; x < W; x++) { checked++; if (al(x, y)) margin++; }
  let clear = 0, opaque = 0, part = 0;
  for (let p = 3; p < v.length; p += 4) { const a = v[p]; if (!a) clear++; else if (a === 255) opaque++; else part++; }
  let minX = W, maxX = -1, minY = H, maxY = -1;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (al(x, y) > 24) {
    if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y;
  }
  console.log('border non-transparent : ' + border + (border ? '  FAIL' : '  OK'));
  console.log('residue in top margin  : ' + margin + ' / ' + checked + (margin ? '  FAIL' : '  OK'));
  console.log('clear ' + (clear / N * 100).toFixed(1) + '%  partial ' + (part / N * 100).toFixed(1) +
    '%  opaque ' + (opaque / N * 100).toFixed(1) + '%   (body should now be opaque)');
  console.log('bbox x ' + minX + '-' + maxX + '  y ' + minY + '-' + maxY);
  fs.writeFileSync(path.join(__dirname, 'sketch-bbox.json'), JSON.stringify({ W, H, minX, maxX, minY, maxY }));

  await sharp({ create: { width: W, height: H, channels: 4, background: '#0d3b2c' } })
    .composite([{ input: OUT }]).png().toFile(path.join(__dirname, 'proof-dark.png'));
  console.log('wrote proof-dark.png');
})();
