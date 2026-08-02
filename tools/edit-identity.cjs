const fs = require('fs');
const path = require('path');
const p = path.join(__dirname, '..', 'public', 'admin', 'index.html');
let s = fs.readFileSync(p, 'utf8');

/* ---- 1. name + phone fields at the top of the edit dialog ---- */
const anchor = '    <div class="fieldset">\n      <label>Attending</label>';
if (!s.includes(anchor)) throw new Error('edit-dialog anchor missing');
s = s.replace(anchor, [
  '    <div class="fieldset">',
  '      <label>Name</label>',
  '      <input id="em-name-in" placeholder="Full name" style="width:100%">',
  '    </div>',
  '',
  '    <div class="fieldset">',
  '      <label>Phone</label>',
  '      <div style="display:flex;gap:8px">',
  '        <select id="em-cc" style="flex:0 0 auto"></select>',
  '        <input id="em-phone" inputmode="tel" placeholder="000 000 0000" style="flex:1">',
  '      </div>',
  '      <div class="hint">Fixing a number here keeps their response. The guest is matched on the last 10 digits.</div>',
  '    </div>',
  '',
  anchor
].join('\n'));

/* ---- 2. populate + submit them ---- */
s = s.replace(
  "      $('em-name').textContent = r.name;",
  [
    "      $('em-name').textContent = r.name;",
    "      // identity fields — split the stored number back into dial code + local part",
    "      (function(){",
    "        var sel=$('em-cc'), list=window.WalimaDial||[];",
    "        if(sel && !sel.options.length){",
    "          sel.innerHTML = list.map(function(d){ return '<option value=\"'+d[1]+'\">'+d[0]+' '+d[1]+'</option>'; }).join('');",
    "        }",
    "        $('em-name-in').value = r.name || '';",
    "        var digits = String(r.phone||'').replace(/\\D/g,'');",
    "        var best = '';",
    "        list.forEach(function(d){ var c=d[1].replace(/\\D/g,''); if(digits.length>10 && digits.indexOf(c)===0 && c.length>best.length) best=c; });",
    "        if(best){ sel.value='+'+best; $('em-phone').value=digits.slice(best.length); }",
    "        else { sel.value='+1'; $('em-phone').value=digits; }",
    "      })();"
  ].join('\n')
);

s = s.replace(
  "      var body = { guest_id:e.id, attending:att };",
  [
    "      var body = { guest_id:e.id, attending:att };",
    "      var nm=($('em-name-in').value||'').trim();",
    "      var localNo=($('em-phone').value||'').replace(/[^\\d]/g,'');",
    "      if(!nm){ $('em-err').textContent='Name cannot be empty.'; $('em-err').style.display='block'; return; }",
    "      if(!localNo){ $('em-err').textContent='Phone number cannot be empty.'; $('em-err').style.display='block'; return; }",
    "      body.name = nm;",
    "      body.phone = ($('em-cc').value||'+1') + localNo;"
  ].join('\n')
);

/* ---- 3. import: say WHICH rows were incomplete ---- */
s = s.replace(
  "            if(j.invalid) bits.push(j.invalid+' incomplete');",
  [
    "            if(j.invalid) bits.push(j.invalid+' incomplete (skipped)');",
    "            if(j.invalidRows && j.invalidRows.length){",
    "              st.title='Incomplete rows: '+j.invalidRows.join(', ');",
    "              bits.push('hover for which');",
    "            }"
  ].join('\n')
);

fs.writeFileSync(p, s);
console.log('name/phone fields:', s.includes('em-name-in'));
console.log('dial select:', s.includes("$('em-cc')"));
console.log('submits identity:', s.includes('body.phone ='));
console.log('reports invalid rows:', s.includes('invalidRows'));
