FD_v159_RECOVERY — ΕΠΑΝΑΦΟΡΑ
================================
Τι έσπασε: το style.css αντικαταστάθηκε από 615 bytes (μόνο το patch v158).
Χάθηκε όλο το styling της εφαρμογής.

Αυτό το zip επαναφέρει:
- Πλήρες style.css (~123KB) από σταθερή έκδοση + hide overlay ήλιου
- app.js με plate switching
- index.html
- data.js (αν υπάρχει)
- Εγκεκριμένες πλάκες hero (day/dawn/gold/dusk/night/cloudy/rain/storm) στη ΡΙΖΑ

UPLOAD (ρίζα GitHub, overwrite):
1. style.css  ← ΚΡΙΣΙΜΟ
2. app.js
3. index.html
4. data.js
5. hero_plate_*.jpg (8 αρχεία)
6. τα υπόλοιπα png/jpg αν λείπουν

Μετά: Netlify → Deploys → Trigger deploy / clear cache
Hard refresh στο κινητό.

ΜΗΝ ανεβάσεις μόνο style.css από παλιό v158 patch.
