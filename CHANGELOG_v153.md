# FD v153 — Hero live τοπίο

## Τι μπαίνει
- Πλάκες ώρας: dawn · day · gold · dusk · night
- Πλάκες καιρού: cloudy · rain · storm
- Crossfade μεταξύ πλακών
- Live σταγόνες βροχής (canvas) όταν rain/storm
- Σελήνη με πραγματικό % φωτισμού
- Νύχτα + συννεφιά → σελήνη ακόμα ορατή (πιο αμυδρή)
- Ήλιος χαμηλά σε ανατολή/δύση · κρύβεται σε βροχή/καταιγίδα

## Αρχεία για upload (ρίζα GitHub)
index.html, style.css, app.js, data.js
hero_plate_dawn.jpg, hero_plate_day.jpg, hero_plate_gold.jpg
hero_plate_dusk.jpg, hero_plate_night.jpg
hero_plate_cloudy.jpg, hero_plate_rain.jpg, hero_plate_storm.jpg
hero_base.jpg, hero_sun.png, hero_sun_warm.png, hero_moon.png
(+ zone_map.png, gold_hour_bg.png αν δεν υπάρχουν ήδη)

## Έλεγχος Netlify
1. Μέρα → φωτεινό τοπίο day plate
2. Κοντά σε ανατολή/δύση → dawn/dusk + ήλιος χαμηλά
3. Νύχτα → night + σελήνη στο σωστό %
4. Συννεφιά API → cloudy plate
5. Βροχή → rain plate + κινούμενες σταγόνες
6. Καταιγίδα → storm + πιο πυκνή βροχή
