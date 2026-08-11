/* moon.js v107 — WebGL · Y-spin OK · fix: thin gold crescent visible at 2% */
(function () {
  "use strict";
  var CFG = {
    rotationSec: 30,
    gold: 0xf5c542,
    texUrl: "moon_eq.jpg?v=107.0.0",
    cdn: "https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.min.js"
  };

  function $(id) { return document.getElementById(id); }
  function isWaxing(t) {
    if (!t) return true;
    t = String(t).toLowerCase();
    return !(/φθιν|waning|last|third|decreasing/.test(t));
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

  function readPctPhase() {
    var pct = 6, waxing = false;
    var pctEl = $("moon-pct"), phaseEl = $("moon-phase");
    if (pctEl) {
      var n = parseFloat(String(pctEl.textContent).replace(/[^0-9.]/g, ""));
      if (!isNaN(n)) pct = n;
    }
    waxing = isWaxing(phaseEl ? phaseEl.textContent : "");
    return { pct: pct, waxing: waxing };
  }

  function initWebGL(canvas, pct, waxing) {
    var THREE = window.THREE;
    var disc = $("moon-disc") || canvas.parentElement;
    var w = Math.max(80, (disc && disc.clientWidth) || 120);
    var h = Math.max(80, (disc && disc.clientHeight) || 120);

    canvas.style.width = "100%";
    canvas.style.height = "100%";
    canvas.style.display = "block";
    canvas.style.opacity = "1";

    var renderer = new THREE.WebGLRenderer({ canvas: canvas, alpha: true, antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(w, h, false);
    renderer.setClearColor(0x000000, 0);

    var scene = new THREE.Scene();
    var camera = new THREE.PerspectiveCamera(35, w / h, 0.1, 20);
    camera.position.set(0, 0, 2.7);

    // Dark base — phase comes from key light only
    var mat = new THREE.MeshPhongMaterial({
      color: CFG.gold,
      emissive: 0x1a1408,
      emissiveIntensity: 0.08,
      specular: 0x665522,
      shininess: 18
    });
    var moon = new THREE.Mesh(new THREE.SphereGeometry(1, 64, 64), mat);
    scene.add(moon);

    try {
      new THREE.TextureLoader().load(CFG.texUrl, function (tex) {
        mat.map = tex;
        mat.color.setHex(CFG.gold);
        mat.needsUpdate = true;
      });
    } catch (e) {}

    // Very low ambient: dark side stays dark, faint structure only
    var ambient = new THREE.AmbientLight(0x2a2010, 0.12);
    scene.add(ambient);

    // Key = phase light (FIXED, does not spin)
    var key = new THREE.DirectionalLight(0xfff5d0, 4.0);
    scene.add(key);

    // Tiny fill so dark side isn't pure void (craters barely readable)
    var fill = new THREE.DirectionalLight(0x3a2e14, 0.18);
    fill.position.set(-2.5, 0.2, -1.5);
    scene.add(fill);

    function setPhase(p, isWax) {
      var alpha = Math.max(0, Math.min(100, Number(p) || 0)) / 100;
      // Keep true thin crescent; at 2% still graze the limb so gold edge reads
      var vis = Math.max(0.025, alpha);
      var angle = (1 - vis) * Math.PI;
      var side = isWax ? 1 : -1;
      // Light almost behind at low % → thin crescent on the limb
      key.position.set(side * Math.sin(angle) * 4.2, 0.12, Math.cos(angle) * 4.2);
      // Strong key so the thin gold edge is bright, not washed into black
      key.intensity = 3.5 + (1 - alpha) * 1.5;
      mat.emissiveIntensity = 0.05 + alpha * 0.12;
      ambient.intensity = 0.08 + alpha * 0.1;
    }
    setPhase(pct, waxing);

    var spin = (Math.PI * 2) / CFG.rotationSec;
    var last = performance.now();
    canvas.classList.add("is-live");

    function frame(now) {
      var dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      moon.rotation.y += spin * dt;
      renderer.render(scene, camera);
      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);

    window.__moonSetPhase = function (p, phaseText) {
      setPhase(p, isWaxing(phaseText));
    };

    window.addEventListener("resize", function () {
      var ww = Math.max(80, (disc && disc.clientWidth) || 120);
      var hh = Math.max(80, (disc && disc.clientHeight) || 120);
      camera.aspect = ww / hh;
      camera.updateProjectionMatrix();
      renderer.setSize(ww, hh, false);
    });
  }

  function initFallback(canvas, pct, waxing) {
    var size = 256;
    canvas.width = size;
    canvas.height = size;
    canvas.style.width = "100%";
    canvas.style.height = "100%";
    canvas.style.display = "block";
    var ctx = canvas.getContext("2d");
    var tex = new Image();
    var ready = false;
    tex.onload = function () { ready = true; draw(); };
    tex.src = CFG.texUrl;

    function draw() {
      var s = size, cx = s / 2, cy = s / 2, r = s * 0.46;
      ctx.clearRect(0, 0, s, s);
      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.clip();
      ctx.fillStyle = "#1a1408";
      ctx.fillRect(0, 0, s, s);
      if (ready) {
        ctx.drawImage(tex, tex.width * 0.25, 0, tex.width * 0.5, tex.height, cx - r, cy - r, r * 2, r * 2);
        ctx.globalCompositeOperation = "multiply";
        ctx.fillStyle = "#f5c542";
        ctx.fillRect(0, 0, s, s);
        ctx.globalCompositeOperation = "source-over";
      }
      var alpha = Math.max(0.025, Math.min(100, pct) / 100);
      if (alpha < 0.98) {
        var offset = r * (1 - 2 * alpha);
        var dir = waxing ? -1 : 1;
        ctx.globalCompositeOperation = "source-atop";
        ctx.beginPath();
        ctx.arc(cx + dir * offset, cy, r * 1.02, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(2,11,24,0.94)";
        ctx.fill();
      }
      ctx.restore();
    }
    window.__moonSetPhase = function (p, phaseText) {
      pct = Math.max(0, Math.min(100, Number(p) || 0));
      waxing = isWaxing(phaseText);
      draw();
    };
    draw();
    canvas.classList.add("is-live");
  }

  function boot() {
    var canvas = $("moon-canvas");
    if (!canvas) return;
    var st = readPctPhase();
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        loadTHREE()
          .then(function () {
            try { initWebGL(canvas, st.pct, st.waxing); }
            catch (e) { initFallback(canvas, st.pct, st.waxing); }
          })
          .catch(function () { initFallback(canvas, st.pct, st.waxing); });
      });
    });
    window.addEventListener("moon-data", function (e) {
      if (e.detail && window.__moonSetPhase) window.__moonSetPhase(e.detail.pct, e.detail.phase);
    });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
