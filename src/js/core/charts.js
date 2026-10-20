/* =====================================================================
   core/charts.js — Fábrica de gráficos sobre o Chart.js 4.

   upsert(id, config, resumo):
     - cria o gráfico na primeira vez;
     - nas próximas, ATUALIZA dados/opções do mesmo objeto (sem destruir),
       o que economiza memória e evita "piscar";
     - grava um resumo textual em aria-label (leitores de tela).
   Também registra um plugin próprio de boxplot (barras flutuantes Q1–Q3
   + bigodes mín–máx + mediana + média), evitando dependências extras.
   ===================================================================== */
ODS.charts = (() => {
  const { fmt, fmtPct, isNum } = ODS.util;
  const registry = new Map();
  const available = () => typeof Chart !== 'undefined';

  /* ---------- Plugin de boxplot ---------- */
  const boxPlugin = {
    id: 'odsBox',
    afterDatasetsDraw(chart) {
      const { ctx, scales: { y } } = chart;
      chart.data.datasets.forEach((ds, di) => {
        if (!ds.boxStats) return;
        const meta = chart.getDatasetMeta(di);
        if (meta.hidden) return;
        const col = ds.whiskerColor || '#333';
        meta.data.forEach((el, i) => {
          const st = ds.boxStats[i]; if (!st || !isNum(st.min)) return;
          const x = el.x, w = el.width * 0.5;
          const py = v => y.getPixelForValue(v);
          ctx.save();
          ctx.strokeStyle = col; ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.moveTo(x, py(st.q3)); ctx.lineTo(x, py(st.max));
          ctx.moveTo(x - w / 2, py(st.max)); ctx.lineTo(x + w / 2, py(st.max));
          ctx.moveTo(x, py(st.q1)); ctx.lineTo(x, py(st.min));
          ctx.moveTo(x - w / 2, py(st.min)); ctx.lineTo(x + w / 2, py(st.min));
          ctx.stroke();
          ctx.lineWidth = 2.5; ctx.beginPath();
          ctx.moveTo(x - el.width / 2, py(st.median)); ctx.lineTo(x + el.width / 2, py(st.median)); ctx.stroke();
          if (isNum(st.mean)) { // média: losango
            const my = py(st.mean); ctx.fillStyle = ds.meanColor || '#fff'; ctx.lineWidth = 1.2;
            ctx.beginPath(); ctx.moveTo(x, my - 5); ctx.lineTo(x + 5, my); ctx.lineTo(x, my + 5); ctx.lineTo(x - 5, my); ctx.closePath(); ctx.fill(); ctx.stroke();
          }
          ctx.restore();
        });
      });
    },
  };

  /* ---------- Padrões visuais (dependem do tema) ---------- */
  function applyDefaults() {
    if (!available()) return;
    const c = ODS.theme.colors();
    const d = Chart.defaults;
    d.font.family = "'IBM Plex Sans', system-ui, sans-serif";
    const big = document.body.classList.contains('presenting'); // projetor: letras maiores
    d.font.size = big ? 14 : 11.5;
    d.color = c.ink3;
    d.borderColor = c.grid;
    d.animation.duration = ODS.util.reducedMotion() ? 0 : 450;
    d.plugins.legend.labels.usePointStyle = true;
    d.plugins.legend.labels.pointStyle = 'circle';
    d.plugins.legend.labels.boxWidth = 8;
    d.plugins.legend.labels.boxHeight = 8;
    d.plugins.legend.labels.padding = 14;
    d.plugins.legend.labels.color = c.ink2;
    const t = d.plugins.tooltip;
    t.backgroundColor = c.dark ? '#262A31' : '#1C2330';
    t.titleColor = '#fff'; t.bodyColor = '#E8E6E1';
    t.borderColor = c.dark ? '#3A404A' : 'transparent'; t.borderWidth = 1;
    t.padding = 10; t.cornerRadius = 8; t.boxPadding = 4; t.usePointStyle = true;
    t.titleFont = { weight: '600' };
  }

  /* ---------- Criar ou atualizar ---------- */
  function upsert(id, config, summary) {
    const canvas = document.getElementById(id);
    if (!canvas) return null;
    if (summary) { canvas.setAttribute('role', 'img'); canvas.setAttribute('aria-label', summary); }
    if (!available()) {
      const wrap = canvas.parentElement;
      if (wrap && !wrap.querySelector('.chart-fallback')) wrap.insertAdjacentHTML('beforeend', '<p class="chart-fallback">Não foi possível carregar a biblioteca de gráficos.</p>');
      return null;
    }
    const prev = registry.get(id);
    if (prev && prev.config.type === config.type && prev.canvas === canvas) {
      prev.data = config.data;
      prev.options = config.options;
      prev.update();
      return prev;
    }
    if (prev) prev.destroy();
    config.plugins = [...(config.plugins || []), boxPlugin];
    const ch = new Chart(canvas, config);
    registry.set(id, ch);
    return ch;
  }

  const resizeAll = () => registry.forEach(ch => { try { ch.resize(); } catch (e) { /* ignora */ } });

  /* ---------- Construtores de opções ---------- */
  const yTick = unit => v => unit === '%' ? fmtPct(v, 0) : unit === 'idx' ? fmt(v) : ODS.util.fmtCompact(v);
  const tipVal = (unit, v) => unit === '%' ? fmtPct(v) : unit === 'idx' ? ODS.util.fmt1(v) : fmt(v);

  function lineOptions({ unit = 'n', yTitle, stacked = false, legend = true } = {}) {
    const c = ODS.theme.colors();
    return {
      responsive: true, maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      elements: { point: { radius: 0, hoverRadius: 4, hitRadius: 8 }, line: { tension: .28, borderWidth: 2 } },
      plugins: {
        legend: { display: legend, position: 'bottom' },
        tooltip: { callbacks: { label: ctx => ` ${ctx.dataset.label}: ${tipVal(ctx.dataset.unit || unit, ctx.parsed.y)}` } },
      },
      scales: {
        x: { grid: { display: false }, ticks: { maxTicksLimit: 8, maxRotation: 0, color: c.ink3 }, border: { color: c.line } },
        y: { stacked, grid: { color: c.grid }, border: { display: false }, ticks: { color: c.ink3, callback: yTick(unit), maxTicksLimit: 6 },
             title: yTitle ? { display: true, text: yTitle, color: c.ink3 } : undefined },
      },
    };
  }

  function barOptions({ horizontal = false, unit = 'n', legend = false, valueFmt } = {}) {
    const c = ODS.theme.colors();
    const vAxis = horizontal ? 'x' : 'y', cAxis = horizontal ? 'y' : 'x';
    const f = valueFmt || (v => tipVal(unit, v));
    return {
      indexAxis: horizontal ? 'y' : 'x',
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { display: legend, position: 'bottom' },
        tooltip: { callbacks: { label: ctx => ` ${ctx.dataset.label ? ctx.dataset.label + ': ' : ''}${f(horizontal ? ctx.parsed.x : ctx.parsed.y)}` } },
      },
      scales: {
        [vAxis]: { grid: { color: c.grid }, border: { display: false }, ticks: { color: c.ink3, callback: yTick(unit), maxTicksLimit: 6 } },
        [cAxis]: { grid: { display: false }, border: { color: c.line }, ticks: { color: c.ink2, font: { size: 11.5 } } },
      },
    };
  }

  /** Dataset de linha padronizado */
  const line = (label, data, color, extra = {}) => ({
    label, data, borderColor: color, backgroundColor: color, pointBackgroundColor: color,
    spanGaps: true, fill: false, ...extra,
  });
  /** Preenchimento suave sob a linha (gradiente) */
  const areaFill = (color) => (ctx) => {
    const { chart } = ctx; const { ctx: g, chartArea } = chart;
    if (!chartArea) return 'transparent';
    const grad = g.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
    grad.addColorStop(0, hexA(color, .22)); grad.addColorStop(1, hexA(color, 0));
    return grad;
  };
  /** Cor hex + alpha */
  function hexA(hex, a) {
    const h = hex.replace('#', '');
    if (h.length !== 6) return hex;
    const n = parseInt(h, 16);
    return `rgba(${n >> 16 & 255},${n >> 8 & 255},${n & 255},${a})`;
  }
  /** Cor categórica fixa por município (consistente em todo o dashboard) */
  const muniColor = m => ODS.theme.colors().cat[DATA.municipios.indexOf(m) % 7];

  return { available, applyDefaults, upsert, resizeAll, lineOptions, barOptions, line, areaFill, hexA, muniColor, registry };
})();
