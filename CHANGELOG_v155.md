# v155 Hero fix — root causes

## Τι δεν πήγε καλά
1. **hero_plate_day.jpg** είχε top RGB ~(40,77,141) = μπλε λυκόφως, όχι μέρα
   (η βάση hero_base είναι ήδη σκούρα μπλε — το grading δεν έφτανε)
2. **CSS conflict**: παλιό `background:radial-gradient` στον `.hero-sun` + box-shadow
   → κίτρινος δίσκος μέσα σε φωτοστέφανο (έμοιαζε μπλε κύκλος στο screenshot)
3. Ο ήλιος PNG ήταν χλωμός επίπεδος δίσκος

## Διορθώσεις
- Νέες πλάκες με πραγματικό daylight ουρανό (day top ~122,176,224)
- Νέος ρεαλιστικός ήλιος (core + corona, διαφανές, χωρίς δαχτυλίδι)
- CSS: `background:none` · χωρίς radial-gradient · χωρίς μπλε κύκλο
- sky-tint απενεργοποιημένο (το χρώμα ουρανού είναι στην πλάκα)

## Upload
index.html style.css app.js
hero_plate_*.jpg (όλα)
hero_sun.png hero_sun_warm.png
