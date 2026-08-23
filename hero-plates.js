/* v158 Hero plates — drop-in */
(function(){
  const PLATES = {
    dawn: 'assets/hero_plate_dawn.jpg',
    day: 'assets/hero_plate_day.jpg',
    gold: 'assets/hero_plate_gold.jpg',
    dusk: 'assets/hero_plate_dusk.jpg',
    night: 'assets/hero_plate_night.jpg',
    cloudy: 'assets/hero_plate_cloudy.jpg',
    rain: 'assets/hero_plate_rain.jpg',
    storm: 'assets/hero_plate_storm.jpg'
  };

  function ensurePlates(root){
    if(!root) return;
    let wrap = root.querySelector('.hero-bg-wrap') || root;
    Object.keys(PLATES).forEach(key=>{
      let img = wrap.querySelector('.hero-plate[data-plate="'+key+'"]');
      if(!img){
        img = document.createElement('img');
        img.className = 'hero-plate';
        img.dataset.plate = key;
        img.alt = '';
        img.src = PLATES[key] + '?v=158';
        wrap.insertBefore(img, wrap.firstChild);
      }
    });
    // hide legacy single bg if any
    wrap.querySelectorAll('img:not(.hero-plate)').forEach(el=>{
      if(el.classList.contains('hero-bg') || el.id==='hero-bg') el.style.display='none';
    });
  }

  function pickKey(wx, hour){
    const code = (wx && (wx.weathercode ?? wx.weather_code)) ?? 0;
    const isStorm = code >= 95;
    const isRain = code >= 51 && code < 95;
    const isCloud = code >= 2 && code < 51;
    if(isStorm) return 'storm';
    if(isRain) return 'rain';
    if(isCloud) return 'cloudy';
    // clear by hour
    if(hour >= 5 && hour < 8) return 'dawn';
    if(hour >= 8 && hour < 16) return 'day';
    if(hour >= 16 && hour < 19) return 'gold';
    if(hour >= 19 && hour < 21) return 'dusk';
    return 'night';
  }

  function setPlate(key){
    const root = document.querySelector('.hero-card') || document.querySelector('#hero') || document.body;
    ensurePlates(root.querySelector('.hero-bg-wrap') || root);
    root.querySelectorAll('.hero-plate').forEach(img=>{
      img.classList.toggle('is-active', img.dataset.plate === key);
    });
    // rain canvas
    let canvas = root.querySelector('.hero-rain-canvas');
    if(!canvas){
      canvas = document.createElement('canvas');
      canvas.className = 'hero-rain-canvas';
      (root.querySelector('.hero-bg-wrap')||root).appendChild(canvas);
      startRain(canvas);
    }
    canvas.classList.toggle('is-on', key==='rain' || key==='storm');
  }

  function startRain(canvas){
    const ctx = canvas.getContext('2d');
    let drops = [];
    function resize(){
      const r = canvas.parentElement.getBoundingClientRect();
      canvas.width = r.width; canvas.height = r.height;
      drops = Array.from({length: 80}, ()=>({
        x: Math.random()*canvas.width,
        y: Math.random()*canvas.height,
        len: 10+Math.random()*14,
        spd: 6+Math.random()*8
      }));
    }
    resize();
    window.addEventListener('resize', resize);
    (function tick(){
      if(canvas.classList.contains('is-on')){
        ctx.clearRect(0,0,canvas.width,canvas.height);
        ctx.strokeStyle = 'rgba(180,200,220,0.45)';
        ctx.lineWidth = 1.2;
        drops.forEach(d=>{
          ctx.beginPath();
          ctx.moveTo(d.x, d.y);
          ctx.lineTo(d.x-1, d.y+d.len);
          ctx.stroke();
          d.y += d.spd;
          d.x -= 0.4;
          if(d.y > canvas.height){ d.y = -20; d.x = Math.random()*canvas.width; }
        });
      }
      requestAnimationFrame(tick);
    })();
  }

  window.HeroPlates = {
    update(wx){
      const h = new Date().getHours();
      setPlate(pickKey(wx||{}, h));
    },
    setPlate
  };

  // auto on load + every 2 min
  document.addEventListener('DOMContentLoaded', ()=>{
    window.HeroPlates.update(window.__lastWx || {});
    setInterval(()=>window.HeroPlates.update(window.__lastWx || {}), 120000);
  });
})();
