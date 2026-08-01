/* Walima — audio engine.
   Two jobs:
     1. MUSIC. Plays song-male.mp3, then song-female.mp3, then loops the pair.
        Routed through a lowpass so it can start "behind the door" (muffled, quiet)
        and open up to full clarity as the camera moves through the doorway.
        setMuffle(1) = heard through a closed door.  setMuffle(0) = in the room.
     2. SFX. Every effect is SYNTHESISED with the Web Audio API — no files to load,
        nothing to download, and each one is shaped to the beat it accompanies.

   Browsers block audio until a user gesture, so unlock() must be called from a
   real click/tap (the gate's ENTER button). Everything before that is a no-op. */
(function () {
  "use strict";

  var AC = window.AudioContext || window.webkitAudioContext;

  var A = {
    ctx: null,
    ready: false,
    muted: false,
    _music: null,        // <audio> element currently playing
    _srcNode: null,      // MediaElementAudioSourceNode
    _lp: null,           // muffle lowpass
    _musicGain: null,
    _sfxGain: null,
    _master: null,
    _noise: null,
    _track: 0,           // 0 = male, 1 = female
    _els: [],
    _muffle: 1,
    _stopped: false
  };

  // ---------- setup ----------
  A.unlock = function () {
    if (A.ready || !AC) return;
    try {
      var ctx = A.ctx = new AC();
      A._master = ctx.createGain();  A._master.gain.value = A.muted ? 0 : 1;
      A._master.connect(ctx.destination);

      A._musicGain = ctx.createGain(); A._musicGain.gain.value = 0;
      A._lp = ctx.createBiquadFilter(); A._lp.type = "lowpass";
      A._lp.frequency.value = 320; A._lp.Q.value = 0.9;
      A._musicGain.connect(A._lp); A._lp.connect(A._master);

      A._sfxGain = ctx.createGain(); A._sfxGain.gain.value = 0.9;
      A._sfxGain.connect(A._master);

      A.ready = true;
    } catch (e) { A.ready = false; }
    if (A.ctx && A.ctx.state === "suspended") { try { A.ctx.resume(); } catch (e) {} }
  };

  A.setMuted = function (m) {
    A.muted = !!m;
    if (A._master && A.ctx) {
      A._master.gain.cancelScheduledValues(A.ctx.currentTime);
      A._master.gain.linearRampToValueAtTime(A.muted ? 0 : 1, A.ctx.currentTime + 0.25);
    }
  };

  function noiseBuffer() {
    if (A._noise) return A._noise;
    var ctx = A.ctx, len = Math.floor(ctx.sampleRate * 2), b = ctx.createBuffer(1, len, ctx.sampleRate), d = b.getChannelData(0);
    for (var i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    A._noise = b; return b;
  }

  // ---------- music ----------
  var TRACKS = ["./assets/audio/song-male.mp3", "./assets/audio/song-female.mp3"];

  A.startMusic = function () {
    if (!A.ready || A._stopped) return;
    if (A._music) return;
    A._track = 0;
    playTrack(0);
    // fade in gently — it should creep in from behind the door
    A._musicGain.gain.cancelScheduledValues(A.ctx.currentTime);
    A._musicGain.gain.setValueAtTime(0.0001, A.ctx.currentTime);
    A._musicGain.gain.linearRampToValueAtTime(0.34, A.ctx.currentTime + 3.2);
  };

  function playTrack(i) {
    var el = A._els[i];
    if (!el) {
      el = A._els[i] = new Audio(TRACKS[i]);
      el.crossOrigin = "anonymous";
      el.preload = "auto";
    }
    el.currentTime = 0;
    A._music = el;
    try {
      if (!el._wired) { A._srcNode = A.ctx.createMediaElementSource(el); A._srcNode.connect(A._musicGain); el._wired = true; }
      else { /* already routed */ }
    } catch (e) {}
    el.onended = function () {
      if (A._stopped) return;
      A._track = (A._track + 1) % TRACKS.length;
      A._music = null;
      playTrack(A._track);
    };
    var p = el.play();
    if (p && p.catch) p.catch(function () {});
  }

  /* 1 = fully muffled (behind a closed door), 0 = fully open/in the room. */
  A.setMuffle = function (amount, seconds) {
    A._muffle = amount = Math.max(0, Math.min(1, amount));
    if (!A.ready || !A._lp) return;
    var t = A.ctx.currentTime, d = seconds == null ? 1.2 : seconds;
    // exponential in frequency = linear to the ear
    var f = Math.exp(Math.log(300) + (1 - amount) * (Math.log(20000) - Math.log(300)));
    var g = 0.34 + (1 - amount) * 0.46;
    try {
      A._lp.frequency.cancelScheduledValues(t);
      A._lp.frequency.setValueAtTime(A._lp.frequency.value, t);
      A._lp.frequency.exponentialRampToValueAtTime(Math.max(60, f), t + d);
      A._lp.Q.setValueAtTime(0.9 - (1 - amount) * 0.5, t);
      A._musicGain.gain.cancelScheduledValues(t);
      A._musicGain.gain.setValueAtTime(A._musicGain.gain.value, t);
      A._musicGain.gain.linearRampToValueAtTime(g, t + d);
    } catch (e) {}
  };

  A.duckMusic = function (to, seconds) {
    if (!A.ready) return;
    var t = A.ctx.currentTime;
    A._musicGain.gain.cancelScheduledValues(t);
    A._musicGain.gain.setValueAtTime(A._musicGain.gain.value, t);
    A._musicGain.gain.linearRampToValueAtTime(to, t + (seconds == null ? 1.0 : seconds));
  };

  A.stopMusic = function (fade) {
    A._stopped = true;
    if (!A.ready) return;
    var t = A.ctx.currentTime, d = fade == null ? 1.6 : fade;
    try {
      A._musicGain.gain.cancelScheduledValues(t);
      A._musicGain.gain.setValueAtTime(A._musicGain.gain.value, t);
      A._musicGain.gain.linearRampToValueAtTime(0.0001, t + d);
    } catch (e) {}
    setTimeout(function () { A._els.forEach(function (e) { try { e.pause(); } catch (x) {} }); }, d * 1000 + 60);
  };

  // ---------- SFX primitives ----------
  function env(node, t0, peak, attack, decay, hold) {
    var g = node.gain;
    g.setValueAtTime(0.0001, t0);
    g.exponentialRampToValueAtTime(Math.max(0.0002, peak), t0 + attack);
    if (hold) g.setValueAtTime(Math.max(0.0002, peak), t0 + attack + hold);
    g.exponentialRampToValueAtTime(0.0001, t0 + attack + (hold || 0) + decay);
  }

  function noiseVoice(t0, opts) {
    var ctx = A.ctx;
    var s = ctx.createBufferSource(); s.buffer = noiseBuffer(); s.loop = true;
    var f = ctx.createBiquadFilter(); f.type = opts.type || "bandpass";
    f.frequency.setValueAtTime(opts.f0, t0);
    if (opts.f1) f.frequency.exponentialRampToValueAtTime(opts.f1, t0 + (opts.sweep || opts.dur));
    f.Q.value = opts.Q == null ? 1.0 : opts.Q;
    var g = ctx.createGain();
    s.connect(f); f.connect(g); g.connect(A._sfxGain);
    env(g, t0, opts.peak, opts.attack || 0.01, opts.dur, opts.hold);
    s.start(t0); s.stop(t0 + (opts.attack || 0.01) + (opts.hold || 0) + opts.dur + 0.05);
    return g;
  }

  function toneVoice(t0, opts) {
    var ctx = A.ctx;
    var o = ctx.createOscillator(); o.type = opts.wave || "sine";
    o.frequency.setValueAtTime(opts.f0, t0);
    if (opts.f1) o.frequency.exponentialRampToValueAtTime(opts.f1, t0 + (opts.sweep || opts.dur));
    var g = ctx.createGain();
    o.connect(g); g.connect(A._sfxGain);
    env(g, t0, opts.peak, opts.attack || 0.006, opts.dur, opts.hold);
    o.start(t0); o.stop(t0 + (opts.attack || 0.006) + (opts.hold || 0) + opts.dur + 0.05);
    return g;
  }

  // ---------- the named effects ----------
  var FX = {
    // soft rising shimmer as the WALIMA plaque fades up out of the dark
    signGlow: function (t) {
      toneVoice(t, { wave: "sine", f0: 210, f1: 420, peak: 0.10, attack: 1.1, dur: 2.4, sweep: 2.0 });
      toneVoice(t + 0.05, { wave: "sine", f0: 315, f1: 630, peak: 0.055, attack: 1.3, dur: 2.4, sweep: 2.2 });
      noiseVoice(t, { type: "bandpass", f0: 900, f1: 2600, Q: 2.4, peak: 0.035, attack: 1.2, dur: 2.0, sweep: 1.8 });
    },
    // BAM — a candle catching. Percussive whoomph + bright flare + settling crackle.
    candleLight: function (t, bright) {
      var p = bright ? 1.0 : 0.86;
      // the strike
      noiseVoice(t, { type: "highpass", f0: 1800, f1: 5200, Q: 0.8, peak: 0.42 * p, attack: 0.004, dur: 0.11, sweep: 0.09 });
      // the whoomph of the flame taking
      noiseVoice(t + 0.01, { type: "bandpass", f0: 380, f1: 90, Q: 0.7, peak: 0.55 * p, attack: 0.012, dur: 0.55, sweep: 0.45 });
      toneVoice(t + 0.01, { wave: "sine", f0: 140, f1: 52, peak: 0.30 * p, attack: 0.012, dur: 0.5, sweep: 0.4 });
      // settling flame crackle
      for (var i = 0; i < 7; i++) {
        var d = 0.16 + Math.random() * 0.75;
        noiseVoice(t + d, { type: "bandpass", f0: 1400 + Math.random() * 2600, Q: 6, peak: 0.05 * p, attack: 0.002, dur: 0.05 });
      }
    },
    // the heavy doors parting — low rumble under a slow hinge creak
    doorOpen: function (t) {
      noiseVoice(t, { type: "lowpass", f0: 150, f1: 60, Q: 0.6, peak: 0.40, attack: 0.5, dur: 3.4, sweep: 3.0, hold: 0.7 });
      toneVoice(t + 0.15, { wave: "sine", f0: 44, f1: 30, peak: 0.34, attack: 0.7, dur: 3.0, sweep: 2.6, hold: 0.5 });
      // hinge — resonant band creeping upward
      noiseVoice(t + 0.45, { type: "bandpass", f0: 420, f1: 980, Q: 14, peak: 0.075, attack: 0.7, dur: 2.0, sweep: 1.9 });
      noiseVoice(t + 1.20, { type: "bandpass", f0: 610, f1: 1240, Q: 16, peak: 0.055, attack: 0.6, dur: 1.7, sweep: 1.6 });
    },
    // moving forward through the doorway
    whoosh: function (t) {
      noiseVoice(t, { type: "bandpass", f0: 240, f1: 1500, Q: 0.9, peak: 0.16, attack: 0.55, dur: 1.5, sweep: 1.4 });
    },
    // envelope lifting off the desk
    lift: function (t) {
      noiseVoice(t, { type: "bandpass", f0: 700, f1: 1900, Q: 1.4, peak: 0.13, attack: 0.28, dur: 0.85, sweep: 0.8 });
      toneVoice(t, { wave: "sine", f0: 190, f1: 340, peak: 0.05, attack: 0.3, dur: 0.8, sweep: 0.75 });
    },
    // wax seal giving way
    sealCrack: function (t) {
      noiseVoice(t, { type: "bandpass", f0: 2400, Q: 3, peak: 0.30, attack: 0.002, dur: 0.09 });
      toneVoice(t, { wave: "triangle", f0: 320, f1: 120, peak: 0.16, attack: 0.003, dur: 0.16, sweep: 0.14 });
    },
    // the flap opening / paper unfolding
    paper: function (t, n) {
      n = n || 3;
      for (var i = 0; i < n; i++) {
        var d = i * (0.075 + Math.random() * 0.06);
        noiseVoice(t + d, { type: "highpass", f0: 2000 + Math.random() * 1800, Q: 0.7, peak: 0.11 + Math.random() * 0.05, attack: 0.005, dur: 0.13 + Math.random() * 0.09 });
      }
    },
    // the whole envelope turning over
    flip: function (t) {
      noiseVoice(t, { type: "bandpass", f0: 500, f1: 1700, Q: 1.1, peak: 0.17, attack: 0.12, dur: 0.5, sweep: 0.45 });
      FX.paper(t + 0.10, 4);
    },
    // the card sliding out of the pocket
    slide: function (t) {
      noiseVoice(t, { type: "bandpass", f0: 900, f1: 2500, Q: 1.6, peak: 0.15, attack: 0.35, dur: 1.1, sweep: 1.0 });
    },
    // the card settling in front of you — a soft, warm arrival
    settle: function (t) {
      toneVoice(t, { wave: "sine", f0: 523.25, peak: 0.085, attack: 0.02, dur: 1.5 });
      toneVoice(t + 0.02, { wave: "sine", f0: 659.25, peak: 0.06, attack: 0.03, dur: 1.7 });
      toneVoice(t + 0.05, { wave: "sine", f0: 783.99, peak: 0.045, attack: 0.04, dur: 2.0 });
      noiseVoice(t, { type: "lowpass", f0: 400, Q: 0.7, peak: 0.10, attack: 0.02, dur: 0.4 });
    },
    // UI
    tap: function (t) { toneVoice(t, { wave: "sine", f0: 660, f1: 880, peak: 0.07, attack: 0.004, dur: 0.11, sweep: 0.09 }); },
    accept: function (t) {
      toneVoice(t, { wave: "sine", f0: 523.25, peak: 0.10, attack: 0.01, dur: 0.5 });
      toneVoice(t + 0.09, { wave: "sine", f0: 783.99, peak: 0.09, attack: 0.01, dur: 0.6 });
      toneVoice(t + 0.18, { wave: "sine", f0: 1046.5, peak: 0.07, attack: 0.01, dur: 0.9 });
    },
    reject: function (t) {
      toneVoice(t, { wave: "triangle", f0: 300, f1: 150, peak: 0.15, attack: 0.006, dur: 0.32, sweep: 0.3 });
    }
  };

  A.sfx = function (name, delaySec) {
    if (!A.ready || A.muted) return;
    if (A.ctx.state === "suspended") { try { A.ctx.resume(); } catch (e) {} }
    var fn = FX[name]; if (!fn) return;
    try { fn(A.ctx.currentTime + (delaySec || 0)); } catch (e) {}
  };

  window.WalimaAudio = A;
})();
