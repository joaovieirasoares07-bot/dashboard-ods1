/* =====================================================================
   features/kpis.js — Indicadores-chave (KPIs).

   Regra de comparação ("período anterior"):
     estoques (famílias, empregos): mesmo mês do ano anterior (t − 12);
       se não existir (ex.: filtro 2021), compara com o 1º mês da série.
     fluxos (saldo): mesma janela de meses deslocada 12 meses para trás.
   Cor: verde = melhora, vermelho = piora, conforme a polaridade do indicador
   (ex.: menos pobreza = melhora; mais empregos = melhora).
   ===================================================================== */
ODS.kpis = (() => {
  const u = ODS.util, D = ODS.data;
  const { fmt, fmtPct, fmtMes, fmtSigned, fmtSignedInt, pct, icon, isNum } = u;

  /** Índice de comparação para um estoque no mês i */
  function compareIdx(key, i, munis) {
    if (i == null) return null;
    const j = i - 12;
    if (j >= 0 && D.agg(key, j, munis) != null) return { j, kind: 'yoy' };
    const first = D.L.findIndex((_, k) => D.agg(key, k, munis) != null);
    return (first >= 0 && first < i) ? { j: first, kind: 'base' } : null;
  }

  /** Tom (cor) a partir da variação e da polaridade */
  function tone(delta, polarity) {
    if (!isNum(delta) || !polarity || Math.abs(delta) < 0.05) return 'neutral';
    return delta * polarity > 0 ? 'good' : 'bad';
  }

  /** Chip de variação: ▲/▼ valor */
  function chip(delta, unit, polarity) {
    if (!isNum(delta)) return '';
    const t = tone(delta, polarity);
    const arrow = Math.abs(delta) < 0.05 ? 'minus' : delta > 0 ? 'arrow-up-right' : 'arrow-down-right';
    const txt = unit === 'pp' ? fmtSigned(delta, ' p.p.') : unit === 'int' ? fmtSignedInt(delta) : fmtSigned(delta);
    const word = t === 'good' ? 'melhora' : t === 'bad' ? 'piora' : 'estável';
    return `<span class="chip ${t}" title="${word}">${icon(arrow)}${txt}<span class="sr-only"> (${word})</span></span>`;
  }

  /** HTML de um card de KPI */
  function card({ ic, label, value, suffix = '', delta, unit = '%', polarity = 0, vs, foot, toneOverride }) {
    const t = toneOverride || (isNum(delta) ? tone(delta, polarity) : 'brand');
    const deltaHtml = isNum(delta) ? `<p class="kpi-delta">${chip(delta, unit, polarity)}<span>${vs || ''}</span></p>`
      : (vs ? `<p class="kpi-delta"><span>${vs}</span></p>` : '');
    return `<article class="kpi tone-${t}">
      <div class="kpi-top"><span class="kpi-icon">${icon(ic)}</span><span class="kpi-label">${label}</span></div>
      <p class="kpi-value">${value}${suffix ? `<small>${suffix}</small>` : ''}</p>
      ${deltaHtml}
      ${foot ? `<p class="kpi-foot">${foot}</p>` : ''}
    </article>`;
  }

  /** Card de estoque com comparação automática */
  function stockCard({ key, i, munis, label, ic, polarity, unit = '%', valueFmt = fmt, extraFoot }) {
    const v = D.agg(key, i, munis);
    const c = compareIdx(key, i, munis);
    let delta = null, vs = 'sem período anterior';
    if (c) {
      const p = D.agg(key, c.j, munis);
      delta = unit === 'pp' ? v - p : pct(v, p);
      vs = `vs ${fmtMes(D.L[c.j])}${c.kind === 'base' ? ' (início da série)' : ''}`;
    }
    return card({ ic, label, value: valueFmt(v), delta, unit, polarity, vs, foot: extraFoot || `Posição em ${fmtMes(D.L[i])}` });
  }

  /** Os 8 KPIs da página executiva */
  function execCards(P, munis) {
    const out = [];
    out.push(stockCard({ key: 'tot', i: P.cadLast, munis, label: 'Famílias no CadÚnico', ic: 'users', polarity: -1 }));
    out.push(stockCard({ key: 'pob', i: P.cadLast, munis, label: 'Famílias em situação de pobreza', ic: 'triangle-alert', polarity: -1 }));

    // Extrema pobreza: série só existe até fev/2023
    const ei = D.extLastIdx(P.cadLast);
    if (ei != null && D.agg('ext', ei, munis) != null) {
      const discont = ei < P.cadLast;
      out.push(stockCard({ key: 'ext', i: ei, munis, label: 'Famílias em extrema pobreza', ic: 'hand-coins', polarity: -1,
        extraFoot: discont ? `Último dado: ${fmtMes(D.L[ei])} — desde mar/2023 a faixa está somada à pobreza` : `Posição em ${fmtMes(D.L[ei])}` }));
    } else {
      out.push(card({ ic: 'hand-coins', label: 'Famílias em extrema pobreza', value: '—', foot: 'Sem dado no período' }));
    }

    out.push(stockCard({ key: 'pctPob', i: P.cadLast, munis, label: '% das famílias do CadÚnico em pobreza', ic: 'scale', polarity: -1, unit: 'pp',
      valueFmt: v => fmtPct(v) }));
    out.push(stockCard({ key: 'est', i: P.cgLast, munis, label: 'Empregos formais (estoque)', ic: 'briefcase', polarity: 1 }));

    // Saldo: janela do período (ano) ou últimos 12 meses; compara com a mesma janela 12 meses antes
    const win = P.ano ? P.cgIdx : D.L.map((_, k) => k).filter(k => k <= P.cgLast && k > P.cgLast - 12);
    const prevWin = win.map(k => k - 12);
    const s = D.sumOver('sal', win, munis);
    const sPrev = prevWin.every(k => k >= 0) ? D.sumOver('sal', prevWin, munis) : null;
    const winLbl = `${fmtMes(D.L[win[0]])}–${fmtMes(D.L[win[win.length - 1]])}`;
    out.push(card({ ic: 'trending-up', label: P.ano ? `Saldo de empregos em ${P.ano}` : 'Saldo de empregos (12 meses)',
      value: fmtSignedInt(s), delta: sPrev != null ? s - sPrev : null, unit: 'int', polarity: 1,
      vs: sPrev != null ? `vs ${fmtSignedInt(sPrev)} um ano antes` : 'sem período anterior', foot: `Admissões − desligamentos, ${winLbl}` }));

    const n = munis.length;
    out.push(card({ ic: 'building-2', label: 'Municípios analisados', value: n === 7 ? '7' : `${n}`, suffix: n === 7 ? '' : ' de 7',
      vs: n === 7 ? 'Todos os municípios do recorte' : munis[0], foot: `${fmt(D.ipvsTotal(munis))} domicílios no IPVS 2022`, toneOverride: 'brand' }));

    const months = P.idx.length;
    out.push(card({ ic: 'calendar-range', label: 'Período analisado', value: `${months}`, suffix: ' meses',
      vs: `${fmtMes(D.L[P.idx[0]])} – ${fmtMes(D.L[P.idx[months - 1]])}`,
      foot: `CadÚnico até ${fmtMes(D.L[P.cadLast])} · CAGED até ${fmtMes(D.L[P.cgLast])}`, toneOverride: 'brand' }));
    return out.join('');
  }

  /** Card dos painéis originais: valor + variação vs. início do período */
  function panelCard({ ic, label, value, base, baseLbl, polarity = 0, foot, sub }) {
    const delta = isNum(base) ? pct(value, base) : null;
    return card({ ic, label, value: fmt(value), delta, polarity,
      vs: isNum(delta) ? `em relação a ${baseLbl}` : sub, foot, toneOverride: isNum(delta) ? null : 'brand' });
  }

  return { card, chip, tone, compareIdx, execCards, panelCard };
})();
