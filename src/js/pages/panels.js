/* =====================================================================
   pages/panels.js — Painéis originais do dashboard, preservados:
     Visão Geral · Vulnerabilidade Social · Mercado de Trabalho · Análise Integrada
   Os cálculos são os mesmos da versão anterior; mudou apenas a apresentação
   (cards no novo padrão, gráficos atualizados sem recriação, cores do tema).
   ===================================================================== */
ODS.pages.panels = (() => {
  const u = ODS.util, D = ODS.data, S = ODS.state, CH = ODS.charts, K = ODS.kpis;
  const { $, $$, fmt, fmtPct, fmtMes, fmtMesCurto, fmtSigned, pct, esc } = u;

  /** Atualiza os subtítulos dinâmicos (data-sub) dentro de uma página */
  function subs(pageId, P) {
    const mun = S.get().muni || 'Soma dos 7 municípios';
    const L = D.L;
    const text = {
      mun: `${mun}, por mês`,
      cadMes: `Mês mais recente do período (${fmtMes(L[P.cadLast])})`,
      cgMes: `Mês mais recente do período (${fmtMes(L[P.cgLast])})`,
      faixa: `${mun}, ${fmtMes(L[P.cadLast])}`,
      indice: `${mun} · índice, ${fmtMes(L[P.idx[0]])} = 100`,
      integ: `Crescimento por município (${fmtMes(L[P.cadFirst])} → ${fmtMes(L[P.cadLast])})`,
    };
    $$(`#page-${pageId} [data-sub]`).forEach(e => { e.textContent = text[e.dataset.sub] || ''; });
  }
  const labelsOf = idx => idx.map(i => fmtMesCurto(D.L[i]));

  /** Barras horizontais por município (destaca o filtrado) */
  function barByMuni(id, key, i, colorFn, label) {
    const c = ODS.theme.colors(), sel = S.get().muni;
    const val = m => D.agg(key, i, [m]);
    const sorted = [...D.MUNIS].sort((a, b) => val(b) - val(a));
    CH.upsert(id, {
      type: 'bar',
      data: { labels: sorted, datasets: [{ label, data: sorted.map(val), backgroundColor: sorted.map(m => sel && sel !== m ? c.muted : colorFn(val(m), c)), borderRadius: 4, maxBarThickness: 26 }] },
      options: CH.barOptions({ horizontal: true }),
    }, `${label} por município em ${fmtMes(D.L[i])}. Maior: ${sorted[0]} (${fmt(val(sorted[0]))}); menor: ${sorted[sorted.length - 1]} (${fmt(val(sorted[sorted.length - 1]))}).`);
  }

  /* ---------------- Visão Geral ---------------- */
  function renderGeral() {
    const P = S.period(), M = S.munis(), L = D.L, c = ODS.theme.colors();
    const cBase = fmtMes(L[P.cadFirst]), gBase = fmtMes(L[P.cgFirst]);
    const perLbl = P.ano || `jan/2021 a ${fmtMes(L[P.cgLast])}`;
    $('#cards-geral').innerHTML =
      K.panelCard({ ic: 'users', label: `Famílias no CadÚnico (${fmtMes(L[P.cadLast])})`, value: D.agg('tot', P.cadLast, M), base: D.agg('tot', P.cadFirst, M), baseLbl: cBase, polarity: -1 }) +
      K.panelCard({ ic: 'hand-coins', label: `Famílias de baixa renda (${fmtMes(L[P.cadLast])})`, value: D.agg('br', P.cadLast, M), base: D.agg('br', P.cadFirst, M), baseLbl: cBase, polarity: -1 }) +
      K.panelCard({ ic: 'briefcase', label: `Estoque de empregos (${fmtMes(L[P.cgLast])})`, value: D.agg('est', P.cgLast, M), base: D.agg('est', P.cgFirst, M), baseLbl: gBase, polarity: 1 }) +
      K.card({ ic: 'trending-up', label: 'Saldo de empregos acumulado', value: u.fmtSignedInt(D.sumOver('sal', P.idx, M)), vs: `Soma do período: ${perLbl}`, toneOverride: D.sumOver('sal', P.idx, M) >= 0 ? 'good' : 'bad' }) +
      // indicadores de pobreza (acrescentados para a narrativa da apresentação)
      K.panelCard({ ic: 'triangle-alert', label: `Famílias em pobreza (${fmtMes(L[P.cadLast])})`, value: D.agg('pob', P.cadLast, M), base: D.agg('pob', P.cadFirst, M), baseLbl: cBase, polarity: -1 }) +
      K.card({ ic: 'scale', label: `% das famílias do CadÚnico em pobreza`, value: fmtPct(D.agg('pctPob', P.cadLast, M)),
        delta: D.agg('pctPob', P.cadLast, M) - D.agg('pctPob', P.cadFirst, M), unit: 'pp', polarity: -1, vs: `em relação a ${cBase}`, foot: `Posição em ${fmtMes(L[P.cadLast])}` });
    subs('geral', P);

    const idx = D.trimTail(P.idx, 'pob');
    const tot = D.series('tot', idx, M), pob = D.series('pob', idx, M), br = D.series('br', idx, M);
    CH.upsert('chartCadLine', {
      type: 'line',
      data: { labels: labelsOf(idx), datasets: [
        CH.line('Total CadÚnico', tot, c.brand, { borderWidth: 2.6, fill: 'origin', backgroundColor: CH.areaFill(c.brand) }),
        CH.line('Pobreza', pob, c.gold),
        CH.line('Baixa renda', br, c.blue),
      ] },
      options: CH.lineOptions(),
    }, `Famílias no CadÚnico de ${fmtMes(L[idx[0]])} a ${fmtMes(L[idx[idx.length - 1]])}: total passou de ${fmt(tot[0])} para ${fmt(tot[tot.length - 1])}.`);

    const idg = D.trimTail(P.idx, 'est');
    CH.upsert('chartCagedLine', {
      type: 'line',
      data: { labels: labelsOf(idg), datasets: [
        CH.line('Admissões', D.series('adm', idg, M), c.sage),
        CH.line('Desligamentos', D.series('des', idg, M), c.brand),
        CH.line('Saldo', D.series('sal', idg, M), c.ink, { borderDash: [5, 4], borderWidth: 1.6 }),
      ] },
      options: CH.lineOptions(),
    }, `Admissões, desligamentos e saldo mensais do CAGED, ${fmtMes(L[idg[0]])} a ${fmtMes(L[idg[idg.length - 1]])}.`);
  }

  /* ---------------- Vulnerabilidade Social ---------------- */
  function renderVuln() {
    const P = S.period(), M = S.munis(), L = D.L, c = ODS.theme.colors();
    const cBase = fmtMes(L[P.cadFirst]), F = P.cadFirst, Lt = P.cadLast;
    $('#cards-vuln').innerHTML =
      K.panelCard({ ic: 'triangle-alert', label: 'Famílias em pobreza', value: D.agg('pob', Lt, M), base: D.agg('pob', F, M), baseLbl: cBase, polarity: -1 }) +
      K.panelCard({ ic: 'hand-coins', label: 'Famílias de baixa renda', value: D.agg('br', Lt, M), base: D.agg('br', F, M), baseLbl: cBase, polarity: -1 }) +
      K.panelCard({ ic: 'users-round', label: 'Famílias acima de 1/2 SM', value: D.agg('ac', Lt, M), base: D.agg('ac', F, M), baseLbl: cBase, polarity: 0 }) +
      K.panelCard({ ic: 'users', label: 'Total no CadÚnico', value: D.agg('tot', Lt, M), base: D.agg('tot', F, M), baseLbl: cBase, polarity: -1 });
    subs('vuln', P);

    barByMuni('chartVulnBar', 'pob', Lt, (v, cc) => cc.brand, 'Famílias em pobreza');
    const vals = [D.agg('pob', Lt, M), D.agg('br', Lt, M), D.agg('ac', Lt, M)];
    CH.upsert('chartFaixaBar', {
      type: 'bar',
      data: { labels: ['Pobreza', 'Baixa renda', 'Acima 1/2 SM'], datasets: [{ label: 'Famílias', data: vals, backgroundColor: [c.brand, c.gold, c.blue], borderRadius: 6, maxBarThickness: 72 }] },
      options: CH.barOptions(),
    }, `Famílias por faixa de renda em ${fmtMes(L[Lt])}: pobreza ${fmt(vals[0])}, baixa renda ${fmt(vals[1])}, acima de meio salário mínimo ${fmt(vals[2])}.`);

    // Tabela por município
    const sel = S.get().muni; let tP = 0, tB = 0, tA = 0, h = '';
    D.MUNIS.forEach(m => {
      const p = D.agg('pob', Lt, [m]), b = D.agg('br', Lt, [m]), a = D.agg('ac', Lt, [m]);
      h += `<tr${sel === m ? ' class="hl"' : ''}><th scope="row">${esc(m)}</th><td>${fmt(p)}</td><td>${fmt(b)}</td><td>${fmt(a)}</td><td>${(p / (p + b + a) * 100).toFixed(0)}%</td></tr>`;
      tP += p; tB += b; tA += a;
    });
    h += `<tr class="total"><th scope="row">Total</th><td>${fmt(tP)}</td><td>${fmt(tB)}</td><td>${fmt(tA)}</td><td>${(tP / (tP + tB + tA) * 100).toFixed(0)}%</td></tr>`;
    $('#tableVuln tbody').innerHTML = h;
  }

  /* ---------------- Mercado de Trabalho ---------------- */
  function renderTrab() {
    const P = S.period(), M = S.munis(), L = D.L, c = ODS.theme.colors();
    const perLbl = P.ano || `jan/2021 a ${fmtMes(L[P.cgLast])}`;
    const sum = k => D.sumOver(k, P.idx, M);
    const saldo = sum('sal');
    $('#cards-trab').innerHTML =
      K.panelCard({ ic: 'briefcase', label: `Estoque de empregos (${fmtMes(L[P.cgLast])})`, value: D.agg('est', P.cgLast, M), base: D.agg('est', P.cgFirst, M), baseLbl: fmtMes(L[P.cgFirst]), polarity: 1 }) +
      K.card({ ic: 'arrow-up-right', label: 'Admissões no período', value: fmt(sum('adm')), vs: perLbl, toneOverride: 'good' }) +
      K.card({ ic: 'arrow-down-right', label: 'Desligamentos no período', value: fmt(sum('des')), vs: perLbl, toneOverride: 'bad' }) +
      K.card({ ic: 'trending-up', label: 'Saldo no período', value: u.fmtSignedInt(saldo), vs: perLbl, toneOverride: saldo >= 0 ? 'good' : 'bad' });
    subs('trab', P);

    const idg = D.trimTail(P.idx, 'est');
    CH.upsert('chartAdmDesl', {
      type: 'line',
      data: { labels: labelsOf(idg), datasets: [
        CH.line('Admissões', D.series('adm', idg, M), c.sage, { fill: 'origin', backgroundColor: CH.areaFill(c.sage) }),
        CH.line('Desligamentos', D.series('des', idg, M), c.brand),
      ] },
      options: CH.lineOptions(),
    }, `Admissões e desligamentos mensais, ${fmtMes(L[idg[0]])} a ${fmtMes(L[idg[idg.length - 1]])}.`);
    barByMuni('chartSaldoBar', 'sal', P.cgLast, (v, cc) => v >= 0 ? cc.good : cc.bad, 'Saldo de empregos');
  }

  /* ---------------- Análise Integrada ---------------- */
  function renderInteg() {
    const P = S.period(), M = S.munis(), L = D.L, c = ODS.theme.colors();
    subs('integ', P);
    const idx = D.trimTail(P.idx, 'pob');
    const cad = D.series('tot', idx, M), est = D.series('est', idx, M);
    const b1 = cad.find(u.isNum), b2 = est.find(u.isNum);
    const iCad = cad.map(v => v == null ? null : v / b1 * 100), iEst = est.map(v => v == null ? null : v / b2 * 100);
    CH.upsert('chartIndice', {
      type: 'line',
      data: { labels: labelsOf(idx), datasets: [
        CH.line('Famílias no CadÚnico (base 100)', iCad, c.brand, { borderWidth: 2.6, unit: 'idx' }),
        CH.line('Estoque de empregos (base 100)', iEst, c.blue, { borderWidth: 2.6, unit: 'idx' }),
      ] },
      options: CH.lineOptions({ unit: 'idx' }),
    }, `Índices base 100: famílias no CadÚnico chegaram a ${u.fmt1([...iCad].reverse().find(u.isNum))} e estoque de empregos a ${u.fmt1([...iEst].reverse().find(u.isNum))}.`);

    const sel = S.get().muni; let h = '';
    D.MUNIS.forEach(m => {
      const c1 = D.agg('tot', P.cadLast, [m]), c0 = D.agg('tot', P.cadFirst, [m]), e1 = D.agg('est', P.cgLast, [m]), e0 = D.agg('est', P.cgFirst, [m]);
      const v1 = pct(c1, c0), v2 = pct(e1, e0);
      h += `<tr${sel === m ? ' class="hl"' : ''}><th scope="row">${esc(m)}</th><td>${fmt(c1)}</td><td class="${v1 > 0 ? 'neg' : 'pos'}">${fmtSigned(v1)}</td><td>${fmt(e1)}</td><td class="${v2 >= 0 ? 'pos' : 'neg'}">${fmtSigned(v2)}</td></tr>`;
    });
    $('#tableInteg tbody').innerHTML = h;
  }

  function init() {
    const sub = () => `${S.scopeLabel()} · ${S.period().label}`;
    ODS.router.register('geral', { title: 'Panorama 2021–2026', sub, render: renderGeral });
    ODS.router.register('vuln', { title: 'Vulnerabilidade social', sub, render: renderVuln });
    ODS.router.register('trab', { title: 'Mercado de trabalho', sub, render: renderTrab });
    ODS.router.register('integ', { title: 'Análise integrada', sub, render: renderInteg });
  }
  return { init };
})();
