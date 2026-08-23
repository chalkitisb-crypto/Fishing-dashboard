/*! FD Moon WebGL v170 — 3D sphere, horizontal spin, phase light */
(function () {
  var canvas, gl, prog, buf, tex, raf, ready = false;
  var rotY = 0;
  var phasePct = 78;
  var phaseKey = "";
  var lastT = 0;
  var PERIOD = 30; // seconds full rotation

  function $(id) { return document.getElementById(id); }

  function compile(type, src) {
    var s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
      console.warn("moon shader", gl.getShaderInfoLog(s));
      return null;
    }
    return s;
  }

  function makeSphere(lat, lon) {
    var pos = [], nor = [], uv = [], idx = [];
    for (var i = 0; i <= lat; i++) {
      var v = i / lat;
      var phi = v * Math.PI;
      for (var j = 0; j <= lon; j++) {
        var u = j / lon;
        var th = u * Math.PI * 2;
        var x = Math.sin(phi) * Math.cos(th);
        var y = Math.cos(phi);
        var z = Math.sin(phi) * Math.sin(th);
        pos.push(x, y, z);
        nor.push(x, y, z);
        uv.push(1 - u, v);
      }
    }
    for (var i = 0; i < lat; i++) {
      for (var j = 0; j < lon; j++) {
        var a = i * (lon + 1) + j;
        var b = a + lon + 1;
        idx.push(a, b, a + 1);
        idx.push(b, b + 1, a + 1);
      }
    }
    return { pos: new Float32Array(pos), nor: new Float32Array(nor), uv: new Float32Array(uv), idx: new Uint16Array(idx) };
  }

  function init() {
    canvas = $("moon-canvas");
    if (!canvas) return false;
    gl = canvas.getContext("webgl", { alpha: true, antialias: true, premultipliedAlpha: false });
    if (!gl) {
      console.warn("WebGL unavailable");
      return false;
    }
    var vs = compile(gl.VERTEX_SHADER, [
      "attribute vec3 aPos;",
      "attribute vec3 aNor;",
      "attribute vec2 aUv;",
      "uniform mat4 uMVP;",
      "uniform mat3 uNMat;",
      "varying vec3 vNor;",
      "varying vec2 vUv;",
      "void main(){",
      "  vNor = normalize(uNMat * aNor);",
      "  vUv = aUv;",
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
      "  float ndl = clamp(dot(n, normalize(uLight)), 0.0, 1.0);",
      "  float lit = uAmb + (1.0 - uAmb) * ndl;",
      "  vec4 tex = texture2D(uTex, vUv);",
      "  vec3 col = tex.rgb * lit;",
      "  /* soft terminator */",
      "  float soft = smoothstep(0.0, 0.15, ndl);",
      "  col = mix(tex.rgb * uAmb, col, soft);",
      "  gl_FragColor = vec4(col, 1.0);",
      "}"
    ].join("\n"));
    if (!vs || !fs) return false;
    prog = gl.createProgram();
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      console.warn("moon link", gl.getProgramInfoLog(prog));
      return false;
    }
    var sph = makeSphere(48, 64);
    buf = {
      pos: gl.createBuffer(),
      nor: gl.createBuffer(),
      uv: gl.createBuffer(),
      idx: gl.createBuffer(),
      nIdx: sph.idx.length
    };
    gl.bindBuffer(gl.ARRAY_BUFFER, buf.pos); gl.bufferData(gl.ARRAY_BUFFER, sph.pos, gl.STATIC_DRAW);
    gl.bindBuffer(gl.ARRAY_BUFFER, buf.nor); gl.bufferData(gl.ARRAY_BUFFER, sph.nor, gl.STATIC_DRAW);
    gl.bindBuffer(gl.ARRAY_BUFFER, buf.uv); gl.bufferData(gl.ARRAY_BUFFER, sph.uv, gl.STATIC_DRAW);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, buf.idx); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, sph.idx, gl.STATIC_DRAW);

    tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    // placeholder pixel until image loads
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([245,197,66,255]));

    var img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = function () {
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 1);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
      ready = true;
    };
    img.onerror = function () {
      console.warn("moon texture load fail");
      ready = true;
    };
    img.src = "moon_full.png?v=170.0.0";

    gl.enable(gl.DEPTH_TEST);
    gl.enable(gl.CULL_FACE);
    gl.clearColor(0, 0, 0, 0);
    return true;
  }

  function matMul(a, b) {
    var o = new Float32Array(16);
    for (var c = 0; c < 4; c++)
      for (var r = 0; r < 4; r++)
        o[c*4+r] = a[r]*b[c*4] + a[4+r]*b[c*4+1] + a[8+r]*b[c*4+2] + a[12+r]*b[c*4+3];
    return o;
  }
  function perspective(fovy, aspect, near, far) {
    var f = 1 / Math.tan(fovy / 2);
    var m = new Float32Array(16);
    m[0] = f/aspect; m[5] = f; m[10] = (far+near)/(near-far); m[11] = -1;
    m[14] = (2*far*near)/(near-far);
    return m;
  }
  function lookAt() {
    // camera at z=3 looking origin
    var m = new Float32Array(16);
    m[0]=1; m[5]=1; m[10]=1; m[15]=1;
    m[14] = -2.35;
    return m;
  }
  function rotYMat(a) {
    var c = Math.cos(a), s = Math.sin(a);
    var m = new Float32Array(16);
    m[0]=c; m[2]=s; m[5]=1; m[8]=-s; m[10]=c; m[15]=1;
    return m;
  }

  function lightFromPhase(pct, key) {
    // illumination 0..100 → light angle around Y
    // waxing: light from right; waning: from left
    var k = String(key || "").toLowerCase();
    var waning = /φθιν|waning|τελευτ|last/.test(k);
    var t = Math.max(0, Math.min(100, pct)) / 100;
    // full lit when t=1, new when t=0
    // light direction in view space: x positive = right
    var ang = (1 - t) * Math.PI; // 0 at full → light toward camera; pi at new
    if (waning) ang = -ang;
    // mix so surface under shadow still visible (ambient)
    return {
      dir: [Math.sin(ang), 0.15, Math.cos(ang)],
      amb: 0.18
    };
  }

  function frame(t) {
    if (!gl || !prog) return;
    raf = requestAnimationFrame(frame);
    if (!lastT) lastT = t;
    var dt = Math.min(0.05, (t - lastT) / 1000);
    lastT = t;
    rotY += (Math.PI * 2 / PERIOD) * dt;

    var w = canvas.width, h = canvas.height;
    gl.viewport(0, 0, w, h);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    var mvp = matMul(perspective(0.55, w / h, 0.1, 10), lookAt());
    mvp = matMul(mvp, rotYMat(rotY));

    // normal matrix ≈ rotation only (upper 3x3)
    var c = Math.cos(rotY), s = Math.sin(rotY);
    var nmat = new Float32Array([c,0,-s, 0,1,0, s,0,c]);

    var L = lightFromPhase(phasePct, phaseKey);

    gl.useProgram(prog);
    gl.uniformMatrix4fv(gl.getUniformLocation(prog, "uMVP"), false, mvp);
    gl.uniformMatrix3fv(gl.getUniformLocation(prog, "uNMat"), false, nmat);
    gl.uniform3fv(gl.getUniformLocation(prog, "uLight"), new Float32Array(L.dir));
    gl.uniform1f(gl.getUniformLocation(prog, "uAmb"), L.amb);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.uniform1i(gl.getUniformLocation(prog, "uTex"), 0);

    var aPos = gl.getAttribLocation(prog, "aPos");
    var aNor = gl.getAttribLocation(prog, "aNor");
    var aUv = gl.getAttribLocation(prog, "aUv");
    gl.bindBuffer(gl.ARRAY_BUFFER, buf.pos);
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 3, gl.FLOAT, false, 0, 0);
    gl.bindBuffer(gl.ARRAY_BUFFER, buf.nor);
    gl.enableVertexAttribArray(aNor);
    gl.vertexAttribPointer(aNor, 3, gl.FLOAT, false, 0, 0);
    gl.bindBuffer(gl.ARRAY_BUFFER, buf.uv);
    gl.enableVertexAttribArray(aUv);
    gl.vertexAttribPointer(aUv, 2, gl.FLOAT, false, 0, 0);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, buf.idx);
    gl.drawElements(gl.TRIANGLES, buf.nIdx, gl.UNSIGNED_SHORT, 0);
  }

  function resize() {
    if (!canvas) return;
    var size = Math.round(canvas.clientWidth * (window.devicePixelRatio || 1));
    size = Math.max(128, Math.min(512, size || 256));
    if (canvas.width !== size) {
      canvas.width = size;
      canvas.height = size;
    }
  }

  function setPhase(pct, key) {
    phasePct = Math.max(0, Math.min(100, Number(pct) || 0));
    phaseKey = key || phaseKey;
  }
  window.__moonSetPhase = setPhase;

  function boot() {
    if (!init()) {
      // fallback: show static img
      var img = $("moon-img");
      if (img) { img.hidden = false; img.style.display = "block"; }
      return;
    }
    var img = $("moon-img");
    if (img) { img.hidden = true; img.style.display = "none"; }
    resize();
    window.addEventListener("resize", resize);
    requestAnimationFrame(frame);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
