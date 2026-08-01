/* Wedding envelope — real Three.js scene (r128 globals).
   window.WeddingBook public API used by the DC:
     new WeddingBook({glMount, cssMount, mobile, content, onReady, onRsvp})
     .open(reduced)     start the 1→2→3→4 auto sequence (flap lift → flip → open)
     .extractLetter()   after stage 4: the letter slides out, rotates, grows to fill
     .skip()  .reject()  .setLanguage(l)  .dispose()
     .onFlapOpen        fires at end of stage 4 (letter ready to take out)
     .onOpened          fires when the letter has settled at the camera

   A small LANDSCAPE envelope (matches the 4-stage sketch):
     1  closed sealed envelope — small V-flap, wax seal, M&B.
     2  the flap lifts up (taller silhouette).
     3  the whole letter flips over — the ornate back/interior with the gold emblem.
     4  that face lifts to reveal the interior: gold medallion above, the invitation
        card tucked in the pocket, poking out. Then "tap to take out the letter".
   Built as two authored-upright assemblies (FRONT = closed look, BACK = open
   interior) swapped at the mid-point of a flip, so nothing renders upside-down. */
(function () {
  "use strict";

  /* THE REVEAL — milliseconds from the moment the phone panel dismisses.
     The music starts at 0 (muffled, behind the door). The vocal on the track begins
     at ~4.5s, which is exactly when the doors part — the singing carries you in. */
  /* The gate is already pitch black, so there's no fade-to-black to sit through —
     the plaque can start glowing almost immediately. That shortens the lead-in to
     the doors to 3.85s; the music trims its intro to match (see audio.js). */
  var REVEAL = {
    dark:      250,    // nothing to fade — the hall was never lit
    signStart: 350,    // WALIMA plaque glows up, self-lit, out of total darkness
    signEnd:  2250,
    candle1:  2350,    // BAM. first sconce catches
    candle2:  3150,    // BAM. second sconce — the room appears
    doorOpen: 3850,    // doors part, camera moves in, the vocal lands
    doorEnd:  9200,
    total:   12400
  };
  function easeInOut(t){ return t<0.5 ? 4*t*t*t : 1-Math.pow(-2*t+2,3)/2; }
  function easeOut(t){ return 1-Math.pow(1-t,3); }
  function clamp(v,a,b){ return Math.max(a,Math.min(b,v)); }
  function lerp(a,b,t){ return a+(b-a)*t; }
  function seg(p,a,b){ return clamp((p-a)/(b-a),0,1); }

  function loadTex(url, cb){
    var t=new THREE.TextureLoader().load(url, function(tex){
      tex.anisotropy=8; tex.needsUpdate=true; if(cb) cb(tex);
    });
    t.anisotropy=8; return t;
  }
  function radialSprite(){
    var s=128,c=document.createElement("canvas"); c.width=c.height=s;
    var ctx=c.getContext("2d"), g=ctx.createRadialGradient(s/2,s/2,0,s/2,s/2,s/2);
    g.addColorStop(0,"rgba(255,243,208,1)"); g.addColorStop(0.4,"rgba(255,225,160,0.5)"); g.addColorStop(1,"rgba(255,220,150,0)");
    ctx.fillStyle=g; ctx.fillRect(0,0,s,s);
    return new THREE.CanvasTexture(c);
  }

  // stamped wax seal texture (matte oxblood, pressed rim, embossed monogram)
  function waxTexture(){
    var S=512, c=document.createElement("canvas"); c.width=c.height=S;
    var x=c.getContext("2d"), cx=S/2, cy=S/2;
    var g=x.createRadialGradient(cx-40,cy-50,20,cx,cy,S/2);
    g.addColorStop(0,"#9e2c3b"); g.addColorStop(0.5,"#7c1f2d"); g.addColorStop(1,"#5a1420");
    x.fillStyle=g; x.beginPath(); x.arc(cx,cy,S/2-6,0,7); x.fill();
    for(var i=0;i<26;i++){ var a=i/26*Math.PI*2, rr=S/2-10+Math.sin(i*3.3)*10+Math.random()*8;
      x.fillStyle="rgba(90,20,32,0.55)"; x.beginPath(); x.arc(cx+Math.cos(a)*rr, cy+Math.sin(a)*rr, 10+Math.random()*10,0,7); x.fill(); }
    x.lineWidth=10; x.strokeStyle="rgba(50,12,20,0.55)"; x.beginPath(); x.arc(cx,cy,S*0.34,0,7); x.stroke();
    x.lineWidth=2.5; x.strokeStyle="rgba(210,120,120,0.35)"; x.beginPath(); x.arc(cx,cy,S*0.33,0,7); x.stroke();
    x.textAlign="center"; x.textBaseline="middle";
    x.font="600 "+(S*0.30)+"px 'Cormorant Garamond', Georgia, serif";
    x.fillStyle="rgba(40,8,14,0.5)";  x.fillText("A\u0026B", cx+3, cy+4);
    x.fillStyle="rgba(214,150,150,0.5)"; x.fillText("A\u0026B", cx-2, cy-2);
    x.fillStyle="#6e1a28"; x.fillText("A\u0026B", cx, cy);
    var t=new THREE.CanvasTexture(c); t.anisotropy=8; return t;
  }
  // ---- procedural fine paper: fiber grain (bump) + felt roughness variation, shared across the green stock ----
  var _paperBump=null, _paperRough=null;
  function paperMaps(){
    if(_paperBump) return {bump:_paperBump, rough:_paperRough};
    var S=1024, c=document.createElement("canvas"); c.width=c.height=S; var x=c.getContext("2d");
    // base mid-grey
    x.fillStyle="#808080"; x.fillRect(0,0,S,S);
    var id=x.getImageData(0,0,S,S), d=id.data;
    // fine fiber speckle
    for(var i=0;i<d.length;i+=4){ var n=(Math.random()-0.5)*40; d[i]+=n; d[i+1]+=n; d[i+2]+=n; }
    x.putImageData(id,0,0);
    x.filter="blur(0.9px)"; x.drawImage(c,0,0); x.filter="none";   // soften single-pixel noise -> no shimmer
    // laid lines — faint horizontal + vertical chain of a cotton stock
    x.globalAlpha=0.05; x.strokeStyle="#ffffff";
    for(var yy=0; yy<S; yy+=3){ x.beginPath(); x.moveTo(0,yy+Math.sin(yy*0.3)*0.6); x.lineTo(S,yy); x.stroke(); }
    x.strokeStyle="#000000"; x.globalAlpha=0.03;
    for(var xx=0; xx<S; xx+=6){ x.beginPath(); x.moveTo(xx,0); x.lineTo(xx,S); x.stroke(); }
    // soft cloudy roughness blotches (deckle unevenness)
    x.globalAlpha=1;
    for(var b=0;b<40;b++){ var bx=Math.random()*S, by=Math.random()*S, br=60+Math.random()*160;
      var g=x.createRadialGradient(bx,by,0,bx,by,br);
      g.addColorStop(0,"rgba(255,255,255,0.10)"); g.addColorStop(1,"rgba(255,255,255,0)");
      x.fillStyle=g; x.beginPath(); x.arc(bx,by,br,0,7); x.fill(); }
    _paperBump=new THREE.CanvasTexture(c);
    _paperBump.wrapS=_paperBump.wrapT=THREE.RepeatWrapping; _paperBump.repeat.set(4,3); _paperBump.anisotropy=8;
    _paperBump.minFilter=THREE.LinearMipmapLinearFilter; _paperBump.generateMipmaps=true;
    // roughness map: darker fibers = slightly glossier, felt-like variation
    var rc=document.createElement("canvas"); rc.width=rc.height=S; var rx=rc.getContext("2d");
    rx.drawImage(c,0,0); var rid=rx.getImageData(0,0,S,S), rd=rid.data;
    for(var j=0;j<rd.length;j+=4){ var v=rd[j]; var r=200+(v-128)*0.7; rd[j]=rd[j+1]=rd[j+2]=clamp(r,140,240); }
    rx.putImageData(rid,0,0);
    _paperRough=new THREE.CanvasTexture(rc);
    _paperRough.wrapS=_paperRough.wrapT=THREE.RepeatWrapping; _paperRough.repeat.set(4,3); _paperRough.anisotropy=8;
    return {bump:_paperBump, rough:_paperRough};
  }

  // tinted mottled COLOR map so the tonal fiber variation reads even in flat light
  var _paperColorCache={};
  function paperColor(hex){
    if(_paperColorCache[hex]) return _paperColorCache[hex];
    var S=512, c=document.createElement("canvas"); c.width=c.height=S; var x=c.getContext("2d");
    var col=new THREE.Color(hex);
    x.fillStyle="#"+col.getHexString(); x.fillRect(0,0,S,S);
    var id=x.getImageData(0,0,S,S), d=id.data;
    for(var i=0;i<d.length;i+=4){
      var n=(Math.random()-0.5)*10;                 // subtle per-pixel tonal grain
      d[i]=clamp(d[i]+n,0,255); d[i+1]=clamp(d[i+1]+n,0,255); d[i+2]=clamp(d[i+2]+n,0,255);
    }
    x.putImageData(id,0,0);
    x.filter="blur(0.6px)"; x.drawImage(c,0,0); x.filter="none";   // soften grain so it doesn't crawl
    // very faint light-only clouds for a hand-made stock feel (no dark scuffs)
    for(var b=0;b<14;b++){ var bx=Math.random()*S, by=Math.random()*S, br=60+Math.random()*130;
      var g=x.createRadialGradient(bx,by,0,bx,by,br);
      g.addColorStop(0,"rgba(255,255,255,0.035)"); g.addColorStop(1,"rgba(255,255,255,0)");
      x.fillStyle=g; x.beginPath(); x.arc(bx,by,br,0,7); x.fill(); }
    var t=new THREE.CanvasTexture(c);
    t.wrapS=t.wrapT=THREE.RepeatWrapping; t.repeat.set(2,2); t.anisotropy=8;
    t.minFilter=THREE.LinearMipmapLinearFilter; t.generateMipmaps=true;
    _paperColorCache[hex]=t; return t;
  }

  // ================= procedural PBR room textures (map + derived normal + clearcoat) =================
  var _cvTex={};
  function normFromCv(cv, strength){
    var w=cv.width,h=cv.height, src=cv.getContext("2d").getImageData(0,0,w,h).data;
    var out=document.createElement("canvas"); out.width=w; out.height=h; var oc=out.getContext("2d"); var od=oc.createImageData(w,h), d=od.data;
    function L(x,y){ x=(x+w)%w; y=(y+h)%h; var i=(y*w+x)*4; return (src[i]*0.299+src[i+1]*0.587+src[i+2]*0.114)/255; }
    var s=strength||2.5;
    for(var y=0;y<h;y++) for(var x=0;x<w;x++){
      var dx=(L(x-1,y)-L(x+1,y))*s, dy=(L(x,y-1)-L(x,y+1))*s, len=Math.sqrt(dx*dx+dy*dy+1);
      var i=(y*w+x)*4; d[i]=(dx/len*0.5+0.5)*255; d[i+1]=(dy/len*0.5+0.5)*255; d[i+2]=(1/len*0.5+0.5)*255; d[i+3]=255;
    }
    oc.putImageData(od,0,0); var t=new THREE.CanvasTexture(out); t.wrapS=t.wrapT=THREE.RepeatWrapping; t.anisotropy=8; return t;
  }
  function texPair(key,build,rx,ry,ns){ if(_cvTex[key]) return _cvTex[key];
    var cv=build(); var map=new THREE.CanvasTexture(cv); map.wrapS=map.wrapT=THREE.RepeatWrapping; map.anisotropy=16;
    map.minFilter=THREE.LinearMipmapLinearFilter; map.generateMipmaps=true; map.encoding=THREE.sRGBEncoding;
    var norm=normFromCv(cv,ns); if(rx||ry){ map.repeat.set(rx||1,ry||1); norm.repeat.set(rx||1,ry||1); }
    var p={map:map,normal:norm}; _cvTex[key]=p; return p;
  }
  function _imgCanvas(img){ var c=document.createElement("canvas"); c.width=img.naturalWidth||img.width; c.height=img.naturalHeight||img.height; c.getContext("2d").drawImage(img,0,0); return c; }
  function loadPBR(url,o,apply){ var im=new Image(); im.onload=function(){ var cv=_imgCanvas(im);
      if(o.crop){ var c2=document.createElement("canvas"); c2.width=c2.height=512; c2.getContext("2d").drawImage(cv,o.crop[0]*cv.width,o.crop[1]*cv.height,o.crop[2]*cv.width,o.crop[3]*cv.height,0,0,512,512); cv=c2; }
      if(o.recolor) o.recolor(cv);
      var map=new THREE.CanvasTexture(cv); map.encoding=THREE.sRGBEncoding; map.wrapS=map.wrapT=THREE.RepeatWrapping; map.anisotropy=16; map.minFilter=THREE.LinearMipmapLinearFilter; map.generateMipmaps=true;
      var norm=normFromCv(cv,o.ns||2.5);
      if(o.rx){ map.repeat.set(o.rx,o.ry||o.rx); norm.repeat.set(o.rx,o.ry||o.rx); }
      apply(map,norm); }; im.src=url; }
  function woodImg(url,o){ var m=new THREE.MeshPhysicalMaterial({color:0x6b5334, roughness:o.rough==null?0.5:o.rough, metalness:0, clearcoat:o.cc==null?0.32:o.cc, clearcoatRoughness:0.42, envMapIntensity:0.9});
    loadPBR(url,{rx:o.rx,ry:o.ry,ns:o.ns||2.5,crop:o.crop},function(map,norm){ m.map=map; m.color.set(o.tint||0xffffff); m.normalMap=norm; var k=o.nsc==null?0.8:o.nsc; m.normalScale=new THREE.Vector2(k,k); m.needsUpdate=true; }); return m; }
  function paperImg(){ var m=new THREE.MeshPhysicalMaterial({color:0xece3cd, roughness:0.95, metalness:0, side:THREE.DoubleSide, envMapIntensity:0.06});
    loadPBR("./assets/tex/paper_diff.jpg",{rx:1,ry:1,ns:1.2},function(map,norm){ m.map=map; m.color.set(0xf1e8d2); m.normalMap=norm; m.normalScale=new THREE.Vector2(0.4,0.4); m.needsUpdate=true; }); return m; }
  function wallImg(){ var m=new THREE.MeshPhysicalMaterial({color:0x18241c, roughness:0.82, metalness:0, clearcoat:0.08, clearcoatRoughness:0.7, envMapIntensity:0.2});
    loadPBR("./assets/tex/wall_diff.jpg",{rx:5,ry:4,ns:1.3,recolor:function(cv){ var x=cv.getContext("2d"),w=cv.width,h=cv.height,id=x.getImageData(0,0,w,h),d=id.data; var bg=[18,34,26],gold=[196,158,74];
        for(var i=0;i<d.length;i+=4){ var l=(d[i]*0.299+d[i+1]*0.587+d[i+2]*0.114)/255,t=Math.min(1,Math.max(0,(l-0.5)/0.45)); d[i]=bg[0]+(gold[0]-bg[0])*t; d[i+1]=bg[1]+(gold[1]-bg[1])*t; d[i+2]=bg[2]+(gold[2]-bg[2])*t; } x.putImageData(id,0,0); }},
      function(map,norm){ m.map=map; m.color.set(0xffffff); m.normalMap=norm; m.normalScale=new THREE.Vector2(0.5,0.5); m.needsUpdate=true; }); return m; }
  function bookImg(){ var m=new THREE.MeshPhysicalMaterial({color:0x5a3a26, roughness:0.5, metalness:0, clearcoat:0.22, clearcoatRoughness:0.5, envMapIntensity:0.45});
    loadPBR("./assets/tex/book_cover_diff.png",{crop:[0.02,0.28,0.34,0.34],rx:1,ry:1,ns:2.0},function(map,norm){ m.map=map; m.color.set(0xffffff); m.normalMap=norm; m.normalScale=new THREE.Vector2(0.6,0.6); m.needsUpdate=true; }); return m; }

  function woodCv(base,dk,lt,vertical){
    var S=1024,c=document.createElement("canvas"); c.width=c.height=S; var x=c.getContext("2d");
    x.fillStyle=base; x.fillRect(0,0,S,S);
    for(var bnd=0;bnd<12;bnd++){ var bp=Math.random()*S; var g=vertical?x.createLinearGradient(bp-50,0,bp+50,0):x.createLinearGradient(0,bp-50,0,bp+50);
      g.addColorStop(0,"rgba(0,0,0,0)"); g.addColorStop(0.5, Math.random()<0.5?"rgba(0,0,0,0.11)":"rgba(255,238,214,0.06)"); g.addColorStop(1,"rgba(0,0,0,0)");
      x.fillStyle=g; x.fillRect(0,0,S,S); }
    for(var i=0;i<1000;i++){ var pos=Math.random()*S; x.strokeStyle=Math.random()<0.5?dk:lt; x.globalAlpha=0.03+Math.random()*0.1; x.lineWidth=0.4+Math.random()*1.7; var wob=6+Math.random()*10; x.beginPath();
      if(vertical){ x.moveTo(pos,0); for(var y=0;y<=S;y+=14) x.lineTo(pos+Math.sin((y+pos)*0.012)*wob,y); }
      else { x.moveTo(0,pos); for(var xp=0;xp<=S;xp+=14) x.lineTo(xp,pos+Math.sin((xp+pos)*0.012)*wob); }
      x.stroke(); }
    x.globalAlpha=0.055; x.strokeStyle=dk;                  // cathedral figure
    for(var a=0;a<16;a++){ x.lineWidth=1+Math.random(); x.beginPath(); if(vertical) x.ellipse(S*0.5,S*0.5,26+a*20,110+a*30,0,0,7); else x.ellipse(S*0.5,S*0.5,110+a*30,26+a*20,0,0,7); x.stroke(); }
    for(var k=0;k<2;k++){ var kx=Math.random()*S,ky=Math.random()*S; for(var rr=22;rr>0;rr-=2){ x.strokeStyle=dk; x.globalAlpha=0.06; x.lineWidth=1.3; x.beginPath(); x.ellipse(kx,ky,rr,rr*0.5,0,0,7); x.stroke(); } }
    x.globalAlpha=1; return c;
  }
  function woodMat(o){ var p=texPair(o.key,function(){return woodCv(o.base,o.dk,o.lt,o.vertical);},o.rx,o.ry,o.ns||3.0);
    var m=new THREE.MeshPhysicalMaterial({map:p.map, normalMap:p.normal, roughness:o.rough==null?0.52:o.rough, metalness:o.metal||0.0,
      clearcoat:o.cc==null?0.35:o.cc, clearcoatRoughness:0.42, envMapIntensity:0.95});
    var k=o.nsc==null?0.9:o.nsc; m.normalScale=new THREE.Vector2(k,k); return m; }
  function wallpaperMat(){
    var p=texPair("walldamask",function(){
      var S=1024, cell=256;                                   // 4x4 seamless cells; flat ground => tiles in both axes
      var c=document.createElement("canvas"); c.width=c.height=S; var x=c.getContext("2d");
      x.fillStyle="#2b1c0d"; x.fillRect(0,0,S,S);
      function petal(cx,cy,rot,sc,col){ x.save(); x.translate(cx,cy); x.rotate(rot); x.scale(sc,sc); x.fillStyle=col;
        x.beginPath(); x.moveTo(0,0); x.bezierCurveTo(6,-5,7,-15,0,-21); x.bezierCurveTo(-7,-15,-6,-5,0,0); x.fill(); x.restore(); }
      function flower(cx,cy,col){ for(var k=0;k<5;k++) petal(cx,cy,k*(Math.PI*2/5),0.5,col); }
      function motif(ox,oy){ var sx=cell/110, sy=cell/150; x.save(); x.translate(ox,oy); x.scale(sx,sy);
        function stem(off,w,col){ x.strokeStyle=col; x.lineWidth=w; x.beginPath();
          x.moveTo(55+off,4); x.bezierCurveTo(36+off,8,10+off,46,7+off,75); x.bezierCurveTo(10+off,104,36+off,142,55+off,146);
          x.bezierCurveTo(74+off,142,100+off,104,103+off,75); x.bezierCurveTo(100+off,46,74+off,8,55+off,4); x.stroke(); }
        stem(1.4,9,"#170d07"); stem(0,8,"#3d2614"); stem(-1.2,3,"#66492a");   // lattice: shadow/body/edge, tone-on-tone
        x.fillStyle="#170d07"; x.beginPath(); x.ellipse(56.2,91,17,21,0,0,7); x.fill();
        x.fillStyle="#3d2614"; x.beginPath(); x.ellipse(55,90,17,21,0,0,7); x.fill();
        x.fillStyle="#66492a"; x.beginPath(); x.ellipse(53.6,88.6,15,18,0,0,7); x.fill();
        x.fillStyle="#2e1e10"; [[52,104],[57,106],[54,110]].forEach(function(s){ x.beginPath(); x.arc(s[0],s[1],1.6,0,7); x.fill(); });
        x.strokeStyle="#3d2614"; x.lineWidth=3; x.beginPath(); x.moveTo(55,6); x.lineTo(55,144); x.stroke();  // through-stem
        petal(55,66,0,0.7,"#3d2614");                                          // crown leaf
        flower(0,0,"#3d2614"); flower(110,0,"#3d2614"); flower(0,150,"#3d2614"); flower(110,150,"#3d2614");   // node flowers
        x.restore();
      }
      for(var iy=-1;iy<=4;iy++) for(var ix=-1;ix<=4;ix++) motif(ix*cell,iy*cell);   // wrap-ring => seamless
      return c;
    }, 24, 8.4, 1.1);                                       // was 6 × 2.1; ×4 → ~8 motifs across the visible wall. ry scaled by same factor to keep motif square
    var m=new THREE.MeshPhysicalMaterial({map:p.map, normalMap:p.normal, roughness:0.86, metalness:0.0, clearcoat:0.08, clearcoatRoughness:0.7, envMapIntensity:0.18});
    m.normalScale=new THREE.Vector2(0.35,0.35); return m; }
  function letterMat(){ var p=texPair("letter",function(){
      var S=1024,c=document.createElement("canvas"); c.width=c.height=S; var x=c.getContext("2d");
      x.fillStyle="#efe6cf"; x.fillRect(0,0,S,S);
      for(var i=0;i<42000;i++){ x.fillStyle="rgba("+(200+(Math.random()*40|0))+","+(190+(Math.random()*40|0))+","+(160+(Math.random()*40|0))+",0.05)"; x.fillRect(Math.random()*S,Math.random()*S,1.5,1.5); }
      for(var b=0;b<28;b++){ var bx=Math.random()*S,by=Math.random()*S,br=30+Math.random()*120; var gg=x.createRadialGradient(bx,by,0,bx,by,br); gg.addColorStop(0,"rgba(150,120,70,0.05)"); gg.addColorStop(1,"rgba(150,120,70,0)"); x.fillStyle=gg; x.beginPath(); x.arc(bx,by,br,0,7); x.fill(); }
      var vg=x.createRadialGradient(S/2,S/2,S*0.32,S/2,S/2,S*0.72); vg.addColorStop(0,"rgba(0,0,0,0)"); vg.addColorStop(1,"rgba(80,60,30,0.14)"); x.fillStyle=vg; x.fillRect(0,0,S,S);
      x.strokeStyle="rgba(64,44,24,0.6)"; x.lineWidth=5; x.beginPath(); x.moveTo(240,150); for(var xp=240;xp<=780;xp+=10) x.lineTo(xp,150+Math.sin(xp*0.07)*10); x.stroke();
      x.lineWidth=2.3;
      for(var ln=0;ln<16;ln++){ var yb=250+ln*44; x.strokeStyle="rgba(54,40,24,0.5)"; var started=false; x.beginPath();
        for(var xp2=160;xp2<=860;xp2+=8){ if(Math.random()<0.05){ x.stroke(); x.beginPath(); started=false; continue; } var yy2=yb+Math.sin(xp2*0.28+ln)*6+(Math.random()-0.5)*4; if(!started){x.moveTo(xp2,yy2);started=true;} else x.lineTo(xp2,yy2); } x.stroke(); }
      return c; },1,1,1.0);
    var m=new THREE.MeshPhysicalMaterial({map:p.map, normalMap:p.normal, roughness:0.95, metalness:0.0, side:THREE.DoubleSide, envMapIntensity:0.06});
    m.normalScale=new THREE.Vector2(0.3,0.3); return m; }
  function bookMat(hex){ var p=texPair("book"+hex,function(){
      var S=256,c=document.createElement("canvas"); c.width=c.height=S; var x=c.getContext("2d");
      x.fillStyle=hex; x.fillRect(0,0,S,S);
      for(var i=0;i<2600;i++){ x.fillStyle="rgba(0,0,0,"+(Math.random()*0.06)+")"; x.beginPath(); x.arc(Math.random()*S,Math.random()*S,1+Math.random()*2.4,0,7); x.fill(); }
      var g=x.createLinearGradient(0,0,S,0); g.addColorStop(0,"rgba(0,0,0,0.4)"); g.addColorStop(0.12,"rgba(0,0,0,0)"); g.addColorStop(1,"rgba(0,0,0,0)"); x.fillStyle=g; x.fillRect(0,0,S,S);  // darker at the spine joint
      return c; },1,1,1.4);
    var col=new THREE.Color(hex);
    var m=new THREE.MeshStandardMaterial({map:p.map, normalMap:p.normal, roughness:0.62, metalness:0.0, emissive:col.clone().multiplyScalar(0.14), emissiveIntensity:1.0, envMapIntensity:0.3});
    m.normalScale=new THREE.Vector2(0.5,0.5); return m; }
  // flat cream page block — no texture, no stripes (cheap)
  var _creamMat=null;
  function creamMat(){ if(_creamMat) return _creamMat; _creamMat=new THREE.MeshStandardMaterial({color:0xa8946a, roughness:0.92, metalness:0.0, envMapIntensity:0.04, emissive:0x0c0a06, emissiveIntensity:1.0}); return _creamMat; }
  var _giltBookMat=null;
  function giltBookMat(){ if(_giltBookMat) return _giltBookMat; _giltBookMat=new THREE.MeshStandardMaterial({color:0xcaa04a, roughness:0.4, metalness:0.6, envMapIntensity:0.9, emissive:0x2a1e08, emissiveIntensity:1.0}); return _giltBookMat; }
  // ONE cheap book. Coloured cover box (all faces). A cream page block sits ONLY at the fore-edge (+z),
  // recessed so the cover overhangs it top/bottom/sides (clear coloured bands). Gilt bands on the spine (-z).
  // Shelf books rotate π so the coloured/gilt spine faces the room; desk-stack books keep the fore-edge to camera.
  function makeBook(w,h,d,hex,gilt){
    var g=new THREE.Group();
    g.add(new THREE.Mesh(new THREE.BoxGeometry(w,h,d), bookMat(hex)));           // solid coloured cover
    var cream=new THREE.Mesh(new THREE.BoxGeometry(w-0.08,h-0.14,0.06), creamMat());
    cream.position.z=d/2-0.02; g.add(cream);                                     // cream pages at the fore-edge only, cover overhangs it
    if(gilt){ for(var b=-1;b<=1;b++){ var band=new THREE.Mesh(new THREE.BoxGeometry(w+0.008,h*0.05,0.05), giltBookMat()); band.position.set(0,b*h*0.28,-d/2+0.01); g.add(band); } }
    return g;
  }
  // ruffled cream page-edge material: fine horizontal striations (individual leaves)
  var _pageEdgeMat=null;
  function pageEdgeMat(){ if(_pageEdgeMat) return _pageEdgeMat;
      // FLAT cream page block — no fine repeating lines (they were the moiré source, and were never
      // legible at this on-screen size). Just a gentle vertical gradient + a darker line where the
      // pages meet the cover along the top edge.
      var S=128,c=document.createElement("canvas"); c.width=c.height=S; var x=c.getContext("2d");
      var g=x.createLinearGradient(0,0,0,S); g.addColorStop(0,"#d8c8a0"); g.addColorStop(0.5,"#ccbb92"); g.addColorStop(1,"#bda880");
      x.fillStyle=g; x.fillRect(0,0,S,S);
      x.fillStyle="rgba(60,44,24,0.38)"; x.fillRect(0,0,S,3);                  // shadow line at the cover join (top edge)
      var t=new THREE.CanvasTexture(c); t.anisotropy=8; t.minFilter=THREE.LinearFilter; t.magFilter=THREE.LinearFilter; t.generateMipmaps=false;
    _pageEdgeMat=new THREE.MeshStandardMaterial({map:t, color:0xd8c8a0, roughness:0.88, metalness:0.0, envMapIntensity:0.1});
    return _pageEdgeMat; }

  function makeWax(scale){
    var g=new THREE.Group();
    var waxMat=new THREE.MeshPhysicalMaterial({ map:waxTexture(), color:0xffffff, roughness:0.6, metalness:0.0,
      clearcoat:0.3, clearcoatRoughness:0.4, envMapIntensity:0.35, emissive:0x230208, emissiveIntensity:0.14 });
    var disc=new THREE.Mesh(new THREE.CylinderGeometry(0.16,0.175,0.05,40,1),
      [ new THREE.MeshStandardMaterial({color:0x5a1420,roughness:0.62}), waxMat,
        new THREE.MeshStandardMaterial({color:0x4a0f1a,roughness:0.7}) ]);
    var dp=disc.geometry.attributes.position;
    for(var i=0;i<dp.count;i++){ var vx=dp.getX(i), vz=dp.getZ(i), rr=Math.hypot(vx,vz);
      if(rr>0.09){ var a=Math.atan2(vz,vx), n=1+Math.sin(a*7)*0.06+Math.sin(a*13)*0.03; dp.setX(i,vx*n); dp.setZ(i,vz*n); } }
    disc.geometry.computeVertexNormals();
    disc.rotation.x=Math.PI/2; disc.castShadow=true; disc.receiveShadow=true;
    g.add(disc); if(scale) g.scale.setScalar(scale); return g;
  }

  // ---------- constants (small LANDSCAPE envelope) ----------
  var PW=2.30, PH=1.46;              // pocket body width / height
  var HW=PW/2, HH=PH/2;
  var FF=0.86;                       // front V-flap length (folds to centre)
  var FB=1.52;                       // interior flap length — apex (wax) reaches below the body when folded
  var OPEN_ANGLE=-2.85;              // interior shield-flap lift (stage 4) — stands up, wax travels to the top
  var LIFT_ANGLE=-2.85;              // front flap lift (stage 2) — stands ~85° up, slight forward tilt

  function triGeo(a,b,c){ var g=new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(new Float32Array([a[0],a[1],0,b[0],b[1],0,c[0],c[1],0]),3));
    g.setAttribute("uv", new THREE.BufferAttribute(new Float32Array([
      a[0]*0.4+0.5,a[1]*0.4+0.5, b[0]*0.4+0.5,b[1]*0.4+0.5, c[0]*0.4+0.5,c[1]*0.4+0.5]),2));
    g.setIndex([0,1,2]); g.computeVertexNormals(); return g; }

  function WeddingBook(opts){
    this.glMount=opts.glMount; this.cssMount=opts.cssMount;
    this.content=opts.content||{}; this.mobile=!!opts.mobile;
    this.onReady=opts.onReady||function(){}; this.onRsvp=opts.onRsvp||function(){};
    this.onOpened=null; this.onFlapOpen=null;
    this.phase="portal";              // portal | intro | await | seq | hold | extract | done
    this.onIntroDone=null;
    this.pA=0; this.pB=0; this.reduced=false; this.settled=false;
    this._raf=0; this._t0=performance.now(); this._fade=[];
    this._init();
  }

  WeddingBook.prototype._init=function(){
    var W=this.glMount.clientWidth||window.innerWidth, H=this.glMount.clientHeight||window.innerHeight;
    this._qual=0.27;   // gate renders at ~27% internal res (browser upscales = a near-free blur; ramped to 1 on intro)
    var scene=this.scene=new THREE.Scene();
    scene.background=new THREE.Color(0x0a0704);
    scene.fog=new THREE.FogExp2(0x090603, 0.03);

    var cam=this.cam=new THREE.PerspectiveCamera(34, W/H, 0.1, 100);
    cam.position.set(0, 0.06, 4.7);

    var r=this.renderer=new THREE.WebGLRenderer({antialias:!this.mobile, alpha:true});
    r.setPixelRatio(Math.min(window.devicePixelRatio, this.mobile?1.5:2));
    r.setSize(W,H);
    r.shadowMap.enabled=true; r.shadowMap.type=THREE.PCFSoftShadowMap;
    r.outputEncoding=THREE.sRGBEncoding;
    r.toneMapping=THREE.ACESFilmicToneMapping; r.toneMappingExposure=0.82;
    r.physicallyCorrectLights=true;
    this.glMount.appendChild(r.domElement);
    try{ var pmrem=new THREE.PMREMGenerator(r); this.envRT=pmrem.fromScene(new THREE.RoomEnvironment(),0.04); scene.environment=this.envRT.texture; }catch(e){}

    this._lights(); this._build(); this._buildRoom(); this._buildGlow();

    try{
      var comp=this.composer=new THREE.EffectComposer(r);
      comp.addPass(new THREE.RenderPass(scene,cam));
      var bloom=this.bloom=new THREE.UnrealBloomPass(new THREE.Vector2(W,H), 0.85, 0.7, 0.85);
      bloom.strength=0.22; comp.addPass(bloom);
      // radial (zoom) blur — strength driven by camera speed; centre stays sharp
      var radialShader={
        uniforms:{ tDiffuse:{value:null}, strength:{value:0.0}, center:{value:new THREE.Vector2(0.5,0.5)} },
        vertexShader:"varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }",
        fragmentShader:"uniform sampler2D tDiffuse; uniform float strength; uniform vec2 center; varying vec2 vUv;"+
          "void main(){ vec2 dir=vUv-center; float d=length(dir); vec4 sum=vec4(0.0); float w=0.0;"+
          "for(int i=0;i<8;i++){ float s=1.0 - strength*d*(float(i)/7.0); sum+=texture2D(tDiffuse, center+dir*s); w+=1.0; }"+
          "gl_FragColor=sum/w; }"
      };
      var radial=this.radialPass=new THREE.ShaderPass(radialShader); radial.renderToScreen=true; comp.addPass(radial);
    }catch(e){ this.composer=null; }

    var self=this;
    this._onResize=function(){ self._resize(); }; window.addEventListener("resize",this._onResize);
    this._resize();
    this.onReady();
    this._loop=function(){ self._frame(); self._raf=requestAnimationFrame(self._loop); }; this._loop();
  };

  WeddingBook.prototype._lights=function(){
    var s=this.scene;
    s.add(new THREE.AmbientLight(0x453422, 0.9));   // raised warm ambient — no surface reads as absent geometry (candles still dominate the desk)
    this.ambient=s.children[s.children.length-1];
    var key=this.key=new THREE.DirectionalLight(0xffdca8, 1.45);
    key.position.set(-2.6,3.8,4.6); key.castShadow=false;   // only the primary candle casts shadows (perf: one shadow map) s.add(key);
    var rim=new THREE.DirectionalLight(0x5a8a76, 0.4); rim.position.set(3.0,1.8,-3.0); s.add(rim);
    var top=this.top=new THREE.DirectionalLight(0xfff0d6, 0.6); top.position.set(0.2,3.0,5.0); s.add(top);
    var fill=this.fill=new THREE.PointLight(0xffe0b0, 1.7, 18, 2.0); fill.position.set(0,0.8,3.4); s.add(fill);
    var faceFill=this.faceFill=new THREE.DirectionalLight(0xfff2da, 0.42); faceFill.position.set(-3.2,3.4,7); s.add(faceFill);  // dim hall wash on the door fronts (keeps hallway dark)
    var upFill=new THREE.PointLight(0x9fe0c4, 0.75, 14, 2.0); upFill.position.set(0,-1.0,3.6); s.add(upFill);
    /* These are the lights that make the hall visible at all. They are held at ZERO
       until the candles are struck, so the gate is genuine darkness — the guest sees
       nothing but the entry panel and has no idea a room is waiting. _setRoomLight()
       brings them up on the candle beat. */
    this._roomLights=[{l:rim,b:0.4},{l:top,b:0.6},{l:fill,b:1.7},{l:faceFill,b:0.42},{l:upFill,b:0.75}];
    this._roomLightF=null;
    var interior=this.interior=new THREE.PointLight(0xffd9a0, 0.0, 5.0, 2.2);
    interior.position.set(0,0.2,0.3); s.add(interior);
    // dedicated camera-side warm fill for the LETTER sequence: keeps whichever face is toward the
    // viewer lit through the flip. Fades in as the sequence begins, out (to a low hold) once settled.
    var letterFill=this.letterFill=new THREE.DirectionalLight(0xffe8c6, 0.0); letterFill.position.set(0.4,1.0,6.5); s.add(letterFill); s.add(letterFill.target);
  };

  /* f = 0 pitch black hall, 1 fully lit. Cheap: only writes when it actually changes. */
  WeddingBook.prototype._setRoomLight=function(f){
    if(!this._roomLights || this._roomLightF===f) return;
    this._roomLightF=f;
    for(var i=0;i<this._roomLights.length;i++){ var R=this._roomLights[i]; R.l.intensity=R.b*f; }
    // The image-based environment lights every PBR material on its own, independently of
    // any Light in the scene — leaving it on kept the hall softly visible with all the
    // lamps at zero. Detach it while we want true black, reattach as the candles come up.
    if(this.scene && this.envRT){
      var want = f>0.004 ? this.envRT.texture : null;
      if(this.scene.environment !== want) this.scene.environment = want;
    }
  };

  WeddingBook.prototype._green=function(shade){
    var pm=paperMaps();
    var m=new THREE.MeshPhysicalMaterial({ color:0xffffff, map:paperColor(shade||0x073028), roughness:1.0, metalness:0.0,
      clearcoat:0.0, reflectivity:0.0, envMapIntensity:0.03, emissive:0x041a15, emissiveIntensity:0.12,
      side:THREE.DoubleSide });
    m.bumpMap=pm.bump; m.bumpScale=0.015;
    m.roughnessMap=pm.rough;
    return m;
  };

  WeddingBook.prototype._build=function(){
    var scene=this.scene, self=this;
    this.gold=new THREE.MeshStandardMaterial({ color:0xE8C87E, metalness:1.0, roughness:0.32, envMapIntensity:1.7, emissive:0x241804, emissiveIntensity:0.22 });
    function goldBar(x1,y1,x2,y2,parent,z){ var dx=x2-x1,dy=y2-y1,len=Math.hypot(dx,dy);
      var bar=new THREE.Mesh(new THREE.BoxGeometry(len,0.013,0.013), self.gold);
      bar.position.set((x1+x2)/2,(y1+y2)/2,(z==null?0.004:z)); bar.rotation.z=Math.atan2(dy,dx);
      parent.add(bar); return bar; }

    var env=this.env=new THREE.Group(); scene.add(env);

    // ============ FRONT assembly (stages 1–2): the sealed envelope front ============
    var front=this.front=new THREE.Group(); env.add(front);
    var fBody=new THREE.Mesh(new THREE.PlaneGeometry(PW,PH), this._green(0x04211b));
    fBody.receiveShadow=true; front.add(fBody);
    // subtle diagonal seams to the centre (envelope-front look)
    goldBar(-HW,-HH,0,-HH*0.05,front,0.006); goldBar(HW,-HH,0,-HH*0.05,front,0.006);
    // small top V-flap: hinged at top edge, apex down to centre, wax + M&B
    var fFlapPivot=this.fFlapPivot=new THREE.Group(); fFlapPivot.position.set(0,HH,0.02); front.add(fFlapPivot);
    var fFlap=new THREE.Mesh(triGeo([-HW,0],[HW,0],[0,-FF]), this._green(0x083128));
    fFlap.castShadow=true; fFlap.receiveShadow=true; fFlapPivot.add(fFlap);
    goldBar(-HW,0,0,-FF,fFlapPivot,0.004); goldBar(HW,0,0,-FF,fFlapPivot,0.004);
    // M&B monogram just above the flap point
    var mono=this._monogram(); var mg=new THREE.Mesh(new THREE.PlaneGeometry(0.5,0.28),
      new THREE.MeshBasicMaterial({map:mono,transparent:true,depthWrite:false}));
    mg.position.set(0,-FF*0.62,0.006); fFlapPivot.add(mg);
    // wax at the flap tip (stays attached the whole time)
    var fWax=makeWax(1.0); fWax.position.set(0,-FF,0.03); fFlapPivot.add(fWax);
    this._fFade=[fBody,fFlap];

    // ============ BACK assembly (stages 3–4): the open ornate interior ============
    // authored upright; pre-rotated PI about X so that after the env flip (env.rot.x→PI)
    // it lands perfectly upright and facing the camera.
    var back=this.back=new THREE.Group(); back.rotation.x=Math.PI; back.position.z=-0.004; env.add(back);
    back.visible=false;
    var bWall=new THREE.Mesh(new THREE.PlaneGeometry(PW,PH), this._green(0x073028));
    bWall.receiveShadow=true; back.add(bWall);                 // the FLAT back of the envelope (no fold lines)
    // the invitation card, tucked in the pocket, poking out the top
    var cardMat=new THREE.MeshStandardMaterial({ color:0xffffff, roughness:0.62, metalness:0.0, envMapIntensity:0.35 });
    this._cardMat=cardMat;
    var self0=this;
    function applyCardTex(){
      var t = (self0._lang==="ur" ? self0._cardTexUr : self0._cardTexEn);
      if(!t) return;
      cardMat.map=t; cardMat.emissiveMap=t; cardMat.emissive.set(0xffffff); cardMat.emissiveIntensity=0.42;
      cardMat.needsUpdate=true;
    }
    this._applyCardTex=applyCardTex;
    /* The card that slides out of the envelope is the SAME rose artwork as the
       full-screen invitation, with the wording drawn onto it here at runtime.
       Baking it in the browser (rather than shipping a second pair of flattened
       JPEGs) means the 3D card and the DOM card can never drift apart, and both
       languages come from one source of truth in content.js. */
    var CARD_ART="./assets/card-pink.jpg";
    function bakeCard(lang, cb){
      var img=new Image();
      img.onload=function(){
        var W=img.naturalWidth||1023, H=img.naturalHeight||1557;
        var c=document.createElement("canvas"); c.width=W; c.height=H;
        var x=c.getContext("2d");
        x.drawImage(img,0,0,W,H);
        var d=(self0.content && self0.content[lang]) || null;
        if(d) drawCardText(x, W, H, d, lang);
        var t=new THREE.CanvasTexture(c);
        t.anisotropy=16; t.needsUpdate=true;
        if(THREE.sRGBEncoding) t.encoding=THREE.sRGBEncoding;
        cb(t);
      };
      img.onerror=function(){ cb(null); };
      img.src=CARD_ART;
    }
    // Panel measured off the artwork: 16.1%-74.6% vertical, 26.3%-73.1% horizontal.
    // Text is laid inside an inset of that so it never meets the arch or the gold.
    function drawCardText(x, W, H, d, lang){
      var ur = (lang==="ur");
      var L=W*(ur?0.268:0.29), R=W*(1-(ur?0.268:0.29)), T=H*(ur?0.19:0.21), B=H*(ur?0.745:0.72);
      var cx=(L+R)/2, colW=R-L;
      var serif = ur ? "'Noto Nastaliq Urdu', serif" : "'Cormorant Garamond', Georgia, serif";
      var body  = ur ? "'Noto Nastaliq Urdu', serif" : "'EB Garamond', Georgia, serif";
      var u=W/1023;   // scale factor relative to the reference artwork
      x.textAlign="center"; x.textBaseline="alphabetic";
      x.direction = ur ? "rtl" : "ltr";

      // wrap helper — returns the y after drawing
      function lines(text, font, fill, size, lh, y, maxW){
        x.font=font; x.fillStyle=fill;
        var words=String(text||"").split(/\s+/), out=[], cur="";
        for(var i=0;i<words.length;i++){
          var trial=cur?cur+" "+words[i]:words[i];
          if(x.measureText(trial).width>maxW && cur){ out.push(cur); cur=words[i]; }
          else cur=trial;
        }
        if(cur) out.push(cur);
        for(var j=0;j<out.length;j++){ x.fillText(out[j], cx, y); y+=size*lh; }
        return y;
      }

      var y=T+ (ur?40:30)*u;
      // bismillah
      y=lines("بِسْمِ اللّٰہِ الرَّحْمٰنِ الرَّحِیْمِ",
        ((ur?28:22)*u)+"px 'Noto Nastaliq Urdu','Amiri',serif", "#a97f2c", (ur?28:22)*u, 1.7, y, colW);
      y+=10*u;
      y=lines(d.invite, (ur?"":"italic ")+((ur?25:19)*u)+"px "+body, "#5f4630", (ur?25:19)*u, ur?1.85:1.42, y, colW);
      y+=16*u;
      x.font=(20*u)+"px Georgia,serif"; x.fillStyle="#b8892f";
      x.fillText("❦ ❧ ❦", cx, y); y+=30*u;
      y=lines(d.groom, (ur?"":"600 ")+((ur?47:40)*u)+"px "+serif, "#7C2A38", (ur?47:40)*u, ur?1.5:1.1, y, colW);
      y+=4*u;
      y=lines(d.groomParent, (ur?"":"italic ")+((ur?23:17)*u)+"px "+body, "#6a4f2c", (ur?23:17)*u, ur?1.7:1.3, y, colW);
      y+=10*u;
      y=lines(d.withWord, (ur?"":"italic 600 ")+((ur?30:24)*u)+"px "+serif, "#9c7526", (ur?30:24)*u, ur?1.5:1.2, y, colW);
      y+=6*u;
      y=lines(d.bride, (ur?"":"600 ")+((ur?47:40)*u)+"px "+serif, "#7C2A38", (ur?47:40)*u, ur?1.5:1.1, y, colW);
      y+=4*u;
      y=lines(d.brideParent, (ur?"":"italic ")+((ur?23:17)*u)+"px "+body, "#6a4f2c", (ur?23:17)*u, ur?1.7:1.3, y, colW);
      y+=22*u;
      // rule with a small ornament
      x.strokeStyle="#c8a24e"; x.lineWidth=Math.max(1,1*u);
      x.beginPath(); x.moveTo(cx-colW*0.22,y); x.lineTo(cx+colW*0.22,y); x.stroke();
      x.font=(17*u)+"px Georgia,serif"; x.fillStyle="#fdf3dc";
      x.fillText(" ❦ ", cx, y+6*u);
      x.fillStyle="#b8892f"; x.fillText("❦", cx, y+6*u);
      y+=34*u;
      y=lines(d.date, ((ur?26:20)*u)+"px "+body, "#3A2A16", (ur?26:20)*u, ur?1.6:1.4, y, colW);
      y+=10*u;
      y=lines(d.venue, ((ur?35:27)*u)+"px "+serif, "#2e2010", (ur?35:27)*u, ur?1.45:1.15, y, colW);
      y+=4*u;
      lines(d.venueLoc, ((ur?24:19)*u)+"px "+body, "#6a4f2c", (ur?24:19)*u, ur?1.6:1.35, y, colW);
    }
    function bakeBoth(){
      bakeCard("en", function(t){ if(t){ self0._cardTexEn=t; applyCardTex(); } });
      bakeCard("ur", function(t){ if(t){ self0._cardTexUr=t; applyCardTex(); } });
    }
    // wait for the webfonts, otherwise the canvas bakes in a fallback face
    if(document.fonts && document.fonts.ready) document.fonts.ready.then(bakeBoth).catch(bakeBoth);
    else bakeBoth();
    var edge=new THREE.MeshStandardMaterial({ color:0x8e1c3e, roughness:0.8 });
    var CH=1.30, CW=CH*(1023/1557);   // match the rose artwork's proportions
    var card=this.card=new THREE.Mesh(new THREE.BoxGeometry(CW,CH,0.02),[edge,edge,edge,edge,cardMat,edge]);
    card.castShadow=true; card.receiveShadow=true;
    this._cardHomeY = 0.0;                          // hidden fully BEHIND the decorated front paper
    card.position.set(0, this._cardHomeY, 0.03);
    back.add(card);
    // front pocket flaps of the OPEN envelope (only appear at stage 4) — grouped so they hide cleanly in stage 3
    var pocketGrp=this._pocketGrp=new THREE.Group(); back.add(pocketGrp);
    var cy=-HH*0.1;
    var pL=new THREE.Mesh(triGeo([-HW,-HH],[-HW,-HH*0.05],[0,cy]), this._green(0x073229));
    var pR=new THREE.Mesh(triGeo([HW,-HH*0.05],[HW,-HH],[0,cy]), this._green(0x073229));
    var pB=new THREE.Mesh(triGeo([-HW,-HH],[HW,-HH],[0,cy]), this._green(0x083128));
    [pL,pR,pB].forEach(function(m){ m.position.z=0.09; m.castShadow=true; m.receiveShadow=true; pocketGrp.add(m); });
    goldBar(-HW,-HH*0.05,0,cy,pocketGrp,0.094); goldBar(HW,-HH*0.05,0,cy,pocketGrp,0.094);
    goldBar(-HW,-HH,0,cy,pocketGrp,0.094); goldBar(HW,-HH,0,cy,pocketGrp,0.094);

    // decorated FRONT PANEL: the whole pocket face is ONE paper carrying the invitation art.
    // The real card hides fully behind it and slides UP out of this "slit" on extract.
    var panelMat=new THREE.MeshStandardMaterial({ color:0x073329, roughness:1.0, metalness:0.0, envMapIntensity:0.03 });   // fully matte — no per-candle specular smudges
    this._panelMat=panelMat;
    var PPW=PW*0.985, PPH=PH*0.99;
    loadTex("./assets/front-paper.png?v=6", function(t){
      t.wrapS=t.wrapT=THREE.ClampToEdgeWrapping;
      var planeAsp=PPW/PPH, imgAsp=(t.image.width/t.image.height);
      if(planeAsp>imgAsp){ t.repeat.set(1, imgAsp/planeAsp); t.offset.set(0,(1-imgAsp/planeAsp)/2); }
      else { t.repeat.set(planeAsp/imgAsp,1); t.offset.set((1-planeAsp/imgAsp)/2,0); }
      panelMat.map=t; panelMat.color.set(0xffffff); panelMat.needsUpdate=true;
    });
    var panel=this._panel=new THREE.Mesh(new THREE.PlaneGeometry(PPW,PPH), panelMat);
    panel.position.set(0,0,0.16); panel.receiveShadow=true; pocketGrp.add(panel);
    goldBar(-PPW/2, PPH/2, PPW/2, PPH/2, pocketGrp, 0.165);
    goldBar(-PPW/2,-PPH/2, PPW/2,-PPH/2, pocketGrp, 0.165);
    goldBar(-PPW/2,-PPH/2,-PPW/2, PPH/2, pocketGrp, 0.165);
    goldBar( PPW/2,-PPH/2, PPW/2, PPH/2, pocketGrp, 0.165);

    // the interior SHIELD flap = flat rectangle (emblem) + triangle (wax) as ONE piece, hinged at the top edge.
    // stage 3: folds flat over the body (rectangle up, triangle+wax hanging below). stage 4: lifts up.
    var FT=0.86;                                   // triangle length below the rectangle
    var bFlapPivot=this.bFlapPivot=new THREE.Group(); bFlapPivot.position.set(0,HH,0.10); back.add(bFlapPivot);
    var flapMat=this._green(0x083a2c);
    flapMat.emissive=new THREE.Color(0x06281c); flapMat.emissiveIntensity=0.5;   // never reads as pure black
    // single pentagon mesh = rectangle (TL,TR,BR,BL) + downward triangle (BL,BR,AP), all +Z normals
    var pg=new THREE.BufferGeometry();
    pg.setAttribute("position", new THREE.BufferAttribute(new Float32Array([
      -HW,0,0,   -HW,-PH,0,  HW,-PH,0,     // TL, BL, BR
      -HW,0,0,    HW,-PH,0,  HW,0,0,       // TL, BR, TR
      -HW,-PH,0,  HW,-PH,0,  0,-PH-FT,0    // BL, BR, AP (triangular tip)
    ]),3));
    pg.setAttribute("normal", new THREE.BufferAttribute(new Float32Array([
      0,0,1, 0,0,1, 0,0,1,  0,0,1, 0,0,1, 0,0,1,  0,0,1, 0,0,1, 0,0,1 ]),3));
    pg.setAttribute("uv", new THREE.BufferAttribute(new Float32Array([
      -HW*0.4+0.5,0*0.4+0.5,  -HW*0.4+0.5,-PH*0.4+0.5,  HW*0.4+0.5,-PH*0.4+0.5,
      -HW*0.4+0.5,0*0.4+0.5,   HW*0.4+0.5,-PH*0.4+0.5,   HW*0.4+0.5,0*0.4+0.5,
      -HW*0.4+0.5,-PH*0.4+0.5, HW*0.4+0.5,-PH*0.4+0.5,   0*0.4+0.5,(-PH-FT)*0.4+0.5 ]),2));
    var bFlap=new THREE.Mesh(pg, flapMat);
    bFlap.castShadow=true; bFlap.receiveShadow=true; bFlapPivot.add(bFlap);
    var bTri=bFlap;
    var medMat=new THREE.MeshStandardMaterial({ color:0xffffff, roughness:0.8, metalness:0.0, envMapIntensity:0.15,
      transparent:true, depthWrite:false, depthTest:true, side:THREE.DoubleSide,
      polygonOffset:true, polygonOffsetFactor:-4, polygonOffsetUnits:-4 });
    this._medMat=medMat;
    loadTex("./assets/emblem.png", function(t){ t.anisotropy=16; medMat.map=t; medMat.needsUpdate=true; });
    var med=new THREE.Mesh(new THREE.PlaneGeometry(1.0,1.0), medMat);
    med.renderOrder=20;
    med.position.set(0,-PH*0.5,0.03); bFlapPivot.add(med);   // centred on the rectangle part
    var bWax=makeWax(1.0); bWax.position.set(0,-PH-FT,0.02); bFlapPivot.add(bWax);
    this._bFade=[bWall,pL,pR,pB,bFlap,bTri,this._panel]; this._medMesh=med;

    // ground shadow
    var gp=new THREE.Mesh(new THREE.PlaneGeometry(30,30), new THREE.ShadowMaterial({opacity:0.38}));
    gp.rotation.x=-Math.PI/2; gp.position.y=-3.2; gp.receiveShadow=true; scene.add(gp);

    // initial pose: everything closed
    this.fFlapPivot.rotation.x=0;
    this.bFlapPivot.rotation.x=0;
  };

  WeddingBook.prototype._monogram=function(){
    var c=document.createElement("canvas"); c.width=256; c.height=140; var x=c.getContext("2d");
    x.textAlign="center"; x.textBaseline="middle";
    x.font="600 84px 'Cormorant Garamond', Georgia, serif";
    var g=x.createLinearGradient(40,20,220,120); g.addColorStop(0,"#f4e4a6"); g.addColorStop(.6,"#c9a03f"); g.addColorStop(1,"#9c7526");
    x.fillStyle=g; x.fillText("A \u0026 B", 128, 74);
    var t=new THREE.CanvasTexture(c); t.anisotropy=8; return t;
  };

  WeddingBook.prototype._buildGlow=function(){
    var g=this.shafts=new THREE.Group();
    var mat=this.shaftMat=new THREE.MeshBasicMaterial({map:radialSprite(),transparent:true,opacity:0,blending:THREE.AdditiveBlending,depthWrite:false,color:0xffe6b4});
    for(var i=0;i<3;i++){ var m=new THREE.Mesh(new THREE.PlaneGeometry(0.9,0.9),mat); m.position.set((i-1)*0.5,0.1,0.2); g.add(m); }
    this.scene.add(g);
  };

  // ================= ROOM: doorway wall, carved doors, desk, lamp =================
  WeddingBook.prototype._buildRoom=function(){
    var scene=this.scene, self=this;
    var wallMat=wallpaperMat();
    var floorMat=woodImg("./assets/tex/floor_diff.jpg",{rx:5,ry:6,rough:0.55,nsc:0.9});
    var deskMat=woodMat({key:"desk",base:"#3a2614",dk:"#1e1109",lt:"#5c3d1f",vertical:false,planks:0,rx:3,ry:1.4,rough:0.38,metal:0.1,bump:0.02});
    var doorMat=woodMat({key:"door",base:"#33210f",dk:"#170e05",lt:"#4c3118",vertical:true,planks:0,rx:1,ry:2,rough:0.42,metal:0.06,bump:0.022});
    var panelMat=woodMat({key:"doorp",base:"#291a0b",dk:"#130a03",lt:"#40290f",vertical:true,planks:0,rx:1,ry:1,rough:0.5,metal:0.05,bump:0.022});
    var brass=new THREE.MeshStandardMaterial({color:0x9a7526, roughness:0.26, metalness:0.92, envMapIntensity:1.6});
    function box(w,h,d,mat,x,y,z){ var m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat); m.position.set(x,y,z); m.receiveShadow=true; scene.add(m); return m; }

    // floor + wallpapered walls + skirting
    var floor=new THREE.Mesh(new THREE.PlaneGeometry(34,28), floorMat);
    floor.rotation.x=-Math.PI/2; floor.position.set(0,-1.95,4.5); floor.receiveShadow=true; scene.add(floor);
    // back wall behind the desk = the HERO backdrop: dark and quiet, but a VISIBLE wall (not a void).
    var backWallMat=wallMat.clone(); backWallMat.color=new THREE.Color(0x352617); backWallMat.emissiveIntensity=0; backWallMat.envMapIntensity=0.12;
    box(34,12,0.3, backWallMat, 0,3.6,-6.7);                  // back wall (dark but readable — the hero backdrop)
    box(0.3,12,26, wallMat, -10,3.6,1.5);                     // left wall
    box(0.3,12,26, wallMat,  10,3.6,1.5);                     // right wall
    // dim warm wash BETWEEN the desk and the back wall — lifts the wall, skirting and painting out of
    // pure black so the room reads finished, without touching the candle-graded envelope front.
    var backWash=new THREE.PointLight(0xffd9a8, 1.0, 8.5, 2.0); backWash.position.set(0.4,2.0,-4.4); scene.add(backWash);
    var floorWash=new THREE.PointLight(0xffcf9a, 0.7, 8, 2.0); floorWash.position.set(0,-0.6,-4.6); scene.add(floorWash);   // reveals floor→wall meeting line
    // no-shadow warm grazers so the room reads candlelit-but-legible (well below the candles → desk stays brightest)
    var bookcaseGraze=new THREE.PointLight(0xffcc94, 1.15, 11, 2.0); bookcaseGraze.position.set(-6.6,1.6,-1.0); scene.add(bookcaseGraze);   // rakes the left-wall bookcase spines
    var bookcaseGraze2=new THREE.PointLight(0xffca90, 0.7, 9, 2.2); bookcaseGraze2.position.set(-6.4,-0.6,1.6); scene.add(bookcaseGraze2);  // lower shelves
    var wallWash=new THREE.PointLight(0xffd6a2, 0.6, 14, 1.8); wallWash.position.set(-1.0,3.4,-2.0); scene.add(wallWash);                    // grazes upper back wall + map
    var skirt=woodMat({key:"skirt",base:"#28190c",dk:"#150c05",lt:"#3a2513",vertical:false,rx:10,ry:1,rough:0.5});
    box(34,0.85,0.36, skirt, 0,-1.55,-6.52);
    // framed antique WORLD MAP on the back wall above the desk — landscape, moulded frame, glazing sheen,
    // slight forward tilt, cast shadow. Dim/low-contrast so it reads as depth, not a second subject.
    (function(){
      var pg=new THREE.Group(); pg.position.set(-0.3,2.35,-6.46); pg.rotation.x=0.06; scene.add(pg);
      // cast shadow onto the wall behind (offset down/right, as if lit from upper-left)
      var psh=new THREE.Mesh(new THREE.PlaneGeometry(4.6,3.4), new THREE.MeshBasicMaterial({map:radialSprite(),color:0x000000,transparent:true,opacity:0.4,depthWrite:false}));
      psh.position.set(0.22,-0.2,-0.1); pg.add(psh);
      var giltF=new THREE.MeshStandardMaterial({color:0x5a4622, roughness:0.5, metalness:0.5, envMapIntensity:0.6});
      var giltD=new THREE.MeshStandardMaterial({color:0x33240f, roughness:0.6, metalness:0.4, envMapIntensity:0.4});
      pg.add(new THREE.Mesh(new THREE.BoxGeometry(4.0,2.7,0.16), giltF));                 // outer fillet (landscape)
      var cove=new THREE.Mesh(new THREE.BoxGeometry(3.68,2.4,0.2), giltD); cove.position.z=0.04; pg.add(cove);
      var inner=new THREE.Mesh(new THREE.BoxGeometry(3.42,2.16,0.22), giltF); inner.position.z=0.08; pg.add(inner);
      var artTex=(function(){ var W=512,H=336,c=document.createElement("canvas"); c.width=W; c.height=H; var x=c.getContext("2d");
        // sea: aged cream; higher contrast than before
        var g=x.createLinearGradient(0,0,0,H); g.addColorStop(0,"#cdb787"); g.addColorStop(1,"#b39a63"); x.fillStyle=g; x.fillRect(0,0,W,H);
        // stippled ocean hatching (fine, even)
        x.strokeStyle="rgba(110,86,50,0.16)"; x.lineWidth=1;
        for(var oy=22;oy<H-18;oy+=6){ x.beginPath(); for(var ox=18;ox<W-18;ox+=4){ x.lineTo(ox, oy+Math.sin(ox*0.25+oy)*1.0); } x.stroke(); }
        // latitude / longitude graticule — the thing that makes it read instantly as a map
        x.strokeStyle="rgba(78,58,32,0.4)"; x.lineWidth=0.8;
        for(var gx=W/2%64;gx<W;gx+=64){ x.beginPath(); x.moveTo(gx,14); x.lineTo(gx,H-14); x.stroke(); }
        for(var gy=H/2%54;gy<H;gy+=54){ x.beginPath(); x.moveTo(14,gy); x.lineTo(W-14,gy); x.stroke(); }
        // equator + prime meridian slightly heavier
        x.strokeStyle="rgba(70,50,26,0.6)"; x.lineWidth=1.4; x.beginPath(); x.moveTo(14,H/2); x.lineTo(W-14,H/2); x.stroke(); x.beginPath(); x.moveTo(W*0.46,14); x.lineTo(W*0.46,H-14); x.stroke();
        // engraved landmasses: recognisable coastline shapes, aged-cream land against darker sea, fine outline
        function land(pts){ x.beginPath(); pts.forEach(function(p,i){ i?x.lineTo(p[0],p[1]):x.moveTo(p[0],p[1]); }); x.closePath();
          x.fillStyle="rgba(206,188,146,0.95)"; x.fill(); x.strokeStyle="rgba(60,42,20,0.85)"; x.lineWidth=1.3; x.stroke();
          // faint interior contour
          x.strokeStyle="rgba(120,96,56,0.35)"; x.lineWidth=0.7; x.stroke(); }
        // a westerly continent (Americas-ish)
        land([[64,66],[96,54],[112,80],[104,120],[128,150],[120,196],[92,236],[74,214],[86,176],[70,150],[84,122],[60,96]]);
        // a central-east continent (Africa/Europe-ish)
        land([[228,58],[286,50],[322,74],[336,116],[318,168],[300,214],[268,246],[250,206],[266,168],[248,128],[236,98]]);
        // an eastern landmass (Asia-ish) + island
        land([[356,60],[430,52],[470,84],[486,120],[456,150],[420,138],[392,108],[366,92]]);
        land([[452,196],[482,188],[492,214],[470,232],[448,220]]);
        // ruled double border
        x.strokeStyle="rgba(70,50,26,0.85)"; x.lineWidth=2; x.strokeRect(12,12,W-24,H-24);
        x.lineWidth=1; x.strokeRect(19,19,W-38,H-38);
        // compass rose lower-right
        var ccx=436,ccy=268,cr=30; x.strokeStyle="rgba(60,42,20,0.9)"; 
        for(var k=0;k<8;k++){ var an=k*Math.PI/4; x.fillStyle=(k%2?"rgba(120,92,50,0.85)":"rgba(74,52,26,0.9)"); x.beginPath(); x.moveTo(ccx,ccy); x.lineTo(ccx+Math.cos(an)*cr,ccy+Math.sin(an)*cr); x.lineTo(ccx+Math.cos(an+0.26)*cr*0.38,ccy+Math.sin(an+0.26)*cr*0.38); x.closePath(); x.fill(); x.stroke(); }
        x.beginPath(); x.arc(ccx,ccy,cr,0,7); x.stroke(); x.beginPath(); x.arc(ccx,ccy,cr*0.55,0,7); x.stroke();
        var t=new THREE.CanvasTexture(c); t.anisotropy=8; return t; })();
      var art=new THREE.Mesh(new THREE.PlaneGeometry(3.24,2.0), new THREE.MeshStandardMaterial({map:artTex, roughness:0.92, metalness:0.0, envMapIntensity:0.12, emissive:0x1a1206, emissiveIntensity:0.35})); art.position.z=0.2; pg.add(art);
      // glazing sheen: a faint diagonal additive streak catching the candlelight
      var glaze=new THREE.Mesh(new THREE.PlaneGeometry(3.3,2.1), new THREE.MeshBasicMaterial({map:radialSprite(),color:0xfff0d0,transparent:true,opacity:0.08,blending:THREE.AdditiveBlending,depthWrite:false}));
      glaze.position.set(-0.5,0.3,0.22); glaze.rotation.z=-0.4; glaze.scale.set(0.6,1.2,1); pg.add(glaze);
    })();

    // ===== BOOKCASE on the LEFT SIDE WALL (walnut, dim, receding). Seen during the camera travel and
    // adds depth, but NEVER sits behind the envelope — the hero object keeps a plain dark backdrop. =====
    (function(){
      var bc=this.bookcase=new THREE.Group(); bc.position.set(-9.3,1.4,-1.2); bc.rotation.y=Math.PI/2; scene.add(bc);
      var caseMat2=new THREE.MeshStandardMaterial({color:0x241708, roughness:0.6, metalness:0.05, envMapIntensity:0.3});
      var backMat2=new THREE.MeshStandardMaterial({color:0x160d05, roughness:0.75, metalness:0.0, envMapIntensity:0.15});   // dark walnut, in shadow
      var CW=7.0, CH=6.6, CD=1.0, SIDE=0.24, SHT=0.16;   // carcass dims / side thickness / shelf thickness
      bc.add(new THREE.Mesh(new THREE.BoxGeometry(CW,0.24,CD), caseMat2)).position.set(0,CH/2,0);      // top
      bc.add(new THREE.Mesh(new THREE.BoxGeometry(CW,0.24,CD), caseMat2)).position.set(0,-CH/2,0);     // base
      bc.add(new THREE.Mesh(new THREE.BoxGeometry(SIDE,CH,CD), caseMat2)).position.set(-CW/2+SIDE/2,0,0);
      bc.add(new THREE.Mesh(new THREE.BoxGeometry(SIDE,CH,CD), caseMat2)).position.set(CW/2-SIDE/2,0,0);
      bc.add(new THREE.Mesh(new THREE.BoxGeometry(CW,CH,0.16), backMat2)).position.set(0,0,-CD/2+0.02);
      // 4 openings, evenly spaced between top & base; a shelf board tops each opening except the last
      var innerTop=CH/2-0.24, innerBot=-CH/2+0.24, innerH=innerTop-innerBot;
      var OPEN=(innerH-3*SHT)/4;                          // 4 equal bay openings, 3 dividing shelves
      var shelfTopY=[], bayFloorY=[];
      for(var b=0;b<4;b++){ var floorY=innerBot + b*(OPEN+SHT); bayFloorY.push(floorY); shelfTopY.push(floorY+OPEN); }
      for(var s=0;s<3;s++){ bc.add(new THREE.Mesh(new THREE.BoxGeometry(CW-SIDE*2,SHT,CD-0.12), caseMat2)).position.set(0,shelfTopY[s]+SHT/2,0); }
      var innerW=CW-SIDE*2-0.1, x0all=-innerW/2;
      var palette=[0x7a3a1e,0x5a3a20,0x2f4a3a,0x8a6a30,0x3a2416,0x244a56,0x7a2f2a,0x503018];
      for(var bay=0;bay<4;bay++){
        var floorY=bayFloorY[bay], maxH=OPEN-0.12, run=0.06, seed=bay*37+7;
        while(run < innerW-0.5){
          seed=(seed*1103515245+12345)&0x7fffffff; var r1=(seed>>8)%100/100;
          seed=(seed*1103515245+12345)&0x7fffffff; var r2=(seed>>8)%100/100;
          var h=Math.min(maxH, 0.62*maxH + r1*0.38*maxH), w=0.26+r2*0.16;
          if(run+w>innerW-0.06) break;
          var col=palette[(bay*3+Math.floor(run*7))%palette.length];
          var lean=(r1>0.86)?(r2>0.5?0.14:-0.14):0;
          var bk=makeBook(w,h,0.72,col,true); bk.position.set(x0all+run+w/2, floorY+h/2, 0.0); bk.rotation.set(0,Math.PI,lean);   // spine (coloured + gilt) faces the room
          bc.add(bk); run+=w+0.02;
          // occasional gap
          if(r1>0.7) run+=0.14;
        }
        // a flat stack leaning into the remaining gap in some bays
        if(bay%2===1 && innerW-run>0.9){ var sx=x0all+run+0.5;
          for(var f=0;f<2+bay%2;f++){ var fh=0.15; var fv=makeBook(0.85,fh,0.68,palette[(bay+f)%palette.length],false); fv.position.set(sx,floorY+fh/2+f*fh,0.0); bc.add(fv); } }
      }
      // a few non-book objects for rhythm (each seated ON a shelf floor)
      bc.add(new THREE.Mesh(new THREE.BoxGeometry(0.5,0.4,0.5), new THREE.MeshStandardMaterial({color:0x6a4a22,roughness:0.4,metalness:0.4}))).position.set(2.1,bayFloorY[2]+0.2,0.05);
      var jar=new THREE.Mesh(new THREE.CylinderGeometry(0.16,0.2,0.5,16), new THREE.MeshStandardMaterial({color:0x3a5a54,roughness:0.3,metalness:0.1,envMapIntensity:0.6})); jar.position.set(-1.9,bayFloorY[1]+0.25,0.05); bc.add(jar);
      var clock=new THREE.Mesh(new THREE.BoxGeometry(0.6,0.7,0.35), new THREE.MeshStandardMaterial({color:0x4a3016,roughness:0.4,metalness:0.2})); clock.position.set(-2.5,bayFloorY[3]+0.35,0.05); bc.add(clock);
      bc.add(new THREE.Mesh(new THREE.CircleGeometry(0.22,20), new THREE.MeshStandardMaterial({color:0xd8c69a,roughness:0.5}))).position.set(-2.5,bayFloorY[3]+0.43,0.23);
      bc.traverse(function(o){ if(o.isMesh){ o.castShadow=true; o.receiveShadow=true; } });
    }).call(this);

    // ===== front wall = the HALLWAY: a warm late-colonial subcontinental hall matching the walnut door.
    // Dim but fully legible — brass sconces, aged plaster, walnut panelled wainscot, encaustic tile. In fw (hides inside). =====
    var fw=this.frontWall=new THREE.Group(); scene.add(fw);
    // aged warm plaster above the dado (putty/ochre, subtle mottle — no pattern)
    function plasterTex(){ var S=512,c=document.createElement("canvas"); c.width=c.height=S; var x=c.getContext("2d");
      x.fillStyle="#9c8058"; x.fillRect(0,0,S,S);
      // subtle, even tonal variation only — many tiny low-contrast specks, no large blotches
      for(var i=0;i<2600;i++){ var up=Math.random()<0.5; x.fillStyle=up?"rgba(176,150,110,0.05)":"rgba(96,76,50,0.05)"; x.beginPath(); x.arc(Math.random()*S,Math.random()*S,2+Math.random()*5,0,7); x.fill(); }
      var t=new THREE.CanvasTexture(c); t.wrapS=t.wrapT=THREE.RepeatWrapping; t.anisotropy=8; return t; }
    var plasterMat=new THREE.MeshStandardMaterial({map:plasterTex(), color:0xb59873, roughness:0.95, metalness:0.0, envMapIntensity:0.12});
    function plaster(w,h){ var m=plasterMat.clone(); var t=plasterMat.map.clone(); t.needsUpdate=true; t.wrapS=t.wrapT=THREE.RepeatWrapping; t.repeat.set(w*0.5,h*0.5); m.map=t; return m; }
    // ALL joinery is walnut, matching the door
    var hallWood=woodMat({key:"hallwd",base:"#3a2513",dk:"#1c1108",lt:"#5a3c1e",vertical:false,rx:4,ry:1,rough:0.46,metal:0.08,bump:0.02});
    var hallWoodV=woodMat({key:"hallwdv",base:"#33210f",dk:"#170e05",lt:"#4c3118",vertical:true,rx:1,ry:2,rough:0.46,metal:0.08,bump:0.02});
    var railMat=new THREE.MeshStandardMaterial({color:0x4a3018, roughness:0.44, metalness:0.1, envMapIntensity:0.6});
    var brassMat=new THREE.MeshStandardMaterial({color:0x9a7526, roughness:0.3, metalness:0.9, envMapIntensity:1.4});
    // PLASTER above the dado (jambs beside door + over the head)
    fw.add(box(8,6.4,0.34, plaster(8,6.4), -6,3.25,6.6));    // left plaster
    fw.add(box(8,6.4,0.34, plaster(8,6.4),  6,3.25,6.6));    // right plaster
    fw.add(box(4.4,2.5,0.34, plaster(4.4,2.5), 0,6.2,6.6));  // over-door plaster
    // PANELLED WAINSCOT (walnut, real stiles/rails/recessed fields) up to dado ~y0.4
    function wainscotRun(cxc){
      fw.add(box(8,3.1,0.30, hallWood, cxc,-1.05,6.58));      // ground
      for(var p=-3;p<=3;p+=2){
        fw.add(box(1.15,2.0,0.05, hallWoodV, cxc+p*0.98, -1.05, 6.72));   // recessed field (proud face)
        fw.add(box(1.5,2.3,0.12, railMat, cxc+p*0.98, -1.05, 6.66));      // field frame behind
      }
    }
    wainscotRun(-6); wainscotRun(6);
    fw.add(box(8,0.22,0.5, railMat, -6,0.6,6.7)); fw.add(box(8,0.22,0.5, railMat, 6,0.6,6.7));   // dado rail
    fw.add(box(8,0.1,0.54, hallWood, -6,0.72,6.72)); fw.add(box(8,0.1,0.54, hallWood, 6,0.72,6.72));
    // SKIRTING
    fw.add(box(8,0.5,0.5, hallWood, -6,-2.32,6.72)); fw.add(box(8,0.5,0.5, hallWood, 6,-2.32,6.72));
    // CORNICE at the ceiling line
    fw.add(box(20,0.3,0.55, railMat, 0,6.7,6.72)); fw.add(box(20,0.16,0.62, hallWood, 0,6.5,6.74));
    // TALL SCREENS: a phone's frame is much taller than a desktop's, so the camera used to see
    // straight over the top of this wall and past the leading edge of the corridor ceiling —
    // that was the black band along the top on mobile. Carry the plaster up to the ceiling line
    // and run the ceiling forward over the doorway so the room is closed at any aspect ratio.
    fw.add(box(20,1.6,0.5, plaster(20,2), 0,7.65,6.72));                       // wall above the cornice
    fw.add(box(20,0.3,1.4, new THREE.MeshStandardMaterial({color:0x2a2018,roughness:0.9}), 0,7.6,6.4));  // ceiling over the doorway
    fw.add(box(20,0.22,0.4, railMat, 0,7.42,6.9));                              // small cornice return
    // ===== corridor the camera flies down =====
    fw.add(box(0.34,9,14, plaster(14,9), -6.0,3.25,13.4)); fw.add(box(0.34,9,14, plaster(14,9), 6.0,3.25,13.4));
    fw.add(box(0.4,3.1,14, hallWood, -5.86,-1.05,13.4)); fw.add(box(0.4,3.1,14, hallWood, 5.86,-1.05,13.4));
    fw.add(box(0.34,0.22,14, railMat, -5.9,0.6,13.4)); fw.add(box(0.34,0.22,14, railMat, 5.9,0.6,13.4));
    fw.add(box(0.4,0.5,14, hallWood, -5.86,-2.32,13.4)); fw.add(box(0.4,0.5,14, hallWood, 5.86,-2.32,13.4));
    fw.add(box(13,0.3,14, new THREE.MeshStandardMaterial({color:0x2a2018,roughness:0.9}), 0,7.6,13.4));
    // ENCAUSTIC CEMENT TILE floor (geometric muted terracotta/cream/slate)
    function tileTex(){ var S=512,c=document.createElement("canvas"); c.width=c.height=S; var x=c.getContext("2d");
      var n=4, u=S/n; for(var iy=0;iy<n;iy++)for(var ix=0;ix<n;ix++){ var ox=ix*u,oy=iy*u;
        x.fillStyle="#b9a681"; x.fillRect(ox,oy,u,u);
        x.fillStyle="#7a3b2c"; x.beginPath(); x.moveTo(ox+u/2,oy+8); x.lineTo(ox+u-8,oy+u/2); x.lineTo(ox+u/2,oy+u-8); x.lineTo(ox+8,oy+u/2); x.closePath(); x.fill();
        x.fillStyle="#42505a"; x.beginPath(); x.arc(ox+u/2,oy+u/2,u*0.16,0,7); x.fill();
        x.strokeStyle="rgba(40,30,20,0.4)"; x.lineWidth=3; x.strokeRect(ox,oy,u,u); }
      var t=new THREE.CanvasTexture(c); t.wrapS=t.wrapT=THREE.RepeatWrapping; t.repeat.set(5,9); t.anisotropy=8; return t; }
    var tile=new THREE.Mesh(new THREE.PlaneGeometry(11.6,14), new THREE.MeshStandardMaterial({map:tileTex(),color:0xcfc0a4,roughness:0.5,metalness:0.05,envMapIntensity:0.3}));
    tile.rotation.x=-Math.PI/2; tile.position.set(0,-2.55,13.4); tile.receiveShadow=true; fw.add(tile);
    // RUNNER — worn muted, fringed ends, leading to the door
    var runnerT=(function(){ var S=256,c=document.createElement("canvas"); c.width=72; c.height=S; var x=c.getContext("2d");
      x.fillStyle="#6e2f2a"; x.fillRect(0,0,72,S); x.strokeStyle="rgba(200,168,110,0.3)"; x.lineWidth=3;
      x.strokeRect(9,9,54,S-18); x.strokeRect(16,16,40,S-32);
      x.strokeStyle="rgba(180,150,100,0.18)"; for(var yy=30;yy<S;yy+=26){ x.beginPath(); x.moveTo(16,yy); x.lineTo(56,yy); x.stroke(); }
      var t=new THREE.CanvasTexture(c); t.anisotropy=8; return t; })();
    var runnerRug=new THREE.Mesh(new THREE.PlaneGeometry(2.6,13.2), new THREE.MeshStandardMaterial({map:runnerT,color:0xb07068,roughness:0.9}));
    runnerRug.rotation.x=-Math.PI/2; runnerRug.position.set(0,-2.5,13.0); runnerRug.receiveShadow=true; fw.add(runnerRug);
    // TWO BRASS SCONCES flanking the door — bracket + upright candle, a real warm pool on the wall.
    // (Previously the point light sat at z=6.3, BEHIND the z≈6.77 wall face the viewer sees during the
    // approach, so it lit the hidden back side — the sconces read as unlit. Now mounted proud, viewer-side.)
    function sconceAt(sx){
      var g=new THREE.Group(); g.position.set(sx,3.4,6.92);
      // brass backplate flush to the wall + wall bracket arm
      var bp=new THREE.Mesh(new THREE.BoxGeometry(0.34,0.6,0.05), brassMat); bp.position.set(0,0.1,-0.02); g.add(bp);
      g.add(new THREE.Mesh(new THREE.CylinderGeometry(0.09,0.13,0.5,14), brassMat));
      var cup=new THREE.Mesh(new THREE.CylinderGeometry(0.12,0.06,0.16,14), brassMat); cup.position.y=0.34; g.add(cup);
      // upright candle standing in the cup
      var candle=new THREE.Mesh(new THREE.CylinderGeometry(0.05,0.055,0.34,14), new THREE.MeshStandardMaterial({color:0xf0e4c8,roughness:0.5,emissive:0x2a1c08,emissiveIntensity:0.15})); candle.position.y=0.56; g.add(candle);
      // lit tapered amber flame (same treatment as the desk candles)
      var fg=new THREE.Group(); fg.position.set(0,0.78,0);
      fg.add(new THREE.Mesh(new THREE.SphereGeometry(0.026,10,10), new THREE.MeshBasicMaterial({color:0xfff2d2})));
      var sb=new THREE.Mesh(new THREE.ConeGeometry(0.05,0.19,14), new THREE.MeshBasicMaterial({color:0xffb44e,transparent:true,opacity:0.95,blending:THREE.AdditiveBlending,depthWrite:false})); sb.position.y=0.09; fg.add(sb);
      var st=new THREE.Mesh(new THREE.ConeGeometry(0.028,0.13,14), new THREE.MeshBasicMaterial({color:0xff8a24,transparent:true,opacity:0.8,blending:THREE.AdditiveBlending,depthWrite:false})); st.position.y=0.17; fg.add(st);
      // small additive glow sprite AT the flame (replaces the deleted flanking planes)
      var spr=new THREE.Mesh(new THREE.PlaneGeometry(0.5,0.7), new THREE.MeshBasicMaterial({map:radialSprite(),color:0xffc079,transparent:true,opacity:0.5,blending:THREE.AdditiveBlending,depthWrite:false})); spr.position.y=0.06; fg.add(spr);
      g.add(fg); fw.add(g);
      // warm point light PROUD of the wall so it throws a visible pool with falloff onto the plaster
      var L=new THREE.PointLight(0xffb060, 5.6, 9.5, 2.0); L.position.set(sx,3.98,7.05); fw.add(L);
      if(!self.sconceLights) self.sconceLights=[];
      self.sconceLights.push({light:L, base:5.6, flame:fg, off:self.sconceLights.length*3.1+1.7});
    }
    sconceAt(-3.5); sconceAt(3.5);
    var hallAmbient=new THREE.PointLight(0xffcf90, 1.15, 24, 1.5); hallAmbient.position.set(0,3.0,10.5); fw.add(hallAmbient);
    var wainscotFill=new THREE.PointLight(0xffcaa0, 0.7, 16, 1.6); wainscotFill.position.set(0,-0.4,9.5); fw.add(wainscotFill);   // legibly-lit lower hall (wainscot never pitch black)
    // casing profile: stacked WALNUT bands around the opening (proud)
    var caseMat=hallWood, caseHi=railMat;
    [ [0.26,5.9,-2.18],[0.26,5.9,2.18] ].forEach(function(v){ fw.add(box(v[0],v[1],0.22, caseMat, v[2],0.95,6.5)); });
    [ [0.12,5.9,-2.34],[0.12,5.9,2.34] ].forEach(function(v){ fw.add(box(v[0],v[1],0.30, caseHi, v[2],0.95,6.46)); });
    fw.add(box(4.8,0.26,0.22, caseMat, 0,3.55,6.52));         // head casing   (fronts staggered in Z to kill the z-fighting band)
    fw.add(box(5.2,0.16,0.34, caseHi, 0,3.78,6.40));          // cornice band  (pushed back so its front ≠ head casing front)
    fw.add(box(5.5,0.22,0.42, caseMat, 0,3.92,6.30));         // cornice cap   (pushed back further)
    // TRANSOM over the door — a glazed WINDOW: warm frosted glass with a gradient (brighter low-centre), walnut bars
    fw.add(box(4.4,1.0,0.24, hallWood, 0,4.35,6.5));                    // walnut surround
    var transTex=(function(){ var W=256,H=72,c=document.createElement("canvas"); c.width=W; c.height=H; var x=c.getContext("2d");
      var g=x.createRadialGradient(W/2,H,4,W/2,H,W*0.7); g.addColorStop(0,"#ffcf82"); g.addColorStop(0.5,"#e0a24e"); g.addColorStop(1,"#6e4420"); x.fillStyle=g; x.fillRect(0,0,W,H);
      for(var vx=0;vx<W;vx+=3){ x.strokeStyle="rgba(255,240,200,"+(Math.random()*0.06)+")"; x.beginPath(); x.moveTo(vx,0); x.lineTo(vx+ (Math.random()-0.5)*2,H); x.stroke(); }   // old drawn-glass streaks
      return new THREE.CanvasTexture(c); })();
    // Basic materials ignore lighting, so these two were the last thing still visible
    // during the blackout. Kept as refs and faded with the candles (see _setDoors).
    var transGlass=this.transGlass=new THREE.Mesh(new THREE.PlaneGeometry(3.7,0.66), new THREE.MeshBasicMaterial({map:transTex,transparent:true,opacity:0.9,depthWrite:false}));
    transGlass.position.set(0,4.35,6.58); fw.add(transGlass);            // gradient glass (depthWrite off + separated in Z from the glow → no transparent-sort flicker)
    var transGlow=this.transGlow=new THREE.Mesh(new THREE.PlaneGeometry(3.9,0.9), new THREE.MeshBasicMaterial({map:radialSprite(),color:0xffb45a,transparent:true,opacity:0.22,blending:THREE.AdditiveBlending,depthWrite:false}));
    transGlow.position.set(0,4.2,6.68); fw.add(transGlow);              // faint bloom low-centre only
    this._transBase={glass:0.9, glow:0.22};
    for(var gb=-1;gb<=1;gb++){ var vb=box(0.07,0.7,0.14, hallWood, gb*1.2,4.35,6.66); }   // vertical glazing bars (depth, cast small shadows)
    fw.add(box(3.9,0.06,0.14, hallWood, 0,4.35,6.66));                  // horizontal muntin
    fw.add(box(5.0,0.22,0.6, doorMat, 0,-1.86,6.3));         // walnut threshold at the floor
    // doorway REVEAL: inner faces of the opening, receding from wall front (z~6.6) to door plane (z~6.4)
    var revMat=new THREE.MeshStandardMaterial({color:0x2a1c10, roughness:0.66, metalness:0.04, envMapIntensity:0.4});
    fw.add(box(0.04,5.5,0.42, revMat, -1.93,0.95,6.5));      // left reveal (faces +x, inward)
    fw.add(box(0.04,5.5,0.42, revMat,  1.93,0.95,6.5));      // right reveal
    fw.add(box(4.0,0.04,0.42, revMat, 0,3.38,6.5));          // head reveal

    // ===== two carved door leaves, hinged at outer edges (slight overlap at centre) =====
    var _dtl=new THREE.TextureLoader();
    function _dtex(u){ var t=_dtl.load(u); t.encoding=THREE.sRGBEncoding; t.anisotropy=8; return t; }
    function _dnrm(u){ var t=_dtl.load(u); t.anisotropy=8; return t; }
    var texL=_dtex("./assets/door-left.png?v=16"),  nrmL=_dnrm("./assets/door-left-norm.png?v=16");
    var texR=_dtex("./assets/door-right.png?v=16"), nrmR=_dnrm("./assets/door-right-norm.png?v=16");
    self.doorLevers=[];
    function makeLeaf(inner){
      var grp=new THREE.Group();
      var W=1.98,H=4.24,D=0.34, cx=inner*(W/2);
      // leaf body: darker leading (inner) edge + sides so thickness reads as the door swings.
      // extended DOWN to meet the threshold (art face stays H tall; body reaches the floor).
      var edgeMat=new THREE.MeshStandardMaterial({color:0x1c130a, roughness:0.7, metalness:0.0});
      var bodyH=5.32, bodyCY=-0.29;   // spans local -2.95..2.37 => world -1.85..3.42 (meets threshold AND head)
      var body=new THREE.Mesh(new THREE.BoxGeometry(W,bodyH,D), doorMat); body.position.set(cx,bodyCY,0); body.castShadow=true; body.receiveShadow=true; grp.add(body);
      var ftex = inner>0 ? texL : texR, fnrm = inner>0 ? nrmL : nrmR;
      // FRONT (hallway-facing) art face
      var faceMat = new THREE.MeshStandardMaterial({ map:ftex, normalMap:fnrm, roughness:0.65, metalness:0.0, emissive:0x1c1308, emissiveIntensity:0.3 });
      faceMat.normalScale=new THREE.Vector2(1.2,1.2);
      var face=new THREE.Mesh(new THREE.PlaneGeometry(W,H), faceMat); face.position.set(cx,0,D/2+0.004); grp.add(face);
      // BACK (room-facing) face — plain walnut, catches the room's warm lamp once open
      var backMat=new THREE.MeshStandardMaterial({color:0x3a2613, roughness:0.62, metalness:0.05, envMapIntensity:0.7});
      var back=new THREE.Mesh(new THREE.PlaneGeometry(W,H), backMat); back.position.set(cx,0,-D/2-0.004); back.rotation.y=Math.PI; grp.add(back);
      // REAL inset panels (4 per leaf) so joinery catches light regardless of the normal map
      var panelBoxMat=new THREE.MeshStandardMaterial({color:0x33220f, roughness:0.6, metalness:0.05, envMapIntensity:0.6});
      var frameMat=new THREE.MeshStandardMaterial({color:0x4a3018, roughness:0.5, metalness:0.06, envMapIntensity:0.7});
      var pw=W*0.62, ys=[1.28,0.02,-1.24], phs=[1.05,0.44,1.05];
      ys.forEach(function(fy,idx){ var ph=1.02*phs[idx];
        var fr=new THREE.Mesh(new THREE.BoxGeometry(pw+0.2,ph+0.2,0.06), frameMat); fr.position.set(cx,fy,D/2-0.03); fr.castShadow=true; fr.receiveShadow=true; grp.add(fr);
        var pn=new THREE.Mesh(new THREE.BoxGeometry(pw,ph,0.05), panelBoxMat); pn.position.set(cx,fy,D/2-0.055); pn.receiveShadow=true; grp.add(pn);
      });
      // WIDE bottom rail (widest member) + top rail — SAME grained walnut as the leaf, not a flat band
      var brail=new THREE.Mesh(new THREE.BoxGeometry(W,0.78,D+0.012), doorMat); brail.position.set(cx,-2.52,0); brail.castShadow=true; brail.receiveShadow=true; grp.add(brail);
      var brailBev=new THREE.Mesh(new THREE.BoxGeometry(W*0.9,0.5,0.04), doorMat); brailBev.position.set(cx,-2.44,D/2-0.01); grp.add(brailBev);
      var trail=new THREE.Mesh(new THREE.BoxGeometry(W,0.5,D+0.012), doorMat); trail.position.set(cx,2.28,0); trail.castShadow=true; trail.receiveShadow=true; grp.add(trail);
      // vertical brass PULL bar on the lock (inner) stile; ~40% up, clear below the raised plaque.
      var hx=inner*(W-0.17), hy=-0.95, barH=1.1;
      function standoff(y){ var s=new THREE.Mesh(new THREE.CylinderGeometry(0.04,0.04,0.17,14), brass); s.rotation.x=Math.PI/2; s.position.set(hx,y,D/2+0.09); s.castShadow=true; grp.add(s); }
      standoff(hy+barH/2-0.06); standoff(hy-barH/2+0.06);
      var bar=new THREE.Mesh(new THREE.CylinderGeometry(0.072,0.072,barH,18), brass);
      bar.position.set(hx,hy,D/2+0.18); bar.castShadow=true; grp.add(bar);
      var mid=new THREE.Mesh(new THREE.SphereGeometry(0.082,16,12), brass); mid.position.set(hx,hy,D/2+0.18); grp.add(mid);  // slight belly
      grp.traverse(function(o){ if(o.isMesh && !o.castShadow){ o.receiveShadow=true; } });
      return grp;
    }
    var dL=this.doorL=makeLeaf(+1); dL.position.set(-1.95,1.1,6.40); fw.add(dL);
    var dR=this.doorR=makeLeaf(-1); dR.position.set( 1.95,1.1,6.40); fw.add(dR);
    // seam glow ONLY (small, occluded by leaves, widens with gap, fades once open). The FLASH is a DOM overlay.
    var blade=this.blade=new THREE.Mesh(new THREE.PlaneGeometry(0.5,3.9),
      new THREE.MeshBasicMaterial({map:radialSprite(),color:0xffb14e, transparent:true, opacity:0, blending:THREE.AdditiveBlending, depthWrite:false, depthTest:true, side:THREE.DoubleSide}));
    blade.position.set(0,1.1,6.30); blade.scale.set(0.1,1,1); fw.add(blade);
    var bladeGlow=this.bladeGlow=new THREE.Mesh(new THREE.PlaneGeometry(1.6,4.0),
      new THREE.MeshBasicMaterial({map:radialSprite(),color:0xff9a3c,transparent:true,opacity:0,blending:THREE.AdditiveBlending,depthWrite:false}));
    bladeGlow.position.set(0,1.1,6.28); bladeGlow.scale.set(0.3,1,1); fw.add(bladeGlow);
    var floorSpill=this.floorSpill=new THREE.Mesh(new THREE.PlaneGeometry(1.2,3.0),
      new THREE.MeshBasicMaterial({map:radialSprite(),color:0xffbe6e,transparent:true,opacity:0,blending:THREE.AdditiveBlending,depthWrite:false}));
    floorSpill.rotation.x=-Math.PI/2; floorSpill.position.set(0,-1.02,5.2); fw.add(floorSpill);
    // SINGLE unsplit plaque plate — one mesh parented to the FRAME (fw), spanning both closed leaves.
    // No slicing, no seam to align. Fades out the instant the doors begin to move (see _setDoors).
    var plaqueTex=_dtex("./assets/plaque.png?v=16");
    // self-lit sign: emissive carries the artwork so it stays bright regardless of hall lighting; the
    // ONLY thing animated on door-open is material.opacity (transparent) → it goes INVISIBLE, never black.
    var plaqueMat=new THREE.MeshStandardMaterial({map:plaqueTex, color:0x0b0a06, transparent:true, roughness:0.5, metalness:0.0, emissive:0xffffff, emissiveMap:plaqueTex, emissiveIntensity:0.95, envMapIntensity:0.2, depthWrite:false});
    var plaquePlate=this.plaque=new THREE.Mesh(new THREE.PlaneGeometry(2.72,1.38), plaqueMat);
    plaquePlate.position.set(0,1.74,6.62); fw.add(plaquePlate);
    // soft warm glow — a CHILD of the plate, so it shares the plate's exact transform and can never
    // out-move or outlive it. Faded on the identical curve in _setDoors.
    var plaqueGlow=this.plaqueGlow=new THREE.Mesh(new THREE.PlaneGeometry(3.5,2.1),
      new THREE.MeshBasicMaterial({map:radialSprite(),color:0xffce7e,transparent:true,opacity:0.5,blending:THREE.AdditiveBlending,depthWrite:false}));
    plaqueGlow.position.set(0,0,-0.02); plaquePlate.add(plaqueGlow);
    // warm "picture light" spotlight from an unseen fixture above, aimed at the door face — lights the
    // plaque AND the door panels (door face reads brighter than the walls beside it)
    var doorSpot=new THREE.SpotLight(0xffdda8, 3.2, 12, 0.62, 0.5, 1.4); doorSpot.position.set(0,5.4,8.2); doorSpot.target.position.set(0,1.4,6.5); fw.add(doorSpot); fw.add(doorSpot.target);

    // ===== large writing desk (substantial partner's desk, spans much of the room) =====
    var deskTopY=-0.75;
    var deskTop=new THREE.Mesh(new THREE.BoxGeometry(8.8,0.4,3.7), deskMat);
    deskTop.position.set(0,deskTopY-0.2,-0.2); deskTop.receiveShadow=true; deskTop.castShadow=true; scene.add(deskTop);
    // deep moulded front edge (two stacked bullnoses = a real ovolo moulding)
    var frontEdge=new THREE.Mesh(new THREE.CylinderGeometry(0.2,0.2,8.8,24), deskMat); frontEdge.rotation.z=Math.PI/2; frontEdge.position.set(0,deskTopY-0.18,1.62); frontEdge.castShadow=true; scene.add(frontEdge);
    var edgeLip=new THREE.Mesh(new THREE.BoxGeometry(8.8,0.12,0.16), deskMat); edgeLip.position.set(0,deskTopY-0.02,1.6); scene.add(edgeLip);
    box(8.3,0.82,0.26, deskMat, 0,-1.28,-1.9);              // deeper back apron
    // TWO drawers across the front apron, each with TWO real brass drop pulls (backplate + hanging bail)
    [-2.05,2.05].forEach(function(dxr){
      var dr=new THREE.Mesh(new THREE.BoxGeometry(3.9,0.82,0.16), deskMat); dr.position.set(dxr,-1.28,1.5); dr.castShadow=true; dr.receiveShadow=true; scene.add(dr);
      var lip=new THREE.Mesh(new THREE.BoxGeometry(3.94,0.09,0.2), deskMat); lip.position.set(dxr,-0.9,1.51); scene.add(lip);
      var faceZ=1.58;                                        // drawer front face
      [-0.95,0.95].forEach(function(px){
        // shaped backplate, PROUD of the drawer face and casting onto it
        var pback=new THREE.Mesh(new THREE.PlaneGeometry(0.42,0.34), new THREE.MeshBasicMaterial({map:radialSprite(),color:0x000000,transparent:true,opacity:0.4,depthWrite:false}));
        pback.position.set(dxr+px,-1.2,faceZ+0.002); scene.add(pback);   // shadow the plate throws on the face
        var plate=new THREE.Mesh(new THREE.BoxGeometry(0.3,0.24,0.05), brass); plate.position.set(dxr+px,-1.16,faceZ+0.03); plate.castShadow=true; plate.receiveShadow=true; scene.add(plate);
        var rose=new THREE.Mesh(new THREE.CylinderGeometry(0.05,0.06,0.06,16), brass); rose.rotation.x=Math.PI/2; rose.position.set(dxr+px,-1.16,faceZ+0.07); scene.add(rose);
        // two pivot bosses the bail hangs from
        [-0.12,0.12].forEach(function(bx){ var boss=new THREE.Mesh(new THREE.SphereGeometry(0.03,10,8), brass); boss.position.set(dxr+px+bx,-1.16,faceZ+0.09); scene.add(boss); });
        // the bail: a heavy half-ring hanging BELOW the plate, projecting forward, casting its own shadow
        var bailSh=new THREE.Mesh(new THREE.PlaneGeometry(0.32,0.26), new THREE.MeshBasicMaterial({map:radialSprite(),color:0x000000,transparent:true,opacity:0.34,depthWrite:false}));
        bailSh.position.set(dxr+px,-1.3,faceZ+0.004); scene.add(bailSh);
        var bail=new THREE.Mesh(new THREE.TorusGeometry(0.13,0.03,12,24,Math.PI), brass); bail.rotation.x=Math.PI; bail.position.set(dxr+px,-1.16,faceZ+0.1); bail.castShadow=true; scene.add(bail);
      });
    });
    // walnut divider stile between the two drawers — closes the dark gap at lower-centre of frame
    var drawerDivider=new THREE.Mesh(new THREE.BoxGeometry(0.22,0.86,0.3), deskMat); drawerDivider.position.set(0,-1.28,1.5); drawerDivider.castShadow=true; drawerDivider.receiveShadow=true; scene.add(drawerDivider);
    // tooled-leather writing inset on the desktop (maroon, gilt border)
    var leatherInset=new THREE.Mesh(new THREE.PlaneGeometry(5.6,2.7), new THREE.MeshStandardMaterial({color:0x5a1e26, roughness:0.72, metalness:0.05, envMapIntensity:0.15}));
    leatherInset.rotation.x=-Math.PI/2; leatherInset.position.set(0,deskTopY+0.006,0.05); leatherInset.receiveShadow=true; scene.add(leatherInset);
    var insetBorder=new THREE.Mesh(new THREE.PlaneGeometry(5.9,3.0), new THREE.MeshStandardMaterial({color:0x8a6a2e, roughness:0.4, metalness:0.6, envMapIntensity:0.8}));
    insetBorder.rotation.x=-Math.PI/2; insetBorder.position.set(0,deskTopY+0.003,0.05); scene.add(insetBorder);
    // thick turned legs at the four corners
    [[-4.0,1.4],[4.0,1.4],[-4.0,-1.7],[4.0,-1.7]].forEach(function(L){
      var lg=new THREE.Mesh(new THREE.CylinderGeometry(0.28,0.36,1.5,20), deskMat); lg.position.set(L[0],-1.68,L[1]); lg.castShadow=true; scene.add(lg);
      var knee=new THREE.Mesh(new THREE.SphereGeometry(0.3,16,12), deskMat); knee.position.set(L[0],-1.0,L[1]); knee.scale.set(1,0.7,1); scene.add(knee);   // turned knee block at the apron
      var foot=new THREE.Mesh(new THREE.SphereGeometry(0.26,16,12), deskMat); foot.position.set(L[0],-2.36,L[1]); scene.add(foot);
      var lsh=new THREE.Mesh(new THREE.PlaneGeometry(0.95,0.95), new THREE.MeshBasicMaterial({map:radialSprite(),color:0x000000,transparent:true,opacity:0.34,depthWrite:false}));
      lsh.rotation.x=-Math.PI/2; lsh.position.set(L[0],-2.38,L[1]); scene.add(lsh); });
    // desk runner cloth under the envelope
    var runner=new THREE.Mesh(new THREE.PlaneGeometry(5.0,2.4), new THREE.MeshStandardMaterial({color:0x3a1220, roughness:0.86, metalness:0.0, side:THREE.DoubleSide, envMapIntensity:0.1}));
    runner.rotation.x=-Math.PI/2; runner.position.set(0,deskTopY+0.011,0.05); runner.receiveShadow=true; scene.add(runner);
    // soft contact shadow anchoring the envelope to the desk
    var envShadow=new THREE.Mesh(new THREE.PlaneGeometry(2.2,1.6), new THREE.MeshBasicMaterial({map:radialSprite(),color:0x000000,transparent:true,opacity:0.28,depthWrite:false}));
    envShadow.rotation.x=-Math.PI/2; envShadow.position.set(0,deskTopY+0.016,0.02); scene.add(envShadow);

    // ===== detailed oil lamp (left) =====
    var lamp=new THREE.Group(); lamp.position.set(-1.5,deskTopY,0.4); scene.add(lamp);
    var waxMat=new THREE.MeshStandardMaterial({color:0xf0e4c8, roughness:0.5, metalness:0.0, emissive:0x2a1c08, emissiveIntensity:0.12});
    // brass candlestick: foot, turned stem, drip pan
    var foot=new THREE.Mesh(new THREE.CylinderGeometry(0.30,0.40,0.10,32), brass); foot.castShadow=true; lamp.add(foot);
    var footRing=new THREE.Mesh(new THREE.TorusGeometry(0.30,0.05,12,32), brass); footRing.rotation.x=Math.PI/2; footRing.position.y=0.05; lamp.add(footRing);
    var knop1=new THREE.Mesh(new THREE.SphereGeometry(0.14,20,16), brass); knop1.position.y=0.22; knop1.scale.set(1,0.7,1); lamp.add(knop1);
    var stem=new THREE.Mesh(new THREE.CylinderGeometry(0.075,0.10,0.5,20), brass); stem.position.y=0.5; lamp.add(stem);
    var knop2=new THREE.Mesh(new THREE.SphereGeometry(0.11,20,16), brass); knop2.position.y=0.74; knop2.scale.set(1,0.65,1); lamp.add(knop2);
    var pan=new THREE.Mesh(new THREE.CylinderGeometry(0.26,0.16,0.06,28), brass); pan.position.y=0.86; pan.castShadow=true; lamp.add(pan);
    var panLip=new THREE.Mesh(new THREE.TorusGeometry(0.24,0.03,10,28), brass); panLip.rotation.x=Math.PI/2; panLip.position.y=0.89; lamp.add(panLip);
    var socket=new THREE.Mesh(new THREE.CylinderGeometry(0.11,0.13,0.16,20), brass); socket.position.y=0.96; lamp.add(socket);
    // taper candle with pooled top + frozen drips down the side + hardened puddle on the pan
    var candle=new THREE.Mesh(new THREE.CylinderGeometry(0.085,0.095,0.92,20), waxMat); candle.position.y=1.5; candle.castShadow=true; lamp.add(candle);
    var pool=new THREE.Mesh(new THREE.SphereGeometry(0.10,18,12), waxMat); pool.position.y=1.95; pool.scale.set(1,0.5,1); lamp.add(pool);
    var drip1=new THREE.Mesh(new THREE.CylinderGeometry(0.022,0.03,0.34,8), waxMat); drip1.position.set(0.082,1.7,0.02); lamp.add(drip1);
    var drip1b=new THREE.Mesh(new THREE.SphereGeometry(0.03,10,8), waxMat); drip1b.position.set(0.082,1.53,0.02); lamp.add(drip1b);
    var drip2=new THREE.Mesh(new THREE.CylinderGeometry(0.016,0.022,0.2,8), waxMat); drip2.position.set(-0.06,1.62,0.06); lamp.add(drip2);
    var puddle=new THREE.Mesh(new THREE.SphereGeometry(0.15,18,10), waxMat); puddle.position.y=0.9; puddle.scale.set(1,0.16,1); lamp.add(puddle);
    var wick=new THREE.Mesh(new THREE.CylinderGeometry(0.008,0.008,0.06,6), new THREE.MeshBasicMaterial({color:0x201008})); wick.position.y=2.0; lamp.add(wick);
    // small flame sprite: near-white core, amber edge (additive)
    var flameG=new THREE.Group(); flameG.position.set(0,2.06,0); lamp.add(flameG); this.candleFlame=flameG;
    // tall tapered teardrop: blue base tinge, pale core low, amber body, deep-orange tip
    var fBlue=new THREE.Mesh(new THREE.SphereGeometry(0.028,12,12), new THREE.MeshBasicMaterial({color:0x5a86c8,transparent:true,opacity:0.5,blending:THREE.AdditiveBlending,depthWrite:false})); fBlue.position.y=-0.01; fBlue.scale.set(1,0.8,1); flameG.add(fBlue);
    var fCore=new THREE.Mesh(new THREE.SphereGeometry(0.022,12,12), new THREE.MeshBasicMaterial({color:0xfff2d2})); fCore.position.y=0.02; fCore.scale.set(1,1.5,1); flameG.add(fCore);
    var fBody=new THREE.Mesh(new THREE.ConeGeometry(0.05,0.2,16), new THREE.MeshBasicMaterial({color:0xffa63c,transparent:true,opacity:0.85,blending:THREE.AdditiveBlending,depthWrite:false})); fBody.position.y=0.09; flameG.add(fBody);
    var fTip=new THREE.Mesh(new THREE.ConeGeometry(0.03,0.16,16), new THREE.MeshBasicMaterial({color:0xff7a20,transparent:true,opacity:0.7,blending:THREE.AdditiveBlending,depthWrite:false})); fTip.position.y=0.17; flameG.add(fTip);
    // key light at the flame — warm ~1900K, strong inverse-square falloff
    var flame=this.lampLight=new THREE.PointLight(0xff9532, 5.2, 14, 2.2); flame.position.set(-1.5,deskTopY+2.08,0.4); flame.castShadow=true; scene.add(flame);
    // Shadow acne fix. An unbiased point-light cube shadow map self-shadows every surface it
    // touches, which showed up as black lines crawling over the doors and panelling as the
    // candles came up and the camera moved. normalBias offsets the lookup along the surface
    // normal — it kills the striping without the light leaking under objects (peter-panning).
    flame.shadow.mapSize.width=flame.shadow.mapSize.height=this.mobile?1024:2048;
    flame.shadow.bias=-0.0016;
    flame.shadow.normalBias=0.045;
    flame.shadow.radius=2.0;
    flame.shadow.camera.near=0.35;
    flame.shadow.camera.far=16;
    flame.shadow.mapSize.set(this.mobile?512:1024,this.mobile?512:1024); flame.shadow.camera.near=0.3; flame.shadow.camera.far=9; flame.shadow.normalBias=0.035; flame.shadow.bias=-0.0005; flame.shadow.radius=4;
    this._flameBaseInt=5.2; this._flameBasePos=flame.position.clone();
    var roomFill=new THREE.PointLight(0xffcf90, 0.55, 8, 2.2); roomFill.position.set(0.4,1.2,0.2); scene.add(roomFill);   // low even fill so the two candles do the grading; back wall stays dark
    var bookFill=new THREE.PointLight(0xffd9a0, 0.7, 7, 2.2); bookFill.position.set(2.4,deskTopY+1.2,1.2); scene.add(bookFill);
    // soft warm pool the flame throws across the desk
    var glow=new THREE.Mesh(new THREE.PlaneGeometry(2.4,2.4), new THREE.MeshBasicMaterial({map:radialSprite(),transparent:true,opacity:0.4,blending:THREE.AdditiveBlending,depthWrite:false,color:0xffb060}));
    glow.rotation.x=-Math.PI/2; glow.position.set(-1.4,deskTopY+0.02,0.55); scene.add(glow);
    // contact shadow under the candlestick base
    var candleSh=new THREE.Mesh(new THREE.PlaneGeometry(0.9,0.9), new THREE.MeshBasicMaterial({map:radialSprite(),color:0x000000,transparent:true,opacity:0.3,depthWrite:false}));
    candleSh.rotation.x=-Math.PI/2; candleSh.position.set(-1.5,deskTopY+0.02,0.4); scene.add(candleSh);
    // SECOND candlestick on the right — burned noticeably lower, more wax on the pan (visibly different)
    var lamp2=new THREE.Group(); lamp2.position.set(1.55,deskTopY,0.95); scene.add(lamp2);
    lamp2.add(new THREE.Mesh(new THREE.CylinderGeometry(0.28,0.38,0.10,32), brass)).castShadow=true;
    var knop2a=new THREE.Mesh(new THREE.SphereGeometry(0.13,20,16), brass); knop2a.position.y=0.2; knop2a.scale.set(1,0.7,1); lamp2.add(knop2a);
    var stem2=new THREE.Mesh(new THREE.CylinderGeometry(0.07,0.095,0.44,20), brass); stem2.position.y=0.44; lamp2.add(stem2);
    var pan2=new THREE.Mesh(new THREE.CylinderGeometry(0.25,0.15,0.06,28), brass); pan2.position.y=0.74; pan2.castShadow=true; lamp2.add(pan2);
    var socket2=new THREE.Mesh(new THREE.CylinderGeometry(0.11,0.13,0.14,20), brass); socket2.position.y=0.84; lamp2.add(socket2);
    var candle2=new THREE.Mesh(new THREE.CylinderGeometry(0.088,0.10,0.42,20), waxMat); candle2.position.y=1.07; candle2.castShadow=true; lamp2.add(candle2);   // much shorter
    var pool2=new THREE.Mesh(new THREE.SphereGeometry(0.11,18,12), waxMat); pool2.position.y=1.27; pool2.scale.set(1,0.5,1); lamp2.add(pool2);
    var puddle2=new THREE.Mesh(new THREE.SphereGeometry(0.2,18,10), waxMat); puddle2.position.y=0.78; puddle2.scale.set(1,0.2,1); lamp2.add(puddle2);   // more built-up wax
    var drip2a=new THREE.Mesh(new THREE.CylinderGeometry(0.02,0.028,0.26,8), waxMat); drip2a.position.set(0.085,0.92,0.02); lamp2.add(drip2a);
    var wick2=new THREE.Mesh(new THREE.CylinderGeometry(0.008,0.008,0.05,6), new THREE.MeshBasicMaterial({color:0x201008})); wick2.position.y=1.31; lamp2.add(wick2);
    var flameG2=new THREE.Group(); flameG2.position.set(0,1.37,0); lamp2.add(flameG2); this.candleFlame2=flameG2;
    var fBlue2=new THREE.Mesh(new THREE.SphereGeometry(0.026,12,12), new THREE.MeshBasicMaterial({color:0x5a86c8,transparent:true,opacity:0.5,blending:THREE.AdditiveBlending,depthWrite:false})); fBlue2.position.y=-0.01; fBlue2.scale.set(1,0.8,1); flameG2.add(fBlue2);
    var fCore2=new THREE.Mesh(new THREE.SphereGeometry(0.02,12,12), new THREE.MeshBasicMaterial({color:0xfff2d2})); fCore2.position.y=0.02; fCore2.scale.set(1,1.5,1); flameG2.add(fCore2);
    var fBody2=new THREE.Mesh(new THREE.ConeGeometry(0.045,0.18,16), new THREE.MeshBasicMaterial({color:0xffa63c,transparent:true,opacity:0.85,blending:THREE.AdditiveBlending,depthWrite:false})); fBody2.position.y=0.08; flameG2.add(fBody2);
    var fTip2=new THREE.Mesh(new THREE.ConeGeometry(0.026,0.14,16), new THREE.MeshBasicMaterial({color:0xff7a20,transparent:true,opacity:0.7,blending:THREE.AdditiveBlending,depthWrite:false})); fTip2.position.y=0.15; flameG2.add(fTip2);
    var fHalo2=new THREE.Sprite(new THREE.SpriteMaterial({map:radialSprite(),color:0xffb45a,transparent:true,opacity:0.32,blending:THREE.AdditiveBlending,depthWrite:false})); fHalo2.scale.set(0.7,0.9,1); fHalo2.position.y=0.08; flameG2.add(fHalo2);
    // second candle: light ONLY (no shadow) for performance; primary candle casts the shadows
    var flame2=this.lampLight2=new THREE.PointLight(0xff9a38, 3.4, 12, 2.2); flame2.position.set(1.55,deskTopY+1.4,0.95); scene.add(flame2);
    this._flame2BaseInt=3.4; this._flame2BasePos=flame2.position.clone();
    var candleSh2=new THREE.Mesh(new THREE.PlaneGeometry(0.85,0.85), new THREE.MeshBasicMaterial({map:radialSprite(),color:0x000000,transparent:true,opacity:0.3,depthWrite:false}));
    candleSh2.rotation.x=-Math.PI/2; candleSh2.position.set(1.55,deskTopY+0.02,0.95); scene.add(candleSh2);
    // faint bloom halo on the primary flame too
    var fHalo=new THREE.Sprite(new THREE.SpriteMaterial({map:radialSprite(),color:0xffb45a,transparent:true,opacity:0.34,blending:THREE.AdditiveBlending,depthWrite:false})); fHalo.scale.set(0.85,1.1,1); fHalo.position.set(0,2.12,0); lamp.add(fHalo);

    // ===== stacked books (leather + gold band + page block) =====
    var pageMat=new THREE.MeshStandardMaterial({color:0xb99f5f,roughness:0.7,metalness:0.15,envMapIntensity:0.3,emissive:0x3a3016,emissiveIntensity:0.35});
    var books=[[0x5a1f22,2.2,0.40],[0x233a2a,1.95,0.34],[0x8a6a3c,2.05,0.36]];
    var gilt=new THREE.MeshStandardMaterial({color:0xcaa04a, roughness:0.35, metalness:0.7, envMapIntensity:1.2, emissive:0x2a1e08, emissiveIntensity:0.3});
    // one volume lying FLAT beneath the stack
    (function(){ var g=makeBook(1.5,0.34,1.15,0x3a2416,true);
      g.position.set(2.55,deskTopY+0.17,-1.15); g.rotation.y=0.12;
      g.traverse(function(o){ if(o.isMesh){ o.castShadow=true; o.receiveShadow=true; } }); scene.add(g); })();
    var by=deskTopY+0.34;
    books.forEach(function(b,i){ var w=Math.min(b[1],1.5),h=b[2],d=1.15;
      var g=makeBook(w,h,d,b[0],true);
      var csh=new THREE.Mesh(new THREE.PlaneGeometry(w*1.15,d*1.1), new THREE.MeshBasicMaterial({map:radialSprite(),color:0x000000,transparent:true,opacity:0.22,depthWrite:false}));
      csh.rotation.x=-Math.PI/2; csh.position.set(0,-h/2-0.001,0); g.add(csh);
      g.position.set(2.55+(i%2?0.1:-0.08), by+h/2, -1.15+i*0.06); g.rotation.y=0.12-i*0.05+(i%2?0.04:-0.04); by+=h;   // fore-edge (cream + coloured bands) faces the camera
      g.traverse(function(o){ if(o.isMesh && o.material!==csh.material) { o.castShadow=true; o.receiveShadow=true; } }); scene.add(g); });
    // a fountain pen resting on the books
    var pen=new THREE.Group(); pen.position.set(2.8,by+0.06,-0.7); pen.rotation.set(0,0.5,0.16); scene.add(pen);
    pen.add(new THREE.Mesh(new THREE.CylinderGeometry(0.05,0.05,1.1,16), new THREE.MeshStandardMaterial({color:0x14100a,roughness:0.3,metalness:0.2})));
    var nib=new THREE.Mesh(new THREE.CylinderGeometry(0.005,0.05,0.24,16), brass); nib.position.y=0.62; pen.add(nib);

    // ===== handwritten letter sheets on the desk (in front of the envelope) =====
    var lm=letterMat();
    // polygonOffset so the sheets always win depth over the desk beneath (kills z-fight flicker without
    // needing to float them). They sit FLAT and LOW on the front strip of the desk, clear of the
    // envelope's footprint — so they can't phase up through the letter as the camera comes in.
    lm.polygonOffset=true; lm.polygonOffsetFactor=-2; lm.polygonOffsetUnits=-2;
    var pOff=[[0.35,0.07],[-0.55,-0.16],[1.05,0.24]];
    pOff.forEach(function(p,i){
      var sh=new THREE.Mesh(new THREE.PlaneGeometry(1.15,0.95), new THREE.MeshBasicMaterial({map:radialSprite(),color:0x000000,transparent:true,opacity:0.16,depthWrite:false}));
      sh.rotation.x=-Math.PI/2; sh.position.set(p[0]*0.7,deskTopY+0.008+i*0.005,1.12); scene.add(sh);
      var pl=new THREE.Mesh(new THREE.PlaneGeometry(1.25,0.95), lm);
      pl.rotation.x=-Math.PI/2; pl.rotation.z=p[1]; pl.position.set(p[0]*0.7,deskTopY+0.014+i*0.005,1.1); pl.renderOrder=2+i; pl.receiveShadow=true; scene.add(pl); });
  };

  WeddingBook.prototype._setDoors=function(p){
    if(!this.doorL) return;
    var cp=clamp(p,0,1), a=easeInOut(cp)*(122*Math.PI/180);
    this.doorL.rotation.y= a;
    this.doorR.rotation.y=-a;
    // warm light grows with the parting gap during the read/open, then FADES OUT once the doors are open
    var seep=this._readSeep||0;
    var gap=Math.max(cp, 0);
    var doneFade=1-clamp(cp/0.15,0,1);                     // beam dies on first door motion, gone by 15% open
    var base=seep*0.5*doneFade;
    // every one of these is scaled by seep so nothing leaks light before the first candle
    if(this.transGlass && this._transBase){
      this.transGlass.material.opacity=this._transBase.glass*seep;
      this.transGlass.visible=seep>0.004;
    }
    if(this.transGlow && this._transBase){
      this.transGlow.material.opacity=this._transBase.glow*seep;
      this.transGlow.visible=seep>0.004;
    }
    if(this.blade){ this.blade.scale.x=(0.1+seep*0.05); this.blade.material.opacity=Math.min((0.28+base*0.8),0.95)*doneFade*seep; }
    if(this.bladeGlow){ this.bladeGlow.scale.x=0.3+seep*0.35; this.bladeGlow.material.opacity=Math.min(base*0.6,0.6)*doneFade*seep; }
    if(this.floorSpill){ this.floorSpill.scale.set(0.4+gap*1.2, 0.5+gap*0.8, 1); this.floorSpill.material.opacity=Math.min(seep*0.5,0.5)*doneFade*seep; }
    if(this.plaque){
      // Slow, graceful fade: the sign holds fully readable through the first part of the swing, then
      // dissolves gradually as the doors open (gone by ~68% open). It's parented to the frame (doesn't
      // rotate with the leaves), so a lingering fade reads as the sign dimming away, not a flat slab.
      // ...and it has to arrive first: _signGlow brings it up out of total darkness before
      // any candle is lit, so the sign is the only thing in the frame for a beat.
      var glowIn=(this._signGlow==null)?1:this._signGlow;
      var pf=(1-easeInOut(clamp((cp-0.12)/0.56,0,1)))*glowIn;
      this.plaque.material.opacity=pf; this.plaque.visible=pf>0.002;
      // The sign is the only lit thing on screen while the hall is dark, so push the
      // halo harder then and let it settle back once the candles take over.
      if(this.plaqueGlow) this.plaqueGlow.material.opacity=pf*(0.5+(1-(this._readSeep||0))*0.5);
    }
  };

  WeddingBook.prototype.playIntro=function(reduced){
    if(this.phase!=="portal") return;
    if(this._readT0==null) this._readT0=performance.now();   // safety: candles ignite with the intro even if beginRead() was skipped
    this.reduced=!!reduced;
    if(reduced){
      this.setQuality(1);
      this._setDoors(1); this.env.rotation.x=0; this.env.position.y=0; this.phase="await";
      if(this.onIntroDone){ var cb=this.onIntroDone; this.onIntroDone=null; cb(); } return;
    }
    // ramp the render resolution back up as the doors start to open (replaces the expensive gate CSS blur)
    var self=this; [[0,0.5],[140,0.72],[300,1.0]].forEach(function(s){ setTimeout(function(){ self.setQuality(s[1]); }, s[0]); });
    // share the reveal clock with beginRead() so the beats and the music stay locked together
    this.phase="intro"; this._pStart=this._readT0||performance.now(); this._durIntro=REVEAL.total; this._flashT0=0;
    this._beats={};
    var au=window.WalimaAudio;
    // hand the music the exact lead time so the vocal lands on the door opening
    if(au){ au.startMusic(REVEAL.doorOpen/1000); au.setMuffle(1, 0.1); }
  };

  /* fire a one-shot beat once the reveal clock passes `atMs` */
  WeddingBook.prototype._beat=function(name, atMs, now, fn){
    if(!this._beats || this._beats[name]) return;
    if(this._readT0==null || (now-this._readT0) < atMs) return;
    this._beats[name]=1; try{ fn(); }catch(e){}
  };

  WeddingBook.prototype.beginRead=function(){ this._readT0=performance.now(); };  // starts the reveal clock
  // ignition curve: 0 until (readT0+delay), a quick strike/flare to ~1.35 over 150ms, settling to 1.0 over the next 400ms
  WeddingBook.prototype._ignAt=function(now, delayMs){
    if(this._readT0==null) return 0;
    var e=(now-this._readT0)-(delayMs||0);
    if(e<=0) return 0;
    if(e<150) return (e/150)*1.35;
    if(e<550) return 1.35 + (1.0-1.35)*((e-150)/400);
    return 1.0;
  };
  WeddingBook.prototype._introFrame=function(now){
    var portal=(this.phase==="portal");
    if(portal && !this._portalT0) this._portalT0=now;
    // room brightness follows the CANDLES, not the clock: pitch dark until the first
    // sconce catches at REVEAL.candle1, then up over 1.5s (covering the second strike).
    var rel = this._readT0 ? (now-this._readT0) : -1;
    this._readSeep = (rel<0 || portal) ? 0 : clamp((rel-REVEAL.candle1)/1500,0,1);
    // the WALIMA plaque glowing up out of total darkness — hidden entirely during the
    // gate so the first thing the guest ever sees in the scene is it fading in
    this._signGlow = (rel<0 || portal) ? 0
                   : easeInOut(clamp((rel-REVEAL.signStart)/(REVEAL.signEnd-REVEAL.signStart),0,1));
    // the hall itself only exists once a candle is lit
    this._setRoomLight(this._readSeep);
    // fade the dim hall to black the instant the panel goes
    this._darkT = (rel<0 || portal) ? 0 : clamp(rel/REVEAL.dark,0,1);

    if(!portal){
      var self=this, au=window.WalimaAudio;
      this._beat("sign",  REVEAL.signStart, now, function(){ au&&au.sfx("signGlow"); });
      this._beat("cd1",   REVEAL.candle1,   now, function(){ au&&au.sfx("candleLight", 0); });
      this._beat("cd2",   REVEAL.candle2,   now, function(){ au&&au.sfx("candleLight", 0); });
      this._beat("door",  REVEAL.doorOpen,  now, function(){
        if(au){ au.sfx("doorOpen"); au.setMuffle(0.5, 3.2); }   // door parts — music opens up
      });
      this._beat("thru",  REVEAL.doorOpen+3800, now, function(){
        if(au){ au.sfx("whoosh"); au.setMuffle(0.1, 2.6); }     // moving through the doorway
      });
      this._beat("insid", REVEAL.total-900, now, function(){ au&&au.setMuffle(0, 1.4); });
    }
    var t = portal ? clamp((now-this._portalT0)/26000,0,1)*0.14   // slow continuous forward drift during the gate
                   : clamp((now-this._pStart)/this._durIntro,0,1);
    var e=easeInOut(t);
    // BEATS overlap, with small holds. Doors swing (ease) and finish by ~42%; a still beat; the camera
    // travels the whole way (accel/decel) so it's already moving before the doors finish and still gliding
    // in as the envelope begins; the envelope lifts from ~55% — a breath after the doors settle.
    // door swing: a SINGLE gentle ease over a wide, later window so the leaves accelerate softly and
    // glide to rest (no double-ease "smashed open" spike in the middle); finishes ~56% into the intro.
    // doors hold shut through the dark/sign/candle beats, then part from REVEAL.doorOpen
    var dS=REVEAL.doorOpen/REVEAL.total, dE=REVEAL.doorEnd/REVEAL.total;
    this._setDoors(portal?0:seg(t,dS,dE));
    // camera dolly: holds still while the candles light (you are standing in the dark looking at
    // the door), then travels in with the swing and decelerates onto the envelope.
    var ce=easeInOut(seg(t,dS,0.97));
    this.cam.position.set(0, lerp(1.55,0.06,ce), lerp(20.0,4.7,ce));
    this.cam.lookAt(0, lerp(1.15,0.06,ce), lerp(6.5,0,ce));
    // envelope: lift is a FUNCTION of the rotation (single arc) so the lowest corner clears the
    // desk at every frame — peak height at mid-rotation, where the swinging corner is lowest.
    var rise=portal?0:easeInOut(seg(t,0.74,0.99));   // starts before the camera fully settles; small hold at the top
    var rot=easeInOut(seg(rise,0.05,0.95));
    var baseY=lerp(-0.68,0,rot);
    var ey=baseY + 0.36*Math.sin(rot*Math.PI);
    this.env.rotation.x=lerp(-Math.PI/2,0,rot);
    this.env.rotation.z=0;
    this.env.position.y=ey;
    if(this.bloom) this.bloom.strength=0.18;
    if(this.interior) this.interior.intensity=0;
    // Gate: a dim, readable hall. Then the panel goes and the hall fades to BLACK (darkT),
    // and the only thing that brings it back is the candles catching (readSeep).
    // Pitch black through the gate and the sign beat; the candles bring the room back.
    if(this.ambient) this.ambient.intensity = portal ? 0.0 : this._readSeep*0.9;
    // RADIAL (zoom) blur driven by camera speed — centre sharp, off entirely at the desk. No flash/exposure ramp.
    // exposure comes up with the candles (kept high enough that the self-lit plaque reads)
    if(this.renderer) this.renderer.toneMappingExposure=lerp(0.80,0.90,this._readSeep);
    if(this.radialPass){
      var cz=this.cam.position.z, spd=(this._lastCamZ==null)?0:Math.abs(this._lastCamZ-cz); this._lastCamZ=cz;
      var target=portal?0:clamp(spd*0.9,0,0.65);
      this._radial=(this._radial==null)?target:(this._radial+(target-this._radial)*0.25);   // smooth
      this.radialPass.uniforms.strength.value=this._radial;
    }
    var vg=document.getElementById("wb-vignette"); if(vg) vg.style.opacity=(portal?1:clamp(1-t/0.34,0,1)).toFixed(3);
    if(!portal && t>=1){
      this.phase="await"; this.env.rotation.x=0; this.env.position.y=0;
      if(this.ambient) this.ambient.intensity=0.9;  // restore to normal brightness when intro completes
      if(this.renderer) this.renderer.toneMappingExposure=0.9;
      if(this.radialPass) this.radialPass.uniforms.strength.value=0;
      if(this.onIntroDone){ var cb=this.onIntroDone; this.onIntroDone=null; cb(); }
    }
  };

  // ---------- public ----------
  // STOPS mark the end of each stage in the pA timeline: [stage2, stage3, stage4]
  var STOPS=[0.24, 0.56, 1.0];
  WeddingBook.prototype.open=function(reduced){
    if(this.phase!=="await" && this.phase!=="idle") return;
    if(this.frontWall) this.frontWall.visible=false;   // doorway wall done its job; free the camera to pull back
    this.reduced=!!reduced;
    if(this.stepMode){ this._stepIdx=-1; this.phase="pause"; this.pA=0;
      if(this.onStageReached) this.onStageReached(2); return; }   // showing stage 1, next tap → stage 2
    this.phase="seq"; this._pStart=performance.now(); this._durA=reduced?700:7300;   // +40%
  };
  WeddingBook.prototype._animTo=function(target){
    this._pFrom=this.pA; this._pTarget=target; this._pStart=performance.now();
    this._durStep=this.reduced?300:1800; this.phase="step";   // +40%
  };
  WeddingBook.prototype.advance=function(){        // test mode: play the next stage
    if(this.phase!=="pause") return;
    if(this._stepIdx>=STOPS.length-1) return;
    this._stepIdx++; this._animTo(STOPS[this._stepIdx]);
  };
  WeddingBook.prototype.extractLetter=function(){
    if(this.phase!=="hold") return;
    this.phase="extract"; this._pStart=performance.now(); this._durB=this.reduced?500:4200;   // +40%
  };
  WeddingBook.prototype.skip=function(){ this.pA=1; this.pB=1; this.phase="done";
    if(!this.settled){ this.settled=true; if(this.onOpened) this.onOpened(); } };
  /* Returning guest who has already sealed their RSVP: park the scene in its finished
     state WITHOUT firing onOpened (the caller is showing the invitation itself). */
  WeddingBook.prototype.skipToSettled=function(){
    this.pA=1; this.pB=1; this.phase="done"; this.settled=true;
    this._readT0=performance.now()-REVEAL.total;
    this._readSeep=1; this._signGlow=0; this._darkT=1;
    if(this.frontWall) this.frontWall.visible=false;
    if(this.ambient) this.ambient.intensity=0.9;
    if(this._setRoomLight) this._setRoomLight(1);
    if(this.renderer) this.renderer.toneMappingExposure=0.9;
    this.setQuality(1);
  };
  WeddingBook.prototype.setStepMode=function(on){ this.stepMode=!!on; };
  WeddingBook.prototype.reject=function(){ this._rejectStart=performance.now(); };
  WeddingBook.prototype.setLanguage=function(l){ this._lang=l; if(this._applyCardTex) this._applyCardTex(); };

  WeddingBook.prototype._resize=function(){
    var W=this.glMount.clientWidth||window.innerWidth, H=this.glMount.clientHeight||window.innerHeight;
    var asp=W/H;
    this.cam.aspect=asp;
    // Portrait needs a wider vertical FOV so the door and desk aren't cropped side-to-side, but
    // 62 was too much — it pushed the view above the room. 48 fits the doorway on a 20:9 phone
    // while keeping the ceiling in frame.
    this.cam.fov = asp<1 ? clamp(34/Math.max(asp,0.52), 34, 48) : 34;
    this.cam.updateProjectionMatrix();
    var cap=Math.min(window.devicePixelRatio, this.mobile?1.5:2);
    var q=this._qual==null?1:this._qual;
    if(this.composer){
      this.renderer.setPixelRatio(cap);
      this.renderer.setSize(W,H);
      if(this.composer.setPixelRatio) this.composer.setPixelRatio(cap*q);   // composer targets at q res; final canvas full → upscale blur during gate
      this.composer.setSize(W,H);
    } else {
      this.renderer.setPixelRatio(cap*q);
      this.renderer.setSize(W,H);
    }
  };
  WeddingBook.prototype.setQuality=function(q){ this._qual=clamp(q,0.18,1); this._resize(); };

  // ---------- per-frame ----------
  WeddingBook.prototype._frame=function(){
    var now=performance.now(), tsec=(now-this._t0)/1000, self=this;
    // ---- visibility culling (6.2): the hallway (door leaves, frame, transom, sconces, corridor) is only
    // seen during the gate + intro; hide it entirely once we're through the doorway so it isn't processed
    // during the envelope close-up. The bookcase is hidden during the gate (occluded by the closed doors).
    var inHall=(this.phase==="portal"||this.phase==="intro");
    if(this.frontWall && this.frontWall.visible!==inHall) this.frontWall.visible=inHall;
    if(this.bookcase){ var bcVis=this.phase!=="portal"; if(this.bookcase.visible!==bcVis) this.bookcase.visible=bcVis; }
    // ---- shadow cost (6.3/6.4): freeze the shadow map once we reach the (static) close-up — render it one
    // final frame, then stop the per-frame shadow re-render. No material recompile (autoUpdate flag only).
    if(this.renderer){
      if(inHall){ if(!this.renderer.shadowMap.autoUpdate){ this.renderer.shadowMap.autoUpdate=true; } }
      else if(this.renderer.shadowMap.autoUpdate){ this.renderer.shadowMap.needsUpdate=true; this.renderer.shadowMap.autoUpdate=false; }
    }
    // ---- candle flicker throttled to ~24/sec (6.4): recompute the noise/ignition only every ~42ms,
    // hold values between. Candlelight doesn't need 60Hz updates and it halves this block's cost.
    var doFlick = (now-(this._lastFlick||0))>=42;
    if(doFlick){ this._lastFlick=now;
    var ignL=this._ignAt(now,REVEAL.candle1);
    if(this.lampLight){
      var n=Math.sin(tsec*11.0)*0.5+Math.sin(tsec*17.3)*0.3+Math.sin(tsec*6.1)*0.2;
      this.lampLight.intensity=this._flameBaseInt*(1+n*0.10)*ignL;
      // NO positional jitter on the shadow-casting light (it was crawling the shadow map / acne)
      if(this.candleFlame){ var gL=Math.min(1,ignL); this.candleFlame.visible=ignL>0.02; this.candleFlame.scale.set((1+n*0.03)*gL, (1+n*0.08)*gL, (1+n*0.03)*gL); this.candleFlame.rotation.z=Math.sin(tsec*2.3)*0.09; }
    }
    if(this.lampLight2){
      var o=2.7;
      var n2=Math.sin((tsec+o)*12.4)*0.5+Math.sin((tsec+o)*8.1)*0.3+Math.sin((tsec+o)*19.7)*0.2;
      var ignL2=this._ignAt(now,REVEAL.candle2+70);   // right desk candle catches a touch after the left
      this.lampLight2.intensity=this._flame2BaseInt*(1+n2*0.11)*ignL2;
      if(this.candleFlame2){ var gL2=Math.min(1,ignL2); this.candleFlame2.visible=ignL2>0.02; this.candleFlame2.scale.set((1+n2*0.04)*gL2, (1+n2*0.09)*gL2, (1+n2*0.04)*gL2); this.candleFlame2.rotation.z=Math.sin((tsec+1.4)*2.7)*0.1; }
    }
    if(this.sconceLights){ for(var si=0;si<this.sconceLights.length;si++){ var S=this.sconceLights[si];
      var ns=Math.sin((tsec+S.off)*10.2)*0.5+Math.sin((tsec+S.off)*15.6)*0.3+Math.sin((tsec+S.off)*7.4)*0.2;
      var igS=this._ignAt(now, si===0?REVEAL.candle1:REVEAL.candle2);   // one sconce, then the other — a beat apart
      S.light.intensity=S.base*(1+ns*0.12)*igS;
      if(S.flame){ var gS=Math.min(1,igS); S.flame.visible=igS>0.02; S.flame.scale.set((1+ns*0.04)*gS,(1+ns*0.09)*gS,(1+ns*0.04)*gS); S.flame.rotation.z=Math.sin((tsec+S.off)*2.5)*0.1; }
    } }
    } // end flicker throttle
    if(this.letterFill){
      var seqLive=(this.phase==="seq"||this.phase==="hold"||this.phase==="step"||this.phase==="extract");
      var lfTarget = seqLive ? 0.95 : (this.phase==="done" ? 0.4 : 0.0);
      this.letterFill.intensity += (lfTarget - this.letterFill.intensity)*0.12;   // smooth fade in/out
    }
    if(this._cardMat){
      // as the letter grows to fill the screen it stops being scenery and becomes a document: ramp its
      // material to flat/evenly-lit (emissive carries the texture) so it can't clip bright or fall dark,
      // and lands matching the brightness of the DOM invitation page that replaces it (no visible jump).
      var full = this.phase==="done" ? 1 : (this.phase==="extract" ? easeInOut(clamp(this.pB,0,1)) : 0);
      var eI = lerp(0.42, 1.0, full);
      if(this._cardMat.emissiveIntensity!==eI){ this._cardMat.emissiveIntensity=eI; this._cardMat.needsUpdate=false; }
    }
    if(this.phase==="seq"){ this.pA=clamp((now-this._pStart)/this._durA,0,1);
      // sound for each stage of the envelope opening, keyed off the same STOPS the animation uses
      var au=window.WalimaAudio, pa=this.pA, sq=(this._seqFx=this._seqFx||{});
      function fx(k,at,fn){ if(!sq[k] && pa>=at){ sq[k]=1; try{ fn(); }catch(e){} } }
      fx("lift", 0.02, function(){ au&&au.sfx("lift"); });
      fx("seal", 0.16, function(){ au&&au.sfx("sealCrack"); });
      fx("flap", 0.26, function(){ au&&au.sfx("paper", 4); });
      fx("flip", 0.50, function(){ au&&au.sfx("flip"); });
      fx("open", 0.86, function(){ au&&au.sfx("paper", 5); });
      if(this.pA>=1){ this.phase="hold"; if(this.onFlapOpen) this.onFlapOpen();
        // the letter comes out on its own — no extra tap required
        this.phase="extract"; this._pStart=now; this._durB=this.reduced?500:4200;
        if(au) au.sfx("slide");
      } }
    else if(this.phase==="step"){ var st=clamp((now-this._pStart)/this._durStep,0,1);
      this.pA=lerp(this._pFrom,this._pTarget,easeInOut(st));
      if(st>=1){
        if(this._stepIdx>=STOPS.length-1){ this.phase="hold"; if(this.onFlapOpen) this.onFlapOpen(); }
        else { this.phase="pause"; if(this.onStageReached) this.onStageReached(this._stepIdx+3); }
      } }
    else if(this.phase==="extract"){ this.pB=clamp((now-this._pStart)/this._durB,0,1);
      if(this.pB>=1 && !this.settled){ this.phase="done"; this.settled=true;
        if(window.WalimaAudio) window.WalimaAudio.sfx("settle");
        if(this.onOpened) this.onOpened(); } }
    var pA=this.pA, pB=this.pB, active=this.phase!=="idle";

    // idle float
    var idle=active?0:1;
    this.env.position.y=Math.sin(tsec*0.7)*0.025*idle;
    this.env.rotation.z=Math.sin(tsec*0.5)*0.008*idle;

    if(this._rejectStart!=null){ var rt=(now-this._rejectStart)/480; if(rt>=1){this._rejectStart=null;}
      else { this.env.rotation.z+=Math.sin(rt*Math.PI*5)*(1-rt)*0.05; } }

    if(this.phase==="portal" || this.phase==="intro"){
      this._introFrame(now);
      if(this.composer) this.composer.render(); else this.renderer.render(this.scene,this.cam);
      return;
    }

    // ---- Stage 1→2: front V-flap lifts ----
    var s1=easeInOut(seg(pA,0.03,0.24));
    this.fFlapPivot.rotation.x=lerp(0,LIFT_ANGLE,s1);

    // ---- Stage 2→3: whole letter flips over (front → interior) ----
    var flip=easeInOut(seg(pA,0.26,0.56));
    this.env.rotation.x=lerp(0,Math.PI,flip);
    // swap which assembly is shown at the edge-on midpoint
    var showBack = flip>0.5;
    this.front.visible = !showBack && pB<1;
    this.back.visible  = showBack;

    // ---- Stage 3→4: the interior flap lifts, revealing medallion + card ----
    var s4=easeInOut(seg(pA,0.60,1.0));
    this.bFlapPivot.rotation.x=lerp(0,OPEN_ANGLE,s4);
    // emblem shows the moment we see the back (stage 3), on the folded-then-lifting flap
    if(this._medMesh){ this._medMesh.visible = showBack; }
    // the card stays hidden/tucked through stage 3; it only pokes out once the flap is opening (stage 4)
    this.card.visible = (s4>0.45) || this.phase==="extract" || this.phase==="done";
    // the pocket V-flaps belong to the OPEN envelope (stage 4) — hide them in stage 3 for the clean two-piece look
    var pv=(s4>0.35)||this.phase==="extract"||this.phase==="done";
    if(this._pocketGrp) this._pocketGrp.visible=pv;

    // ---- Extract: the card is drawn UP out of the slot behind the front paper, then forward & grows ----
    var rise=easeOut(seg(pB,0.0,0.55));
    var come=easeInOut(seg(pB,0.55,1.0));
    var pull=Math.sin(seg(pB,0.0,0.5)*Math.PI);            // the paper "gives" as the card is pulled out
    if(this._panel){ this._panel.position.z=0.16+pull*0.05; this._panel.scale.set(1,1+pull*0.02,1); }
    // the raised shield flap sits right where the card emerges — draw IT back (like holding the flap
    // aside) and KEEP it there once drawn, so it never swings back over the extracted letter.
    var flapBack=easeOut(seg(pB,0.0,0.5));
    if(this.bFlapPivot){ this.bFlapPivot.position.z = 0.10 - flapBack*0.55; }
    // 1) slide UP out of the slit, staying BEHIND the front panel (z<0.16) so it reads as emerging
    var cardY=lerp(this._cardHomeY, HH+PH*0.55, rise);
    cardY=lerp(cardY, 0.06, come);                          // 3) settle toward centre as it comes forward
    this.card.position.y=cardY;
    // 2) only AFTER it has fully cleared the panel top does it travel forward toward the camera
    this.card.position.z=lerp(0.05, 1.9, come);
    this.card.rotation.z=lerp(0,0.1,easeInOut(seg(pB,0.5,0.72)))*(1-easeInOut(seg(pB,0.72,1)));
    this.card.scale.setScalar(lerp(1,1.62,come));

    // back assembly recedes & fades as the letter takes over
    this.back.position.z = -0.004 + lerp(0,-1.0,come);
    var envFade=1-come;
    this._bFade.forEach(function(m){ if(m.material){ m.material.transparent=true; m.material.opacity=envFade; } });
    if(this._medMat){ this._medMat.transparent=true; this._medMat.opacity=come>0?envFade:1; }

    // interior warm glow while opening / emerging
    var glowFade = 1 - easeInOut(seg(pB,0.0,0.45));       // glow present at the reveal, gone once pulling
    var glowP = (this.phase==="extract"||this.phase==="done") ? 0.5 : seg(pA,0.55,1.0);
    var ev=Math.sin(clamp(glowP,0,1)*Math.PI), evS=Math.pow(ev,1.4);
    if(this.phase==="extract"||this.phase==="done") evS*=glowFade;
    this.interior.intensity=this.reduced?ev*0.35:evS*0.45;
    this.shafts.visible=false;   // shafts only add a hot spot once the opaque front paper is up; keep the soft point light instead
    this.shaftMat.opacity=this.reduced?0:evS*0.10;
    if(this.bloom) this.bloom.strength=0.18+evS*0.12;

    // camera tracks the flap: pitch UP for the raised flap (stages 2 & 4), pitch DOWN for the
    // hanging shield (stage 3, whose triangle + wax sit below centre). Always zoom out to fit.
    var st2=s1*(1-flip), dn=flip*(1-s4), up=s4;
    var openLift=easeInOut(seg(pA,0.0,0.24))*1.25;          // envelope rises off the desk to open — never clips the table
    this.env.position.y=openLift;
    var camY=lerp( 0.06 + 0.30*st2 - 0.06*dn + 0.85*up, 0.08, come) + openLift;
    var camZ=lerp( 4.7 + Math.max(1.95*dn, 4.2*up, 1.8*st2), 4.6, come);
    var lookY=lerp( 0.0 + 0.42*st2 - 0.42*dn + 1.05*up, 0.06, come) + openLift;
    this.cam.position.set(0,camY,camZ); this.cam.lookAt(0,lookY,0);

    if(this.composer) this.composer.render(); else this.renderer.render(this.scene,this.cam);
  };

  WeddingBook.prototype.dispose=function(){
    cancelAnimationFrame(this._raf);
    window.removeEventListener("resize",this._onResize);
    try{ this.renderer.dispose(); }catch(e){}
    try{ if(this.renderer.domElement.parentNode) this.renderer.domElement.parentNode.removeChild(this.renderer.domElement); }catch(e){}
  };

  window.WeddingBook=WeddingBook;
})();
