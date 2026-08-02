const fs = require('fs');
const path = require('path');
const p = path.join(__dirname, '..', 'public', 'admin', 'index.html');
let s = fs.readFileSync(p, 'utf8');

/* ---------- 1. buttons in the add-guest card ---------- */
const addRowAnchor = '      <div id="add-err" class="err" style="margin-top:10px;display:none"></div>';
if (!s.includes(addRowAnchor)) throw new Error('add-row anchor missing');
s = s.replace(addRowAnchor, [
  '      <div id="add-err" class="err" style="margin-top:10px;display:none"></div>',
  '      <div class="bulk-row">',
  '        <span class="bulk-sep"></span>',
  '        <span class="muted" style="font-size:13px">Or add several at once</span>',
  '        <button onclick="Admin.openTemplate()">Download CSV template</button>',
  '        <button onclick="document.getElementById(\'csv-file\').click()">Import CSV</button>',
  '        <input id="csv-file" type="file" accept=".csv,text/csv" hidden onchange="Admin.importCsv(this)">',
  '        <span id="csv-status" class="muted" style="font-size:13px"></span>',
  '      </div>'
].join('\n'));

/* ---------- 2. template dialog ---------- */
const modalAnchor = '<div id="edit-modal" class="modal" hidden>';
if (!s.includes(modalAnchor)) throw new Error('modal anchor missing');
s = s.replace(modalAnchor, [
  '<div id="tpl-modal" class="modal" hidden>',
  '  <div class="modal-box" style="max-width:420px">',
  '    <h2>Download CSV template</h2>',
  '    <div class="who-sub">A blank sheet with the right columns, ready to fill in.</div>',
  '    <div class="fieldset">',
  '      <label>How many guests are you planning to add?</label>',
  '      <div class="stepper">',
  '        <button onclick="Admin.bumpRows(-5)" aria-label="Five fewer">&minus;</button>',
  '        <input id="tpl-rows" type="number" min="1" max="2000" value="25">',
  '        <button onclick="Admin.bumpRows(5)" aria-label="Five more">+</button>',
  '      </div>',
  '      <div class="hint">You get that many blank rows. Leave the country code blank and it is treated as +1.</div>',
  '    </div>',
  '    <div class="modal-actions">',
  '      <button onclick="Admin.closeTemplate()">Cancel</button>',
  '      <button class="primary" onclick="Admin.downloadTemplate()">Download</button>',
  '    </div>',
  '  </div>',
  '</div>',
  '',
  modalAnchor
].join('\n'));

/* ---------- 3. styles ---------- */
const cssAnchor = '  /* ---- edit-a-response dialog ---- */';
s = s.replace(cssAnchor, [
  '  .bulk-row{display:flex;flex-wrap:wrap;gap:10px;align-items:center;margin-top:16px;padding-top:15px;border-top:1px solid #eee7d8}',
  '  .bulk-sep{flex:0 0 0}',
  cssAnchor
].join('\n'));

/* ---------- 4. behaviour ---------- */
const jsAnchor = '    // ---------- edit a response directly ----------';
if (!s.includes(jsAnchor)) throw new Error('js anchor missing');
s = s.replace(jsAnchor, [
  '    // ---------- CSV template + import ----------',
  '    openTemplate:function(){ $(\'tpl-modal\').hidden=false; },',
  '    closeTemplate:function(){ $(\'tpl-modal\').hidden=true; },',
  '    bumpRows:function(d){ var el=$(\'tpl-rows\'); el.value=Math.max(1,Math.min(2000,(parseInt(el.value,10)||0)+d)); },',
  '    downloadTemplate:function(){',
  '      var n=Math.max(1,Math.min(2000,parseInt($(\'tpl-rows\').value,10)||1));',
  '      var lines=[\'Name,Country Code,Phone Number\'];',
  '      for(var i=0;i<n;i++) lines.push(\',,\');',
  '      // BOM so Excel opens it as UTF-8 and does not mangle names',
  '      var blob=new Blob([\'\\ufeff\'+lines.join(\'\\r\\n\')+\'\\r\\n\'],{type:\'text/csv;charset=utf-8\'});',
  '      var a=document.createElement(\'a\');',
  '      a.href=URL.createObjectURL(blob);',
  '      a.download=\'valima-guests-template-\'+n+\'.csv\';',
  '      document.body.appendChild(a); a.click(); document.body.removeChild(a);',
  '      setTimeout(function(){ URL.revokeObjectURL(a.href); },1000);',
  '      this.closeTemplate();',
  '    },',
  '',
  '    // minimal RFC-4180 reader: handles quoted fields, escaped quotes and CRLF',
  '    _parseCsv:function(text){',
  '      text=text.replace(/^\\ufeff/,\'\');',
  '      var rows=[],row=[],cur=\'\',q=false;',
  '      for(var i=0;i<text.length;i++){',
  '        var c=text[i];',
  '        if(q){',
  '          if(c===\'"\'){ if(text[i+1]===\'"\'){ cur+=\'"\'; i++; } else q=false; }',
  '          else cur+=c;',
  '        } else if(c===\'"\'){ q=true; }',
  '        else if(c===\',\'){ row.push(cur); cur=\'\'; }',
  '        else if(c===\'\\n\'){ row.push(cur); rows.push(row); row=[]; cur=\'\'; }',
  '        else if(c!==\'\\r\'){ cur+=c; }',
  '      }',
  '      if(cur.length||row.length){ row.push(cur); rows.push(row); }',
  '      return rows.filter(function(r){ return r.some(function(v){ return String(v).trim()!==\'\'; }); });',
  '    },',
  '',
  '    importCsv:function(input){',
  '      var file=input.files&&input.files[0]; if(!file) return;',
  '      var st=$(\'csv-status\'); st.textContent=\'Reading…\';',
  '      var reader=new FileReader();',
  '      reader.onload=function(){',
  '        var rows=Admin._parseCsv(String(reader.result||\'\'));',
  '        if(!rows.length){ st.textContent=\'That file was empty.\'; input.value=\'\'; return; }',
  '        // drop a header row if present',
  '        var first=rows[0].map(function(v){ return String(v).toLowerCase().trim(); });',
  '        if(first.join(\',\').indexOf(\'name\')>=0 && first.join(\',\').indexOf(\'phone\')>=0) rows.shift();',
  '        var guests=rows.map(function(r){ return { name:(r[0]||\'\').trim(), cc:(r[1]||\'\').trim(), phone:(r[2]||\'\').trim() }; })',
  '                       .filter(function(g){ return g.name || g.phone; });',
  '        if(!guests.length){ st.textContent=\'No guest rows found.\'; input.value=\'\'; return; }',
  '        st.textContent=\'Importing \'+guests.length+\'…\';',
  '        api(\'/api/admin/import\',{method:\'POST\',body:JSON.stringify({guests:guests})}).then(function(j){',
  '          input.value=\'\';',
  '          if(j&&j.ok){',
  '            var bits=[j.added+\' added\'];',
  '            if(j.skipped) bits.push(j.skipped+\' already on the list\');',
  '            if(j.invalid) bits.push(j.invalid+\' incomplete\');',
  '            st.textContent=bits.join(\' · \');',
  '            Admin.refresh();',
  '            setTimeout(function(){ st.textContent=\'\'; },8000);',
  '          } else { st.textContent=(j&&j.error)||\'Import failed.\'; }',
  '        }).catch(function(){ input.value=\'\'; st.textContent=\'Import failed.\'; });',
  '      };',
  '      reader.readAsText(file);',
  '    },',
  '',
  jsAnchor
].join('\n'));

fs.writeFileSync(p, s);
console.log('buttons:', s.includes('Download CSV template'));
console.log('template modal:', s.includes('tpl-modal'));
console.log('import handler:', s.includes('importCsv:function'));
console.log('csv parser:', s.includes('_parseCsv:function'));
