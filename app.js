// Utilidades
const fmt = (n, d=0) => Number(n).toFixed(d);
const now = () => new Date().toLocaleTimeString();

// Tema
const toggleTheme = document.getElementById('toggleTheme');
toggleTheme.addEventListener('click', () => document.body.classList.toggle('light'));

// Simulación de datos (suaves)
function jitter(x, step, min, max){
  x += (Math.random() - 0.5) * step;
  return Math.max(min, Math.min(max, x));
}

// Estado por sensor
const state = {
  co: 45, ch4: 85, iaq: 68, t: 28, h: 55,
  max: {co: 78, ch4: 92, iaq: 90, t: 33, h: 88},
  avg: {co: 42, ch4: 65, iaq: 72, t: 27, h: 58}
};

// Datasets y gráficos
const charts = {};
function mkLine(ctx, label, color){
  return new Chart(ctx, {
    type: 'line',
    data: { labels: [], datasets: [{label, data: [], borderWidth: 2, tension:.35}] },
    options: {
      animation:false, responsive:true, maintainAspectRatio:false,
      plugins:{ legend:{display:false}},
      scales:{
        x: { ticks:{color:'#94a3b8'}, grid:{color:'rgba(148,163,184,.2)', borderDash:[4,4]}},
        y: { ticks:{color:'#94a3b8'}, grid:{color:'rgba(148,163,184,.2)', borderDash:[4,4]}}
      }
    }
  });
}

// Crear charts
document.addEventListener('DOMContentLoaded', () => {
  charts.co  = mkLine(document.getElementById('coChart'),  'CO (ppm)');
  charts.ch4 = mkLine(document.getElementById('ch4Chart'), 'CH₄ (ppm)');
  charts.iaq = mkLine(document.getElementById('iaqChart'), 'IAQ');
  charts.dht = mkLine(document.getElementById('dhtChart'), 'DHT11');

  // Seed inicial
  for(let i=0;i<30;i++) tick(true);
  // Loop
  setInterval(() => tick(false), 1200);
});

// Push punto y limitar longitud
function push(chart, value){
  const L = chart.data.labels;
  const D = chart.data.datasets[0].data;
  L.push(now()); D.push(value);
  if(L.length>36){L.shift(); D.shift();}
  chart.update();
}

// Actualizar KPIs en DOM
function setText(id, txt){ document.getElementById(id).textContent = txt; }

function tick(seed=false){
  // actualizar valores simulados
  state.co  = jitter(state.co,  8,  10, 120);
  state.ch4 = jitter(state.ch4, 10,  10, 160);
  state.iaq = jitter(state.iaq,  4,  20, 100);
  state.t   = jitter(state.t,    .6, 18,  36);
  state.h   = jitter(state.h,    2,  25,  95);

  // KPIs grandes por tarjeta
  setText('coValue',  fmt(state.co,1));
  setText('ch4Value', fmt(state.ch4,1));
  setText('iaqValue', fmt(state.iaq,0));
  setText('tValue',   fmt(state.t,1));
  setText('hValue',   fmt(state.h,0));

  // Máximos/promedios simulados (fijos de demo)
  setText('coMax',  state.max.co + ' ppm');
  setText('coAvg',  state.avg.co + ' ppm');
  setText('ch4Max', state.max.ch4 + ' ppm');
  setText('ch4Avg', state.avg.ch4 + ' ppm');
  setText('iaqMax', state.max.iaq);
  setText('iaqAvg', state.avg.iaq);
  setText('dhtMax', fmt(state.max.t,0)+' °C / '+fmt(state.max.h,0)+' %');
  setText('dhtAvg', fmt(state.avg.t,0)+' °C / '+fmt(state.avg.h,0)+' %');

  // Graficar
  push(charts.co,  state.co);
  push(charts.ch4, state.ch4);
  push(charts.iaq, state.iaq);
  // Para DHT: combinamos T y H en mismo dataset como “índice visual”
  push(charts.dht, state.t + (state.h/5)); // solo efecto visual

  // Tarjetas KPI superiores también podrían animarse:
  // (aquí las mantenemos con valores de ejemplo fijos)
  if(seed){ /* nada */ }
}

