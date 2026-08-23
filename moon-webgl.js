/*! FD Moon v172 — root fix
 * NEVER rotate geometry for spin (that blacked-out 78% in v170).
 * Phase light FIXED. Spin = UV offset only.
 */
(function () {
  var canvas, gl, prog, buf, tex;
  var uvOff = 0, phasePct = 78, phaseKey = "", lastT = 0;
  var PERIOD = 30;
  var $ = function (id) { return document.getElementById(id); };

  function compile(type, src) {
    var s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
      console.warn("[moon]", gl.getShaderInfoLog(s));
      return null;
    }
    return s;
  }

  function sphere(lat, lon) {
    var pos=[], nor=[], uv=[], idx=[];
    for (var i=0;i<=lat;i++){
      var v=i/lat, phi=v*Math.PI;
      for (var j=0;j<=lon;j++){
        var u=j/lon, th=u*Math.PI*2;
        var x=Math.sin(phi)*Math.cos(th);
        var y=Math.cos(phi);
        var z=Math.sin(phi)*Math.sin(th);
        pos.push(x,y,z); nor.push(x,y,z); uv.push(u,v);
      }
    }
    for (var i=0;i<lat;i++){
      for (var j=0;j<lon;j++){
        var a=i*(lon+1)+j, b=a+lon+1;
        idx.push(a,b,a+1, b,b+1,a+1);
      }
    }
    return {pos:new Float32Array(pos),nor:new Float32Array(nor),uv:new Float32Array(uv),idx:new Uint16Array(idx)};
  }

  function init() {
    canvas = $("moon-canvas");
    if (!canvas) return false;
    gl = canvas.getContext("webgl", {alpha:true, antialias:true, premultipliedAlpha:false});
    if (!gl) return false;

    var vs = compile(gl.VERTEX_SHADER, [
      "attribute vec3 aPos;",
      "attribute vec3 aNor;",
      "attribute vec2 aUv;",
      "uniform mat4 uMVP;",
      "uniform float uUvOff;",
      "varying vec3 vNor;",
      "varying vec2 vUv;",
      "void main(){",
      "  vNor = aNor;",               // geometry never rotates → normals fixed
      "  vUv = vec2(fract(aUv.x + uUvOff), aUv.y);",
      "  gl_Position = uMVP * vec4(aPos,1.0);",
      "}"
    ].join("\n"));

    var fs = compile(gl.FRAGMENT_SHADER, [
      "precision mediump float;",
      "varying vec3 vNor;",
      "varying vec2 vUv;",
      "uniform sampler2D uTex;",
      "uniform vec3 uLight;",
      "uniform float uAmb;",
      "void main(){",
      "  vec3 n = normalize(vNor);",
      "  float ndl = dot(n, normalize(uLight));",
      "  float lit = smoothstep(-0.05, 0.18, ndl);",
      "  vec3 albedo = texture2D(uTex, vUv).rgb;",
      "  vec3 col = albedo * (uAmb + (1.0 - uAmb) * lit);",
      "  gl_FragColor = vec4(col, 1.0);",
      "}"
    ].join("\n"));
    if (!vs || !fs) return false;

    prog = gl.createProgram();
    gl.attachShader(prog, vs); gl.attachShader(prog, fs); gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return false;

    var sp = sphere(48, 64);
    buf = {pos:gl.createBuffer(),nor:gl.createBuffer(),uv:gl.createBuffer(),idx:gl.createBuffer(),n:sp.idx.length};
    gl.bindBuffer(gl.ARRAY_BUFFER, buf.pos); gl.bufferData(gl.ARRAY_BUFFER, sp.pos, gl.STATIC_DRAW);
    gl.bindBuffer(gl.ARRAY_BUFFER, buf.nor); gl.bufferData(gl.ARRAY_BUFFER, sp.nor, gl.STATIC_DRAW);
    gl.bindBuffer(gl.ARRAY_BUFFER, buf.uv);  gl.bufferData(gl.ARRAY_BUFFER, sp.uv,  gl.STATIC_DRAW);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, buf.idx); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, sp.idx, gl.STATIC_DRAW);

    tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([245,197,66,255]));

    var img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = function(){
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 1);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
    };
    img.src = "moon_full.png?v=172.0.0";

    gl.enable(gl.DEPTH_TEST);
    gl.enable(gl.CULL_FACE);
    gl.clearColor(0,0,0,0);
    return true;
  }

  function matMul(a,b){var o=new Float32Array(16);for(var c=0;c<4;c++)for(var r=0;r<4;r++)o[c*4+r]=a[r]*b[c*4]+a[4+r]*b[c*4+1]+a[8+r]*b[c*4+2]+a[12+r]*b[c*4+3];return o;}
  function perspective(fovy,aspect,near,far){var f=1/Math.tan(fovy/2);var m=new Float32Array(16);m[0]=f/aspect;m[5]=f;m[10]=(far+near)/(near-far);m[11]=-1;m[14]=(2*far*near)/(near-far);return m;}
  function lookAt(){var m=new Float32Array(16);m[0]=1;m[5]=1;m[10]=1;m[15]=1;m[14]=-2.35;return m;}

  // FIXED light from phase — does NOT change over time, only when % changes
  function lightFromPhase(pct, key) {
    var t = Math.max(0, Math.min(100, pct)) / 100;
    var waning = /φθιν|waning|τελευτ|last|φθίνουσα/.test(String(key||"").toLowerCase());
    // full(t=1): light toward camera (+Z). new(t=0): light from behind.
    var ang = (1 - t) * Math.PI;
    if (waning) ang = -ang;
    return {
      dir: [Math.sin(ang), 0.06, Math.cos(ang)],
      amb: 0.28  // night side still shows surface (transparent black)
    };
  }

  function frame(t) {
    if (!gl || !prog) return;
    requestAnimationFrame(frame);
    if (!lastT) lastT = t;
    var dt = Math.min(0.05, (t - lastT) / 1000);
    lastT = t;
    uvOff = (uvOff + dt / PERIOD) % 1.0; // ONLY uv moves

    var w = canvas.width, h = canvas.height;
    gl.viewport(0, 0, w, h);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    // MVP: static camera, NO model rotation
    var mvp = matMul(perspective(0.55, w/h, 0.1, 10), lookAt());
    var L = lightFromPhase(phasePct, phaseKey);

    gl.useProgram(prog);
    gl.uniformMatrix4fv(gl.getUniformLocation(prog,"uMVP"), false, mvp);
    gl.uniform1f(gl.getUniformLocation(prog,"uUvOff"), uvOff);
    gl.uniform3fv(gl.getUniformLocation(prog,"uLight"), new Float32Array(L.dir));
    gl.uniform1f(gl.getUniformLocation(prog,"uAmb"), L.amb);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.uniform1i(gl.getUniformLocation(prog,"uTex"), 0);

    var aPos=gl.getAttribLocation(prog,"aPos");
    var aNor=gl.getAttribLocation(prog,"aNor");
    var aUv=gl.getAttribLocation(prog,"aUv");
    gl.bindBuffer(gl.ARRAY_BUFFER, buf.pos); gl.enableVertexAttribArray(aPos); gl.vertexAttribPointer(aPos,3,gl.FLOAT,false,0,0);
    gl.bindBuffer(gl.ARRAY_BUFFER, buf.nor); gl.enableVertexAttribArray(aNor); gl.vertexAttribPointer(aNor,3,gl.FLOAT,false,0,0);
    gl.bindBuffer(gl.ARRAY_BUFFER, buf.uv);  gl.enableVertexAttribArray(aUv);  gl.vertexAttribPointer(aUv,2,gl.FLOAT,false,0,0);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, buf.idx);
    gl.drawElements(gl.TRIANGLES, buf.n, gl.UNSIGNED_SHORT, 0);
  }

  function resize() {
    if (!canvas) return;
    var css = canvas.clientWidth || 108;
    var size = Math.max(128, Math.min(512, Math.round(css * (window.devicePixelRatio||1))));
    if (canvas.width !== size) { canvas.width = size; canvas.height = size; }
  }

  function setPhase(pct, key) {
    phasePct = Math.max(0, Math.min(100, Number(pct)||0));
    if (key) phaseKey = key;
  }
  window.__moonSetPhase = setPhase;

  function boot() {
    if (!init()) {
      var img = $("moon-img");
      if (img) { img.hidden = false; img.style.display = "block"; }
      return;
    }
    var img = $("moon-img");
    if (img) { img.hidden = true; img.style.display = "none"; }
    // sync phase from DOM once
    try {
      var el = $("moon-pct");
      if (el) {
        var n = parseFloat(String(el.textContent).replace(/[^0-9.]/g,""));
        if (!isNaN(n)) phasePct = n;
      }
      var ph = $("moon-phase");
      if (ph) phaseKey = ph.textContent || "";
    } catch(e) {}
    resize();
    window.addEventListener("resize", resize);
    requestAnimationFrame(frame);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
