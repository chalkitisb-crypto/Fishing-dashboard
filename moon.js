/* moon.js v103 — WebGL sphere (Three.js) · fixed light phase · Y-axis spin · #f5c542 */
(function () {
  "use strict";
  var CFG = {
    rotationSec: 30,
    gold: 0xf5c542,
    texUrl: "moon_tex.jpg?v=103.0.0",
    cdn: "https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.min.js"
  };

  function $(id) { return document.getElementById(id); }

  function isWaxing(t) {
    if (!t) return true;
    t = String(t).toLowerCase();
    return !(t.indexOf("φθιν") >= 0 || t.indexOf("waning") >= 0);
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
    var w = canvas.clientWidth || 76;
    var h = canvas.clientHeight || 76;
    canvas.width = w * 2;
    canvas.height = h * 2;

    var renderer = new THREE.WebGLRenderer({
      canvas: canvas,
      alpha: true,
      antialias: true
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(w, h, false);
    renderer.setClearColor(0x000000, 0);

    var scene = new THREE.Scene();
    var camera = new THREE.PerspectiveCamera(35, w / h, 0.1, 10);
    camera.position.z = 2.35;

    // Sphere
    var geo = new THREE.SphereGeometry(1, 64, 64);
    var texLoader = new THREE.TextureLoader();
    var mat = new THREE.MeshStandardMaterial({
      color: CFG.gold,
      roughness: 0.85,
      metalness: 0.05,
      emissive: CFG.gold,
      emissiveIntensity: 0.08
    });
    var moon = new THREE.Mesh(geo, mat);
    scene.add(moon);

    texLoader.load(
      CFG.texUrl,
      function (tex) {
        tex.colorSpace = THREE.SRGBColorSpace || THREE.sRGBEncoding;
        mat.map = tex;
        mat.color.setHex(CFG.gold);
        mat.needsUpdate = true;
      },
      undefined,
      function () {
        // texture fail — solid gold still ok
        mat.color.setHex(CFG.gold);
      }
    );

    // Ambient very low so dark side stays dark but faint relief via residual light
    var ambient = new THREE.AmbientLight(0x1a1508, 0.22);
    scene.add(ambient);

    // Key light = phase (FIXED direction, does not spin with moon)
    var key = new THREE.DirectionalLight(0xfff0c8, 1.35);
    scene.add(key);

    // Soft fill so unlit side shows faint crater structure
    var fill = new THREE.DirectionalLight(0x2a2210, 0.18);
    fill.position.set(-2, 0, -1);
    scene.add(fill);

    function setPhase(p, isWax) {
      var alpha = Math.max(0, Math.min(100, Number(p) || 0)) / 100;
      // Full lit when alpha=1 → light from camera side (+Z)
      // New when alpha=0 → light behind (-Z)
      // Angle from full: 0 .. PI
      var angle = (1 - alpha) * Math.PI;
      var side = isWax ? 1 : -1;
      // Light orbits in XZ plane; moon spins on Y independently
      key.position.set(
        side * Math.sin(angle) * 3,
        0.15,
        Math.cos(angle) * 3
      );
      // Dim key near new moon so crescent stays thin
      key.intensity = 0.35 + alpha * 1.1;
    }

    setPhase(pct, waxing);

    var spin = (Math.PI * 2) / CFG.rotationSec;
    var last = performance.now();

    function frame(now) {
      var dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      moon.rotation.y += spin * dt; // Y-axis only = globe
      renderer.render(scene, camera);
      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);

    window.__moonSetPhase = function (p, phaseText) {
      setPhase(p, isWaxing(phaseText));
    };

    // resize
    window.addEventListener("resize", function () {
      var ww = canvas.clientWidth || 76;
      var hh = canvas.clientHeight || 76;
      camera.aspect = ww / hh;
      camera.updateProjectionMatrix();
      renderer.setSize(ww, hh, false);
    });

    return true;
  }

  /* Canvas2D fallback — static correct-ish crescent, no fake spin */
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
      ctx.fillStyle = "#0a0804";
      ctx.fillRect(0, 0, s, s);
      if (ready) {
        ctx.drawImage(tex, cx - r, cy - r, r * 2, r * 2);
        ctx.globalCompositeOperation = "multiply";
        ctx.fillStyle = "#f5c542";
        ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
        ctx.globalCompositeOperation = "source-over";
      }
      var alpha = Math.max(0, Math.min(100, pct)) / 100;
      if (alpha < 0.995) {
        var offset = r * (1 - 2 * alpha);
        var dir = waxing ? -1 : 1;
        var sx = cx + dir * offset;
        ctx.globalCompositeOperation = "source-atop";
        ctx.beginPath();
        ctx.arc(sx, cy, r, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(2,11,24,0.94)";
        ctx.fill();
      }
      ctx.restore();
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(245,197,66,0.4)";
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }

    window.__moonSetPhase = function (p, phaseText) {
      pct = Math.max(0, Math.min(100, Number(p) || 0));
      waxing = isWaxing(phaseText);
      draw();
    };
    draw();
  }

  function init() {
    var canvas = $("moon-canvas");
    if (!canvas) return;
    canvas.style.display = "block";
    canvas.style.width = "100%";
    canvas.style.height = "100%";

    var pct = 6;
    var waxing = false;
    var pctEl = $("moon-pct") || document.querySelector(".moon-pct");
    var phaseEl = $("moon-phase") || document.querySelector(".moon-phase");
    if (pctEl) {
      var n = parseFloat(String(pctEl.textContent).replace(",", ".").replace("%", ""));
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
      .catch(function () {
        initFallback(canvas, pct, waxing);
      });

    window.addEventListener("moon-data", function (e) {
      if (e.detail && window.__moonSetPhase) {
        window.__moonSetPhase(e.detail.pct, e.detail.phase);
      }
    });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
