/* v155.0.0 hero plates + realistic sun no blue ring */
/* v153.0.0 HERO plates time×weather + live rain + moon % */
/* v152.0.0 FULL package */
/* v151.1.0 chips 10-00 every 2h */
/* v151.0.0 logic: objective score · peak hours · hour picker · current tips */
/* v150.0.0 ROOTFIX — rod pivot restore · GOLD HOUR PNG bg · zone horizontal 2D */
/* v149.0.0 — arrows wind TO / current TOWARD · rod calibrated · GOLD HOUR ruby · zone */
/* v148.0.0 GOLD HOUR ruby + zone horizontal + pin */

/* v97 bridge → moon.js */
function __notifyMoon(pct, phaseTxt) {
  if (typeof window.__moonSetPhase === "function") {
    window.__moonSetPhase(pct, phaseTxt);
  }
  try {
    window.dispatchEvent(new CustomEvent("moon-data", { detail: { pct: pct, phase: phaseTxt } }));
  } catch (e) {}
}

/* Fishing Dashboard v127.0.0 — Stage 1 complete APIs + score SVG */
(function () {
  "use strict";

  var weatherHours = [];
  var windHours = [];
  var currentHours = [];
  var pressurePts = [];
  var pressureTimes = [];
  var tidePts = [0.15, 0.4, 0.9, 1.15, 0.7, 0.3, 0.18];

  var STAR_LABEL = { 5: "Ιδανική", 4: "Πολύ καλή", 3: "Καλή", 2: "Μέτρια", 1: "Κακή" };
  function starsText(n) {
    n = Math.max(1, Math.min(5, n | 0));
    return "★★★★★".slice(0, n) + "☆☆☆☆☆".slice(0, 5 - n);
  }

  function $(id) { return document.getElementById(id); }

  function setStatus(msg, isErr) {
    var el = $("data-status");
    if (!el) return;
    el.textContent = msg;
    el.classList.toggle("err", !!isErr);
    el.classList.add("show");
  }

  function renderWeather() {
    var root = $("weather-hours");
    if (!root) return;
    if (!weatherHours.length) {
      root.innerHTML = '<article class="wh-cell"><span class="lab">Φόρτωση…</span></article>';
      return;
    }
    root.innerHTML = weatherHours.map(function (h) {
      return '<article class="wh-cell"><img class="wh-ico" src="' + h.ico + '" alt=""/>' +
        '<time>' + h.t + '</time><span class="lab">' + h.lab +
        '</span><strong>' + h.temp + '°C</strong></article>';
    }).join("");
  }

  function renderWind() {
    var root = $("wind-hours");
    if (!root) return;
    root.innerHTML = windHours.map(function (h) {
      /* API deg = FROM; arrow shows WHERE wind blows (TO) */
      var from = Number(h.deg) || 0;
      var to = (from + 180) % 360;
      /* tip points east at 0° CSS → meteo 0°N needs -90 */
      var cssDeg = (to - 90 + 360) % 360;
      return '<article class="wh-cell wind-cell"><div class="wind-arrow ' + h.cls +
        '" style="transform:rotate(' + cssDeg + 'deg)"></div>' +
        '<time>' + h.t + '</time><span class="lab">' + h.dir +
        '</span><strong>' + h.bf + '</strong></article>';
    }).join("");
  }

  function renderCurrents() {
    var root = $("current-hours");
    if (!root) return;
    root.innerHTML = currentHours.map(function (h) {
      /* API deg = flow TOWARD (start → end) */
      var to = Number(h.deg) || 0;
      var cssDeg = (to - 90 + 360) % 360;
      return '<article class="wh-cell"><div class="wind-arrow ' + h.cls +
        '" style="transform:rotate(' + cssDeg + 'deg)"></div>' +
        '<time>' + h.t + '</time><span class="lab">' + h.dir +
        '</span><strong>' + h.kn + ' kn</strong></article>';
    }).join("");
  }


  function placeLiveDot(groupId, x, y) {
    var g = $(groupId);
    if (!g) return;
    g.innerHTML =
      '<circle cx="' + x.toFixed(1) + '" cy="' + y.toFixed(1) + '" r="6" fill="#ff2a2a" opacity="0.35"></circle>' +
      '<circle cx="' + x.toFixed(1) + '" cy="' + y.toFixed(1) + '" r="3.4" fill="#e01010" stroke="#ffffff" stroke-width="1.8"></circle>';
  }
  function liveIndexFromTimes(times) {
    if (!times || !times.length) return 0;
    var now = new Date();
    var nowMin = now.getHours() * 60 + now.getMinutes();
    var liveIdx = 0, best = 1e9;
    for (var li = 0; li < times.length; li++) {
      var parts = String(times[li] || "0:0").split(":");
      var tm = parseInt(parts[0], 10) * 60 + parseInt(parts[1] || "0", 10);
      if (isNaN(tm)) continue;
      var dff = Math.abs(tm - nowMin);
      if (dff > 12 * 60) dff = 24 * 60 - dff;
      if (dff < best) { best = dff; liveIdx = li; }
    }
    return liveIdx;
  }
  /* fractional index for rolling red-dot between samples */
  function liveFracFromTimes(times) {
    if (!times || times.length < 2) return liveIndexFromTimes(times);
    var now = new Date();
    var nowMin = now.getHours() * 60 + now.getMinutes() + now.getSeconds() / 60;
    function tMin(s) {
      var p = String(s || "0:0").split(":");
      return parseInt(p[0], 10) * 60 + parseInt(p[1] || "0", 10);
    }
    var mins = times.map(tMin);
    /* find segment [i, i+1] containing nowMin (handle wrap) */
    for (var i = 0; i < mins.length - 1; i++) {
      var a = mins[i], b = mins[i + 1];
      if (a <= b) {
        if (nowMin >= a && nowMin <= b) {
          var t = (nowMin - a) / Math.max(1, b - a);
          return i + t;
        }
      }
    }
    /* before first or after last → clamp */
    if (nowMin <= mins[0]) return 0;
    return mins.length - 1;
  }

  function drawPressure() {
    var line = $("pressure-line");
    var area = $("pressure-area");
    var dots = $("pressure-dots");
    var labels = $("pressure-labels");
    var grid = $("pressure-grid");
    if (!line || !pressurePts || pressurePts.length < 2) return;
    var pts = pressurePts;
    var times = pressureTimes || [];
    var svg = $("pressure-svg");
    if (svg) {
      svg.setAttribute("preserveAspectRatio", "none");
      svg.setAttribute("viewBox", "0 0 320 150");
    }
    var w = 320, h = 150;
    var padL = 30, padR = 10, padT = 20, padB = 26;
    var min = Math.min.apply(null, pts) - 0.5;
    var max = Math.max.apply(null, pts) + 0.5;
    if (max <= min) max = min + 2;
    function X(i) { return padL + (i * (w - padL - padR)) / Math.max(1, pts.length - 1); }
    function Y(v) { return padT + (1 - (v - min) / (max - min)) * (h - padT - padB); }
    var pairs = pts.map(function (v, i) { return X(i).toFixed(1) + "," + Y(v).toFixed(1); });
    line.setAttribute("points", pairs.join(" "));
    line.setAttribute("stroke", "#f5c542");
    line.setAttribute("stroke-width", "3.2");
    line.setAttribute("filter", "url(#pressureGlow)");
    line.setAttribute("fill", "none");
    if (area) {
      area.setAttribute("d",
        "M" + X(0).toFixed(1) + "," + (h - padB) + " " +
        pairs.map(function (p) { return "L" + p; }).join(" ") +
        " L" + X(pts.length - 1).toFixed(1) + "," + (h - padB) + " Z");
    }
    /* sparse value labels — every ~4 points + first/last */
    if (dots) {
      var step = Math.max(1, Math.floor(pts.length / 6));
      var htmlD = "";
      for (var i = 0; i < pts.length; i++) {
        if (i !== 0 && i !== pts.length - 1 && (i % step) !== 0) continue;
        htmlD += '<circle cx="' + X(i).toFixed(1) + '" cy="' + Y(pts[i]).toFixed(1) +
          '" r="2.8" fill="#f5c542" stroke="#1a1000" stroke-width="1"/>';
        htmlD += '<text x="' + X(i).toFixed(1) + '" y="' + (Y(pts[i]) - 7).toFixed(1) +
          '" text-anchor="middle" fill="#f5c542" font-size="8" font-weight="600">' +
          Math.round(pts[i]) + "</text>";
      }
      dots.innerHTML = htmlD;
    }
    if (grid) {
      var ticks = [];
      var stepV = Math.max(1, Math.round((max - min) / 3));
      for (var v = Math.ceil(min); v <= max; v += stepV) {
        var y = Y(v);
        ticks.push('<line x1="' + padL + '" y1="' + y + '" x2="' + (w - padR) +
          '" y2="' + y + '" stroke="rgba(53,200,255,.12)" stroke-dasharray="3 4"/>');
        ticks.push('<text x="' + (padL - 4) + '" y="' + (y + 3) +
          '" text-anchor="end" fill="rgba(53,200,255,.55)" font-size="8">' + v + "</text>");
      }
      /* time labels sparse */
      var tStep = Math.max(1, Math.floor(pts.length / 5));
      for (var i = 0; i < pts.length; i++) {
        if (i !== 0 && i !== pts.length - 1 && (i % tStep) !== 0) continue;
        var t = times[i] || "";
        if (t) ticks.push('<text x="' + X(i).toFixed(1) + '" y="' + (h - 6) +
          '" text-anchor="middle" fill="rgba(53,200,255,.55)" font-size="8">' + t + "</text>");
      }
      grid.innerHTML = ticks.join("");
    }
    try {
      var frac = (typeof liveFracFromTimes === "function") ? liveFracFromTimes(times) : liveIndexFromTimes(times);
      var i0 = Math.floor(frac);
      var i1 = Math.min(pts.length - 1, i0 + 1);
      var t = frac - i0;
      var v0 = pts[i0], v1 = pts[i1];
      if (v0 != null && v1 != null) {
        var xf = X(i0) * (1 - t) + X(i1) * t;
        var yf = Y(v0) * (1 - t) + Y(v1) * t;
        placeLiveDot("pressure-live", xf, yf);
      } else if (v0 != null) {
        placeLiveDot("pressure-live", X(i0), Y(v0));
      }
    } catch (eLive) {}

    

    /* LIVE red dot — match current hour to times[] */
}

    function drawTide(pts, times) {
    pts = pts || tidePts;
    times = times || window._tideTimes || [];
    var line = $("tide-line");
    var area = $("tide-area");
    var dots = $("tide-dots");
    var axis = $("tide-axis");
    if (!line) return;
    if (!pts || pts.length < 2) pts = [0.2, 0.5, 1.0, 0.6, 0.25, 0.45, 0.9];
    var tsvg = $("tide-svg");
    if (tsvg) { tsvg.setAttribute("preserveAspectRatio", "none"); }
    var w = 320, h = 130;
    var padL = 8, padR = 8, padT = 16, padB = 24;
    var min = Math.min.apply(null, pts);
    var max = Math.max.apply(null, pts);
    var span = max - min || 0.2;
    min -= span * 0.08;
    max += span * 0.08;
    function X(i) { return padL + (i * (w - padL - padR)) / Math.max(1, pts.length - 1); }
    function Y(v) { return padT + (1 - (v - min) / (max - min)) * (h - padT - padB); }
    var pairs = pts.map(function (v, i) { return X(i).toFixed(1) + "," + Y(v).toFixed(1); });
    line.setAttribute("points", pairs.join(" "));
    line.setAttribute("stroke", "#35c8ff");
    line.setAttribute("stroke-width", "2.8");
    line.setAttribute("fill", "none");
    if (area) {
      area.setAttribute("d",
        "M" + X(0).toFixed(1) + "," + (h - padB) + " " +
        pairs.map(function (p) { return "L" + p; }).join(" ") +
        " L" + X(pts.length - 1).toFixed(1) + "," + (h - padB) + " Z");
    }
    var html = "";
    if (dots) {
      for (var i = 0; i < pts.length; i++) {
        var isExt = (i === 0 || i === pts.length - 1);
        if (!isExt && i > 0 && i < pts.length - 1) {
          if ((pts[i] >= pts[i-1] && pts[i] >= pts[i+1]) || (pts[i] <= pts[i-1] && pts[i] <= pts[i+1])) isExt = true;
        }
        if (!isExt) continue;
        html += '<circle cx="' + X(i).toFixed(1) + '" cy="' + Y(pts[i]).toFixed(1) +
          '" r="3.5" fill="#fff" stroke="#35c8ff" stroke-width="2"/>';
      }
      /* LIVE red dot — series starts at now (index 0) */
      var liveIdx = 0;
      html +=
        '<circle cx="' + X(liveIdx).toFixed(1) + '" cy="' + Y(pts[liveIdx]).toFixed(1) +
        '" r="5" fill="#ff2a2a" opacity="0.35"/>' +
        '<circle cx="' + X(liveIdx).toFixed(1) + '" cy="' + Y(pts[liveIdx]).toFixed(1) +
        '" r="3.2" fill="#e01010" stroke="#ffffff" stroke-width="1.6"/>';
      dots.innerHTML = html;
      try {
        var tArr = (times && times.length) ? times : (window._tideTimes || []);
        var li = liveIndexFromTimes(tArr);
        var fracT = (typeof liveFracFromTimes === "function") ? liveFracFromTimes(times) : li;
      var j0 = Math.floor(fracT), j1 = Math.min(pts.length - 1, j0 + 1), tt = fracT - j0;
      if (pts[j0] != null && pts[j1] != null)
        placeLiveDot("tide-live", X(j0) * (1 - tt) + X(j1) * tt, Y(pts[j0]) * (1 - tt) + Y(pts[j1]) * tt);
      else if (pts[li] != null) placeLiveDot("tide-live", X(li), Y(pts[li]));
      } catch (eT) {}
      
    }
    if (axis) {
      var labels = "";
      var n = pts.length;
      var idxs = n <= 4 ? [0, n-1] : [0, Math.floor(n/4), Math.floor(n/2), Math.floor(3*n/4), n-1];
      var tArr = times.length ? times : (window._tideTimes || []);
      idxs.forEach(function (i) {
        var lab = tArr[i] ? tArr[i] : "";
        if (!lab) return;
        labels += '<text x="' + X(i).toFixed(1) + '" y="' + (h - 5) +
          '" text-anchor="middle" fill="#7ad7ff" font-size="9">' + lab + '</text>';
      });
      axis.innerHTML = labels;
    }
  }



  function parseHHMM(s) {
    var p = String(s || "06:30").split(":");
    return parseInt(p[0], 10) * 60 + parseInt(p[1] || "0", 10);
  }
  function ensureHeroStars() {
    var box = $("hero-stars");
    if (!box || box.dataset.ready === "1") return box;
    var html = "";
    for (var i = 0; i < 48; i++) {
      var x = (i * 37) % 100;
      var y = (i * 53) % 55;
      var s = 1 + (i % 3);
      var o = 0.45 + ((i % 5) * 0.1);
      html += '<i style="left:' + x + '%;top:' + y + '%;width:' + s + 'px;height:' + s + 'px;opacity:' + o + '"></i>';
    }
    box.innerHTML = html;
    box.dataset.ready = "1";
    return box;
  }
  /* v153 — landscape plates by time×weather · live rain · moon % */
  var __heroPlateKey = "";
  var __heroPlateFlip = false;
  var __rainRAF = null;
  var __rainDrops = [];

  function weatherBucket(c) {
    c = c || {};
    var code = c.weatherCode != null ? Number(c.weatherCode) : null;
    var desc = (c.condition || c.desc || c.weather || "").toString().toLowerCase();
    if (code != null) {
      if (code >= 95) return "storm";
      if (code >= 80) return "rain";
      if (code >= 61) return "rain";
      if (code >= 51) return "rain";
      if (code >= 45) return "cloudy";
      if (code >= 3) return "cloudy";
      if (code >= 2) return "cloudy";
      return "clear";
    }
    if (/καταιγ|storm|thunder/.test(desc)) return "storm";
    if (/βροχ|rain|drizzle|ψιλ/.test(desc)) return "rain";
    if (/συννε|cloud|ομίχ|fog|overcast|νεφ/.test(desc)) return "cloudy";
    if (/αραι|partly|λίγα/.test(desc)) return "cloudy";
    return "clear";
  }

  function timePlateKey(mins, rise, set) {
    var span = Math.max(1, set - rise);
    var p = (mins - rise) / span;
    if (mins < rise - 40 || mins > set + 40) return "night";
    if (mins < rise + 50) return "dawn";
    if (mins > set - 50) return "dusk";
    if (mins > set - 110) return "gold";
    return "day";
  }

  function resolveHeroPlate(timeKey, wx) {
    if (wx === "storm") return "hero_plate_storm.jpg";
    if (wx === "rain") return "hero_plate_rain.jpg";
    if (wx === "cloudy" && (timeKey === "night" || timeKey === "day" || timeKey === "gold"))
      return "hero_plate_cloudy.jpg";
    var map = {
      dawn: "hero_plate_dawn.jpg",
      day: "hero_plate_day.jpg",
      gold: "hero_plate_gold.jpg",
      dusk: "hero_plate_dusk.jpg",
      night: "hero_plate_night.jpg"
    };
    return map[timeKey] || "hero_plate_day.jpg";
  }

  function setHeroPlate(src) {
    var a = $("hero-plate-a");
    var b = $("hero-plate-b");
    if (!a) return;
    if (!b) {
      if (a.getAttribute("src") !== src) a.src = src;
      return;
    }
    if (__heroPlateKey === src) return;
    __heroPlateKey = src;
    var front = __heroPlateFlip ? b : a;
    var back = __heroPlateFlip ? a : b;
    back.src = src;
    back.onload = function () {
      back.style.opacity = "1";
      front.style.opacity = "0";
      __heroPlateFlip = !__heroPlateFlip;
    };
    // if cached
    if (back.complete) {
      back.style.opacity = "1";
      front.style.opacity = "0";
      __heroPlateFlip = !__heroPlateFlip;
    }
  }

  function ensureLiveRain() {
    var canvas = $("hero-rain");
    if (!canvas || canvas.dataset.ready === "1") return canvas;
    canvas.dataset.ready = "1";
    var ctx = canvas.getContext("2d");
    function resize() {
      var r = canvas.parentElement.getBoundingClientRect();
      canvas.width = Math.max(1, Math.floor(r.width * (window.devicePixelRatio || 1)));
      canvas.height = Math.max(1, Math.floor(r.height * (window.devicePixelRatio || 1)));
    }
    resize();
    window.addEventListener("resize", resize);
    function spawn(n, heavy) {
      __rainDrops = [];
      for (var i = 0; i < n; i++) {
        __rainDrops.push({
          x: Math.random() * canvas.width,
          y: Math.random() * canvas.height,
          len: heavy ? 14 + Math.random() * 18 : 8 + Math.random() * 12,
          spd: heavy ? 12 + Math.random() * 10 : 6 + Math.random() * 8,
          op: 0.25 + Math.random() * 0.45
        });
      }
    }
    canvas.__setIntensity = function (level) {
      if (level <= 0) {
        canvas.classList.remove("is-on");
        if (__rainRAF) { cancelAnimationFrame(__rainRAF); __rainRAF = null; }
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        return;
      }
      canvas.classList.add("is-on");
      spawn(level === 2 ? 90 : 55, level === 2);
      if (__rainRAF) return;
      function frame() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.strokeStyle = "rgba(200,220,255,0.55)";
        ctx.lineWidth = Math.max(1, canvas.width / 400);
        ctx.lineCap = "round";
        for (var i = 0; i < __rainDrops.length; i++) {
          var d = __rainDrops[i];
          ctx.globalAlpha = d.op;
          ctx.beginPath();
          ctx.moveTo(d.x, d.y);
          ctx.lineTo(d.x - d.len * 0.15, d.y + d.len);
          ctx.stroke();
          d.y += d.spd * (canvas.height / 300);
          d.x -= d.spd * 0.12;
          if (d.y > canvas.height) {
            d.y = -10;
            d.x = Math.random() * canvas.width;
          }
        }
        ctx.globalAlpha = 1;
        __rainRAF = requestAnimationFrame(frame);
      }
      __rainRAF = requestAnimationFrame(frame);
    };
    return canvas;
  }

  function updateHeroSky(sun, c) {
    sun = sun || {};
    c = c || {};
    var rise = parseHHMM(sun.rise || "06:30");
    var set = parseHHMM(sun.set || "20:00");
    var now = new Date();
    var mins = now.getHours() * 60 + now.getMinutes() + now.getSeconds() / 60;
    var sunEl = $("hero-sun");
    var nightEl = $("hero-night");
    var tintEl = $("hero-sky-tint");
    var starsEl = ensureHeroStars();
    var isDay = mins >= rise && mins <= set;
    var progress = 0;
    if (isDay) {
      progress = (mins - rise) / Math.max(1, set - rise);
      progress = Math.max(0, Math.min(1, progress));
    }

    var timeKey = timePlateKey(mins, rise, set);
    var wx = weatherBucket(c);
    setHeroPlate(resolveHeroPlate(timeKey, wx));

    // Live rain
    var rainCanvas = ensureLiveRain();
    if (rainCanvas && rainCanvas.__setIntensity) {
      if (wx === "storm") rainCanvas.__setIntensity(2);
      else if (wx === "rain") rainCanvas.__setIntensity(1);
      else rainCanvas.__setIntensity(0);
    }

    // Sun arc — hide when rain/storm/heavy cloud
    if (sunEl) {
      var showSun = isDay && wx !== "storm" && wx !== "rain";
      if (showSun && wx === "cloudy") {
        sunEl.style.opacity = "0.35";
      }
      if (showSun && wx !== "cloudy") {
        var x = 8 + progress * 84;
        var y = 72 - Math.sin(progress * Math.PI) * 52;
        // keep lower near horizon at dawn/dusk
        if (progress < 0.12) y = 78 - progress * 80;
        if (progress > 0.88) y = 78 - (1 - progress) * 80;
        sunEl.style.left = x + "%";
        sunEl.style.top = y + "%";
        sunEl.style.opacity = "1";
        sunEl.style.transform = "translate(-50%,-50%) scale(" + (0.95 + Math.sin(progress * Math.PI) * 0.35) + ")";
        var nearHorizon = progress < 0.18 || progress > 0.82;
        sunEl.classList.toggle("hero-sun--warm", nearHorizon);
        var sunImg = $("hero-sun-img");
        if (sunImg) {
          var want = nearHorizon ? "hero_sun_warm.png" : "hero_sun.png";
          if (sunImg.getAttribute("data-src") !== want) {
            sunImg.src = want;
            sunImg.setAttribute("data-src", want);
          }
        }
      } else if (!showSun) {
        sunEl.style.opacity = "0";
      }
    }

    // Night factor
    var nightOp = 0;
    if (!isDay) nightOp = 1;
    else if (progress < 0.08) nightOp = 1 - progress / 0.08;
    else if (progress > 0.92) nightOp = (progress - 0.92) / 0.08;
    if (nightEl) nightEl.style.opacity = String(Math.max(0, Math.min(0.55, nightOp * 0.55)));
    if (starsEl) {
      var starOp = (!isDay || nightOp > 0.5) && wx !== "storm" ? Math.max(nightOp, isDay ? 0 : 0.85) : 0;
      if (wx === "cloudy" && !isDay) starOp *= 0.25;
      starsEl.style.opacity = String(starOp);
    }
    if (tintEl) {
      var warm = (timeKey === "dawn" || timeKey === "gold" || timeKey === "dusk") && wx === "clear";
      tintEl.style.opacity = warm ? "0.45" : "0";
    }

    // Moon — real % · visible at night even with clouds
    var moonEl = $("hero-moon");
    var moonShade = $("hero-moon-shade");
    if (moonEl) {
      var showMoon = !isDay || nightOp > 0.35;
      if (wx === "storm") showMoon = false;
      if (showMoon) {
        var pct = 50;
        try {
          if (window.__fdLastData && window.__fdLastData.moon && window.__fdLastData.moon.pct != null)
            pct = Number(window.__fdLastData.moon.pct);
        } catch (e) {}
        moonEl.style.opacity = wx === "cloudy" ? "0.7" : "1";
        moonEl.classList.toggle("is-cloudy", wx === "cloudy");
        moonEl.style.left = "72%";
        moonEl.style.top = "16%";
        if (moonShade) {
          var illum = Math.max(0, Math.min(100, pct)) / 100;
          var darkPct = Math.round((1 - illum) * 100);
          moonShade.style.background =
            "linear-gradient(90deg, rgba(2,6,18,0.92) 0%, rgba(2,6,18,0.92) " + darkPct + "%, transparent " + Math.min(100, darkPct + 18) + "%)";
        }
      } else {
        moonEl.style.opacity = "0";
      }
    }
  }

  function applyHero(data) {
    if (!data) return;
    window.__fdLastData = data;
    var d = data.date || {};
    var c = data.current || {};
    var sun = data.sun || {};
    if ($("hero-dow")) $("hero-dow").textContent = d.dow || "—";
    if ($("hero-day")) $("hero-day").textContent = d.day || "—";
    if ($("hero-mon")) $("hero-mon").innerHTML = d.mon || "—";
    if ($("hero-cond")) $("hero-cond").textContent = c.cond || "—";
    if ($("hero-temp")) $("hero-temp").innerHTML = (c.temp != null ? c.temp : "—") + "<span>°C</span>";
    if ($("hero-desc")) $("hero-desc").textContent = c.desc || "—";
    if ($("m-feels")) $("m-feels").textContent = (c.feels != null ? c.feels + "°C" : "—");
    if ($("m-hum")) $("m-hum").textContent = (c.humidity != null ? c.humidity + "%" : "—");
    if ($("m-rain")) {
      var rainTxt = c.rain != null ? (Number(c.rain).toFixed(1) + " mm") : "—";
      if (c.precipProb != null) rainTxt += " · " + c.precipProb + "%";
      $("m-rain").textContent = rainTxt;
    }
    if ($("m-uv") && window.FDData) {
      var uvVal = c.uv != null ? c.uv : (data.uvMax || 0);
      $("m-uv").textContent = window.FDData.uvLabel(uvVal);
      var uvEl = $("m-uv");
      if (uvEl) {
        var u = Number(uvVal) || 0;
        var uvColor = u < 3 ? "#3ddc84" : u < 6 ? "#f5c542" : u < 8 ? "#ff9f1a" : u < 11 ? "#ff4d4d" : "#c77dff";
        uvEl.style.color = uvColor;
        uvEl.style.textShadow = "0 0 8px " + uvColor;
      }
    }
    if ($("m-rise")) $("m-rise").textContent = sun.rise || "—";
    if ($("m-set")) $("m-set").textContent = sun.set || "—";
    // Live sun arc + night + stars
    updateHeroSky(sun, c);

    var sea = data.sea || {};
    if ($("sea-wave")) $("sea-wave").textContent = sea.wave != null ? sea.wave.toFixed(1) + " m" : "—";
    if ($("sea-period")) $("sea-period").textContent = sea.period != null ? Math.round(sea.period) + " s" : "—";
    if ($("sea-dir")) $("sea-dir").textContent = sea.dirDeg != null && window.FDData ? window.FDData.degToCompass(sea.dirDeg) : "—";
    if ($("sea-temp")) $("sea-temp").textContent = sea.waterTemp != null ? Math.round(sea.waterTemp) + "°C" : "—";

    if ($("pressure-hpa") && c.pressure != null) {
      $("pressure-hpa").textContent = Math.round(c.pressure) + " hPa";
    }
    if ($("pressure-trend") && data.pressureTrend) {
      $("pressure-trend").textContent = data.pressureTrend;
    }
    if (data.moon) {
      if ($("moon-pct")) $("moon-pct").textContent = data.moon.pct + "%"; if (typeof setMoonShade==="function") setMoonShade(data.moon.pct, data.moon.phaseKey || data.moon.phaseHtml || "");
      if ($("moon-phase")) $("moon-phase").innerHTML = data.moon.phaseHtml;
      if ($("moon-rise") && data.moon.rise) $("moon-rise").textContent = data.moon.rise;
      if ($("moon-set") && data.moon.set) $("moon-set").textContent = data.moon.set;
      setMoonVisual(data.moon.pct, data.moon.phaseHtml || "", data.moon.phaseKey || "");
    }


    
    applyStage2(data);

    var locEl = document.querySelector(".brand-loc");
    if (locEl && data.location) {
      locEl.textContent = "📍 " + (data.location.name || "Κάλυμνος") + ", Ελλάδα";
    }
  }



  /** Map score 0–100 → degrees. Gauge arc: left(-120) … center(0) … right(+120) */
  



  function scoreToAngle(score) {
    score = Math.max(0, Math.min(100, Number(score) || 0));
    /* v149 calibration:
       CSS 0° = up (50). -90° ≈ 0, +90° ≈ 100.
       Gauge artwork arc ~155° useful. Rod tip PNG leans ~7° toward 100.
       At 73 must sit before 75 tick. */
    var span = 155;
    var tipBias = -7; // degrees (tip leans right in asset)
    var start = -span / 2;
    return start + (score / 100) * span + tipBias;
  }

          function setRodAngle(score, instant, root) {
    var scope = root || document;
    var arm = scope.querySelector(".score-rod-live") || scope.querySelector("#score-rod-arm");
    if (!arm) return;
    var s = Math.max(0, Math.min(100, Number(score) || 0));
    var deg = scoreToAngle(s);
    // pivot = bottom center (βίδα) · 0° = πάνω · -90=αριστερά 0 · +90=δεξιά 100
    arm.style.setProperty("transform-origin", "50% 100%", "important");
    var t = "translateX(-50%) rotate(" + deg + "deg)";
    if (instant) arm.style.setProperty("transition", "none", "important");
    else arm.style.setProperty("transition", "transform .95s cubic-bezier(.25,.8,.25,1)", "important");
    arm.style.setProperty("transform", t, "important");
    if (instant) {
      void arm.offsetHeight;
      arm.style.setProperty("transition", "transform .95s cubic-bezier(.25,.8,.25,1)", "important");
    }
  }

  var __scoreTarget = 0;
  function animateScoreRod(target, root) {
    var scope = root || document;
    var arm = scope.querySelector(".score-rod-live") || scope.querySelector("#score-rod-arm");
    if (!arm) return;
    var t = Math.max(0, Math.min(100, Number(target) != null ? Number(target) : __scoreTarget));
    __scoreTarget = t;
    setRodAngle(0, true, scope);
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        setRodAngle(t, false, scope);
      });
    });
  }

  function bindScoreTap(root) {
    var scope = root || document;
    scope.querySelectorAll(".score-dial").forEach(function (dial) {
      if (dial.dataset.scoreTapBound) return;
      dial.dataset.scoreTapBound = "1";
      dial.addEventListener("click", function (e) {
        e.stopPropagation();
        animateScoreRod(__scoreTarget || 0, root || undefined);
      }, true);
    });
  }

  function setActivityBrows(pct) {
    pct = Math.max(0, Math.min(100, Number(pct) || 0));
    var img = $("activity-panel");
    if (!img) return;
    var bright = 0.92 + (pct / 100) * 0.22;
    var sat = 1 + (pct / 100) * 0.35;
    var glow = 4 + (pct / 100) * 14;
    var glowA = 0.15 + (pct / 100) * 0.55;
    img.style.filter =
      "brightness(" + bright.toFixed(3) + ") saturate(" + sat.toFixed(3) + ") " +
      "drop-shadow(0 0 " + glow.toFixed(1) + "px rgba(245,197,66," + glowA.toFixed(3) + "))";
  }




            function setMoonVisual(pct, phaseHtml, phaseKey) {
    pct = Math.max(0, Math.min(100, Number(pct) || 0));
    var img = document.getElementById("moon-img");
    var shade = document.getElementById("moon-shade");
    var lit = document.getElementById("moon-lit");
    if (img) {
      img.hidden = false;
      img.removeAttribute("hidden");
      img.style.setProperty("display", "block", "important");
      img.style.setProperty("visibility", "visible", "important");
      img.style.setProperty("opacity", "1", "important");
      img.src = "moon_full.png?v=178.0.0";
    }
    if (!shade) return;
    // reset any solid background from old CSS
    shade.style.setProperty("background", "transparent", "important");
    var phase = String(phaseHtml || phaseKey || "").toLowerCase();
    var waning = /φθίν|φθιν|waning|last/.test(phase);
    if (pct >= 97) waning = false;

    if (pct >= 97) {
      shade.style.setProperty("background", "transparent", "important");
      shade.style.setProperty("opacity", "0", "important");
      return;
    }
    if (pct <= 3) {
      shade.style.setProperty("opacity", "1", "important");
      shade.style.setProperty("background", "rgba(2,11,24,0.90)", "important");
      return;
    }
    shade.style.setProperty("opacity", "1", "important");
    var edge = waning ? Math.round(pct) : Math.round(100 - pct);
    edge = Math.max(3, Math.min(97, edge));
    var bg;
    if (waning) {
      bg = "linear-gradient(to right, transparent 0%, transparent " + Math.max(0,edge-5) + "%, rgba(2,11,24,0.35) " + edge + "%, rgba(2,11,24,0.85) " + Math.min(100,edge+8) + "%, rgba(2,11,24,0.85) 100%)";
    } else {
      bg = "linear-gradient(to right, rgba(2,11,24,0.85) 0%, rgba(2,11,24,0.85) " + Math.max(0,edge-8) + "%, rgba(2,11,24,0.35) " + edge + "%, transparent " + Math.min(100,edge+5) + "%, transparent 100%)";
    }
    shade.style.setProperty("background", bg, "important");
    if (lit) {
      lit.style.opacity = String(0.05 + pct/100*0.15);
      lit.style.background = waning
        ? "radial-gradient(circle at 28% 40%, rgba(255,245,210,.3), transparent 55%)"
        : "radial-gradient(circle at 72% 40%, rgba(255,245,210,.3), transparent 55%)";
    }
  }





  /* ===== v151 hour preview picker ===== */
  var __previewHour = null; /* null = live now */
  function applyScoreActivity(sc, previewLabel) {
    if (!sc) return;
    if ($("score-num")) $("score-num").textContent = sc.score;
    if ($("score-lab")) $("score-lab").textContent = sc.label || "";
    if ($("score-stars")) {
      var st = sc.stars || 1;
      $("score-stars").textContent = "★★★★★".slice(0, st) + "☆☆☆☆☆".slice(st);
    }
    if (typeof animateScoreRod === "function") animateScoreRod(sc.score);
    else if (typeof setRodAngle === "function") setRodAngle(sc.score, false);
    var ap = sc.activity;
    if ($("activity-pct")) $("activity-pct").textContent = ap + "%";
    var fill = document.querySelector(".activity-fill, #activity-fill");
    if (fill) fill.style.setProperty("width", ap + "%", "important");
    var meta = $("hour-pick-meta");
    if (meta) {
      meta.textContent = previewLabel
        ? ("Πρόβλεψη " + previewLabel + " · Score " + sc.score + " · Activity " + ap)
        : ("Live · Score " + sc.score + " · Activity " + ap);
    }
  }
  function bindHourPicker(data) {
    var card = document.getElementById("hour-pick-card");
    if (!card || !data) return;
    card.querySelectorAll(".hour-chip, .hc-cloud, .hc-center").forEach(function (btn) {
      btn.onclick = function () {
        card.querySelectorAll(".hour-chip, .hc-cloud, .hc-center").forEach(function (b) { b.classList.remove("active"); });
        btn.classList.add("active");
        var h = btn.getAttribute("data-hour");
        if (h === "now") {
          __previewHour = null;
          var sc = FDData.computeScore(data);
          applyScoreActivity(sc, null);
        } else {
          __previewHour = parseInt(h, 10);
          var sc2 = FDData.computeScore(data, __previewHour + 0.5);
          var lab = (parseInt(h,10) < 10 ? "0" : "") + parseInt(h,10) + ":00"; applyScoreActivity(sc2, lab);
        }
      };
    });
  }

  /* scoreToAngle/setRodAngle defined above */
  function scoreStars(score) {
    var n = score >= 90 ? 5 : score >= 75 ? 4 : score >= 55 ? 3 : score >= 35 ? 2 : 1;
    var path = "M12 2.2l2.95 5.98 6.6.96-4.78 4.66 1.13 6.58L12 17.05 6.1 20.38l1.13-6.58L2.45 9.14l6.6-.96L12 2.2z";
    var html = "";
    for (var i = 0; i < 5; i++) {
      var filled = i < n;
      var gid = "sf" + i + "_" + Math.floor(Math.random()*1e5);
      if (filled) {
        html += '<svg class="score-star-svg filled" viewBox="0 0 24 24" width="28" height="28" aria-hidden="true">' +
          '<defs><linearGradient id="'+gid+'" x1="0" y1="0" x2="0" y2="1">' +
          '<stop offset="0%" stop-color="#f14848"/>' +
          '<stop offset="40%" stop-color="#b41e22"/>' +
          '<stop offset="100%" stop-color="#7a1015"/>' +
          '</linearGradient></defs>' +
          '<path d="'+path+'" fill="url(#'+gid+')" stroke="#e5bf6f" stroke-width="1.6" stroke-linejoin="round"/>' +
          '</svg>';
      } else {
        html += '<svg class="score-star-svg empty" viewBox="0 0 24 24" width="28" height="28" aria-hidden="true">' +
          '<path d="'+path+'" fill="rgba(180,30,34,0.15)" stroke="#e5bf6f" stroke-width="1.6" stroke-linejoin="round"/>' +
          '</svg>';
      }
    }
    return html;
  }
  function scoreLabel(score) {
    if (score >= 90) return "Ιδανική";
    if (score >= 75) return "Πολύ καλή";
    if (score >= 55) return "Καλή";
    if (score >= 35) return "Μέτρια";
    return "Κακή";
  }


  var ALERT_ICONS = {
    wind: "ico_alert_rod.png",
    technique: "ico_alert_hook.png",
    fish: "ico_alert_fish.png",
    warn: "ico_alert_warn.png",
    hours: "ico_alert_bell.png",
    score: "ico_alert_chart.png",
    default: "ico_alert_bell.png"
  };
  function alertIcon(a) {
    var map = {
      wind: "ico_alert_rod_v43.png",
      technique: "ico_alert_hook_v43.png",
      fish: "ico_alert_fish_v43.png",
      warn: "ico_alert_warn_v43.png",
      hours: "ico_alert_bell_v43.png",
      score: "ico_alert_chart_v43.png",
      default: "ico_alert_bell_v43.png"
    };
    var t = (a && (a.type || a.ico || "")).toString().toLowerCase();
    if (map[t]) return map[t];
    return map.default;
  }

  function applyStage2(data) {
    if (!window.FDData || !FDData.computeScore) return;
    var sc = FDData.computeScore(data);
    if ($("score-num")) $("score-num").textContent = sc.score;
    __scoreTarget = sc.score;
    if ($("score-stars")) $("score-stars").innerHTML = scoreStars(sc.score);
    if ($("score-lab")) $("score-lab").textContent = scoreLabel(sc.score);
    if ($("score-reasons")) $("score-reasons").innerHTML = "";
    bindScoreTap();
    animateScoreRod(sc.score);
    if ($("activity-pct")) $("activity-pct").textContent = sc.activity + "%";
    var bar = $("activity-bar-fill");
    if (bar) {
      var w = Math.max(8, Math.min(100, Number(sc.activity) || 0));
      /* SVG user units: viewBox width 200 */
      bar.setAttribute("width", String((w / 100) * 200));
    }
    setActivityBrows(sc.activity);
    if ($("zone-place")) {
      var zName = (data.location && data.location.name) ? data.location.name : "Κάλυμνος";
      var windK = (data.current && data.current.windKmh) || 0;
      var bfZ = windK < 2 ? 0 : windK < 6 ? 1 : windK < 12 ? 2 : windK < 20 ? 3 : windK < 29 ? 4 : windK < 39 ? 5 : 6;
      var dirZ = (data.current && data.current.windDir != null) ? Number(data.current.windDir) : null;
      var cknZ = data.sea && data.sea.currentKn;
      var cdegZ = data.sea && data.sea.currentDeg;
      var scZ = sc || {};
      var dirs = ["Β", "ΒΑ", "Α", "ΝΑ", "Ν", "ΝΔ", "Δ", "ΒΔ"];
      function compass(d) {
        if (d == null || isNaN(d)) return null;
        return dirs[Math.floor((((Number(d) % 360) + 360 + 22.5) % 360) / 45)];
      }
      // Lee shore = opposite of wind FROM
      var leeLab = dirZ != null ? compass(dirZ + 180) : null;
      var windFrom = dirZ != null ? compass(dirZ) : null;
      var flowTo = cdegZ != null ? compass(Number(cdegZ)) : null; /* current deg = flow TOWARD */
      var fromDirZ = cdegZ != null ? compass((Number(cdegZ) + 180) % 360) : null;

      var where = "";
      if (bfZ >= 4 && leeLab) {
        where = "Πήγαινε " + leeLab + " (υπήνεμο) · απόφυγε φάτσα " + (windFrom || "");
      } else if (cknZ != null && cknZ < 0.1) {
        where = "Πρόταση: ακτές με ροή · ΒΔ ή ΝΑ κολπίσκοι";
      } else if (cknZ != null && cknZ > 0.9 && flowTo) {
        where = "Δυνατό ρεύμα · στάσου πίσω από ακρωτήρι προς " + flowTo;
      } else if (leeLab && bfZ >= 2) {
        where = "Καλύτερη πλευρά: " + leeLab + " · υπήνεμες ακτές";
      } else if ((scZ.score || 0) >= 70) {
        where = "Πρόταση: Δυτικά (Μυρτιές–Αργινώντα) ή Νότια · καλές συνθήκες";
      } else {
        where = "Πρόταση: προστατευμένοι κολπίσκοι ΝΔ ή ΒΔ · δες ρεύμα";
      }

      var parts = [where];
      if (windFrom) parts.push("άνεμος από " + windFrom + " " + bfZ + "bf");
      if (cknZ != null) parts.push("ρεύμα " + Number(cknZ).toFixed(2) + " kn");
      if (scZ.factors && scZ.factors.tide) {
        var tshort = String(scZ.factors.tide).split("·")[0].trim();
        if (tshort) parts.push(tshort);
      }
      if ((scZ.score || 0) >= 70) parts.push("βάθος 2–6μ δομές");
      else parts.push("βάθος 2–4μ");

      $("zone-place").textContent = "📍 " + zName + " · " + parts.slice(0, 4).join(" · ");

    // v148: pin on recommended fishing side (not "my location")
    (function placeZonePin() {
      var wrap = document.querySelector(".zone-map-wrap") || document.querySelector(".zone-body");
      if (!wrap) return;
      var pin = document.getElementById("zone-pin");
      if (!pin) {
        // ensure wrap
        var mapImg = document.querySelector(".zone-map, .zone-map-fill");
        if (mapImg && !mapImg.parentElement.classList.contains("zone-map-wrap")) {
          var w = document.createElement("div");
          w.className = "zone-map-wrap";
          mapImg.parentNode.insertBefore(w, mapImg);
          w.appendChild(mapImg);
          wrap = w;
        } else if (mapImg) {
          wrap = mapImg.parentElement;
        }
        pin = document.createElement("div");
        pin.id = "zone-pin";
        pin.className = "zone-pin";
        pin.setAttribute("aria-hidden", "true");
        if (wrap) wrap.appendChild(pin);
      }
      // positions on horizontal map (percent): main island center + sides
      // map is Kalymnos-ish: west left, east right, north top, south bottom
      var pos = { N: [52, 18], NE: [68, 22], E: [72, 48], SE: [65, 72], S: [48, 78], SW: [32, 70], W: [28, 48], NW: [35, 22], NA: [68, 55], Β: [52, 18], ΒΑ: [68, 22], Α: [72, 48], ΝΑ: [65, 72], Ν: [48, 78], ΝΔ: [32, 70], Δ: [28, 48], ΒΔ: [35, 22] };
      var side = "ΝΑ";
      var txt = ($("zone-place") && $("zone-place").textContent) || "";
      var m = txt.match(/(?:πλευρά|Πήγαινε|Πρόταση)[:\s]*([ΒΝΑΔ]{1,2}|N[EW]?|S[EW]?|W|E)/i);
      if (m) side = m[1];
      else if (/ΝΑ|SE/i.test(txt)) side = "ΝΑ";
      else if (/ΝΔ|SW/i.test(txt)) side = "ΝΔ";
      else if (/ΒΔ|NW/i.test(txt)) side = "ΒΔ";
      else if (/ΒΑ|NE/i.test(txt)) side = "ΒΑ";
      else if (/νότ|South|\bΝ\b/i.test(txt)) side = "Ν";
      else if (/βόρ|North|\bΒ\b/i.test(txt)) side = "Β";
      else if (/δυτ|\bΔ\b|West/i.test(txt)) side = "Δ";
      else if (/ανατ|\bΑ\b|East/i.test(txt)) side = "Α";
      var xy = pos[side] || pos["ΝΑ"];
      if (pin) {
        pin.style.left = xy[0] + "%";
        pin.style.top = xy[1] + "%";
      }
    })();

    }
    var sr = $("score-reasons");
    if (sr) {
      sr.innerHTML = (sc.reasons || []).slice(0, 3).map(function (r) {
        return "<div>· " + r + "</div>";
      }).join("");
    }

    // Best hours — live reasons, gold hour, per technique (no «Γιατί» label)
    var bl = $("best-line");
    var bw = $("best-why");
    if (bl && FDData.computeBestHours) {
      var bh = FDData.computeBestHours(data);
      var chips =
        '<button type="button" class="best-chip" data-why="morning">ΠΡΩΙ ' + bh.morning + "</button>" +
        '<span class="sep"> · </span>' +
        '<button type="button" class="best-chip" data-why="evening">ΑΠΟΓΕΥΜΑ ' + bh.evening + "</button>" +
        '<span class="sep"> · </span>' +
        '<button type="button" class="best-chip gold-hour" data-why="gold"><span class="gh-txt">GOLD HOUR</span> <span class="gh-time">' + (bh.gold || "") + "</span></button>" +
        '<span class="sep"> · </span>' +
        '<button type="button" class="best-chip" data-why="night">ΝΥΧΤΑ ' + bh.night + "</button>";
      if (bh.techniques && bh.techniques.length) {
        chips += '<div class="best-tech-row">';
        bh.techniques.forEach(function (t) {
          chips +=
            '<button type="button" class="best-chip best-tech" data-why="tech-' + t.id + '">' +
            t.name + " " + t.window +
            "</button>";
        });
        chips += "</div>";
      }
      bl.innerHTML = chips;
      bl.querySelectorAll(".best-chip").forEach(function (btn) {
        btn.addEventListener("click", function (ev) {
          ev.stopPropagation();
          var key = btn.getAttribute("data-why");
          var map = {
            morning: bh.whyMorning,
            evening: bh.whyEvening,
            night: bh.whyNight,
            gold: bh.whyGold
          };
          var title = {
            morning: "Πρωί " + bh.morning,
            evening: "Απόγευμα " + bh.evening,
            night: "Νύχτα " + bh.night,
            gold: "Gold hour " + (bh.gold || "")
          };
          var reasons = map[key];
          var ttl = title[key];
          if (key && key.indexOf("tech-") === 0 && bh.techniques) {
            var tid = key.slice(5);
            var tech = null;
            bh.techniques.forEach(function (t) { if (t.id === tid) tech = t; });
            if (tech) {
              reasons = tech.reasons || [];
              ttl = tech.name + " · " + tech.window;
            }
          }
          if (!bw) return;
          if (bw.dataset.open === key) {
            bw.hidden = true;
            bw.dataset.open = "";
            bw.className = "best-why";
            return;
          }
          bw.dataset.open = key;
          bw.hidden = false;
          bw.className = "best-why best-why--" + (key.indexOf("tech-") === 0 ? "tech" : key);
          bw.innerHTML =
            "<b>" + ttl + "</b><ul>" +
            (reasons || []).map(function (x) { return "<li>" + x + "</li>"; }).join("") +
            "</ul>";
        });
      });
    }

    // Techniques live stars
    if (FDData.computeTechniques) {
      var techs = FDData.computeTechniques(data, sc);
      window.__fdTechs = techs;
      var byId = {};
      techs.forEach(function (t) { byId[t.id] = t; });
      document.querySelectorAll(".tech").forEach(function (btn) {
        var id = btn.getAttribute("data-tech");
        // map shore_jig / shore
        if (id === "shore_jig") id = "shore";
        var t = byId[id];
        if (!t) return;
        btn.setAttribute("data-stars", String(t.stars));
        var st = btn.querySelector(".ts") || btn.querySelector(".tech-stars");
        var lab = btn.querySelector(".tl") || btn.querySelector(".tech-lab");
        if (st) st.textContent = starsText(t.stars);
        if (lab) lab.textContent = t.label;
      });
    }

    // Alerts rules
    if (FDData.computeAlerts) {
      var alerts = FDData.computeAlerts(data, sc);
      var root = $("alert-list");
      if (root) {
        root.innerHTML = alerts.map(function (a) {
          var ico = alertIcon(a);
          return '<li class="alert-item" tabindex="0"><img class="alert-ico" src="' + ico +
            '" alt=""/><div class="alert-text"><strong>' + (a.title || "") +
            '</strong><span>' + (a.text || a.detail || "") + '</span></div><span class="alert-chev">›</span></li>';
        }).join("");
        root.querySelectorAll("li").forEach(function (li, idx) {
          function activate(ev) {
            if (ev) { ev.preventDefault(); ev.stopPropagation(); }
            li.classList.add("pressed");
            setTimeout(function () { li.classList.remove("pressed"); }, 180);
            var a = alerts[idx] || {};
            var title = a.title || "ALERT";
            var body = a.text || a.detail || "";
            var tip = "";
            if (a.type === "wind") tip = "Συμβουλή: ψάξε υπήνεμη πλευρά · πρόσεξε φάτσα.";
            else if (a.type === "fish") tip = "Συμβουλή: ρεύμα + δομές · φυσική παρουσίαση δολώματος.";
            else if (a.type === "hours") tip = "Συμβουλή: προετοιμάσου 15′ νωρίτερα στο σημείο.";
            else if (a.type === "warn") tip = "Συμβουλή: ασφάλεια πρώτα · άλλαξε σημείο αν χρειάζεται.";
            else tip = "Συμβουλή: δες score, παλίρροια και GOLD HOUR hour.";
            showAppSheet(title, body + "\n\n" + tip);
          }
          li.addEventListener("click", activate);
          li.style.cursor = "pointer";
        });
      }
    }
  }

  function applyLive(data) {
    weatherHours = data.weatherHours || [];
    windHours = data.windHours || [];
    currentHours = data.currentHours || [];
    pressurePts = data.pressurePts || [];
    pressureTimes = data.pressureTimes || [];
    tidePts = data.tidePts || tidePts;
    if (data.tideTimes) window._tideTimes = data.tideTimes;
    applyHero(data);
    var exs = data.tideExtrema || [];
    var low = null, high = null;
    exs.forEach(function (e) {
      if (e.type === "Low" && !low) low = e;
      if (e.type === "High" && !high) high = e;
    });
    if ($("tide-low")) $("tide-low").textContent = low ? low.t : "—";
    if ($("tide-high")) $("tide-high").textContent = high ? high.t : "—";

    renderWeather();
    renderWind();
    renderCurrents();
    drawPressure();
    window._tideTimes = data.tideTimes || [];
    window._tideTimes = data.tideTimes || window._tideTimes || [];
    drawTide(data.tidePts || tidePts, data.tideTimes);
  }

  function loadLive() {
    if (!window.FDData) {
      setStatus("Λείπει data layer", true);
      return Promise.resolve();
    }
    setStatus("Φόρτωση Open-Meteo…");
    return FDData.getLocation().then(function (loc) {
      return FDData.fetchDashboard(loc);
    }).then(function (data) {
      applyLive(data);
      var t = new Date(data.fetchedAt);
      var hh = String(t.getHours()).padStart(2, "0");
      var mm = String(t.getMinutes()).padStart(2, "0");
      setStatus("Live · " + (data.location && data.location.name) + " · " + hh + ":" + mm + " · Meteo+Marine");
    }).catch(function (err) {
      var cached = FDData.loadCache();
      if (cached && cached.data) {
        applyLive(cached.data);
        setStatus("Offline — τελευταία αποθηκευμένα δεδομένα", true);
      } else {
        setStatus("Αποτυχία σύνδεσης · " + (err && err.message ? err.message : "error"), true);
      }
    });
  }

  function syncTechLabels() {
    document.querySelectorAll(".tech").forEach(function (btn) {
      var n = parseInt(btn.getAttribute("data-stars") || "3", 10);
      var lab = btn.querySelector(".tech-lab");
      if (lab) lab.textContent = STAR_LABEL[n] || "";
      var st = btn.querySelector(".tech-stars");
      if (st) st.textContent = starsText(n);
    });
  }


  function showView(name) {
    var dash = $("view-dashboard");
    var views = ["map", "spots", "calendar", "settings"];
    if (dash) dash.hidden = name !== "dashboard";
    views.forEach(function (v) {
      var el = $("view-" + v);
      if (el) el.hidden = name !== v;
    });
    document.querySelectorAll(".nav-item").forEach(function (b) {
      b.classList.toggle("active", b.getAttribute("data-nav") === name);
    });
    if (name === "calendar") renderCalendar();
    try { localStorage.setItem("fd-view", name); } catch (e) {}
  }

  function renderCalendar() {
    var root = $("cal-grid");
    if (!root || root.dataset.ready) return;
    var now = new Date();
    var y = now.getFullYear(), m = now.getMonth();
    var first = new Date(y, m, 1).getDay();
    var days = new Date(y, m + 1, 0).getDate();
    var html = "<div class=\"cal-head\">" + (m + 1) + "/" + y + "</div><div class=\"cal-days\">";
    var labels = ["Κ","Δ","Τ","Τ","Π","Π","Σ"];
    labels.forEach(function (l) { html += "<span class=\"cdim\">" + l + "</span>"; });
    for (var i = 0; i < first; i++) html += "<span></span>";
    for (var d = 1; d <= days; d++) {
      var cls = d === now.getDate() ? " class=\"today\"" : "";
      html += "<span" + cls + ">" + d + "</span>";
    }
    html += "</div>";
    root.innerHTML = html;
    root.dataset.ready = "1";
  }

  function bindTabs() {
    document.querySelectorAll(".nav-item").forEach(function (btn) {
      btn.addEventListener("click", function () {
        showView(btn.getAttribute("data-nav") || "dashboard");
      });
    });
    document.querySelectorAll(".menu-item").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var nav = btn.getAttribute("data-go");
        if (nav) showView(nav);
      });
    });
    try {
      var v = localStorage.getItem("fd-view");
      if (v) showView(v);
    } catch (e) {}
  }

  function bindInstall() {
    var deferred = null;
    var btn = $("btn-install");
    window.addEventListener("beforeinstallprompt", function (e) {
      e.preventDefault();
      deferred = e;
      if (btn) btn.hidden = false;
    });
    if (btn) {
      btn.addEventListener("click", function () {
        if (!deferred) return;
        deferred.prompt();
        deferred.userChoice.then(function () { deferred = null; btn.hidden = true; });
      });
    }
  }

  function bindUI() {
    var refresh = $("btn-refresh");
    if (refresh) {
      refresh.addEventListener("click", function () {
        refresh.classList.add("spin");
        loadLive().finally(function () {
          setTimeout(function () { refresh.classList.remove("spin"); }, 400);
        });
      });
    }
    var fav = $("btn-fav");
    if (fav) {
      fav.addEventListener("click", function () {
        fav.classList.toggle("on");
        fav.textContent = fav.classList.contains("on") ? "★" : "☆";
      });
    }
    var menu = $("btn-menu");
    var menuPanel = $("menu-panel");
    var menuClose = $("menu-close");
    function closeMenu() {
      if (menuPanel) menuPanel.classList.remove("open");
    }
    if (menu && menuPanel) {
      menu.addEventListener("click", function () { menuPanel.classList.toggle("open"); });
    }
    if (menuClose) menuClose.addEventListener("click", closeMenu);
    if (menuPanel) {
      menuPanel.addEventListener("click", function (e) {
        if (e.target === menuPanel) closeMenu();
      });
    }

    document.querySelectorAll(".alert-list li").forEach(function (li) {
      function activate() {
        li.classList.add("pressed");
        setTimeout(function () { li.classList.remove("pressed"); }, 150);
        try { console.log("alert", li.innerText); } catch (e) {}
      }
      li.addEventListener("click", activate);
      li.addEventListener("keydown", function (e) {
        if (e.key === "Enter" || e.key === " ") { e.preventDefault(); activate(); }
      });
    });

    document.querySelectorAll(".tech").forEach(function (btn) {
      btn.addEventListener("click", function () {
        document.querySelectorAll(".tech").forEach(function (b) { b.classList.remove("selected"); });
        btn.classList.add("selected");
        try { localStorage.setItem("fd-tech", btn.dataset.tech); } catch (e) {}
      });
    });
    try {
      var saved = localStorage.getItem("fd-tech");
      if (saved) {
        document.querySelectorAll(".tech").forEach(function (b) {
          b.classList.toggle("selected", b.dataset.tech === saved);
        });
      }
    } catch (e) {}

    document.querySelectorAll(".nav-item").forEach(function (btn) {
      btn.addEventListener("click", function () {
        document.querySelectorAll(".nav-item").forEach(function (b) { b.classList.remove("active"); });
        btn.classList.add("active");
      });
    });
    document.querySelectorAll(".menu-item").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var nav = btn.getAttribute("data-go");
        document.querySelectorAll(".nav-item").forEach(function (b) {
          b.classList.toggle("active", b.dataset.nav === nav);
        });
        closeMenu();
      });
    });
    document.querySelectorAll(".h-scroll").forEach(function (strip) {
      var startX = 0, scrollL = 0, dragging = false;
      strip.addEventListener("pointerdown", function (e) {
        dragging = true; startX = e.clientX; scrollL = strip.scrollLeft; strip.setPointerCapture(e.pointerId);
      });
      strip.addEventListener("pointermove", function (e) {
        if (!dragging) return;
        strip.scrollLeft = scrollL - (e.clientX - startX);
      });
      strip.addEventListener("pointerup", function () { dragging = false; });
      strip.addEventListener("pointercancel", function () { dragging = false; });
    });
  }

  function init() {
    syncTechLabels();
    bindUI();
    bindTabs();
    bindInstall();
    renderWeather();
    renderWind();
    renderCurrents();
    /* try cache first for instant paint */
    if (window.FDData) {
      var cached = FDData.loadCache();
      if (cached && cached.data) applyLive(cached.data);
    }
    loadLive();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", function(){ init(); 

  document.querySelectorAll(".tech").forEach(function (btn) {
    if (btn.dataset.techInfoBound) return;
    btn.dataset.techInfoBound = "1";
    btn.addEventListener("click", function (e) {
      e.stopPropagation();
      document.querySelectorAll(".tech").forEach(function (b) { b.classList.remove("selected"); });
      btn.classList.add("selected");
      var id = btn.getAttribute("data-tech") || "";
      techInfo(id);
    });
  });

  });
  if (document.readyState !== "loading") { init(); 
  document.querySelectorAll(".tech").forEach(function (btn) {
    if (btn.dataset.techInfoBound) return;
    btn.dataset.techInfoBound = "1";
    btn.addEventListener("click", function (e) {
      e.stopPropagation();
      document.querySelectorAll(".tech").forEach(function (b) { b.classList.remove("selected"); });
      btn.classList.add("selected");
      var id = btn.getAttribute("data-tech") || "";
      techInfo(id);
    });
  });
 }

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("./service-worker.js?v=34").catch(function () {});
  }
  // v43: open card in large modal (2-3x feel)
  
  
  function techInfo(id) {
    var live = null;
    try {
      var list = window.__fdTechs || [];
      list.forEach(function (t) {
        var tid = t.id;
        if (id === "shore_jig") id = "shore";
        if (tid === id) live = t;
      });
    } catch (e) {}
    var map = {
      spinning: {
        title: "SPINNING",
        body: "• Ψάρεμα κόντρα σε ρεύμα & καιρό\n• Υψηλή παλίρροια + χαμηλές–μέτριες ταχύτητες ρεύματος\n• Μέθοδος τόπου: έξω→μέσα · επιφάνεια→βυθός\n• Εναλλαγές χρωμάτων / πλεύσεων\n• Kotsiruy: πάνω κρικάκι = pencil πιο βαθιά · κάτω = επιφανείας"
      },
      lrf: {
        title: "LRF",
        body: "• Παράμαλλο max Ø 0,25 mm — να μην χαλάει η κίνηση του τεχνητού\n• Άνεμος από πίσω σου\n• Κόντρα στο ρεύμα · επιφάνεια μετά βυθός\n• Σαργός: τεχνητό που βυθίζεται / πλανάκι\n• Συχνές εναλλαγές χρωμάτων"
      },
      english: {
        title: "ΕΓΓΛΕΖΙΚΟ",
        body: "• Παράμαλλο ~1 m σε ήπιες συνθήκες (φυσική κίνηση)\n• Μετά το κόμπο στόπερ → χάντρα\n• Ροή φάτσα σε παραλία / δομή · δόλωμα κόντρα\n• Συναγρίδα / μελανούρι / λούτσος → χαμηλά ρεύματα\n• Μελανούρι: κέντρο κολπίσκου · ποτέ πίσω (ορμόνες φόβου)"
      },
      shore: {
        title: "SHORE JIGGING",
        body: "• Παράμαλλο ~3 m\n• Υψηλή παλίρροια · χαμηλές ταχύτητες ρευμάτων\n• Πάντα κόντρα στα ρεύματα\n• Τόπος με ρεύμα φάτσα στην παραλία\n• Αντίθετα άνεμος & ρεύμα → σημείο ουδετεροποίησης"
      },
      shore_jig: {
        title: "SHORE JIGGING",
        body: "• Παράμαλλο ~3 m\n• Υψηλή παλίρροια · χαμηλές ταχύτητες ρευμάτων\n• Πάντα κόντρα στα ρεύματα\n• Τόπος με ρεύμα φάτσα στην παραλία"
      }
    };
    if (id === "shore_jig") id = "shore";
    var t = map[id] || { title: id, body: "Πληροφορίες τεχνικής." };
    if (live && live.tips && live.tips.length) {
      t.body = live.tips.map(function (x) { return "• " + x; }).join("\n") + "\n\n" + t.body;
      if (live.window) t.body = "Παράθυρο: " + live.window + "\n" + (live.label ? ("Αξιολόγηση: " + live.label + " (" + live.stars + "★)\n\n") : "\n") + t.body;
    }
    showAppSheet(t.title, t.body);
  }

  
  function openCalendarSheet() {
    var data = window.__fdLastData;
    if (!data || !window.FDData || !FDData.computeTomorrowCompare) {
      if (typeof showAppSheet === "function") showAppSheet("ΗΜΕΡΟΛΟΓΙΟ", "Φόρτωση δεδομένων… δοκίμασε σε λίγο.");
      return;
    }
    var cmp = FDData.computeTomorrowCompare(data);
    var t = cmp.today || {};
    var m = cmp.tomorrow || {};
    var body = "ΣΗΜΕΡΑ\nScore " + (t.score != null ? t.score : "—") + " · Activity " + (t.activity != null ? t.activity : "—") +
      "%\n\nΑΥΡΙΟ (εκτίμηση)\nScore " + (m.score != null ? m.score : "—") + " · Activity " + (m.activity != null ? m.activity : "—") +
      "%\n\n→ " + (m.label || "παρόμοια") +
      "\n\nΟι καλύτερες ώρες μετατοπίζονται ~40–50′ με την παλίρροια.";
    showAppSheet("ΗΜΕΡΟΛΟΓΙΟ · Σήμερα vs Αύριο", body);
  }

  function showAppSheet(title, text) {
    var existing = document.getElementById("app-sheet");
    if (existing) existing.remove();
    var el = document.createElement("div");
    el.id = "app-sheet";
    el.innerHTML = '<div class="app-sheet-bg"></div><div class="app-sheet-panel"><div class="app-sheet-h">' +
      (title || "") + '</div><div class="app-sheet-b">' + String(text || "").replace(/\\n/g, "<br/>") +
      '</div><button type="button" class="app-sheet-x">Κλείσιμο</button></div>';
    document.body.appendChild(el);
    function close() { el.remove(); }
    el.querySelector(".app-sheet-bg").addEventListener("click", close);
    el.querySelector(".app-sheet-x").addEventListener("click", close);
  }

  function openWidgetModal(card) {
    var modal = $("widget-modal");
    var body = $("widget-modal-body");
    if (!modal || !body || !card) return;
    body.innerHTML = "";
    var clone = card.cloneNode(true);
    clone.classList.remove("is-expanded");
    clone.style.width = "100%";
    body.appendChild(clone);
    modal.hidden = false;
    document.body.style.overflow = "hidden";
    try { drawPressure(); drawTide(); } catch (e) {}
    try {
      if (clone.querySelector && clone.querySelector(".score-rod-live, #score-rod-arm")) {
        /* ensure rod starts at 0 in clone, then charge after paint */
        setRodAngle(0, true, body);
        setTimeout(function () {
          bindScoreTap(body);
          animateScoreRod(__scoreTarget, body);
        }, 120);
      }
    } catch (e) {}
  }
  function closeWidgetModal() {
    var modal = $("widget-modal");
    if (modal) modal.hidden = true;
    document.body.style.overflow = "";
  }
  /* single click: close modal only · double click card: expand */
  document.addEventListener("click", function (e) {
    if (e.target.closest("#widget-modal-close, #widget-modal-backdrop")) {
      closeWidgetModal();
    }
  });
  
  document.querySelectorAll(".nav-item, .menu-item, button").forEach(function (btn) {
    var t = ((btn.textContent || "") + " " + (btn.getAttribute("aria-label") || "")).toLowerCase();
    if (/ημερολ|calendar|calend/.test(t) || btn.dataset.nav === "calendar") {
      if (btn.dataset.calBound) return;
      btn.dataset.calBound = "1";
      btn.addEventListener("click", function (e) {
        e.preventDefault();
        e.stopPropagation();
        openCalendarSheet();
      });
    }
  });

  document.addEventListener("dblclick", function (e) {
    if (e.target.closest("#widget-modal")) return;
    if (e.target.closest("button, a, input, .alert-item, .tech, .best-chip")) return;
    var card = e.target.closest && e.target.closest(".main .card");
    if (!card) return;
    openWidgetModal(card);
  });
})();

/* ===== v174 MOON — v55 method: CSS shade + img spin ===== */
(function () {
  function setMoonShade(illumination, phaseKey) {
    var pct = Math.max(0, Math.min(100, Number(illumination) || 0));
    if (typeof setMoonVisual === "function") {
      try { setMoonVisual(pct, "", phaseKey || ""); } catch (e) {}
    }
  }
  window.setMoonShade = setMoonShade;

  function syncFromDom() {
    var pctEl = document.getElementById("moon-pct");
    var phaseEl = document.getElementById("moon-phase");
    if (!pctEl) return;
    var n = parseFloat(String(pctEl.textContent).replace(/[^0-9.]/g, ""));
    if (!isNaN(n)) setMoonShade(n, phaseEl ? phaseEl.textContent : "");
  }
  function boot() {
    syncFromDom();
    try {
      var pctEl = document.getElementById("moon-pct");
      var phaseEl = document.getElementById("moon-phase");
      if (pctEl) new MutationObserver(syncFromDom).observe(pctEl, { childList: true, characterData: true, subtree: true });
      if (phaseEl) new MutationObserver(syncFromDom).observe(phaseEl, { childList: true, characterData: true, subtree: true });
    } catch (e) {}
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();



/* v160 layout / size settings */
(function(){
  function applyLayout(mode){
    document.body.classList.remove('layout-compact','layout-comfortable');
    if(mode === 'compact') document.body.classList.add('layout-compact');
    if(mode === 'comfortable') document.body.classList.add('layout-comfortable');
    localStorage.setItem('fd_layout', mode || 'normal');
    document.querySelectorAll('#set-layout-density .set-chip').forEach(btn=>{
      btn.classList.toggle('is-on', btn.dataset.layout === mode);
    });
  }
  function applyWSize(sz){
    document.body.classList.remove('wsize-s','wsize-m','wsize-l');
    document.body.classList.add('wsize-' + (sz || 'm'));
    localStorage.setItem('fd_wsize', sz || 'm');
    document.querySelectorAll('#set-widget-size .set-chip').forEach(btn=>{
      btn.classList.toggle('is-on', btn.dataset.wsize === sz);
    });
  }
  document.addEventListener('DOMContentLoaded', function(){
    applyLayout(localStorage.getItem('fd_layout') || 'normal');
    applyWSize(localStorage.getItem('fd_wsize') || 'm');
    var dens = document.getElementById('set-layout-density');
    if(dens) dens.addEventListener('click', function(e){
      var t = e.target.closest('.set-chip');
      if(!t) return;
      applyLayout(t.dataset.layout);
    });
    var ws = document.getElementById('set-widget-size');
    if(ws) ws.addEventListener('click', function(e){
      var t = e.target.closest('.set-chip');
      if(!t) return;
      applyWSize(t.dataset.wsize);
    });
  });
})();

/* v176 force moon visible after data load */
(function(){
  function run(){
    var el=document.getElementById("moon-pct");
    var n=78;
    if(el){var p=parseFloat(String(el.textContent).replace(/[^0-9.]/g,"")); if(!isNaN(p)) n=p;}
    var ph=document.getElementById("moon-phase");
    var key=ph?ph.textContent:"Αύξουσα";
    if(typeof setMoonVisual==="function") setMoonVisual(n,key,key);
  }
  if(document.readyState==="loading") document.addEventListener("DOMContentLoaded",run);
  else run();
  setTimeout(run,300);
  setTimeout(run,1000);
  setTimeout(run,2500);
})();
