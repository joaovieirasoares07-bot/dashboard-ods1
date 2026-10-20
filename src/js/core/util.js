/* =====================================================================
   core/util.js — Utilitários: formatação pt-BR, estatística e DOM.
   Tudo exposto no namespace global ODS (sem dependências externas).
   ===================================================================== */
const ODS = {};

ODS.util = (() => {
  const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
  const nf0 = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 });
  const nf1 = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  const nf2 = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const isNum = v => typeof v === 'number' && isFinite(v);

  /* ---------- Formatação ---------- */
  const fmt = n => isNum(n) ? nf0.format(Math.round(n)) : '—';
  const fmt1 = n => isNum(n) ? nf1.format(n) : '—';
  const fmt2 = n => isNum(n) ? nf2.format(n) : '—';
  const fmtPct = (n, d = 1) => isNum(n) ? (d === 0 ? nf0 : nf1).format(n) + '%' : '—';
  const fmtSigned = (n, suffix = '%') => isNum(n) ? (n > 0 ? '+' : n < 0 ? '−' : '') + nf1.format(Math.abs(n)) + suffix : '—';
  const fmtSignedInt = n => isNum(n) ? (n > 0 ? '+' : n < 0 ? '−' : '') + nf0.format(Math.abs(Math.round(n))) : '—';
  /** Compacto: 1,2 mil / 3,4 mi */
  const fmtCompact = n => {
    if (!isNum(n)) return '—';
    const a = Math.abs(n);
    if (a >= 1e6) return nf1.format(n / 1e6) + ' mi';
    if (a >= 1e4) return nf1.format(n / 1e3) + ' mil';
    return nf0.format(n);
  };
  /** "2024-03" -> "mar/2024" */
  const fmtMes = l => { const [y, m] = l.split('-'); return `${MESES[+m - 1]}/${y}`; };
  /** "2024-03" -> "mar/24" */
  const fmtMesCurto = l => { const [y, m] = l.split('-'); return `${MESES[+m - 1]}/${y.slice(2)}`; };
  /** variação percentual (a vs b) */
  const pct = (a, b) => (isNum(a) && isNum(b) && b !== 0) ? (a - b) / Math.abs(b) * 100 : null;

  /* ---------- Estatística (ignora null) ---------- */
  const clean = arr => arr.filter(isNum);
  const sum = arr => clean(arr).reduce((s, v) => s + v, 0);
  const mean = arr => { const a = clean(arr); return a.length ? sum(a) / a.length : null; };
  /** Quantil com interpolação linear (método 7 — padrão do R e do Excel QUARTIL.INC) */
  const quantile = (arr, q) => {
    const a = clean(arr).sort((x, y) => x - y);
    if (!a.length) return null;
    const pos = (a.length - 1) * q, lo = Math.floor(pos), hi = Math.ceil(pos);
    return a[lo] + (a[hi] - a[lo]) * (pos - lo);
  };
  const median = arr => quantile(arr, .5);
  /** Desvio padrão amostral (n − 1) */
  const std = arr => {
    const a = clean(arr); if (a.length < 2) return null;
    const m = mean(a);
    return Math.sqrt(a.reduce((s, v) => s + (v - m) ** 2, 0) / (a.length - 1));
  };
  const describe = arr => {
    const a = clean(arr);
    return {
      n: a.length, mean: mean(a), median: median(a), std: std(a),
      min: a.length ? Math.min(...a) : null, max: a.length ? Math.max(...a) : null,
      q1: quantile(a, .25), q3: quantile(a, .75),
      cv: (a.length > 1 && mean(a)) ? std(a) / Math.abs(mean(a)) * 100 : null,
    };
  };
  /** Correlação de Pearson com pares completos; retorna {r, n} */
  const pearson = (x, y) => {
    const px = [], py = [];
    for (let i = 0; i < x.length; i++) if (isNum(x[i]) && isNum(y[i])) { px.push(x[i]); py.push(y[i]); }
    const n = px.length; if (n < 3) return { r: null, n };
    const mx = mean(px), my = mean(py);
    let sxy = 0, sxx = 0, syy = 0;
    for (let i = 0; i < n; i++) { const dx = px[i] - mx, dy = py[i] - my; sxy += dx * dy; sxx += dx * dx; syy += dy * dy; }
    return { r: (sxx && syy) ? sxy / Math.sqrt(sxx * syy) : null, n };
  };
  /** Regressão linear simples y = a + b·x (mínimos quadrados) */
  const linreg = (x, y) => {
    const px = [], py = [];
    for (let i = 0; i < x.length; i++) if (isNum(x[i]) && isNum(y[i])) { px.push(x[i]); py.push(y[i]); }
    if (px.length < 2) return null;
    const mx = mean(px), my = mean(py);
    let sxy = 0, sxx = 0;
    px.forEach((v, i) => { sxy += (v - mx) * (py[i] - my); sxx += (v - mx) ** 2; });
    const b = sxx ? sxy / sxx : 0;
    return { a: my - b * mx, b };
  };
  /** Classificação textual da força de |r| (Cohen, 1988) */
  const corrStrength = r => {
    if (!isNum(r)) return 'indefinida';
    const a = Math.abs(r);
    return a < .1 ? 'desprezível' : a < .3 ? 'fraca' : a < .5 ? 'moderada' : 'forte';
  };

  /* ---------- DOM ---------- */
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const icon = (name, cls = '') => `<svg class="ic ${cls}" aria-hidden="true"><use href="#i-${name}"/></svg>`;
  const debounce = (fn, ms = 120) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };
  /** Preenche um <select> com [{value,label}] preservando a seleção atual quando possível */
  const fillSelect = (sel, options, value) => {
    const cur = value ?? sel.value;
    sel.innerHTML = options.map(o => `<option value="${esc(o.value)}">${esc(o.label)}</option>`).join('');
    if (options.some(o => o.value === cur)) sel.value = cur;
  };
  /** localStorage seguro (pode falhar em modo privado / iframe) */
  const store = {
    get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* ignora */ } },
  };
  const reducedMotion = () => window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;

  return {
    MESES, isNum, fmt, fmt1, fmt2, fmtPct, fmtSigned, fmtSignedInt, fmtCompact, fmtMes, fmtMesCurto, pct,
    sum, mean, median, quantile, std, describe, pearson, linreg, corrStrength,
    $, $$, esc, icon, debounce, fillSelect, store, reducedMotion,
  };
})();
