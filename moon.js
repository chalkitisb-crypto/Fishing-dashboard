/* moon.js v98 — isolated 3D · open CFG at top */
(function(){
  "use strict";
  var CFG = {
    rotationSec: 30,
    goldHex: 0xf5c542,
    texUrl: "moon_tex.jpg?v=99.0.0",
    size: 256,
    minCrescent: 16,
    sunIntensityLow: 5.8,
    sunIntensityHigh: 2.8,
    ambient: 0.40,
    fillStrength: 0.9
  };
  function $(id){ return document.getElementById(id); }
  function isWaxing(txt){
    if(!txt) return true;
    var t = String(txt).toLowerCase();
    return !(t.indexOf("φθιν")>=0 || t.indexOf("waning")>=0);
  }
  function init(){
    var canvas = $("moon-canvas");
    if(!canvas) return;
    if(typeof THREE === "undefined"){
      var img = $("moon-img");
      if(img){ img.hidden=false; img.style.display="block"; }
      canvas.style.display="none";
      return;
    }
    var w=CFG.size,h=CFG.size;
    canvas.width=w; canvas.height=h;
    var renderer = new THREE.WebGLRenderer({canvas:canvas, alpha:true, antialias:true});
    renderer.setPixelRatio(Math.min(window.devicePixelRatio||1, 2));
    renderer.setSize(w,h,false);
    renderer.setClearColor(0x000000,0);
    var scene = new THREE.Scene();
    var camera = new THREE.PerspectiveCamera(35,1,0.1,100);
    camera.position.z = 3.15;
    var amb = new THREE.AmbientLight(0xfff0d0, CFG.ambient);
    scene.add(amb);
    var sun = new THREE.DirectionalLight(0xffe8a0, CFG.sunIntensityHigh);
    sun.position.set(2.5,0.3,1.5);
    scene.add(sun);
    var fill = new THREE.DirectionalLight(0xffd080, CFG.fillStrength);
    fill.position.set(1.0,0.2,2.0);
    scene.add(fill);
    var geo = new THREE.SphereGeometry(1,64,64);
    var mat = new THREE.MeshStandardMaterial({
      color: CFG.goldHex, roughness:0.85, metalness:0.08,
      emissive: CFG.goldHex, emissiveIntensity:0.12
    });
    var mesh = new THREE.Mesh(geo, mat);
    scene.add(mesh);
    new THREE.TextureLoader().load(CFG.texUrl, function(tex){
      tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
      mat.map = tex; mat.needsUpdate = true;
    });
    function setPhase(pct, waxing){
      var p = Math.max(0, Math.min(100, Number(pct)||0));
      var vis = Math.max(p, CFG.minCrescent);
      var cosA = Math.max(-0.98, Math.min(0.98, 2*(vis/100)-1));
      var ang = Math.acos(cosA);
      var side = waxing ? 1 : -1;
      var sx = side * Math.sin(ang) * 3.0;
      var sz = Math.cos(ang) * 3.0;
      if(sz < 0.4) sz = 0.4;
      sun.position.set(sx, 0.25, sz);
      sun.intensity = p<15 ? CFG.sunIntensityLow : p<40 ? 3.6 : CFG.sunIntensityHigh;
      fill.position.set(side*0.9, 0.15, 1.8);
      fill.intensity = p<15 ? CFG.fillStrength : CFG.fillStrength*0.45;
      amb.intensity = CFG.ambient;
      mat.emissiveIntensity = p<15 ? 0.30 : 0.10;
    }
    window.__moonSetPhase = function(pct, phaseText){
      setPhase(pct, isWaxing(phaseText));
    };
    var pctEl = document.querySelector(".moon-pct");
    var phaseEl = document.querySelector(".moon-phase");
    var start = 7;
    if(pctEl){
      var n = parseFloat(String(pctEl.textContent).replace(",",".").replace("%",""));
      if(!isNaN(n)) start = n;
    }
    setPhase(start, isWaxing(phaseEl ? phaseEl.textContent : ""));
    var speed = (Math.PI*2)/CFG.rotationSec;
    var last = performance.now();
    function tick(now){
      var dt = Math.min(0.05,(now-last)/1000);
      last = now;
      mesh.rotation.y += speed*dt;
      renderer.render(scene, camera);
      requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
    window.addEventListener("moon-data", function(e){
      if(e.detail) setPhase(e.detail.pct, isWaxing(e.detail.phase));
    });
  }
  if(document.readyState==="loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
