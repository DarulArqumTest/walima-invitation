const fs = require('fs');
const path = require('path');
const ip = path.join(__dirname, '..', 'public', 'index.html');
let s = fs.readFileSync(ip, 'utf8');

const LOZ = '\\' + '2756';

// strip the previous (too timid) treatment
const startMark = "\n  /* 'With' / بہمراہ is the word that joins the two names";
const endMark = "  .ic-parent{font-family:'Cormorant Garamond'";
const a = s.indexOf(startMark), b = s.indexOf(endMark);
if (a < 0 || b < 0) throw new Error('anchors not found');

const css = [
  "",
  "  /* بہمراہ / With is the word that binds the two names, so it is built as an",
  "     actual CHAIN LINK: a gold thread descends from the groom's name, passes",
  "     through a lozenge-flanked medallion carrying the word, and continues down",
  "     to the bride's. The thread is what does the joining; the word rides it. */",
  "  .ic-with{position:relative;display:flex;flex-direction:column;align-items:center;",
  "    width:100%;margin:.9cqw 0;gap:0;background:none;-webkit-text-fill-color:initial}",
  "  .ic-with:before,.ic-with:after{content:'';width:1.4px;height:2.1cqw;",
  "    background:linear-gradient(180deg,rgba(200,162,78,0),rgba(184,137,47,.95))}",
  "  .ic-with:after{background:linear-gradient(180deg,rgba(184,137,47,.95),rgba(200,162,78,0))}",
  "  .ic-with i{position:relative;font-style:normal;display:inline-flex;align-items:center;",
  "    justify-content:center;padding:.5cqw 3.2cqw;border-radius:999px;white-space:nowrap;",
  "    border:1px solid rgba(184,137,47,.55);",
  "    background:radial-gradient(120% 160% at 50% 0%,rgba(253,243,220,.95),rgba(247,232,198,.55));",
  "    box-shadow:inset 0 0 0 3px rgba(253,243,220,.85),0 1px 0 rgba(184,137,47,.28);",
  "    background-clip:padding-box}",
  // the lozenges that clasp the medallion
  "  .ic-with i:before,.ic-with i:after{content:'" + LOZ + "';position:absolute;top:50%;",
  "    transform:translateY(-50%);font-size:1.5cqw;line-height:1;color:#b8892f;",
  "    font-family:Georgia,serif;-webkit-text-fill-color:#b8892f}",
  "  .ic-with i:before{left:-.55cqw}",
  "  .ic-with i:after{right:-.55cqw}",
  // the word itself, in gold
  "  .ic-with i span{background:linear-gradient(180deg,#d8ae57,#9c7526);",
  "    -webkit-background-clip:text;background-clip:text;color:transparent;",
  "    -webkit-text-fill-color:transparent}",
  "  .inv-ur .ic-with{margin:1.3cqw 0}",
  "  .inv-ur .ic-with:before,.inv-ur .ic-with:after{height:2.5cqw}",
  "  .inv-ur .ic-with i{padding:.85cqw 3.4cqw}",
  "  .inv-ur .ic-with i:before,.inv-ur .ic-with i:after{font-size:1.7cqw}",
  ""
].join('\n');

s = s.slice(0, a) + css + s.slice(b);

// the word needs its own span so the medallion and the gold fill don't fight
s = s.replace(
  "'<div class=\"ic-with\"><i>'+esc(d.withWord)+'</i></div>' +",
  "'<div class=\"ic-with\"><i><span>'+esc(d.withWord)+'</span></i></div>' +"
);

fs.writeFileSync(ip, s);
console.log('chain medallion installed:', s.includes('.ic-with i span'));
console.log('word wrapped in span:', s.includes("<i><span>'+esc(d.withWord)"));
