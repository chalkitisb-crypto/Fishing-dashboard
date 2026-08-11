/* moon.js v101 — full gold texture + phase from code + texture rotation 360° */
(function(){
  "use strict";
  var CFG = {
    rotationSec: 30,
    gold: "#f5c542",
    texUrl: "moon_tex.jpg?v=101.0.0",
    size: 256,
    minVis: 4
  };
  function $(id){ return document.getElementById(id); }
  function isWaxing(t){
    if(!t) return true;
    t = String(t).toLowerCase();
    return !(t.indexOf("φθιν")>=0 || t.indexOf("waning")>=0);
  }

  function init(){
    var canvas = $("moon-canvas");
    if(!canvas) return;
    var size = CFG.size;
    canvas.width = size; canvas.height = size;
    canvas.style.display = "block";
    canvas.style.opacity = "1";
    canvas.style.width = "100%";
    canvas.style.height = "100%";
    var ctx = canvas.getContext("2d");
    var tex = new Image();
    var texReady = false;
    var rot = 0;
    var pct = 12;
    var waxing = false;

    tex.onload = function(){ texReady = true; };
    tex.src = CFG.texUrl;

    function draw(){
      var s = size, cx = s/2, cy = s/2, r = s*0.48;
      ctx.clearRect(0,0,s,s);

      ctx.save();
      ctx.beginPath();
      ctx.arc(cx,cy,r,0,Math.PI*2);
      ctx.closePath();
      ctx.clip();

      // dark base under texture (relief visible through soft shadow)
      ctx.fillStyle = "#0d0a06";
      ctx.fillRect(0,0,s,s);

      // full gold textured sphere — rotates
      ctx.save();
      ctx.translate(cx,cy);
      ctx.rotate(rot);
      ctx.translate(-cx,-cy);
      if(texReady){
        ctx.drawImage(tex, cx-r, cy-r, r*2, r*2);
        ctx.globalCompositeOperation = "multiply";
        ctx.fillStyle = CFG.gold;
        ctx.fillRect(cx-r, cy-r, r*2, r*2);
        ctx.globalCompositeOperation = "source-over";
        ctx.globalAlpha = 0.28;
        ctx.fillStyle = CFG.gold;
        ctx.fillRect(cx-r, cy-r, r*2, r*2);
        ctx.globalAlpha = 1;
      } else {
        ctx.fillStyle = CFG.gold;
        ctx.beginPath(); ctx.arc(cx,cy,r,0,Math.PI*2); ctx.fill();
      }
      ctx.restore();

      // PHASE from code — soft shadow so crater structure remains faintly visible
      var vis = Math.max(Math.min(pct,100), CFG.minVis);
      var offset = (vis/100) * r * 1.9;
      if(offset < r*0.12) offset = r*0.12;
      var dir = waxing ? -1 : 1;
      var sx = cx + dir * (r - offset);

      ctx.save();
      ctx.beginPath();
      ctx.arc(cx,cy,r,0,Math.PI*2);
      ctx.clip();
      ctx.globalCompositeOperation = "source-atop";
      // soft fade shadow (not pure black plate)
      var grd = ctx.createRadialGradient(sx, cy, r*0.05, sx, cy, r*1.02);
      grd.addColorStop(0, "rgba(2,11,24,0.88)");
      grd.addColorStop(0.55, "rgba(2,11,24,0.78)");
      grd.addColorStop(0.85, "rgba(2,11,24,0.45)");
      grd.addColorStop(1, "rgba(2,11,24,0)");
      ctx.fillStyle = grd;
      ctx.beginPath();
      ctx.arc(sx, cy, r*0.99, 0, Math.PI*2);
      ctx.fill();
      ctx.restore();

      // single gold rim
      ctx.save();
      ctx.beginPath();
      ctx.arc(cx,cy,r,0,Math.PI*2);
      ctx.clip();
      ctx.strokeStyle = "rgba(245,197,66,0.5)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(cx,cy,r-1,0,Math.PI*2);
      ctx.stroke();
      ctx.restore();

      ctx.restore();
    }

    window.__moonSetPhase = function(p, phaseText){
      pct = Math.max(0, Math.min(100, Number(p)||0));
      waxing = isWaxing(phaseText);
      draw();
    };

    var pctEl = document.querySelector(".moon-pct");
    var phaseEl = document.querySelector(".moon-phase");
    if(pctEl){
      var n = parseFloat(String(pctEl.textContent).replace(",",".").replace("%",""));
      if(!isNaN(n)) pct = n;
    }
    waxing = isWaxing(phaseEl ? phaseEl.textContent : "");
    draw();

    var last = performance.now();
    var speed = (Math.PI*2)/CFG.rotationSec;
    function tick(now){
      var dt = Math.min(0.05,(now-last)/1000);
      last = now;
      rot += speed*dt;
      draw();
      requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);

    window.addEventListener("moon-data", function(e){
      if(e.detail) window.__moonSetPhase(e.detail.pct, e.detail.phase);
    });
  }

  if(document.readyState==="loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
