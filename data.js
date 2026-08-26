/* v185.0.0 pressure: calendar-day series + rolling red-dot */
/* v152.0.0 FULL — formula + hour picker + diary tips/techniques/alerts */
/* v151.2.0 no score floor — can go 30 or below */
/* v151.2.0 objective score/activity + peak best hours */
/* v150.0.0 */
/* v149.0.0 */
/* v147.0.0 */
/* Fishing Dashboard — Stage 1 data layer
   Primary: Open-Meteo | Secondary (later): Poseidon HCMR
*/
(function (global) {
  "use strict";

  var DEFAULT = { lat: 36.95, lon: 26.98, name: "Κάλυμνος" };
  var CACHE_KEY = "fd-last-data-v1";

  var WMO = {
    0: { lab: "Αίθριος", cond: "ΗΛΙΟΦΑΝΕΙΑ", ico: "ico_wx_sun.png" },
    1: { lab: "Σχεδόν αίθριος", cond: "ΗΛΙΟΦΑΝΕΙΑ", ico: "ico_wx_sun.png" },
    2: { lab: "Αραιή", cond: "ΑΡΑΙΗ ΣΥΝΝΕΦΙΑ", ico: "ico_wx_partly.png" },
    3: { lab: "Συννεφιά", cond: "ΣΥΝΝΕΦΙΑ", ico: "ico_wx_cloud.png" },
    45: { lab: "Ομίχλη", cond: "ΟΜΙΧΛΗ", ico: "ico_wx_haze.png" },
    48: { lab: "Ομίχλη", cond: "ΟΜΙΧΛΗ", ico: "ico_wx_haze.png" },
    51: { lab: "Ψιχάλα", cond: "ΨΙΧΑΛΑ", ico: "ico_wx_rain.png" },
    53: { lab: "Ψιχάλα", cond: "ΨΙΧΑΛΑ", ico: "ico_wx_rain.png" },
    55: { lab: "Ψιχάλα", cond: "ΨΙΧΑΛΑ", ico: "ico_wx_rain.png" },
    61: { lab: "Βροχή", cond: "ΒΡΟΧΗ", ico: "ico_wx_rain.png" },
    63: { lab: "Βροχή", cond: "ΒΡΟΧΗ", ico: "ico_wx_rain.png" },
    65: { lab: "Ισχυρή βροχή", cond: "ΒΡΟΧΗ", ico: "ico_wx_rain.png" },
    80: { lab: "Μπόρα", cond: "ΜΠΟΡΑ", ico: "ico_wx_rain.png" },
    81: { lab: "Μπόρα", cond: "ΜΠΟΡΑ", ico: "ico_wx_rain.png" },
    82: { lab: "Μπόρα", cond: "ΜΠΟΡΑ", ico: "ico_wx_rain.png" },
    95: { lab: "Καταιγίδα", cond: "ΚΑΤΑΙΓΙΔΑ", ico: "ico_wx_storm.png" },
    96: { lab: "Καταιγίδα", cond: "ΚΑΤΑΙΓΙΔΑ", ico: "ico_wx_storm.png" },
    99: { lab: "Καταιγίδα", cond: "ΚΑΤΑΙΓΙΔΑ", ico: "ico_wx_storm.png" }
  };

  var DOW = ["ΚΥΡΙΑΚΗ","ΔΕΥΤΕΡΑ","ΤΡΙΤΗ","ΤΕΤΑΡΤΗ","ΠΕΜΠΤΗ","ΠΑΡΑΣΚΕΥΗ","ΣΑΒΒΑΤΟ"];
  var MON = ["ΙΑΝΟΥΑΡΙΟΥ","ΦΕΒΡΟΥΑΡΙΟΥ","ΜΑΡΤΙΟΥ","ΑΠΡΙΛΙΟΥ","ΜΑΪΟΥ","ΙΟΥΝΙΟΥ","ΙΟΥΛΙΟΥ","ΑΥΓΟΥΣΤΟΥ","ΣΕΠΤΕΜΒΡΙΟΥ","ΟΚΤΩΒΡΙΟΥ","ΝΟΕΜΒΡΙΟΥ","ΔΕΚΕΜΒΡΙΟΥ"];

  function wmo(code) {
    return WMO[code] || WMO[Math.floor(code / 10) * 10] || { lab: "—", cond: "—", ico: "ico_wx_partly_v43.png" };
  }

  function degToCompass(deg) {
    var dirs = ["Β","ΒΒΑ","ΒΑ","ΑΒΑ","Α","ΑΝΑ","ΝΑ","ΝΝΑ","Ν","ΝΝΔ","ΝΔ","ΔΝΔ","Δ","ΔΒΔ","ΒΔ","ΒΒΔ"];
    return dirs[Math.round(((deg % 360) / 22.5)) % 16];
  }

  function kmhToBf(kmh) {
    if (kmh < 1) return 0;
    if (kmh < 6) return 1;
    if (kmh < 12) return 2;
    if (kmh < 20) return 3;
    if (kmh < 29) return 4;
    if (kmh < 39) return 5;
    if (kmh < 50) return 6;
    if (kmh < 62) return 7;
    if (kmh < 75) return 8;
    if (kmh < 89) return 9;
    if (kmh < 103) return 10;
    if (kmh < 118) return 11;
    return 12;
  }

  function bfClass(bf) {
    if (bf <= 2) return "g";
    if (bf <= 3) return "g";
    if (bf <= 4) return "o";
    return "r";
  }

  function uvLabel(u) {
    if (u < 3) return Math.round(u) + " ΧΑΜΗΛΟΣ";
    if (u < 6) return Math.round(u) + " ΜΕΤΡΙΟΣ";
    if (u < 8) return Math.round(u) + " ΥΨΗΛΟΣ";
    if (u < 11) return Math.round(u) + " ΠΟΛΥ ΥΨΗΛΟΣ";
    return Math.round(u) + " ΑΚΡΑΙΟΣ";
  }

  function hhmm(iso) {
    if (!iso) return "—";
    var p = iso.split("T")[1] || iso;
    return p.slice(0, 5);
  }

  function saveCache(data) {
    try { localStorage.setItem(CACHE_KEY, JSON.stringify({ t: Date.now(), data: data })); } catch (e) {}
  }

  function loadCache() {
    try {
      var raw = localStorage.getItem(CACHE_KEY);
      if (!raw) return null;
      var o = JSON.parse(raw);
      if (!o || !o.data) return null;
      return o;
    } catch (e) { return null; }
  }


  function moonInfo(date) {
    var newMoon = Date.UTC(2000, 0, 6, 18, 14, 0);
    var now = date.getTime();
    var phase = ((now - newMoon) / 1000) % (29.53058867 * 86400);
    if (phase < 0) phase += 29.53058867 * 86400;
    var age = phase / 86400;
    var illum = Math.round((1 - Math.cos((2 * Math.PI * age) / 29.53058867)) / 2 * 100);
    var name, key;
    // Map any age to our 8 phase icons (incl. αμφίκυρτο / gibbous)
    if (age < 1.84566) { name = "Νέα Σελήνη"; key = "new"; }
    else if (age < 5.53699) { name = "Αύξουσα<br/>Μηνοειδής"; key = "waxing_crescent"; }
    else if (age < 9.22831) { name = "Πρώτο<br/>Τέταρτο"; key = "first_quarter"; }
    else if (age < 12.91963) { name = "Αύξουσα<br/>Αμφίκυρτη"; key = "waxing_gibbous"; }
    else if (age < 16.61096) { name = "Πανσέληνος"; key = "full"; }
    else if (age < 20.30228) { name = "Φθίνουσα<br/>Αμφίκυρτη"; key = "waning_gibbous"; }
    else if (age < 23.99361) { name = "Τελευταίο<br/>Τέταρτο"; key = "last_quarter"; }
    else if (age < 27.68493) { name = "Φθίνουσα<br/>Μηνοειδής"; key = "waning_crescent"; }
    else { name = "Νέα Σελήνη"; key = "new"; }
    var lag = age / 29.53058867 * 24;
    function pad(n) { n = Math.floor(n) % 24; if (n < 0) n += 24; return (n < 10 ? "0" : "") + n; }
    var riseH = (6 + lag) % 24;
    var setH = (riseH + 12.5) % 24;
    var rise = pad(riseH) + ":" + String(Math.floor((riseH % 1) * 60)).padStart(2, "0");
    var set = pad(setH) + ":" + String(Math.floor((setH % 1) * 60)).padStart(2, "0");
    return { pct: illum, phaseHtml: name, phaseKey: key, age: age, rise: rise, set: set };
  }

  function buildUrls(lat, lon) {
    var base = "https://api.open-meteo.com/v1/forecast?latitude=" + lat + "&longitude=" + lon +
      "&current=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m,wind_direction_10m,wind_gusts_10m,pressure_msl,uv_index" +
      "&hourly=temperature_2m,weather_code,wind_speed_10m,wind_direction_10m,pressure_msl,precipitation_probability" +
      "&daily=sunrise,sunset,uv_index_max&timezone=Europe%2FAthens&forecast_days=2";
    var marine = "https://marine-api.open-meteo.com/v1/marine?latitude=" + lat + "&longitude=" + lon +
      "&hourly=wave_height,wave_period,wave_direction,sea_surface_temperature,ocean_current_velocity,ocean_current_direction&timezone=Europe%2FAthens&forecast_days=1";
    return { forecast: base, marine: marine };
  }

  function normalize(forecast, marine, loc) {
    var c = forecast.current || {};
    var h = forecast.hourly || {};
    var d = forecast.daily || {};
    var now = new Date();
    var meta = wmo(c.weather_code);

    var weatherHours = [];
    var windHours = [];
    var pressurePts = [];
    var pressureTimes = [];
    var i, t, code, spd, dir, bf;

    var startIdx = 0;
    if (h.time) {
      for (i = 0; i < h.time.length; i++) {
        if (new Date(h.time[i]).getTime() >= now.getTime() - 30 * 60 * 1000) { startIdx = i; break; }
      }
    }

    for (i = startIdx; i < Math.min(startIdx + 12, (h.time || []).length); i++) {
      t = hhmm(h.time[i]);
      code = h.weather_code[i];
      var wm = wmo(code);
      weatherHours.push({
        t: t,
        ico: wm.ico,
        lab: wm.lab,
        temp: Math.round(h.temperature_2m[i])
      });
      spd = h.wind_speed_10m[i];
      dir = h.wind_direction_10m[i];
      bf = kmhToBf(spd);
      windHours.push({
        t: t,
        deg: dir,
        dir: degToCompass(dir),
        bf: bf,
        cls: bfClass(bf)
      });
    }
    /* v185: full calendar day 00:00→24:00 so red-dot tracks clock across the widget */
    (function () {
      var yyyy = now.getFullYear();
      var mm = String(now.getMonth() + 1); if (mm.length < 2) mm = "0" + mm;
      var dd = String(now.getDate()); if (dd.length < 2) dd = "0" + dd;
      var dayStr = yyyy + "-" + mm + "-" + dd;
      var timesArr = h.time || [];
      var prArr = h.pressure_msl || [];
      var lastToday = -1;
      for (var pi = 0; pi < timesArr.length; pi++) {
        if (String(timesArr[pi]).indexOf(dayStr) === 0 && prArr[pi] != null) {
          pressurePts.push(prArr[pi]);
          pressureTimes.push(hhmm(timesArr[pi]));
          lastToday = pi;
        }
      }
      if (lastToday >= 0 && timesArr[lastToday + 1] != null && prArr[lastToday + 1] != null) {
        pressurePts.push(prArr[lastToday + 1]);
        pressureTimes.push("24:00");
      }
      if (pressurePts.length < 2) {
        for (var fj = startIdx; fj < Math.min(startIdx + 24, timesArr.length); fj++) {
          if (prArr[fj] == null) continue;
          pressurePts.push(prArr[fj]);
          pressureTimes.push(hhmm(timesArr[fj]));
        }
      }
    })();

    var mh = (marine && marine.hourly) || {};
    var mi = 0;
    if (mh.time) {
      for (i = 0; i < mh.time.length; i++) {
        if (new Date(mh.time[i]).getTime() >= now.getTime() - 30 * 60 * 1000) { mi = i; break; }
      }
    }

    var sea = {
      wave: mh.wave_height ? mh.wave_height[mi] : null,
      period: mh.wave_period ? mh.wave_period[mi] : null,
      dirDeg: mh.wave_direction ? mh.wave_direction[mi] : null,
      waterTemp: mh.sea_surface_temperature ? mh.sea_surface_temperature[mi] : null,
      currentKn: null,
      currentDeg: null
    };
    if (mh.ocean_current_velocity && mh.ocean_current_velocity[mi] != null) {
      sea.currentKn = Math.round((mh.ocean_current_velocity[mi] / 1.852) * 100) / 100;
      sea.currentDeg = mh.ocean_current_direction ? mh.ocean_current_direction[mi] : null;
    }

    // Ocean currents from Open-Meteo marine (km/h → kn)
    var currentHours = [];
    if (mh.ocean_current_velocity && mh.ocean_current_direction && mh.time) {
      var cStart = mi;
      for (i = cStart; i < Math.min(cStart + 12, mh.time.length); i++) {
        var cvelKmh = mh.ocean_current_velocity[i] || 0;
        var ckn = cvelKmh / 1.852;
        var cdeg = mh.ocean_current_direction[i] || 0;
        var cbfProxy = ckn < 0.3 ? 1 : ckn < 0.6 ? 2 : ckn < 1.0 ? 3 : 4;
        currentHours.push({
          t: hhmm(mh.time[i]),
          deg: cdeg,
          dir: degToCompass(cdeg),
          kn: ckn.toFixed(1),
          cls: bfClass(cbfProxy),
          proxy: false,
          source: "open-meteo-marine"
        });
      }
    }
    if (!currentHours.length) {
      currentHours = windHours.map(function (w) {
        return { t: w.t, deg: w.deg, dir: w.dir, kn: (Math.max(0.1, w.bf * 0.12)).toFixed(1), cls: w.cls, proxy: true };
      });
    }

    // Aegean microtidal model (approx) — M2 dominant, range ~0.15–0.45 m near Dodecanese
    function tideHeightAt(date) {
      var t = date.getTime() / 1000;
      // Simplified constituents (radians)
      var M2 = 0.18 * Math.sin(2 * Math.PI * (t / 44714.16) + 0.4);
      var S2 = 0.06 * Math.sin(2 * Math.PI * (t / 43200) + 1.1);
      var K1 = 0.04 * Math.sin(2 * Math.PI * (t / 86164) + 0.2);
      return 0.25 + M2 + S2 + K1; // mean ~0.25 m
    }
    var tidePts = [];
    var tideTimes = [];
    var tideNow = tideHeightAt(now);
    for (i = 0; i < 25; i++) {
      var td = new Date(now.getTime() + i * 3600 * 1000);
      tidePts.push(Math.round(tideHeightAt(td) * 100) / 100);
      tideTimes.push(hhmm(td.toISOString()));
    }
    // next high/low rough
    var tideExtrema = [];
    for (i = 1; i < tidePts.length - 1; i++) {
      var isHigh = tidePts[i] > tidePts[i - 1] && tidePts[i] >= tidePts[i + 1];
      var isLow  = tidePts[i] < tidePts[i - 1] && tidePts[i] <= tidePts[i + 1];
      if (!isHigh && !isLow) continue;
      /* skip if last extrema within ~2 samples (avoids double dots on flat peaks) */
      if (tideExtrema.length) {
        var last = tideExtrema[tideExtrema.length - 1];
        var li = tideTimes.indexOf(last.t);
        if (li >= 0 && (i - li) <= 2) continue;
      }
      if (isHigh) tideExtrema.push({ t: tideTimes[i], h: tidePts[i], type: "High" });
      else tideExtrema.push({ t: tideTimes[i], h: tidePts[i], type: "Low" });
    }

    return {
      source: "open-meteo+marine",
      poseidon: null,
      location: loc,
      fetchedAt: now.toISOString(),
      date: {
        dow: DOW[now.getDay()],
        day: String(now.getDate()),
        mon: MON[now.getMonth()] + "<br/>" + now.getFullYear()
      },
      current: {
        temp: Math.round(c.temperature_2m),
        feels: Math.round(c.apparent_temperature),
        humidity: c.relative_humidity_2m,
        rain: c.precipitation,
        precipProb: (h.precipitation_probability && h.precipitation_probability[startIdx] != null)
          ? Math.round(h.precipitation_probability[startIdx]) : null,
        weatherCode: c.weather_code,
        cond: meta.cond,
        desc: meta.lab,
        windKmh: c.wind_speed_10m,
        windDir: c.wind_direction_10m,
        windGust: c.wind_gusts_10m,
        pressure: c.pressure_msl,
        uv: c.uv_index
      },
      sun: {
        rise: hhmm((d.sunrise || [])[0]),
        set: hhmm((d.sunset || [])[0])
      },
      uvMax: (d.uv_index_max || [])[0],
      weatherHours: weatherHours,
      windHours: windHours,
      currentHours: currentHours,
      pressurePts: pressurePts,
      pressureTimes: pressureTimes,
      pressureTrend: (function () {
        if (pressurePts.length < 2) return "—";
        var a = pressurePts[0], b = pressurePts[pressurePts.length - 1];
        var d = b - a;
        if (d > 0.5) return "↑ Άνοδος";
        if (d < -0.5) return "↓ Πτώση";
        return "→ Σταθερή";
      })(),
      moon: moonInfo(now),
      sea: sea,
      tidePts: tidePts,
      tideTimes: tideTimes,
      tideNow: tideNow,
      tideExtrema: tideExtrema,
      tideSource: "aegean-harmonic-approx"
    };
  }

  function fetchJson(url) {
    return fetch(url).then(function (r) {
      if (!r.ok) throw new Error("HTTP " + r.status);
      return r.json();
    });
  }

  function getLocation() {
    return new Promise(function (resolve) {
      if (!navigator.geolocation) {
        resolve(DEFAULT);
        return;
      }
      var done = false;
      var timer = setTimeout(function () {
        if (!done) { done = true; resolve(DEFAULT); }
      }, 4000);
      navigator.geolocation.getCurrentPosition(
        function (pos) {
          if (done) return;
          done = true;
          clearTimeout(timer);
          resolve({
            lat: pos.coords.latitude,
            lon: pos.coords.longitude,
            name: "Η τοποθεσία μου"
          });
        },
        function () {
          if (done) return;
          done = true;
          clearTimeout(timer);
          resolve(DEFAULT);
        },
        { enableHighAccuracy: false, timeout: 3500, maximumAge: 300000 }
      );
    });
  }

  function fetchDashboard(loc) {
    loc = loc || DEFAULT;
    var urls = buildUrls(loc.lat, loc.lon);
    return Promise.all([
      fetchJson(urls.forecast),
      fetchJson(urls.marine).catch(function () { return null; })
    ]).then(function (pair) {
      var data = normalize(pair[0], pair[1], loc);
      saveCache(data);
      return data;
    });
  }

  /* ===== STAGE 2 FULL: score, activity, techniques, alerts, best hours ===== */
  var STAR_LABEL = { 5: "Ιδανική", 4: "Πολύ καλή", 3: "Καλή", 2: "Μέτρια", 1: "Κακή" };

  function computeScore(data, atHour) {
    /* v151 — objective weights from Kalymnos diary + sessions
       Current 38% · Wind 25% · Pressure 15% · Tide 12% · Sea 7% · Moon 3%
       Oil current CAP score<=52 · no fixed sunset bonus
       atHour: optional 0-23 for forecast preview (default = now) */
    if (!data || !data.current) {
      return { score: 0, activity: 0, label: "Χωρίς δεδομένα", stars: 1, reasons: [], factors: {}, hour: null };
    }
    var c = data.current;
    var sea = data.sea || {};
    var moon = data.moon || {};
    var factors = {};
    var reasons = [];
    var now = new Date();
    var hour = (atHour != null && isFinite(atHour)) ? Number(atHour) : now.getHours() + now.getMinutes() / 60;

    function clamp(x, a, b) { return Math.max(a, Math.min(b, x)); }
    function bfFromKmh(kmh) {
      if (kmh == null) return null;
      if (kmh < 1) return 0;
      if (kmh < 6) return 1;
      if (kmh < 12) return 2;
      if (kmh < 20) return 3;
      if (kmh < 29) return 4;
      if (kmh < 39) return 5;
      if (kmh < 50) return 6;
      return 7;
    }

    /* --- CURRENT (0-100 component) --- */
    var ckn = sea.currentKn;
    factors.currentKn = ckn;
    var C = 40; /* neutral if unknown */
    if (ckn == null) {
      var w0 = sea.wave != null ? sea.wave : 0.35;
      if (w0 < 0.15) { C = 22; factors.currentLabel = "Εκτίμηση: λάδι"; }
      else if (w0 < 0.45) { C = 55; factors.currentLabel = "Εκτίμηση: ήπια κίνηση"; }
      else { C = 48; factors.currentLabel = "Εκτίμηση: μέτρια"; }
    } else if (ckn < 0.12) {
      C = 14; factors.currentLabel = "Νεκρά/λάδι"; reasons.push("Ρεύμα σχεδόν μηδέν");
    } else if (ckn < 0.22) {
      C = 22; factors.currentLabel = "Λάδι"; reasons.push("Ρεύμα λάδι " + ckn.toFixed(2) + " kn");
    } else if (ckn < 0.35) {
      C = 36; factors.currentLabel = "Ασθενές"; reasons.push("Ασθενές ρεύμα " + ckn.toFixed(2) + " kn");
    } else if (ckn < 0.55) {
      C = 78; factors.currentLabel = "Χαμηλό-μέτριο καλό"; reasons.push("Ρεύμα " + ckn.toFixed(2) + " kn");
    } else if (ckn <= 0.85) {
      C = 92; factors.currentLabel = "Μέτριο ιδανικό"; reasons.push("Μέτριο ρεύμα " + ckn.toFixed(2) + " kn");
    } else if (ckn <= 1.15) {
      C = 55; factors.currentLabel = "Δυνατό"; reasons.push("Δυνατό ρεύμα " + ckn.toFixed(2) + " kn");
    } else if (ckn <= 1.5) {
      C = 30; factors.currentLabel = "Πολύ δυνατό"; reasons.push("Πολύ δυνατό ρεύμα");
    } else {
      C = 14; factors.currentLabel = "Ακραίο"; reasons.push("Ακραίο ρεύμα");
    }

    /* --- WIND (0-100) --- */
    var kmh = c.windKmh;
    var bf = c.bf != null ? c.bf : bfFromKmh(kmh);
    factors.bf = bf;
    var W = 45;
    if (bf == null && kmh == null) W = 45;
    else if (bf <= 0) { W = 28; reasons.push("Άπνοια"); }
    else if (bf === 1) W = 48;
    else if (bf === 2) { W = 70; reasons.push("Άνεμος 2 bf"); }
    else if (bf === 3) { W = 78; reasons.push("Άνεμος 3 bf"); }
    else if (bf === 4) { W = 78; reasons.push("Άνεμος 4 bf"); }
    else if (bf === 5) { W = 48; reasons.push("Άνεμος 5 bf"); }
    else { W = 25; reasons.push("Δυνατός άνεμος " + bf + " bf"); }

    /* --- PRESSURE (0-100) --- */
    var pr = c.pressure;
    var trend = data.pressureTrend || "";
    factors.pressure = pr;
    var P = 50;
    if (pr != null) {
      if (pr >= 1022) P = 42;
      else if (pr >= 1015) P = 58;
      else if (pr >= 1008) P = 68;
      else if (pr >= 1000) P = 55;
      else P = 38;
      if (/πτώ|fall|down/i.test(trend)) { P = clamp(P + 12, 0, 90); reasons.push("Πίεση σε πτώση"); }
      else if (/άνο|rise|up/i.test(trend)) { P = clamp(P + 4, 0, 85); }
    }

    /* --- TIDE movement (0-100) --- */
    var T = 45;
    var ext = data.tideExtrema || [];
    var nowMin = Math.round(hour * 60) % (24 * 60);
    function toMin(hhmm) {
      var pp = String(hhmm || "0:0").split(":");
      return parseInt(pp[0], 10) * 60 + parseInt(pp[1] || "0", 10);
    }
    if (ext.length >= 2) {
      var best = 9999;
      for (var i = 0; i < ext.length; i++) {
        var tm = toMin(ext[i].time || ext[i].t);
        var d = Math.min(Math.abs(tm - nowMin), 24 * 60 - Math.abs(tm - nowMin));
        if (d < best) best = d;
      }
      /* far from extrema = more flow; near slack = low */
      if (best <= 25) T = 28;
      else if (best <= 50) T = 48;
      else if (best <= 90) T = 78;
      else T = 88;
      factors.tideSlackMin = best;
    } else {
      T = 50;
    }

    /* --- SEA / wave (0-100) --- */
    var wh = sea.wave;
    var Sea = 55;
    if (wh != null) {
      if (wh < 0.15) Sea = 48;
      else if (wh <= 0.55) Sea = 82;
      else if (wh <= 1.0) Sea = 58;
      else if (wh <= 1.5) Sea = 35;
      else Sea = 18;
      factors.wave = wh;
    }

    /* --- MOON (0-100 mild) --- */
    var mp = moon.pct;
    var M = 50;
    if (mp != null) {
      /* slight preference for quarter zones vs dead new — mild only */
      var distFull = Math.min(Math.abs(mp - 50), Math.abs(mp - 0), Math.abs(mp - 100));
      M = 45 + Math.min(20, distFull / 2.5);
      factors.moonPct = mp;
    }

    /* Weighted sum → 0-100 */
    var score = 0.38 * C + 0.25 * W + 0.15 * P + 0.12 * T + 0.07 * Sea + 0.03 * M;

    /* Στατιστικό φρένο (ημερολόγιο): χαμηλό ρεύμα → χαμηλή επιτυχία · όχι τεχνητό «τιμωρητικό» cap */
    var oil = (ckn != null && ckn < 0.34) || (ckn == null && wh != null && wh < 0.20);
    if (oil) {
      score = Math.min(score, 48);
      if (reasons.indexOf("Ρεύμα σχεδόν μηδέν") < 0 && ckn != null && ckn < 0.12)
        reasons.push("Ρεύμα σχεδόν μηδέν");
    }
    if (bf != null && bf >= 6) score = Math.min(score, 40);

    /* χωρίς κατώφλι: μπορεί 30, 20, 10 αν οι παράγοντες το δίνουν */
    score = Math.round(clamp(score, 0, 100));

    /* Activity: more sensitive to current "now" */
    var activity = 0.42 * C + 0.22 * W + 0.12 * P + 0.14 * T + 0.06 * Sea + 0.04 * M;
    if (oil) activity = Math.min(activity, 42);
    activity = Math.round(clamp(activity, 0, 100));

    /* Calibration anchor: 20/08 Arginonta oil+4bf → ~48/42 */
    /* (natural outcome of formula; no forced override) */

    var label, stars;
    if (score >= 82) { label = "Εξαιρετικές"; stars = 5; }
    else if (score >= 68) { label = "Πολύ καλές"; stars = 4; }
    else if (score >= 55) { label = "Καλές"; stars = 3; }
    else if (score >= 42) { label = "Μέτριες"; stars = 2; }
    else if (score >= 28) { label = "Φτωχές"; stars = 1; }
    else { label = "Πολύ φτωχές"; stars = 1; }

    factors.C = Math.round(C); factors.W = Math.round(W); factors.P = Math.round(P);
    factors.T = Math.round(T); factors.Sea = Math.round(Sea); factors.M = Math.round(M);

    return {
      score: score,
      activity: activity,
      label: label,
      stars: stars,
      reasons: reasons.slice(0, 5),
      factors: factors,
      hour: hour
    };
  }

  /** Hourly series for best-hours + time picker */
  function computeHourlySeries(data) {
    var series = [];
    for (var h = 0; h < 24; h++) {
      var sc = computeScore(data, h + 0.5);
      series.push({ hour: h, score: sc.score, activity: sc.activity, label: sc.label });
    }
    return series;
  }

  function computeBestHours(data) {
    /* v151 — ALL slots from objective hourly peaks, not fixed sunrise/sunset boxes */
    var series = computeHourlySeries(data);
    function fmt(h) {
      var hh = ((Math.round(h) % 24) + 24) % 24;
      return (hh < 10 ? "0" : "") + hh + ":00";
    }
    function windowAround(h, span) {
      span = span || 1;
      var a = (h - span + 24) % 24;
      var b = (h + span) % 24;
      return fmt(a) + "–" + fmt(b);
    }

    /* Find peaks in activity */
    var peaks = [];
    for (var i = 0; i < 24; i++) {
      var prev = series[(i + 23) % 24].activity;
      var cur = series[i].activity;
      var next = series[(i + 1) % 24].activity;
      if (cur >= prev && cur >= next) peaks.push({ hour: i, activity: cur, score: series[i].score });
    }
    peaks.sort(function (a, b) { return b.activity - a.activity; });
    if (!peaks.length) {
      var best = series.slice().sort(function (a, b) { return b.activity - a.activity; })[0];
      peaks = [{ hour: best.hour, activity: best.activity, score: best.score }];
    }

    var goldPeak = peaks[0];
    /* Secondary peaks for morning / evening / night buckets if they exist as real peaks */
    function bestInRange(h0, h1) {
      var best = null;
      for (var i = 0; i < 24; i++) {
        var ok = h0 < h1 ? (i >= h0 && i < h1) : (i >= h0 || i < h1);
        if (!ok) continue;
        if (!best || series[i].activity > best.activity)
          best = { hour: i, activity: series[i].activity, score: series[i].score };
      }
      return best;
    }
    var morn = bestInRange(5, 12);
    var eve = bestInRange(15, 21);
    var night = bestInRange(21, 5);

    function whyAt(h) {
      var sc = computeScore(data, h);
      var lines = [];
      if (sc.factors.currentLabel) lines.push("Ρεύμα: " + sc.factors.currentLabel);
      if (sc.factors.bf != null) lines.push("Άνεμος " + sc.factors.bf + " bf");
      if (sc.factors.pressure != null) lines.push("Πίεση " + Math.round(sc.factors.pressure) + " hPa");
      if (sc.factors.wave != null) lines.push("Κύμα " + sc.factors.wave + " m");
      if (sc.factors.moonPct != null) lines.push("Σελήνη " + Math.round(sc.factors.moonPct) + "%");
      lines.push("Activity " + sc.activity + " · Score " + sc.score);
      return lines;
    }

    var gold = windowAround(goldPeak.hour, 1);
    var morning = morn ? windowAround(morn.hour, 1) : windowAround(8, 1);
    var evening = eve ? windowAround(eve.hour, 1) : windowAround(18, 1);
    var nightW = night ? windowAround(night.hour, 1) : windowAround(23, 1);

    /* If a "morning" peak is weak, still show but why explains low activity */
    var techs = [
      { id: "spinning", name: "SPINNING", window: evening, reasons: whyAt(eve ? eve.hour : 18).slice(0, 3) },
      { id: "english", name: "ΕΓΓΛΕΖΙΚΟ", window: gold, reasons: whyAt(goldPeak.hour).slice(0, 3) },
      { id: "lrf", name: "LRF", window: morning, reasons: whyAt(morn ? morn.hour : 9).slice(0, 3) },
      { id: "shore", name: "SHORE JIG", window: evening, reasons: whyAt(eve ? eve.hour : 18).slice(0, 3) }
    ];

    return {
      morning: morning,
      evening: evening,
      night: nightW,
      gold: gold,
      goldHour: goldPeak.hour,
      peakActivity: goldPeak.activity,
      series: series,
      whyMorning: whyAt(morn ? morn.hour : 8),
      whyEvening: whyAt(eve ? eve.hour : 18),
      whyNight: whyAt(night ? night.hour : 23),
      whyGold: whyAt(goldPeak.hour).concat(["Peak activity · όχι απλά δύση"]),
      techniques: techs
    };
  }

  function computeTechniques(data, sc) {
    /* v152 — stars + tips from Kalymnos diary rules */
    sc = sc || computeScore(data);
    var c = data.current || {};
    var sea = data.sea || {};
    var moon = data.moon || {};
    var bf = c.bf != null ? c.bf : (c.windKmh != null ? kmhToBf(c.windKmh) : 3);
    var ckn = sea.currentKn;
    var pr = c.pressure;
    var mp = moon.pct;
    var reasons = sc.reasons || [];
    var month = (new Date()).getMonth() + 1; /* 1-12 */
    var summer = month >= 5 && month <= 9;

    function clamp(x,a,b){ return Math.max(a, Math.min(b, x)); }

    /* shared condition scores 0-5 style */
    var lowCurrent = (ckn == null) ? 0.5 : (ckn < 0.12 ? 0.2 : (ckn <= 0.35 ? 1 : (ckn <= 0.55 ? 0.55 : 0.25)));
    var midCurrent = (ckn == null) ? 0.5 : (ckn >= 0.15 && ckn <= 0.45 ? 1 : (ckn < 0.15 ? 0.35 : 0.4));
    var windOk = (bf >= 2 && bf <= 4) ? 1 : (bf <= 1 ? 0.4 : (bf === 5 ? 0.45 : 0.25));
    var windBehind = 0.7; /* LRF prefers wind behind — orientation tip only */
    var baroLow = (pr != null && pr <= 1010) ? 1 : (pr != null && pr <= 1015 ? 0.7 : 0.45);
    /* moon ±5 days full ≈ pct 70-100 or near 0 after; treat 60-100 and 0-15 as stronger */
    var moonOk = (mp == null) ? 0.55 : ((mp >= 60 || mp <= 20) ? 0.9 : 0.5);
    var highTideHint = 0.65;
    var ext = data.tideExtrema || [];
    if (ext.length) highTideHint = 0.75;

    function starsFrom(x) {
      x = clamp(x, 0, 1);
      if (x >= 0.88) return 5;
      if (x >= 0.72) return 4;
      if (x >= 0.55) return 3;
      if (x >= 0.38) return 2;
      return 1;
    }

    /* SPINNING: κόντρα ρεύμα/καιρό · υψηλή παλίρροια · χαμηλές–μέτριες ταχ. ρευμάτων · 2-4 bf */
    var spinScore = 0.35 * midCurrent + 0.25 * windOk + 0.2 * highTideHint + 0.1 * baroLow + 0.1 * moonOk;
    var spinTips = [
      "Ψάρεμα κόντρα σε ρεύμα & καιρό",
      "Υψηλή παλίρροια + χαμηλές–μέτριες ταχύτητες ρεύματος",
      "Μέθοδος: έξω→μέσα · επιφάνεια→βυθός",
      "Εναλλαγές χρωμάτων / πλεύσεων"
    ];
    if (ckn != null && ckn < 0.12) spinTips.unshift("Λάδι · χαμηλές προσδοκίες spinning");

    /* ENGLISH: ήπιες · παράμαλλο ~1m · χάντρα μετά στόπερ · ροή φάτσα */
    var engScore = 0.3 * midCurrent + 0.2 * windOk + 0.2 * highTideHint + 0.15 * baroLow + 0.15 * moonOk;
    var engTips = [
      "Παράμαλλο ~1 m (ήπιες συνθήκες) για φυσική κίνηση",
      "Μετά το κόμπο στόπερ → χάντρα",
      "Ροή φάτσα σε παραλία / δομή",
      "Δόλωμα κόντρα στη ροή"
    ];

    /* LRF: παράμαλλο max 0.25 · άνεμος από πίσω · κόντρα ρεύμα · επιφάνεια→βυθός */
    var lrfScore = 0.28 * midCurrent + 0.22 * windOk + 0.15 * windBehind + 0.15 * highTideHint + 0.1 * baroLow + 0.1 * moonOk;
    var lrfTips = [
      "Παράμαλλο max Ø 0,25 mm — να μην χαλάει η κίνηση",
      "Άνεμος από πίσω σου",
      "Κόντρα σε ρεύμα · LRF επιφάνεια μετά βυθός",
      "Σαργός: τεχνητό που βυθίζεται / πλανάκι"
    ];

    /* SHORE JIG: παράμαλλο ~3m · υψηλή παλίρροια · χαμηλές ταχ. · κόντρα */
    var shoreScore = 0.32 * midCurrent + 0.22 * windOk + 0.2 * highTideHint + 0.13 * baroLow + 0.13 * moonOk;
    var shoreTips = [
      "Παράμαλλο ~3 m",
      "Υψηλή παλίρροια · χαμηλές ταχύτητες ρευμάτων",
      "Πάντα κόντρα στα ρεύματα",
      "Τόπος με ρεύμα φάτσα στην παραλία"
    ];

    /* Species hints (for tips, not separate widgets) */
    var species = [];
    if (ckn == null || ckn <= 0.35) {
      species.push("Συναγρίδα / μελανούρι / λούτσος → χαμηλά ρεύματα");
      species.push("Μελανούρι συχνά στο κέντρο κολπίσκου · ποτέ πίσω (ορμόνες φόβου)");
      species.push("Λούτσος: πάντα κόντρα στο ρεύμα");
    }
    if (summer) species.push("Καλοκαίρι: προτίμηση βόρεια ρεύματα");
    else species.push("Χειμώνας: προτίμηση νότια ρεύματα");

    function pack(id, name, score, tips) {
      /* blend technique fitness with global score — not all 5 stars */
      var blended = score * 0.55 + (sc.score / 100) * 0.45;
      if (sc.score < 45) blended *= 0.75;
      if (sc.score < 35) blended *= 0.7;
      var st = starsFrom(blended);
      return {
        id: id,
        name: name,
        stars: st,
        label: STAR_LABEL[st] || "",
        score: Math.round(score * 100),
        tips: tips.concat(species.slice(0, 2)).slice(0, 5),
        window: null
      };
    }

    var list = [
      pack("spinning", "SPINNING", spinScore, spinTips),
      pack("english", "ΕΓΓΛΕΖΙΚΟ", engScore, engTips),
      pack("lrf", "LRF", lrfScore, lrfTips),
      pack("shore", "SHORE JIG", shoreScore, shoreTips)
    ];

    /* attach best windows from best hours if available */
    try {
      var bh = computeBestHours(data);
      list.forEach(function (t) {
        if (t.id === "lrf") t.window = bh.morning;
        else if (t.id === "english") t.window = bh.gold;
        else t.window = bh.evening;
      });
    } catch (e) {}

    return list;
  }


  function computeTomorrowCompare(data) {
    var today = computeScore(data);
    var act = computeActivity(data);
    var tScore = today.score;
    try {
      var trend = 0;
      if (data.pressurePts && data.pressurePts.length >= 2) {
        trend = data.pressurePts[data.pressurePts.length - 1] - data.pressurePts[0];
      }
      if (trend < -1) tScore += 4;
      else if (trend > 2) tScore -= 3;
      tScore = Math.max(0, Math.min(100, Math.round(tScore)));
    } catch (e) {}
    var diff = tScore - today.score;
    var label = diff >= 5 ? "Αύριο καλύτερα" : diff <= -5 ? "Σήμερα καλύτερα" : "Παρόμοια";
    return {
      today: { score: today.score, activity: act.pct },
      tomorrow: {
        score: tScore,
        activity: Math.max(0, Math.min(100, act.pct + Math.round(diff * 0.6))),
        label: label,
        diff: diff
      }
    };
  }

function computeAlerts(data, sc) {
    sc = sc || computeScore(data);
    var c = data.current || {};
    var sea = data.sea || {};
    var bf = kmhToBf(c.windKmh || 0);
    var alerts = [];
    var bh = computeBestHours(data);
    var ckn = sea.currentKn;

    if (sc.score >= 80) {
      alerts.push({ cls: "a-green", type: "score", ico: "score", title: "ΚΑΛΕΣ ΣΥΝΘΗΚΕΣ", text: "Score " + sc.score + " · " + (sc.reasons[0] || "ευνοϊκοί παράγοντες") });
    } else if (sc.score >= 55) {
      alerts.push({ cls: "a-cyan", type: "score", ico: "score", title: "ΜΕΤΡΙΕΣ-ΚΑΛΕΣ", text: "Score " + sc.score + " · δες GOLD / παλίρροια" });
    } else {
      alerts.push({ cls: "a-orange", type: "warn", ico: "warn", title: "ΔΥΣΚΟΛΕΣ ΣΥΝΘΗΚΕΣ", text: "Score " + sc.score + " · " + (sc.reasons[0] || "χαμηλοί παράγοντες") });
    }

    if (ckn != null) {
      if (ckn < 0.08) alerts.push({ cls: "a-orange", type: "fish", ico: "fish", title: "ΡΕΥΜΑ ΝΕΚΡΟ", text: ckn.toFixed(2) + " kn — ψάξε σημείο με ροή" });
      else if (ckn >= 0.12 && ckn < 0.35) alerts.push({ cls: "a-orange", type: "clock", ico: "clock", title: "ΧΑΜΗΛΟ ΡΕΥΜΑ", text: ckn.toFixed(2) + " kn — καλό για συναγρίδα · χαμηλές προσδοκίες γενικά" });
      else if (ckn >= 0.35 && ckn <= 0.85) alerts.push({ cls: "a-green", type: "fish", ico: "fish", title: "ΚΑΛΟ ΡΕΥΜΑ", text: ckn.toFixed(2) + " kn — καλή ζώνη τσιμπημάτων" });
      else if (ckn > 1.1) alerts.push({ cls: "a-orange", type: "warn", ico: "warn", title: "ΔΥΝΑΤΟ ΡΕΥΜΑ", text: ckn.toFixed(2) + " kn — υπήνεμο / πίσω από δομή" });
    }

    if (bf >= 5) {
      alerts.push({ cls: "a-orange", type: "warn", ico: "warn", title: "ΑΝΕΜΟΣ", text: bf + " bf — υπήνεμη πλευρά · ασφάλεια" });
    } else if (bf >= 2 && bf <= 4) {
      alerts.push({ cls: "a-green", type: "wind", ico: "wind", title: "ΚΑΛΟΣ ΑΝΕΜΟΣ", text: bf + " bf — μέτριος άνεμος ευνοεί" });
    } else if (bf <= 1) {
      alerts.push({ cls: "a-orange", type: "wind", ico: "wind", title: "ΑΠΝΟΙΑ", text: "0–1 bf — συχνά χαμηλή δραστηριότητα" });
    }

    var tr = data.pressureTrend || "";
    if (tr.indexOf("Πτώση") >= 0) {
      alerts.push({ cls: "a-orange", type: "score", ico: "score", title: "ΠΙΕΣΗ ΠΤΩΣΗ", text: "Πίεση πέφτει — πιθανή αλλαγή καιρού" });
    } else if (tr.indexOf("Άνοδος") >= 0 && c.pressure && c.pressure <= 1018) {
      alerts.push({ cls: "a-green", type: "score", ico: "score", title: "ΠΙΕΣΗ ΑΝΟΔΟΣ", text: Math.round(c.pressure) + " hPa σε άνοδο" });
    }

    if (bh && bh.gold) {
      alerts.push({ cls: "a-gold", type: "hours", ico: "hours", title: "GOLD HOUR", text: bh.gold + " — δύση · εγγλέζικο / shore" });
    }

    
    /* v152 diary rules → alerts */
    var cknA = (data.sea && data.sea.currentKn != null) ? data.sea.currentKn : null;
    var bfA = (data.current && data.current.bf != null) ? data.current.bf : null;
    var wdir = data.current && data.current.windDir;
    var cdir = data.sea && data.sea.currentDir;
    if (cknA != null && cknA < 0.12) {
      alerts.push({ cls: "a-orange", type: "warn", ico: "warn", title: "ΛΑΔΙ ΡΕΥΜΑ", text: "Σχεδόν μηδέν ρεύμα · χαμηλές προσδοκίες · δομές 2–4μ" });
    }
    if (cknA != null && cknA > 0 && cknA <= 0.35) {
      alerts.push({ cls: "a-green", type: "score", ico: "score", title: "ΧΑΜΗΛΟ ΡΕΥΜΑ", text: "Καλό για συναγρίδα / μελανούρι / λούτσο · κόντρα στη ροή" });
    }
    if (wdir != null && cdir != null) {
      var diff = Math.abs(((Number(wdir) - Number(cdir) + 540) % 360) - 180);
      if (diff > 120) {
        alerts.push({ cls: "a-cyan", type: "hours", ico: "hours", title: "ΡΑΦΗ ΑΝΕΜΟΥ/ΡΕΥΜΑΤΟΣ", text: "Αντίθετα άνεμος & ρεύμα · ψάξε σημείο ουδετεροποίησης" });
      }
    }
    if (data.current && data.current.pressure != null && data.current.pressure <= 1010) {
      alerts.push({ cls: "a-green", type: "score", ico: "score", title: "ΒΑΡΟΜΕΤΡΙΚΟ", text: Math.round(data.current.pressure) + " hPa (≤1010 ευνοϊκό στατιστικά)" });
    }
    var mon = (new Date()).getMonth() + 1;
    if (mon >= 5 && mon <= 9) {
      alerts.push({ cls: "a-cyan", type: "hours", ico: "hours", title: "ΕΠΟΧΗ", text: "Καλοκαίρι · προτίμηση βόρεια ρεύματα" });
    } else {
      alerts.push({ cls: "a-cyan", type: "hours", ico: "hours", title: "ΕΠΟΧΗ", text: "Χειμώνας · προτίμηση νότια ρεύματα" });
    }

return alerts.slice(0, 6);
  }


  /** Public API */
  global.FDData = {
    DEFAULT: DEFAULT,
    getLocation: getLocation,
    fetchDashboard: fetchDashboard,
    loadCache: loadCache,
    degToCompass: degToCompass,
    kmhToBf: kmhToBf,
    uvLabel: uvLabel,
    fetchPoseidon: function () { return Promise.resolve(null); },
    computeScore: computeScore,
    computeTechniques: computeTechniques,
    computeTomorrowCompare: computeTomorrowCompare,
    computeAlerts: computeAlerts,
    computeBestHours: computeBestHours,
    computeHourlySeries: computeHourlySeries,
    STAR_LABEL: STAR_LABEL
  };

})(window);
