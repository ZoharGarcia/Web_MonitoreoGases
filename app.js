// ------ Utilidades ------
const fmt = (n, d=0) => Number(n).toFixed(d);
const nowStr = () => new Date().toLocaleTimeString();

// ------ Estado ------
let running = true;
const MAX_POINTS = 40;
const history = [];

// Semillas para datos pseudoaleatorios con algo de suavizado
let sCO = 15, sIAQ = 80, sLPG = 60, sT = 28, sH = 55;

function jitter(base, step, min, max) {
  base += (Math.random() - 0.5) * step;
  return Math.max(min, Math.min(max, base));
}

function comfortIndex(t, h) {
  // Índice ficticio 0-100
  const idealT = 24, idealH = 50;
  const dt = Math.abs(t - idealT);
  const dh = Math.abs(h - idealH);
  return Math.max(0, 100 - (dt*3 + dh*1.4));
}

// ------ DOM ------
const el = {
  kpiCO: document.getElementById('kpiCO'),
  kpiIAQ: document.getElementById('kpiIAQ'),
  kpiLPG: document.getElementById('kpiLPG'),
  kpiTemp: document.getElementById('kpiTemp'),
  kpiHum: document.getElementById('kpiHum'),
  barCO: document.getElementById('barCO'),
  barIAQ: document.getElementById('barIAQ'),
  barLPG: document.getElementById('barLPG'),
  barComfort: document.getElementById('barComfort'),
  kpiCOTrend: document.getElementById('kpiCOTrend'),
  kpiIAQTrend: document.getElementById('kpiIAQTrend'),
  kpiLPGTrend: document.getElementById('kpiLPGTrend'),
  lastUpdate: document.getElementById('lastUpdate'),
  historyBody: document.getElementById('historyBody'),
  alertList: document.getElementById('alertList'),
  statusBadge: document.getElementById('statusBadge'),
  btnPausa: document.getElementById('btnPausa'),
  btnReiniciar: document.getElementById('btnReiniciar'),
  toggleTheme: document.getElementById('toggleTheme'),
  btnExport: document.getElementById('btnExport'),
};

// ------ Chart.js ------
const ctx = document.getElementById('lineChart');
const chart = new Chart(ctx, {
  type: 'line',
  data: {
    labels: [],
    datasets: [
      { label: 'CO (ppm)', data: [], borderWidth: 2, tension: .35 },
      { label: 'IAQ', data: [], borderWidth: 2, tension: .35 },
      { label: 'LPG (ppm)', data: [], borderWidth: 2, tension: .35 },
      { label: 'Temp (°C)', data: [], borderWidth: 2, tension: .35 },
      { label: 'Hum (%)', data: [], borderWidth: 2, tension: .35 },
    ]
  },
  options: {
    animation: false,
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { labels: { color: '#cbd5e1', boxWidth: 10 } },
      tooltip: { callbacks: { label: (ctx) => `${ctx.dataset.label}: ${fmt(ctx.parsed.y, 1)}` } }
    },
    scales: {
      x: { ticks: { color: '#94a3b8' }, grid: { color: 'rgba(148,163,184,.15)' } },
      y: { ticks: { color: '#94a3b8' }, grid: { color: 'rgba(148,163,184,.15)' } }
    }
  }
});

function pushChartPoint(co, iaq, lpg, temp, hum) {
  const labels = chart.data.labels;
  const ds = chart.data.datasets;
  labels.push(nowStr());
  ds[0].data.push(co);
  ds[1].data.push(iaq);
  ds[2].data.push(lpg);
  ds[3].data.push(temp);
  ds[4].data.push(hum);
  if (labels.length > MAX_POINTS) {
    labels.shift();
    ds.forEach(d => d.data.shift());
  }
  chart.update();
}

function addHistoryRow(row) {
  history.unshift(row);
  if (history.length > 25) history.pop();
  el.historyBody.innerHTML = history.map(r => `
    <tr>
      <td>${r.time}</td>
      <td>${fmt(r.co,1)}</td>
      <td>${fmt(r.iaq,0)}</td>
      <td>${fmt(r.lpg,1)}</td>
      <td>${fmt(r.temp,1)}</td>
      <td>${fmt(r.hum,0)}</td>
    </tr>
  `).join('');
}

function pushAlertIfNeeded({co, iaq, lpg}) {
  const items = [];
  if (co > 35) items.push({txt:`CO alto: ${fmt(co,1)} ppm`, cls:'alert--red'});
  if (lpg > 100) items.push({txt:`Gas LP elevado: ${fmt(lpg,1)} ppm`, cls:'alert--amber'});
  if (iaq < 60) items.push({txt:`Calidad de aire deficiente: IAQ ${fmt(iaq,0)}`, cls:'alert--yellow'});
  for (const it of items) {
    const li = document.createElement('li');
    li.className = it.cls;
    li.innerHTML = `<span>${it.txt}</span><span class="tiny muted">${nowStr()}</span>`;
    el.alertList.prepend(li);
    while (el.alertList.children.length > 6) el.alertList.lastChild.remove();
  }
}

function updateKPIs({co, iaq, lpg, temp, hum}, prev) {
  el.kpiCO.textContent = fmt(co,1);
  el.kpiIAQ.textContent = fmt(iaq,0);
  el.kpiLPG.textContent = fmt(lpg,1);
  el.kpiTemp.textContent = fmt(temp,1);
  el.kpiHum.textContent = fmt(hum,0);

  el.barCO.style.width = Math.min(100, co*2.0) + '%';
  el.barIAQ.style.width = Math.max(0, Math.min(100, iaq)) + '%';
  el.barLPG.style.width = Math.min(100, lpg) + '%';
  el.barComfort.style.width = Math.max(0, Math.min(100, comfortIndex(temp, hum))) + '%';

  const trend = (val, prev) => (prev ? ((val - prev)/Math.max(1e-6, prev))*100 : 0);
  el.kpiCOTrend.textContent = `${trend(co, prev?.co).toFixed(1)}%`;
  el.kpiIAQTrend.textContent = `${trend(iaq, prev?.iaq).toFixed(1)}%`;
  el.kpiLPGTrend.textContent = `${trend(lpg, prev?.lpg).toFixed(1)}%`;
}

// ------ Loop de simulación ------
let prevSample = null;
function sample() {
  sCO  = jitter(sCO, 4.2,  2, 120);
  sIAQ = jitter(sIAQ, 2.5, 30, 100);
  sLPG = jitter(sLPG, 6.0,  5, 220);
  sT   = jitter(sT, 0.5,  18,  36);
  sH   = jitter(sH, 1.8,  25,  95);

  const point = { co: sCO, iaq: sIAQ, lpg: sLPG, temp: sT, hum: sH, time: nowStr() };
  updateKPIs(point, prevSample);
  pushChartPoint(point.co, point.iaq, point.lpg, point.temp, point.hum);
  addHistoryRow(point);
  pushAlertIfNeeded(point);
  el.lastUpdate.textContent = nowStr();
  prevSample = point;
}

let timer = setInterval(() => { if (running) sample(); }, 1200);

// ------ Controles ------
el.btnPausa.addEventListener('click', () => {
  running = !running;
  el.btnPausa.textContent = running ? 'Pausar' : 'Reanudar';
  el.statusBadge.textContent = running ? 'En línea' : 'Pausado';
  el.statusBadge.className = running ? 'badge badge--ok' : 'badge badge--pause';
});

el.btnReiniciar.addEventListener('click', () => {
  chart.data.labels = [];
  chart.data.datasets.forEach(d => d.data = []);
  chart.update();
  el.alertList.innerHTML = '';
  el.historyBody.innerHTML = '';
  prevSample = null;
});

let light = false;
el.toggleTheme.addEventListener('click', () => {
  light = !light;
  document.body.classList.toggle('light', light);
});

el.btnExport.addEventListener('click', () => {
  alert('Demo: aquí podrías exportar CSV/PNG. En esta simulación solo mostramos este aviso.');
});

// Semilla inicial
for (let i=0;i<12;i++) sample();
