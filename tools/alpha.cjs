const sharp = require('sharp');
const path = require('path');
const src = path.join(process.env.USERPROFILE, 'Downloads', 'image (4) (1).png');

(async () => {
  const { data, info } = await sharp(src).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width: W, height: H, channels: C } = info;
  const px = (x, y) => { const i = (y * W + x) * C; return [data[i], data[i + 1], data[i + 2], data[i + 3]]; };

  // bounding box of anything not fully transparent
  let minX = W, maxX = -1, minY = H, maxY = -1;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (data[(y * W + x) * C + 3] > 8) { if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y; }
  }
  console.log('non-transparent bbox: x ' + minX + '-' + maxX + '  y ' + minY + '-' + maxY);
  console.log('  = ' + (maxX - minX + 1) + 'x' + (maxY - minY + 1) +
    ' (' + ((maxX - minX + 1) * (maxY - minY + 1) / (W * H) * 100).toFixed(1) + '% of canvas)');

  // horizontal scan across the middle of the artwork
  const my = Math.floor((minY + maxY) / 2);
  console.log('\nrow y=' + my + ' sampled every 8% of the bbox width:');
  for (let k = 0; k <= 12; k++) {
    const x = Math.round(minX + (maxX - minX) * (k / 12));
    console.log('  x=' + String(x).padStart(4) + '  rgba=' + px(x, my).join(','));
  }

  // colour histogram of OPAQUE pixels
  const bins = {};
  let n = 0;
  for (let y = minY; y <= maxY; y += 3) for (let x = minX; x <= maxX; x += 3) {
    const [r, g, b, a] = px(x, y);
    if (a > 250) { const key = (r >> 5) + ',' + (g >> 5) + ',' + (b >> 5); bins[key] = (bins[key] || 0) + 1; n++; }
  }
  const top = Object.entries(bins).sort((a, b) => b[1] - a[1]).slice(0, 8);
  console.log('\ntop opaque colour bins (r,g,b >>5), of ' + n + ' samples:');
  top.forEach(([k, v]) => {
    const [r, g, b] = k.split(',').map(Number);
    console.log('  ~rgb(' + (r * 32) + ',' + (g * 32) + ',' + (b * 32) + ')  ' + (v / n * 100).toFixed(1) + '%');
  });
})();
