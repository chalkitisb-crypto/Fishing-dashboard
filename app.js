
/* v97 bridge → moon.js */
function __notifyMoon(pct, phaseTxt) {
  if (typeof window.__moonSetPhase === "function") {
    window.__moonSetPhase(pct, phaseTxt);
  }
  try {
    window.dispatchEvent(new CustomEvent("moon-data", { detail: { pct: pct, phase: phaseTxt } }));
  } catch (e) {}
}

/* Fishing Dashboard v126.0.0 — Stage 1 complete APIs + score SVG */
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
      return '<article class="wh-cell wind-cell"><div class="wind-arrow ' + h.cls +
        '" style="transform:rotate(' + h.deg + 'deg)">➤</div>' +
        '<time>' + h.t + '</time><span class="lab">' + h.dir +
        '</span><strong>' + h.bf + '</strong></article>';
    }).join("");
  }

  function renderCurrents() {
    var root = $("current-hours");
    if (!root) return;
    root.innerHTML = currentHours.map(function (h) {
      return '<article class="wh-cell"><div class="wind-arrow ' + h.cls +
        '" style="transform:rotate(' + h.deg + 'deg)">➤</div>' +
        '<time>' + h.t + '</time><span class="lab">' + h.dir +
        '</span><strong>' + h.kn + ' kn</strong></article>';
    }).join("");
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
    var w = 320, h = 150;
    var padL = 36, padR = 12, padT = 18, padB = 28;
    var min = Math.min.apply(null, pts) - 1;
    var max = Math.max.apply(null, pts) + 1;
    if (max <= min) max = min + 2;
    function X(i) { return padL + (i * (w - padL - padR)) / Math.max(1, pts.length - 1); }
    function Y(v) { return padT + (1 - (v - min) / (max - min)) * (h - padT - padB); }
    var pairs = pts.map(function (v, i) { return X(i).toFixed(1) + "," + Y(v).toFixed(1); });
    line.setAttribute("points", pairs.join(" "));
    if (area) {
      area.setAttribute("d",
        "M" + X(0).toFixed(1) + "," + (h - padB) + " " +
        pairs.map(function (p) { return "L" + p; }).join(" ") +
        " L" + X(pts.length - 1).toFixed(1) + "," + (h - padB) + " Z");
    }
    if (dots) {
      dots.innerHTML = pts.map(function (v, i) {
        return '<circle cx="' + X(i).toFixed(1) + '" cy="' + Y(v).toFixed(1) +
          '" r="4" fill="#f5c542" stroke="#1a1000" stroke-width="1"/>' +
          '<text x="' + X(i).toFixed(1) + '" y="' + (Y(v) - 8).toFixed(1) +
          '" text-anchor="middle" fill="#f5c542" font-size="9" font-weight="700">' +
          Math.round(v) + "</text>";
      }).join("");
    }
    if (grid) {
      var ticks = [];
      var step = Math.max(1, Math.round((max - min) / 4));
      for (var v = Math.ceil(min); v <= max; v += step) {
        var y = Y(v);
        ticks.push('<line x1="' + padL + '" y1="' + y + '" x2="' + (w - padR) +
          '" y2="' + y + '" stroke="rgba(53,200,255,.12)" stroke-dasharray="3 4"/>');
        ticks.push('<text x="' + (padL - 4) + '" y="' + (y + 3) +
          '" text-anchor="end" fill="rgba(53,200,255,.55)" font-size="8">' + v + "</text>");
      }
      // time labels
      for (var i = 0; i < pts.length; i++) {
        var t = times[i] || "";
        if (t) ticks.push('<text x="' + X(i).toFixed(1) + '" y="' + (h - 8) +
          '" text-anchor="middle" fill="rgba(53,200,255,.5)" font-size="8">' + t + "</text>");
      }
      grid.innerHTML = ticks.join("");
    }
  }


    function drawTide(pts, times) {
    pts = pts || tidePts;
    times = times || (typeof pressureTimes !== "undefined" ? null : null);
    var line = $("tide-line");
    var area = $("tide-area");
    var dots = $("tide-dots");
    var axis = $("tide-axis");
    if (!line) return;
    if (!pts || pts.length < 2) pts = [0.2, 0.5, 1.0, 0.6, 0.25, 0.45, 0.9];
    var w = 320, h = 130;
    var padL = 8, padR = 8, padT = 14, padB = 22;
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
    line.setAttribute("stroke-width", "3");
    line.setAttribute("fill", "none");
    if (area) {
      area.setAttribute("d",
        "M" + X(0).toFixed(1) + "," + (h - padB) + " " +
        pairs.map(function (p) { return "L" + p; }).join(" ") +
        " L" + X(pts.length - 1).toFixed(1) + "," + (h - padB) + " Z");
    }
    if (dots) {
      var html = "";
      for (var i = 0; i < pts.length; i++) {
        var isExt = false;
        if (i === 0 || i === pts.length - 1) isExt = true;
        else if ((pts[i] >= pts[i-1] && pts[i] >= pts[i+1]) || (pts[i] <= pts[i-1] && pts[i] <= pts[i+1])) isExt = true;
        if (!isExt) continue;
        html += '<circle cx="' + X(i).toFixed(1) + '" cy="' + Y(pts[i]).toFixed(1) +
          '" r="4.2" fill="#fff" stroke="#35c8ff" stroke-width="2"/>';
      }
      dots.innerHTML = html;
    }
    // time axis labels from code
    if (axis) {
      var labels = "";
      var n = pts.length;
      var idxs = n <= 4 ? [0, n-1] : [0, Math.floor(n/3), Math.floor(2*n/3), n-1];
      var tArr = window._tideTimes || [];
      idxs.forEach(function (i) {
        var lab = tArr[i] ? tArr[i] : "";
        if (!lab) return;
        labels += '<text x="' + X(i).toFixed(1) + '" y="' + (h - 4) +
          '" text-anchor="middle" fill="#7ad7ff" font-size="9">' + lab + '</text>';
      });
      axis.innerHTML = labels;
    }
  }



  function applyHero(data) {
    if (!data) return;
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
    if ($("m-rain")) $("m-rain").textContent = (c.rain != null ? c.rain + " mm" : "—");
    if ($("m-uv") && window.FDData) $("m-uv").textContent = window.FDData.uvLabel(c.uv || data.uvMax || 0);
    if ($("m-rise")) $("m-rise").textContent = sun.rise || "—";
    if ($("m-set")) $("m-set").textContent = sun.set || "—";

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
    // 0 → -90° (red left), 50 → 0° (up), 100 → +90° (cyan right)
    return -90 + (score / 100) * 180;
  }

          function setRodAngle(score, instant, root) {
    var scope = root || document;
    var arm = scope.querySelector(".score-rod-live") || scope.querySelector("#score-rod-arm");
    if (!arm) return;
    var s = Math.max(0, Math.min(100, Number(score) || 0));
    var deg = scoreToAngle(s);
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
    var img = $("moon-img") || document.querySelector(".moon-img");
    if (img) {
      img.src = "moon_full.png?v=101.0.0";
      img.style.display = "block";
      img.style.opacity = "1";
    }
    if (typeof setMoonShade === "function") setMoonShade(pct, phaseKey || phaseHtml || "");
  }




  /* scoreToAngle/setRodAngle defined above */
  function scoreStars(score) {
    var n = score >= 90 ? 5 : score >= 75 ? 4 : score >= 55 ? 3 : score >= 35 ? 2 : 1;
    var s = "";
    for (var i = 0; i < 5; i++) s += i < n ? "★" : "☆";
    return s;
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
    if ($("score-stars")) {
      var _st = scoreStars(sc.score);
      $("score-stars").innerHTML = _st.split("").map(function(c){ return "<span>"+c+"</span>"; }).join("");
    }
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
    if ($("zone-place") && data.location) {
      $("zone-place").textContent = "📍 " + (data.location.name || "Κάλυμνος") + " · Νότια άκρη · 2–4μ";
    }
    var sr = $("score-reasons");
    if (sr) {
      sr.innerHTML = (sc.reasons || []).slice(0, 3).map(function (r) {
        return "<div>· " + r + "</div>";
      }).join("");
    }

    // Best hours + why
    var bl = $("best-line");
    var bw = $("best-why");
    if (bl && FDData.computeBestHours) {
      var bh = FDData.computeBestHours(data);
      bl.innerHTML =
        '<button type="button" class="best-chip" data-why="morning">ΠΡΩΙ ' + bh.morning + "</button>" +
        '<span class="sep"> · </span>' +
        '<button type="button" class="best-chip" data-why="evening">ΑΠΟΓΕΥΜΑ ' + bh.evening + "</button>" +
        '<span class="sep"> · </span>' +
        '<button type="button" class="best-chip" data-why="night">ΝΥΧΤΑ ' + bh.night + "</button>";
      bl.querySelectorAll(".best-chip").forEach(function (btn) {
        btn.addEventListener("click", function () {
          var key = btn.getAttribute("data-why");
          var map = { morning: bh.whyMorning, evening: bh.whyEvening, night: bh.whyNight };
          var title = { morning: "Πρωί", evening: "Απόγευμα", night: "Νύχτα" };
          if (!bw) return;
          if (bw.dataset.open === key) {
            bw.hidden = true;
            bw.dataset.open = "";
            return;
          }
          bw.dataset.open = key;
          bw.hidden = false;
          bw.innerHTML = "<b>Γιατί " + title[key] + "</b><ul>" +
            (map[key] || []).map(function (x) { return "<li>" + x + "</li>"; }).join("") +
            "</ul>";
        });
      });
    }

    // Techniques live stars
    if (FDData.computeTechniques) {
      var techs = FDData.computeTechniques(data, sc);
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
        root.querySelectorAll("li").forEach(function (li) {
          function activate() {
            li.classList.add("pressed");
            setTimeout(function () { li.classList.remove("pressed"); }, 150);
          }
          li.addEventListener("click", activate);
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
    drawTide(data.tidePts || tidePts);
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

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("./service-worker.js?v=34").catch(function () {});
  }
  // v43: open card in large modal (2-3x feel)
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
  document.addEventListener("click", function (e) {
    if (e.target.closest("#widget-modal-close, #widget-modal-backdrop")) {
      closeWidgetModal();
      return;
    }
    var card = e.target.closest && e.target.closest(".main .card");
    if (!card) return;
    if (e.target.closest("button, a, input, .alert-item")) return;
    openWidgetModal(card);
  });
})();

/* ===== v104 MOON — single owner: moon.js (WebGL) ===== */
(function () {
  function isWaxing(phaseKey) {
    var k = String(phaseKey || "").toLowerCase();
    if (/φθιν|waning|last|third|decreasing/.test(k)) return false;
    return true;
  }
  function setMoonShade(illumination, phaseKey) {
    var pct = Math.max(0, Math.min(100, Number(illumination) || 0));
    try { if (typeof __notifyMoon === "function") __notifyMoon(pct, phaseKey || ""); } catch (e) {}
    try { if (window.__moonSetPhase) window.__moonSetPhase(pct, phaseKey || ""); } catch (e) {}
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

