/* moon.js v219 = v110 method
   fill disc, live % shade, visible rotate. */
(function () {
  "use strict";
  var CFG = {
    rotationSec: 30,
    texUrl: "moon_eq.jpg?v=219.0.0",
    cdn: "https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.min.js"
  };

  function $(id) { return document.getElementById(id); }
  function isWaxing(t) {
    if (!t) return true;
    t = String(t).toLowerCase();
    return !(/φθιν|waning|last|third|decreasing/.test(t));
  }

  function readPctPhase() {
    var pct = 100, waxing = true;
    var pctEl = $("moon-pct"), phaseEl = $("moon-phase");
    if (pctEl) {
      var n = parseFloat(String(pctEl.textContent).replace(/[^0-9.]/g, ""));
      if (!isNaN(n)) pct = n;
    }
    waxing = isWaxing(phaseEl ? phaseEl.textContent : "");
    return { pct: pct, waxing: waxing };
  }

  function injectCSS() {
    if (document.getElementById("moon-hybrid-css")) return;
    var st = document.createElement("style");
    st.id = "moon-hybrid-css";
    st.textContent = [
      "#moon-disc{position:relative!important;overflow:hidden!important;border-radius:50%!important;}",
      "#moon-disc canvas#moon-canvas,.moon-disc canvas#moon-canvas,canvas#moon-canvas,#moon-canvas{",
      "display:block!important;visibility:visible!important;opacity:1!important;",
      "position:absolute!important;inset:0!important;width:100%!important;height:100%!important;",
      "min-width:100%!important;min-height:100%!important;border-radius:50%!important;",
      "z-index:5!important;pointer-events:none!important;background:transparent!important;}",
      "#moon-phase-mask{position:absolute!important;inset:0!important;width:100%!important;",
      "height:100%!important;border-radius:50%!important;z-index:6!important;pointer-events:none!important;}",
      "#moon-shade,.moon-shade,#moon-img,.moon-img{display:none!important;opacity:0!important;}"
    ].join("");
    document.head.appendChild(st);
  }

  function loadTHREE() {
    return new Promise(function (resolve, reject) {
      if (window.THREE && window.THREE.WebGLRenderer) { resolve(window.THREE); return; }
      var s = document.createElement("script");
      s.src = CFG.cdn;
      s.onload = function () { window.THREE ? resolve(window.THREE) : reject(); };
      s.onerror = reject;
      document.head.appendChild(s);
    });
  }

  function ensureMask(disc) {
    var mask = document.getElementById("moon-phase-mask");
    if (mask) return mask;
    mask = document.createElement("canvas");
    mask.id = "moon-phase-mask";
    mask.setAttribute("aria-hidden", "true");
    disc.appendChild(mask);
    return mask;
  }

  /* Calibrated: alpha 0 → full dark · 0.02 → ~3% gold crescent · 1 → full gold */
  function drawPhaseMask(mask, pct, waxing) {
    var size = 256;
    mask.width = size;
    mask.height = size;
    var ctx = mask.getContext("2d");
    var cx = size / 2, cy = size / 2, r = size / 2;
    ctx.clearRect(0, 0, size, size);

    var alpha = Math.max(0, Math.min(100, Number(pct) || 0)) / 100;
    if (alpha >= 0.98) return; // full — no mask

    // Cover method: dark circle slides off the disc as alpha rises
    // offset 0 at new moon (full cover), -2r at full (off disc)
    var dir = waxing ? 1 : -1;
    var offset = dir * (-2 * r * alpha);

    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.clip();
    ctx.beginPath();
    ctx.arc(cx + offset, cy, r, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(2,11,24,0.95)";
    ctx.fill();
    ctx.restore();
  }

  function initWebGL(canvas, disc, pct, waxing) {
    var THREE = window.THREE;
    var w = Math.max(80, disc.clientWidth || 120);
    var h = Math.max(80, disc.clientHeight || 120);

    var renderer = new THREE.WebGLRenderer({ canvas: canvas, alpha: true, antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(w, h, false);
    renderer.setClearColor(0x000000, 0);

    var scene = new THREE.Scene();
    var camera = new THREE.PerspectiveCamera(35, w / h, 0.1, 20);
    camera.position.set(0, 0, 2.18);

    var mat = new THREE.MeshBasicMaterial({ color: 0xf5c542 });
    var moon = new THREE.Mesh(new THREE.SphereGeometry(1, 64, 64), mat);
    scene.add(moon);

    new THREE.TextureLoader().load(CFG.texUrl, function (tex) {
      mat.map = tex;
      mat.color.setHex(0xf5c542);
      mat.needsUpdate = true;
    });

    var mask = ensureMask(disc);
    drawPhaseMask(mask, pct, waxing);

    var spin = (Math.PI * 2) / CFG.rotationSec;
    var last = performance.now();
    canvas.classList.add("is-live");

    (function frame(now) {
      var dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      moon.rotation.y += spin * dt;
      renderer.render(scene, camera);
      requestAnimationFrame(frame);
    })(performance.now());

    window.__moonSetPhase = function (p, phaseText) {
      drawPhaseMask(mask, p, isWaxing(phaseText));
    };

    window.addEventListener("resize", function () {
      var ww = Math.max(80, disc.clientWidth || 120);
      var hh = Math.max(80, disc.clientHeight || 120);
      camera.aspect = ww / hh;
      camera.updateProjectionMatrix();
      renderer.setSize(ww, hh, false);
    });
  }

  function initFallback(canvas, disc, pct, waxing) {
    var size = 256;
    canvas.width = size;
    canvas.height = size;
    var ctx = canvas.getContext("2d");
    var tex = new Image();
    var ready = false;
    var rot = 0;
    tex.onload = function () { ready = true; };
    tex.src = CFG.texUrl;

    var mask = ensureMask(disc);
    drawPhaseMask(mask, pct, waxing);

    function draw() {
      var s = size, cx = s / 2, cy = s / 2, r = s * 0.48;
      ctx.clearRect(0, 0, s, s);
      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.clip();
      ctx.fillStyle = "#c9a030";
      ctx.fillRect(0, 0, s, s);
      if (ready) {
        ctx.translate(cx, cy);
        ctx.rotate(rot);
        ctx.translate(-cx, -cy);
        ctx.drawImage(tex, tex.width * 0.25, 0, tex.width * 0.5, tex.height, cx - r, cy - r, r * 2, r * 2);
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.globalCompositeOperation = "multiply";
        ctx.fillStyle = "#f5c542";
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalCompositeOperation = "source-over";
      }
      ctx.restore();
    }

    window.__moonSetPhase = function (p, phaseText) {
      drawPhaseMask(mask, p, isWaxing(phaseText));
    };

    var last = performance.now();
    (function loop(now) {
      var dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      rot += (Math.PI * 2 / CFG.rotationSec) * dt;
      draw();
      requestAnimationFrame(loop);
    })(performance.now());

    canvas.classList.add("is-live");
  }

  function boot() {
    injectCSS();
    var canvas = $("moon-canvas");
    var disc = $("moon-disc");
    if (!canvas || !disc) return;
    var st = readPctPhase();

    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        loadTHREE()
          .then(function () {
            try { initWebGL(canvas, disc, st.pct, st.waxing); }
            catch (e) { initFallback(canvas, disc, st.pct, st.waxing); }
          })
          .catch(function () { initFallback(canvas, disc, st.pct, st.waxing); });
      });
    });

    window.addEventListener("moon-data", function (e) {
      if (e.detail && window.__moonSetPhase) {
        window.__moonSetPhase(e.detail.pct, e.detail.phase);
      }
    });
    function applyLive() {
      var st2 = readPctPhase();
      var phaseTxt = $("moon-phase") ? $("moon-phase").textContent : "";
      if (window.__moonSetPhase) window.__moonSetPhase(st2.pct, phaseTxt);
    }
    var prev = window.setMoonShade;
    window.setMoonShade = function (p, k) {
      if (typeof prev === "function") { try { prev(p, k); } catch (e) {} }
      if (window.__moonSetPhase) window.__moonSetPhase(p, k);
    };
    try {
      var pe = $("moon-pct"), ph = $("moon-phase");
      if (pe) new MutationObserver(applyLive).observe(pe, {childList:true,characterData:true,subtree:true});
      if (ph) new MutationObserver(applyLive).observe(ph, {childList:true,characterData:true,subtree:true});
    } catch (e) {}
    var n = 0, iv = setInterval(function () { applyLive(); if (++n >= 30) clearInterval(iv); }, 400);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
