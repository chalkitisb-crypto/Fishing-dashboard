FD_v158_HERO_PLATES
====================
Μέθοδος: ήλιος/σελήνη ΜΕΣΑ στην πλάκα (όχι overlay).

Αρχεία:
  assets/hero_plate_dawn.jpg
  assets/hero_plate_day.jpg
  assets/hero_plate_gold.jpg
  assets/hero_plate_dusk.jpg
  assets/hero_plate_night.jpg
  assets/hero_plate_cloudy.jpg
  assets/hero_plate_rain.jpg
  assets/hero_plate_storm.jpg
  style.css          → merge ή append
  hero-plates.js     → <script src="hero-plates.js?v=158"></script> πριν το κλείσιμο body
                       και κάλεσε HeroPlates.update(wx) όταν έρχονται δεδομένα καιρού

Κρύβει παλιό .hero-sun overlay.
Live βροχή: canvas σταγόνες όταν rain/storm.
