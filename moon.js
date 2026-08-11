/* moon.js v102 — horizontal texture scroll (globe-like) + FIXED phase from % */
(function () {
  "use strict";
  var CFG = {
    rotationSec: 30,
    gold: "#f5c542",
    texUrl: "moon_tex.jpg?v=102.0.0",
    size: 256
  };

  function $(id) { return document.getElementById(id); }

  function isWaxing(t) {
    if (!t) return true;
    t = String(t).toLowerCase();
    return !(t.indexOf("φθιν") >= 0 || t.indexOf("waning") >= 0);
  }

  function init() {
    var canvas = $("moon-canvas");
    if (!canvas) return;
    var size = CFG.size;
    canvas.width = size;
    canvas.height = size;
    canvas.style.display = "block";
    canvas.style.width = "100%";
    canvas.style.height = "100%";
    var ctx = canvas.getContext("2d");
    var tex = new Image();
    var texReady = false;
    var scrollX = 0; // horizontal offset in px (texture scrolls)
    var pct = 6;
    var waxing = false;

    tex.crossOrigin = "anonymous";
    tex.onload = function () { texReady = true; draw(); };
    tex.src = CFG.texUrl;

    function drawMoonBody() {
      var s = size, cx = s / 2, cy = s / 2, r = s * 0.48;
      // dark base
      ctx.fillStyle = "#0a0804";
      ctx.fillRect(0, 0, s, s);

      if (!texReady) {
        ctx.fillStyle = CFG.gold;
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.fill();
        return;
      }

      // Horizontal scroll of texture inside circle (globe longitude feel)
      // Draw texture twice for seamless wrap
      var tw = tex.width, th = tex.height;
      var diam = r * 2;
      var ox = ((scrollX % diam) + diam) % diam;

      ctx.save();
      // gold tint via filter-like multiply after
      ctx.drawImage(tex, cx - r - ox, cy - r, diam, diam);
      ctx.drawImage(tex, cx - r - ox + diam, cy - r, diam, diam);

      // single gold tint
      ctx.globalCompositeOperation = "multiply";
      ctx.fillStyle = CFG.gold;
      ctx.fillRect(cx - r, cy - r, diam, diam);
      ctx.globalCompositeOperation = "source-over";
      ctx.globalAlpha = 0.22;
      ctx.fillStyle = CFG.gold;
      ctx.fillRect(cx - r, cy - r, diam, diam);
      ctx.globalAlpha = 1;
      ctx.restore();
    }

    /**
     * FIXED phase terminator — does NOT rotate with texture.
     * Classic sphere illumination: for illumination fraction α (0..1),
     * the terminator is an offset ellipse / circle cut.
     * We use the standard approach: darken with a circle whose center
     * is shifted so that the visible lit fraction ≈ pct/100.
     */
    function drawPhase() {
      var s = size, cx = s / 2, cy = s / 2, r = s * 0.48;
      var alpha = Math.max(0, Math.min(100, pct)) / 100; // 0=new, 1=full

      if (alpha >= 0.995) return; // full — no shadow
      if (alpha <= 0.005) {
        // new moon — almost fully dark, faint relief
        ctx.save();
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.clip();
        ctx.fillStyle = "rgba(2,11,24,0.92)";
        ctx.fillRect(0, 0, s, s);
        ctx.restore();
        return;
      }

      // Offset of shadow disc: at α=0.5 → offset 0 (half), at α→0 → offset → r
      // lit fraction for two overlapping circles ≈ related to offset
      // offset = r * (1 - 2*α) maps: α=1 → -r (no shadow), α=0 → +r (full cover)
      // For waxing/waning side:
      var offset = r * (1 - 2 * alpha);
      var dir = waxing ? -1 : 1;
      // For waning crescent (low α, light on left in many UIs): dir
      var sx = cx + dir * offset;

      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cy, r + 0.5, 0, Math.PI * 2);
      ctx.clip();
      ctx.globalCompositeOperation = "source-atop";

      // Harder terminator for correct thin crescent at low %
      // Use solid dark disc with slight edge soft only
      ctx.beginPath();
      ctx.arc(sx, cy, r, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(2,11,24,0.94)";
      ctx.fill();

      // Soft edge only near terminator (small blur band)
      var grd = ctx.createRadialGradient(sx, cy, r * 0.92, sx, cy, r * 1.02);
      grd.addColorStop(0, "rgba(2,11,24,0)");
      grd.addColorStop(1, "rgba(2,11,24,0.5)");
      ctx.fillStyle = grd;
      ctx.beginPath();
      ctx.arc(sx, cy, r * 1.02, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();
    }

    function drawRim() {
      var s = size, cx = s / 2, cy = s / 2, r = s * 0.48;
      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(245,197,66,0.45)";
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.restore();
    }

    function draw() {
      var s = size, cx = s / 2, cy = s / 2, r = s * 0.48;
      ctx.clearRect(0, 0, s, s);

      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.closePath();
      ctx.clip();

      drawMoonBody();
      drawPhase(); // FIXED — independent of scrollX
      ctx.restore();

      drawRim();
    }

    window.__moonSetPhase = function (p, phaseText) {
      pct = Math.max(0, Math.min(100, Number(p) || 0));
      waxing = isWaxing(phaseText);
      draw();
    };

    // initial from DOM
    var pctEl = document.querySelector(".moon-pct") || $("moon-pct");
    var phaseEl = document.querySelector(".moon-phase") || $("moon-phase");
    if (pctEl) {
      var n = parseFloat(String(pctEl.textContent).replace(",", ".").replace("%", ""));
      if (!isNaN(n)) pct = n;
    }
    waxing = isWaxing(phaseEl ? phaseEl.textContent : "");
    draw();

    // Animate ONLY texture scroll (not phase)
    var last = performance.now();
    var speed = (size * 0.96) / CFG.rotationSec; // px per second for ~full width in rotationSec
    function tick(now) {
      var dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      scrollX += speed * dt;
      draw();
      requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);

    window.addEventListener("moon-data", function (e) {
      if (e.detail) window.__moonSetPhase(e.detail.pct, e.detail.phase);
    });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
