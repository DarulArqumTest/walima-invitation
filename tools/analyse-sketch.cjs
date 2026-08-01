const sharp = require('sharp');
const path = require('path');
const src = path.join(process.env.USERPROFILE, 'Downloads', '4fa43c39-875c-4f13-821f-df48943120a9.jpg');

(async () => {
  const m = await sharp(src).metadata();
  console.log('size', m.width + 'x' + m.height, 'channels', m.channels, 'alpha', m.hasAlpha, 'format', m.format);
  const { data, info } = await sharp(src).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width: W, height: H, channels: C } = info;
  const px = (x, y) => { const i = (y * W + x) * C; return [data[i], data[i + 1], data[i + 2]]; };

  // corner region = pure checkerboard. Find its two levels.
  const levels = {};
  for (let y = 0; y < 120; y++) for (let x = 0; x < 120; x++) {
    const [r, g, b] = px(x, y);
    const k = Math.round(r / 4) * 4;
    levels[k] = (levels[k] || 0) + 1;
  }
  console.log('\ncheckerboard levels in top-left 120x120 (R value -> count):');
  Object.entries(levels).sort((a, b) => b[1] - a[1]).slice(0, 6)
    .forEach(([k, v]) => console.log('   ~' + k + '  ' + v));

  // measure the checker square size by scanning a row
  let flips = [], prev = null;
  for (let x = 0; x < 400; x++) { const v = px(x, 20)[0] > 235 ? 1 : 0; if (prev !== null && v !== prev) flips.push(x); prev = v; }
  const gaps = flips.slice(1).map((v, i) => v - flips[i]);
  console.log('checker square width (px):', gaps.slice(0, 8).join(','));

  // chroma distribution — how separable is gold from neutral grey?
  let neutralLight = 0, chromatic = 0, dark = 0, total = 0;
  const chromaBins = new Array(10).fill(0);
  for (let y = 0; y < H; y += 3) for (let x = 0; x < W; x += 3) {
    const [r, g, b] = px(x, y);
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b), chroma = mx - mn;
    chromaBins[Math.min(9, Math.floor(chroma / 10))]++;
    total++;
    if (chroma < 12 && mn >= 170) neutralLight++;
    else if (chroma >= 12) chromatic++;
    else dark++;
  }
  console.log('\nchroma histogram (0-9,10-19,...,90+):');
  chromaBins.forEach((n, i) => console.log('  ' + (i * 10) + '+ : ' + (n / total * 100).toFixed(2) + '%'));
  console.log('\nneutral & light (background candidates): ' + (neutralLight / total * 100).toFixed(2) + '%');
  console.log('chromatic (artwork candidates)         : ' + (chromatic / total * 100).toFixed(2) + '%');
  console.log('neutral & dark                          : ' + (dark / total * 100).toFixed(2) + '%');

  // sample some artwork pixels (centre of the couple)
  console.log('\nartwork samples down the centre column x=' + Math.floor(W / 2) + ':');
  for (let k = 0; k <= 10; k++) {
    const y = Math.round(H * (0.35 + 0.05 * k));
    console.log('  y=' + String(y).padStart(4) + ' rgb=' + px(Math.floor(W / 2), y).join(','));
  }
})();
