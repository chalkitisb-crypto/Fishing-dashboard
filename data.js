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
      pressurePts.push(h.pressure_msl[i]);
      pressureTimes.push(t);
    }

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
    for (i = 0; i < 13; i++) {
      var td = new Date(now.getTime() + (i - 2) * 3600 * 1000);
      tidePts.push(Math.round(tideHeightAt(td) * 100) / 100);
      tideTimes.push(hhmm(td.toISOString()));
    }
    // next high/low rough
    var tideExtrema = [];
    for (i = 1; i < tidePts.length - 1; i++) {
      if (tidePts[i] >= tidePts[i - 1] && tidePts[i] >= tidePts[i + 1])
        tideExtrema.push({ t: tideTimes[i], h: tidePts[i], type: "High" });
      if (tidePts[i] <= tidePts[i - 1] && tidePts[i] <= tidePts[i + 1])
        tideExtrema.push({ t: tideTimes[i], h: tidePts[i], type: "Low" });
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

  function computeScore(data) {
    /* v137 objective (not artificially strict)
       Weights from Kalymnos log: current 24, tide 18, pressure 16, wind 12,
       wave 10, hour 8, moon 7, weather 5
       Peaks at moderate current & wind 2-4 bf — natural curve, no keyOk caps */
    if (!data || !data.current) {
      return { score: 0, activity: 0, label: "Χωρίς δεδομένα", stars: 1, reasons: [], factors: {} };
    }
    var c = data.current;
    var sea = data.sea || {};
    var moon = data.moon || {};
    var factors = {};
    var reasons = [];
    var pts = 0;

    function toMin(hhmm) {
      var pp = String(hhmm || "0:0").split(":");
      return parseInt(pp[0], 10) * 60 + parseInt(pp[1] || "0", 10);
    }

    // CURRENTS max 24 — continuous curve, peak 0.28–0.60 kn
    var ckn = sea.currentKn;
    factors.currentKn = ckn;
    var curPts = 0;
    if (ckn == null) {
      var w0 = sea.wave != null ? sea.wave : 0.4;
      if (w0 < 0.12) { curPts = 4; factors.currentLabel = "Εκτίμηση: λάδι"; }
      else if (w0 < 0.45) { curPts = 11; factors.currentLabel = "Εκτίμηση: ήπια κίνηση"; }
      else { curPts = 8; factors.currentLabel = "Εκτίμηση: μέτρια"; }
    } else if (ckn < 0.06) {
      curPts = 3; factors.currentLabel = "Νεκρά/λάδι"; reasons.push("Ρεύμα σχεδόν μηδέν");
    } else if (ckn < 0.18) {
      curPts = 12; factors.currentLabel = "Ασθενές"; reasons.push("Ασθενές ρεύμα " + ckn.toFixed(2) + " kn");
    } else if (ckn < 0.28) {
      curPts = 18; factors.currentLabel = "Ασθενές-μέτριο"; reasons.push("Ρεύμα " + ckn.toFixed(2) + " kn");
    } else if (ckn <= 0.60) {
      curPts = 24; factors.currentLabel = "Μέτριο ιδανικό"; reasons.push("Μέτριο ρεύμα " + ckn.toFixed(2) + " kn");
    } else if (ckn <= 1.0) {
      curPts = 14; factors.currentLabel = "Δυνατό"; reasons.push("Δυνατό ρεύμα " + ckn.toFixed(2) + " kn");
    } else if (ckn <= 1.5) {
      curPts = 7; factors.currentLabel = "Πολύ δυνατό"; reasons.push("Πολύ δυνατό ρεύμα");
    } else {
      curPts = 2; factors.currentLabel = "Ακραίο/φάτσα"; reasons.push("Ακραίο ρεύμα");
    }
    pts += curPts;

    // TIDE + cover max 18
    var tidePts = 0;
    var phase = "";
    var ext = data.tideExtrema || [];
    var nowH = new Date().getHours() * 60 + new Date().getMinutes();
    var prev = null, next = null;
    for (var i = 0; i < ext.length; i++) {
      var tm = toMin(ext[i].t);
      if (tm <= nowH) prev = ext[i];
      if (tm > nowH && !next) next = ext[i];
    }
    var coverProxy = 50;
    if (data.tidePts && data.tidePts.length) {
      var mx = Math.max.apply(null, data.tidePts);
      var mn = Math.min.apply(null, data.tidePts);
      var nowT = data.tideNow != null ? data.tideNow : data.tidePts[Math.floor(data.tidePts.length / 2)];
      if (mx > mn) coverProxy = Math.round(100 * (nowT - mn) / (mx - mn));
    }
    factors.coverProxy = coverProxy;
    if (prev && next) {
      var span = Math.max(1, toMin(next.t) - toMin(prev.t));
      var frac = (nowH - toMin(prev.t)) / span;
      var rising = (prev.type === "Low" || prev.type === "low");
      phase = rising ? "Άνοδος παλίρροιας" : "Πτώση παλίρροιας";
      var distNext = Math.abs(toMin(next.t) - nowH);
      var nearExt = Math.min(Math.abs(nowH - toMin(prev.t)), distNext) <= 50;
      if (frac >= 0.2 && frac <= 0.85) tidePts = 12;
      else if (nearExt) tidePts = 10;
      else tidePts = 6;
      phase += " · επόμενο " + ((next.type === "High" || next.type === "high") ? "υψηλό" : "χαμηλό") + " " + next.t;
    } else if (data.tidePts && data.tidePts.length >= 4) {
      var a = data.tidePts[0], b = data.tidePts[Math.floor(data.tidePts.length / 2)];
      if (Math.abs(b - a) > 0.02) { tidePts = 10; phase = b > a ? "Άνοδος" : "Πτώση"; }
      else { tidePts = 4; phase = "Σταθερή παλίρροια"; }
    } else {
      tidePts = 5; phase = "Παλίρροια n/a";
    }
    if (coverProxy >= 25 && coverProxy <= 75) tidePts += 6;
    else if (coverProxy > 75) tidePts += 3;
    else tidePts += 2;
    tidePts = Math.min(18, tidePts);
    pts += tidePts;
    factors.tide = phase;
    factors.tidePts = tidePts;
    if (phase) reasons.push(phase);

    // PRESSURE max 16 — data favored ~1010-1016
    var p = c.pressure != null ? c.pressure : 1013;
    factors.pressure = Math.round(p);
    var pPts = 0;
    if (p <= 1012) { pPts = 12; factors.pressureLabel = "Χαμηλή-καλή"; reasons.push("Πίεση " + Math.round(p) + " hPa"); }
    else if (p <= 1016) { pPts = 14; factors.pressureLabel = "Ιδανική ζώνη"; reasons.push("Πίεση " + Math.round(p) + " hPa"); }
    else if (p <= 1020) { pPts = 8; factors.pressureLabel = "Μέτρια"; }
    else if (p <= 1025) { pPts = 4; factors.pressureLabel = "Υψηλή"; }
    else { pPts = 2; factors.pressureLabel = "Πολύ υψηλή"; reasons.push("Υψηλή πίεση " + Math.round(p)); }
    var tr = data.pressureTrend || "";
    factors.trend = tr;
    if (tr.indexOf("Άνοδος") >= 0) pPts = Math.min(16, pPts + 2);
    else if (tr.indexOf("Πτώση") >= 0) pPts = Math.max(0, pPts - 1);
    pts += Math.min(16, pPts);

    // WIND max 12 — peak 2-4 bf (objective curve)
    var bf = kmhToBf(c.windKmh || 0);
    factors.wind = bf;
    var wPts = 0;
    if (bf <= 1) { wPts = 4; factors.windLabel = "Άπνοια"; reasons.push("Άπνοια"); }
    else if (bf === 2) { wPts = 10; factors.windLabel = "Ήπιος καλός"; reasons.push("Άνεμος 2 bf"); }
    else if (bf === 3) { wPts = 12; factors.windLabel = "Μέτριος ιδανικός"; reasons.push("Άνεμος 3 bf"); }
    else if (bf === 4) { wPts = 9; factors.windLabel = "Μέτριος-δυνατός"; reasons.push("Άνεμος 4 bf"); }
    else if (bf === 5) { wPts = 4; factors.windLabel = "Δύσκολος"; reasons.push("Άνεμος 5 bf"); }
    else { wPts = 1; factors.windLabel = "Πολύ δυνατός"; reasons.push("Ισχυρός άνεμος"); }
    pts += wPts;

    // WAVE max 10
    var wh = sea.wave != null ? sea.wave : 0.5;
    factors.wave = wh;
    var wavePts = 0;
    if (wh < 0.12) { wavePts = 3; factors.waveLabel = "Λάδι"; reasons.push("Θάλασσα λάδι"); }
    else if (wh < 0.35) { wavePts = 9; factors.waveLabel = "Ήπια ιδανική"; }
    else if (wh < 0.7) { wavePts = 10; factors.waveLabel = "Καλή"; }
    else if (wh < 1.2) { wavePts = 5; factors.waveLabel = "Μέτρια"; }
    else { wavePts = 1; factors.waveLabel = "Δύσκολη"; reasons.push("Μεγάλο κύμα"); }
    pts += wavePts;

    // HOUR max 8
    var h = new Date().getHours() + new Date().getMinutes() / 60;
    var sun = data.sun || {};
    function parseHM(s) {
      var pp = String(s || "6:30").split(":");
      return parseInt(pp[0], 10) + parseInt(pp[1] || "0", 10) / 60;
    }
    var rise = parseHM(sun.rise || "06:30");
    var set = parseHM(sun.set || "20:00");
    var timePts = 0;
    if (h >= rise - 0.5 && h <= rise + 1.5) { timePts = 8; reasons.push("Πρωινό παράθυρο"); }
    else if (h >= set - 1.2 && h <= set + 0.5) { timePts = 8; reasons.push("GOLD / δύση"); }
    else if (h >= 17 && h <= 20) { timePts = 6; reasons.push("Απογευματινό"); }
    else if (h >= 22 || h <= 3) { timePts = 4; }
    else { timePts = 2; }
    pts += timePts;
    factors.timePts = timePts;

    // MOON max 7
    var m = moon.pct != null ? Number(moon.pct) : 50;
    factors.moon = m;
    var moonPts = 0;
    if (m >= 25 && m <= 65) { moonPts = 7; factors.moonLabel = "Καλή ζώνη"; }
    else if (m < 15 || m > 90) { moonPts = 3; factors.moonLabel = "Ακραία"; }
    else { moonPts = 5; factors.moonLabel = "Μέτρια"; }
    pts += moonPts;

    // WEATHER
    var code = c.weatherCode || 0;
    if (code >= 95) { pts = Math.max(0, pts - 15); reasons.push("Καταιγίδα"); }
    else if (code >= 61) { pts = Math.max(0, pts - 8); reasons.push("Βροχή"); }
    else if (code >= 51) { pts = Math.max(0, pts - 3); }
    else { pts += 5; }

    var score = Math.max(0, Math.min(100, Math.round(pts)));

    // ACTIVITY independent — same objective curves, different emphasis
    var act = 0;
    act += Math.round(curPts * (28 / 24));
    act += Math.round(tidePts * (20 / 18));
    if (wh >= 0.15 && wh < 0.7) act += 12;
    else if (wh < 0.15) act += 4;
    else if (wh < 1.2) act += 6;
    else act += 1;
    if (bf >= 2 && bf <= 4) act += 12;
    else if (bf <= 1) act += 4;
    else if (bf === 5) act += 4;
    else act += 1;
    if (p <= 1016) act += 10;
    else if (p <= 1020) act += 6;
    else act += 2;
    act += Math.round(timePts * 0.75);
    act += Math.round(moonPts * 0.6);
    if (code >= 61) act = Math.max(0, act - 10);
    var activity = Math.max(0, Math.min(100, Math.round(act)));

    var label, stars;
    if (score >= 85) { label = "Εξαιρετικές"; stars = 5; }
    else if (score >= 70) { label = "Πολύ καλές"; stars = 4; }
    else if (score >= 55) { label = "Καλές"; stars = 3; }
    else if (score >= 40) { label = "Μέτριες"; stars = 2; }
    else { label = "Δύσκολες"; stars = 1; }

    return {
      score: score,
      activity: activity,
      label: label,
      stars: stars,
      reasons: reasons.slice(0, 6),
      factors: factors
    };
  }

  function computeTechniques(data, sc) {
    sc = sc || computeScore(data);
    var bf = kmhToBf((data.current && data.current.windKmh) || 0);
    var wh = (data.sea && data.sea.wave != null) ? data.sea.wave : 0.6;
    var h = new Date().getHours();
    var isDawnDusk = (h >= 5 && h <= 8) || (h >= 17 && h <= 20);

    function clampStars(n) { return Math.max(1, Math.min(5, Math.round(n))); }

    // Base from overall score, adjusted per technique
    var base = sc.stars;
    var list = [
      {
        id: "spinning",
        stars: clampStars(base + (bf <= 3 ? 1 : 0) + (wh < 1.2 ? 0 : -1) + (isDawnDusk ? 0.5 : 0))
      },
      {
        id: "lrf",
        stars: clampStars(base + (bf <= 2 ? 1 : -1) + (wh < 0.6 ? 1 : -1))
      },
      {
        id: "english",
        stars: clampStars(base + (bf <= 3 ? 0.5 : -1) + (wh < 0.8 ? 1 : 0))
      },
      {
        id: "shore",
        stars: clampStars(base - 1 + (bf >= 3 && bf <= 5 ? 1 : 0) + (wh >= 0.8 ? 0.5 : -0.5))
      }
    ];
    list.forEach(function (t) {
      t.label = STAR_LABEL[t.stars] || "Καλή";
    });
    list.sort(function (a, b) { return b.stars - a.stars; });
    return list;
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
      else if (ckn >= 0.25 && ckn <= 0.7) alerts.push({ cls: "a-green", type: "fish", ico: "fish", title: "ΚΑΛΟ ΡΕΥΜΑ", text: ckn.toFixed(2) + " kn — καλή ζώνη τσιμπημάτων" });
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

    return alerts.slice(0, 6);
  }

  function computeBestHours(data) {
    var sun = (data && data.sun) || {};
    var rise = sun.rise || "06:30";
    var set = sun.set || "20:00";
    var c = (data && data.current) || {};
    var sea = (data && data.sea) || {};
    var bf = kmhToBf(c.windKmh || 0);
    var wh = sea.wave != null ? sea.wave : 0.5;

    function toMin(hhmm) {
      var p = String(hhmm || "0:0").split(":");
      return parseInt(p[0], 10) * 60 + parseInt(p[1] || "0", 10);
    }
    function fromMin(t) {
      t = ((Math.round(t) % (24 * 60)) + 24 * 60) % (24 * 60);
      var h = Math.floor(t / 60), m = t % 60;
      return (h < 10 ? "0" : "") + h + ":" + (m < 10 ? "0" : "") + m;
    }
    function addMin(hhmm, mins) { return fromMin(toMin(hhmm) + mins); }

    var ext = (data && data.tideExtrema) || [];
    var tideCenters = [];
    for (var i = 0; i < ext.length; i++) tideCenters.push(toMin(ext[i].t));
    function nearestInBand(centers, a, b) {
      var best = null, bestDist = 1e9;
      for (var i = 0; i < centers.length; i++) {
        var t = centers[i];
        if (t >= a && t <= b) {
          var d = Math.abs(t - (a + b) / 2);
          if (d < bestDist) { bestDist = d; best = t; }
        }
      }
      return best;
    }

    var riseM = toMin(rise), setM = toMin(set);
    var mornTide = nearestInBand(tideCenters, riseM - 60, riseM + 150);
    var eveTide = nearestInBand(tideCenters, setM - 150, setM + 90);

    var morningA = riseM - 30, morningB = riseM + 90;
    if (mornTide != null) { morningA = mornTide - 70; morningB = mornTide + 40; }
    if (bf >= 5 || wh >= 1.5) {
      var mid = (morningA + morningB) / 2;
      morningA = mid - 35; morningB = mid + 35;
    }
    var morning = fromMin(morningA) + "–" + fromMin(morningB);

    var eveningA = setM - 90, eveningB = setM + 30;
    if (eveTide != null) { eveningA = eveTide - 55; eveningB = eveTide + 50; }
    if (bf >= 5 || wh >= 1.5) {
      var midE = (eveningA + eveningB) / 2;
      eveningA = midE - 35; eveningB = midE + 35;
    }
    var evening = fromMin(eveningA) + "–" + fromMin(eveningB);

    var goldA = setM - 60, goldB = setM + 30;
    if (eveTide != null && Math.abs(eveTide - setM) < 120) {
      goldA = Math.min(goldA, eveTide - 40);
      goldB = Math.max(goldB, eveTide + 25);
    }
    if (bf >= 4) { goldA += 15; goldB -= 10; }
    var gold = fromMin(goldA) + "–" + fromMin(goldB);

    var nightTide = nearestInBand(tideCenters, 21 * 60, 24 * 60 - 1);
    if (nightTide == null) nightTide = nearestInBand(tideCenters, 0, 150);
    var nightA = 22 * 60 + 30, nightB = 25 * 60;
    if (nightTide != null) { nightA = nightTide - 50; nightB = nightTide + 80; }
    var night = fromMin(nightA) + "–" + fromMin(nightB);

    function liveFactors(slot) {
      var lines = [];
      if (c.pressure != null) {
        var tr = data.pressureTrend || "";
        lines.push("Πίεση " + Math.round(c.pressure) + " hPa" + (tr && tr !== "—" ? " · " + tr : ""));
      }
      if (c.windKmh != null) {
        var dir = (c.windDir != null) ? degToCompass(c.windDir) : "";
        lines.push("Άνεμος " + Math.round(c.windKmh) + " km/h · " + bf + " bf" + (dir ? " · " + dir : ""));
      }
      if (sea.currentKn != null) lines.push("Ρεύμα " + Number(sea.currentKn).toFixed(2) + " kn");
      if (sea.wave != null) lines.push("Κύμα " + (Math.round(sea.wave * 10) / 10) + " m");
      if (data.moon && data.moon.pct != null) lines.push("Σελήνη " + Math.round(data.moon.pct) + "%");
      if (slot === "gold") lines.push("Gold hour · δύση ± παλίρροια");
      if (slot === "night") lines.push("Νυχτερινό (παλίρροια)");
      var seen = {}, outL = [];
      lines.forEach(function (x) { if (x && !seen[x]) { seen[x] = 1; outL.push(x); } });
      return outL.slice(0, 6);
    }

    var techs = [
      { id: "spinning", name: "SPINNING", window: fromMin(morningA) + " · " + evening, reasons: liveFactors("evening").slice(0, 3) },
      { id: "english", name: "ΕΓΓΛΕΖΙΚΟ", window: evening, reasons: liveFactors("evening").slice(0, 3) },
      { id: "lrf", name: "LRF", window: morning, reasons: liveFactors("morning").slice(0, 3) },
      { id: "shore", name: "SHORE JIG", window: evening, reasons: liveFactors("evening").slice(0, 3) }
    ];

    return {
      morning: morning,
      evening: evening,
      night: night,
      gold: gold,
      whyMorning: liveFactors("morning"),
      whyEvening: liveFactors("evening"),
      whyNight: liveFactors("night"),
      whyGold: liveFactors("gold"),
      techniques: techs
    };
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
    computeAlerts: computeAlerts,
    computeBestHours: computeBestHours,
    STAR_LABEL: STAR_LABEL
  };

})(window);
