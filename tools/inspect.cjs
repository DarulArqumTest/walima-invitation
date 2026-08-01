const sharp = require('sharp');
const fs = require('fs');
const path = require('path');
const dir = path.join(process.env.USERPROFILE || 'C:/Users/Ansar6211', 'Downloads');

(async () => {
  const files = fs.readdirSync(dir).filter(f => /^image \(4\)/i.test(f));
  console.log('candidates:', files);
  for (const f of files) {
    const p = path.join(dir, f);
    try {
      const m = await sharp(p).metadata();
      const s = await sharp(p).stats();
      console.log(f.padEnd(22), m.width + 'x' + m.height, 'alpha=' + m.hasAlpha, 'ch=' + m.channels);
      if (m.hasAlpha) {
        const a = s.channels[3];
        console.log('    alpha min=' + a.min + ' max=' + a.max + ' mean=' + a.mean.toFixed(1));
      }
    } catch (e) { console.log(f, 'ERR', e.message); }
  }
})();
