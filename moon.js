/* moon.js v105 — single WebGL owner · equirectangular map · fixed light · Y-spin · #f5c542 */
(function () {
  "use strict";
  var CFG = {
    rotationSec: 30,
    gold: 0xf5c542,
    texUrl: "moon_eq.jpg?v=105.0.0",
    cdn: "https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.min.js"
  };

  function $(id) { return document.getElementById(id); }
  function isWaxing(t) {
    if (!t) return true;
    t = String(t).toLowerCase();
    return !(t.indexOf("φθιν") >= 0 || t.indexOf("waning") >= 0 || t.indexOf("last") >= 0 || t.indexOf("third") >= 0);
  }
  function loadScript(src) {
    return new Promise(function (resolve, reject) {
      if (window.THREE) { resolve(); return; }
      var s = document.createElement("script");
      s.src = src;
      s.onload = function () { resolve(); };
      s.onerror = function () { reject(new Error("THREE load fail")); };
      document.head.appendChild(s);
    });
  }

  function initWebGL(canvas, pct, waxing) {
    var THREE = window.THREE;
    var disc = $("moon-disc") || canvas.parentElement;
    var w = (disc && disc.clientWidth) || canvas.clientWidth || 120;
    var h = (disc && disc.clientHeight) || canvas.clientHeight || 120;
    w = Math.max(64, w);
    h = Math.max(64, h);

    var renderer = new THREE.WebGLRenderer({ canvas: canvas, alpha: true, antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(w, h, false);
    renderer.setClearColor(0x000000, 0);
    if (THREE.SRGBColorSpace) renderer.outputColorSpace = THREE.SRGBColorSpace;

    var scene = new THREE.Scene();
    var camera = new THREE.PerspectiveCamera(40, w / h, 0.1, 20);
    camera.position.z = 2.55;

    var geo = new THREE.SphereGeometry(1, 64, 64);
    var mat = new THREE.MeshStandardMaterial({
      color: CFG.gold,
      roughness: 0.78,
      metalness: 0.05,
      emissive: CFG.gold,
      emissiveIntensity: 0.06
    });
    var moon = new THREE.Mesh(geo, mat);
    scene.add(moon);

    new THREE.TextureLoader().load(
      CFG.texUrl,
      function (tex) {
        if (THREE.SRGBColorSpace) tex.colorSpace = THREE.SRGBColorSpace;
        tex.anisotropy = 4;
        mat.map = tex;
        mat.color.setHex(CFG.gold);
        mat.needsUpdate = true;
      },
      undefined,
      function () { mat.color.setHex(CFG.gold); }
    );

    // Ambient: faint so dark side shows structure, not pure black
    var ambient = new THREE.AmbientLight(0x2a2010, 0.32);
    scene.add(ambient);

    // Key light = FIXED phase (does not spin with moon)
    var key = new THREE.DirectionalLight(0xfff1c8, 2.6);
    scene.add(key);

    // Fill for unlit relief
    var fill = new THREE.DirectionalLight(0x3a2e14, 0.4);
    fill.position.set(-2.5, 0.3, -1.5);
    scene.add(fill);

    function setPhase(p, isWax) {
      var alpha = Math.max(0, Math.min(100, Number(p) || 0)) / 100;
      // min visible so 2% still shows thin gold crescent
      var vis = Math.max(0.04, alpha);
      var angle = (1 - vis) * Math.PI;
      var side = isWax ? 1 : -1;
      key.position.set(side * Math.sin(angle) * 3.4, 0.15, Math.cos(angle) * 3.4);
      // Strong key so gold reads at low %
      key.intensity = 1.8 + alpha * 1.2;
      mat.emissiveIntensity = 0.05 + alpha * 0.1;
    }
    setPhase(pct, waxing);

    var spin = (Math.PI * 2) / CFG.rotationSec;
    var last = performance.now();
    canvas.classList.add("is-live");
    canvas.style.display = "block";
    canvas.style.opacity = "1";

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
      var ww = (disc && disc.clientWidth) || 120;
      var hh = (disc && disc.clientHeight) || 120;
      camera.aspect = ww / hh;
      camera.updateProjectionMatrix();
      renderer.setSize(ww, hh, false);
    });
    return true;
  }

  /* 2D fallback if WebGL fails */
  function initFallback(canvas, pct, waxing) {
    var size = 256;
    canvas.width = size;
    canvas.height = size;
    var ctx = canvas.getContext("2d");
    var tex = new Image();
    var ready = false;
    tex.onload = function () { ready = true; draw(); };
    tex.src = CFG.texUrl;
    function draw() {
      var s = size, cx = s / 2, cy = s / 2, r = s * 0.48;
      ctx.clearRect(0, 0, s, s);
      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.clip();
      ctx.fillStyle = "#1a1408";
      ctx.fillRect(0, 0, s, s);
      if (ready) {
        // draw center crop of equirect as flat disc fallback
        ctx.drawImage(tex, tex.width * 0.25, 0, tex.width * 0.5, tex.height, cx - r, cy - r, r * 2, r * 2);
        ctx.globalCompositeOperation = "multiply";
        ctx.fillStyle = "#f5c542";
        ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
        ctx.globalCompositeOperation = "source-over";
      }
      var alpha = Math.max(0.04, Math.min(100, pct) / 100);
      if (alpha < 0.995) {
        var offset = r * (1 - 2 * alpha);
        var dir = waxing ? -1 : 1;
        ctx.globalCompositeOperation = "source-atop";
        ctx.beginPath();
        ctx.arc(cx + dir * offset, cy, r, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(2,11,24,0.93)";
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

  function init() {
    var canvas = $("moon-canvas");
    if (!canvas) return;
    canvas.style.display = "block";
    canvas.style.width = "100%";
    canvas.style.height = "100%";

    var pct = 6, waxing = false;
    var pctEl = $("moon-pct") || document.querySelector(".moon-pct");
    var phaseEl = $("moon-phase") || document.querySelector(".moon-phase");
    if (pctEl) {
      var n = parseFloat(String(pctEl.textContent).replace(",", ".").replace("%", "").replace(/[^0-9.]/g, ""));
      if (!isNaN(n)) pct = n;
    }
    waxing = isWaxing(phaseEl ? phaseEl.textContent : "");

    loadScript(CFG.cdn)
      .then(function () {
        try {
          if (!initWebGL(canvas, pct, waxing)) throw new Error("init fail");
        } catch (e) {
          console.warn("moon WebGL fail, fallback", e);
          initFallback(canvas, pct, waxing);
        }
      })
      .catch(function () { initFallback(canvas, pct, waxing); });

    window.addEventListener("moon-data", function (e) {
      if (e.detail && window.__moonSetPhase) {
        window.__moonSetPhase(e.detail.pct, e.detail.phase);
      }
    });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
