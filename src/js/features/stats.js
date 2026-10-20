/* =====================================================================
   features/stats.js — Estatística descritiva e correlação.

   Unidades de análise da descritiva:
     'time'  — distribuição MENSAL do indicador agregado no escopo
               (todos os municípios somados, ou o município filtrado);
     'cross' — distribuição ENTRE os 7 municípios no fim do período
               (estoques no último mês; fluxos somados no período).

   Correlação de Pearson (pares completos) em painel município × mês:
     'diff'  — variações mensais (%) dentro de cada município: remove o
               efeito do tamanho do município e da tendência comum;
     'level' — níveis: tende a ser dominada pelo porte dos municípios
               (Osasco é o maior em quase tudo) — use com cautela.
   ===================================================================== */
ODS.stats = (() => {
  const u = ODS.util, D = ODS.data;

  /* Variáveis disponíveis: kind = 'stock' (posição no mês) ou 'flow' (soma no período) */
  const VARS = {
    tot:    { label: 'Famílias no CadÚnico', kind: 'stock', src: 'cad', unit: 'n' },
    pob:    { label: 'Famílias em pobreza', kind: 'stock', src: 'cad', unit: 'n' },
    ext:    { label: 'Famílias em extrema pobreza', note: 'até fev/2023', kind: 'stock', src: 'ext', unit: 'n' },
    br:     { label: 'Famílias de baixa renda', kind: 'stock', src: 'cad', unit: 'n' },
    ac:     { label: 'Famílias acima de 1/2 SM', kind: 'stock', src: 'cad', unit: 'n' },
    pctPob: { label: '% do CadÚnico em pobreza', kind: 'stock', src: 'cad', unit: '%' },
    est:    { label: 'Emprego formal (estoque)', kind: 'stock', src: 'cg', unit: 'n' },
    adm:    { label: 'Admissões', kind: 'flow', src: 'cg', unit: 'n' },
    des:    { label: 'Desligamentos', kind: 'flow', src: 'cg', unit: 'n' },
    sal:    { label: 'Saldo de empregos', kind: 'flow', src: 'cg', unit: 'n' },
    rot:    { label: 'Rotatividade mensal', kind: 'rate', src: 'cg', unit: '%' },
  };
  const CORR_VARS = ['pob', 'ext', 'est', 'br', 'tot'];
  const CORR_SHORT = { pob: 'Pobreza', ext: 'Extrema pobreza', est: 'Emprego formal', br: 'Baixa renda', tot: 'CadÚnico total' };

  /** Valores de uma variável para a unidade de análise escolhida */
  function values(key, mode, P, munis) {
    const v = VARS[key];
    if (mode === 'time') return D.series(key, P.idx, munis);
    // entre municípios (n = 7)
    return D.MUNIS.map(m => {
      if (v.kind === 'flow') return D.sumOver(key, P.cgIdx, [m]);
      if (v.kind === 'rate') return u.mean(D.series(key, P.cgIdx, [m]));
      if (v.src === 'ext') { const i = D.extLastIdx(P.cadLast); return i == null ? null : D.agg('ext', i, [m]); }
      return D.agg(key, v.src === 'cg' ? P.cgLast : P.cadLast, [m]);
    });
  }

  const describeAll = (mode, P, munis) => Object.entries(VARS).map(([k, v]) => ({ key: k, ...v, ...u.describe(values(k, mode, P, munis)) }));

  /** Série por município já transformada (níveis ou variação % mensal) */
  function seriesFor(key, mode, P, m) {
    const s = D.series(key, P.idx, [m]);
    return mode === 'diff' ? ODS.insights.monthlyChanges(s) : s;
  }

  /** Pontos (x, y) empilhando todos os municípios do escopo */
  function pairs(a, b, mode, P, munis) {
    const pts = [];
    munis.forEach(m => {
      const xa = seriesFor(a, mode, P, m), yb = seriesFor(b, mode, P, m);
      xa.forEach((x, k) => { if (u.isNum(x) && u.isNum(yb[k])) pts.push({ x, y: yb[k], m, i: P.idx[k] }); });
    });
    return pts;
  }

  function matrix(mode, P, munis) {
    const r = CORR_VARS.map(a => CORR_VARS.map(b => {
      if (a === b) return { r: 1, n: null };
      const pts = pairs(a, b, mode, P, munis);
      return u.pearson(pts.map(p => p.x), pts.map(p => p.y));
    }));
    return { vars: CORR_VARS, r };
  }

  /** Cor divergente para r ∈ [−1, 1]: azul (negativa) ↔ neutro ↔ tijolo (positiva) */
  function corrColor(r, dark) {
    if (!u.isNum(r)) return dark ? '#2A2F37' : '#EEF0F3';
    const neg = dark ? [127, 166, 214] : [63, 101, 147], pos = dark ? [226, 118, 106] : [156, 43, 43];
    const base = dark ? [42, 47, 55] : [246, 244, 239];
    const t = Math.min(1, Math.abs(r)), c = r < 0 ? neg : pos;
    const mix = base.map((b, k) => Math.round(b + (c[k] - b) * t));
    return `rgb(${mix.join(',')})`;
  }

  /** Cor do texto com o maior contraste sobre o fundo rgb(...) (WCAG) */
  function corrText(rgb) {
    const [r, g, b] = rgb.match(/\d+/g).map(Number).map(v => { v /= 255; return v <= .03928 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4; });
    const L = .2126 * r + .7152 * g + .0722 * b;
    return (1.05 / (L + .05)) >= ((L + .05) / (0.0137 + .05)) ? '#FFFFFF' : '#14181F';
  }

  return { VARS, CORR_VARS, CORR_SHORT, values, describeAll, pairs, matrix, corrColor, corrText };
})();
