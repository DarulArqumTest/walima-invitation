const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');

// --- paper must not bloom: only true flames should ---
const lp = path.join(root, 'public', 'letter3d.js');
let l = fs.readFileSync(lp, 'utf8');
l = l.replace(
  'var bloom=this.bloom=new THREE.UnrealBloomPass(new THREE.Vector2(W,H), 0.85, 0.7, 0.85);',
  '// threshold raised so only the candle flames bloom — the ivory paper was blowing out\n      var bloom=this.bloom=new THREE.UnrealBloomPass(new THREE.Vector2(W,H), 0.85, 0.7, 0.955);'
);
fs.writeFileSync(lp, l);
console.log('bloom threshold raised:', /0\.955/.test(l));

// --- "With" / بہمراہ set as an ornament that links the two names ---
const LOZENGE = '\\' + '2756';   // ❖ , escaped for CSS content
const linkCSS = [
  "",
  "  /* 'With' / بہمراہ is the word that joins the two names, so it is set as an",
  "     ornament rather than a label: gold lettering, tapered rules reaching out to",
  "     either side, and a small lozenge where each rule meets the word. */",
  "  .ic-with{display:flex;align-items:center;justify-content:center;gap:1.6cqw;width:100%}",
  "  .ic-with:before,.ic-with:after{content:'';flex:1 1 auto;max-width:22%;height:1px;",
  "    background:linear-gradient(90deg,rgba(200,162,78,0) 0%,rgba(200,162,78,.55) 55%,rgba(200,162,78,.95) 100%)}",
  "  .ic-with:after{transform:scaleX(-1)}",
  "  .ic-with i{font-style:normal;position:relative;display:inline-block;padding:0 .5cqw;white-space:nowrap}",
  "  .ic-with i:before,.ic-with i:after{content:'" + LOZENGE + "';position:absolute;top:50%;",
  "    transform:translateY(-50%);font-size:1.2cqw;line-height:1;color:#c8a24e;",
  "    font-family:Georgia,serif;opacity:.92;-webkit-text-fill-color:#c8a24e}",
  "  .ic-with i:before{left:-1.5cqw}",
  "  .ic-with i:after{right:-1.5cqw}",
  "  .inv-ur .ic-with{gap:2.1cqw}",
  "  .inv-ur .ic-with i{padding:0 .7cqw}",
  "  .inv-ur .ic-with i:before,.inv-ur .ic-with i:after{font-size:1.35cqw}",
  ""
].join('\n');

const ip = path.join(root, 'public', 'index.html');
let s = fs.readFileSync(ip, 'utf8');

const anchor = "  .ic-parent{font-family:'Cormorant Garamond'";
if (!s.includes(anchor)) throw new Error('CSS anchor not found');
s = s.replace(anchor, linkCSS + anchor);

const markerFrom = "'<div class=\"ic-with\">'+esc(d.withWord)+'</div>' +";
const markerTo = "'<div class=\"ic-with\"><i>'+esc(d.withWord)+'</i></div>' +";
if (!s.includes(markerFrom)) throw new Error('markup anchor not found');
s = s.replace(markerFrom, markerTo);

fs.writeFileSync(ip, s);
console.log('ornament CSS added:', s.includes('.ic-with i:before'));
console.log('word wrapped in <i>:', s.includes(markerTo));
