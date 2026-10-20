/* =====================================================================
   core/data.js — Modelo de dados e agregações.

   DATA (gerado por scripts/build_data.py):
     labels[i]            "AAAA-MM", 68 meses
     series[mun][chave][i] chave ∈ pob, ext, br, ac, est, adm, des, sal (null = sem dado)
     ipvs[mun]            [g1..g6] domicílios por grupo IPVS 2022
     geo                  polígonos SVG pré-projetados

   Chaves derivadas (calculadas aqui):
     tot    = pob + br + ac          (famílias no CadÚnico)
     pctPob = pob / tot · 100        (% das famílias do CadÚnico em pobreza)
     rot    = (adm + des) / (2·est) · 100   (taxa de rotatividade mensal)

   Agregações são memorizadas (Map) — o conjunto é pequeno, mas os
   gráficos pedem os mesmos valores várias vezes por renderização.
   ===================================================================== */
ODS.data = (() => {
  const { isNum, pct } = ODS.util;
  const L = DATA.labels;
  const MUNIS = DATA.municipios;
  const cache = new Map();

  /** Soma de uma chave base entre municípios no mês i (null se nenhum tiver dado) */
  function base(key, i, munis) {
    let s = 0, any = false;
    for (const m of munis) { const v = DATA.series[m][key][i]; if (v != null) { s += v; any = true; } }
    return any ? s : null;
  }

  /** Valor agregado (com chaves derivadas) — memorizado */
  function agg(key, i, munis = MUNIS) {
    if (i == null || i < 0) return null;
    const ck = key + '|' + i + '|' + munis.join(',');
    if (cache.has(ck)) return cache.get(ck);
    let v;
    switch (key) {
      case 'tot': { const p = base('pob', i, munis), b = base('br', i, munis), a = base('ac', i, munis); v = p == null ? null : p + b + a; break; }
      case 'pctPob': { const p = base('pob', i, munis), t = agg('tot', i, munis); v = (p != null && t) ? p / t * 100 : null; break; }
      case 'rot': { const a = base('adm', i, munis), d = base('des', i, munis), e = base('est', i, munis); v = (a != null && e) ? (a + d) / (2 * e) * 100 : null; break; }
      default: v = base(key, i, munis);
    }
    cache.set(ck, v);
    return v;
  }

  const series = (key, idx, munis) => idx.map(i => agg(key, i, munis));
  const sumOver = (key, idx, munis) => { let s = 0, any = false; idx.forEach(i => { const v = agg(key, i, munis); if (v != null) { s += v; any = true; } }); return any ? s : null; };

  /** Índices dos meses do ano escolhido ("" = todos) */
  const periodIdx = ano => L.map((l, i) => i).filter(i => !ano || L[i].startsWith(ano));
  /** Primeiro/último mês do período com dado no conjunto completo de municípios */
  const firstWith = (key, idx) => idx.find(i => agg(key, i) != null);
  const lastWith = (key, idx) => [...idx].reverse().find(i => agg(key, i) != null);
  /** Corta meses finais sem dado (para gráficos de linha) */
  const trimTail = (idx, key) => { const last = lastWith(key, idx); return idx.filter(i => i <= last); };

  /** Período corrente: índices e limites do CadÚnico (pob) e do CAGED (est) */
  function period(ano) {
    const idx = periodIdx(ano);
    const P = { ano, idx, cadFirst: firstWith('pob', idx), cadLast: lastWith('pob', idx), cgFirst: firstWith('est', idx), cgLast: lastWith('est', idx) };
    P.cgIdx = idx.filter(i => i <= P.cgLast);  // meses do período com CAGED
    P.label = ano ? ano : `${ODS.util.fmtMes(L[idx[0]])} a ${ODS.util.fmtMes(L[P.cgLast])}`;
    return P;
  }

  /** Último mês com extrema pobreza disponível (série descontinuada em mar/2023) */
  const extLastIdx = upTo => { for (let i = Math.min(upTo, L.length - 1); i >= 0; i--) if (agg('ext', i) != null) return i; return null; };

  /* ---------- IPVS ---------- */
  const IPVS_METRICS = {
    vuln: { label: '% em vulnerabilidade média, alta ou muito alta', short: 'Média + alta + muito alta', f: g => g[3] + g[4] + g[5] },
    alta: { label: '% em vulnerabilidade alta ou muito alta', short: 'Alta + muito alta', f: g => g[4] + g[5] },
    malta: { label: '% em vulnerabilidade muito alta', short: 'Muito alta', f: g => g[5] },
  };
  const ipvsGroups = munis => [0, 1, 2, 3, 4, 5].map(k => munis.reduce((s, m) => s + DATA.ipvs[m][k], 0));
  const ipvsTotal = munis => ipvsGroups(munis).reduce((a, b) => a + b, 0);
  const ipvsPct = (munis, met = 'vuln') => { const g = ipvsGroups(munis); return IPVS_METRICS[met].f(g) / g.reduce((a, b) => a + b, 0) * 100; };

  /* ---------- Catálogo de indicadores por município ----------
     polarity: +1 = quanto maior, melhor; −1 = quanto maior, pior; 0 = neutro.
     value(m, P) devolve o valor para o município m no período P. */
  const METRICS = {
    pob:    { label: 'Famílias em pobreza', unit: 'n', polarity: -1, series: 'pob', value: (m, P) => agg('pob', P.cadLast, [m]) },
    pctPob: { label: '% das famílias do CadÚnico em pobreza', unit: '%', polarity: -1, series: 'pctPob', value: (m, P) => agg('pctPob', P.cadLast, [m]) },
    varPob: { label: 'Variação da pobreza no período', unit: 'var', polarity: -1, value: (m, P) => pct(agg('pob', P.cadLast, [m]), agg('pob', P.cadFirst, [m])) },
    tot:    { label: 'Famílias no CadÚnico', unit: 'n', polarity: -1, series: 'tot', value: (m, P) => agg('tot', P.cadLast, [m]) },
    br:     { label: 'Famílias de baixa renda', unit: 'n', polarity: -1, series: 'br', value: (m, P) => agg('br', P.cadLast, [m]) },
    est:    { label: 'Estoque de empregos formais', unit: 'n', polarity: 1, series: 'est', value: (m, P) => agg('est', P.cgLast, [m]) },
    varEst: { label: 'Variação do estoque de empregos', unit: 'var', polarity: 1, value: (m, P) => pct(agg('est', P.cgLast, [m]), agg('est', P.cgFirst, [m])) },
    saldo:  { label: 'Saldo de empregos acumulado', unit: 'int', polarity: 1, series: 'sal', value: (m, P) => sumOver('sal', P.cgIdx, [m]) },
    rot:    { label: 'Taxa de rotatividade média mensal', unit: '%', polarity: -1, series: 'rot', value: (m, P) => ODS.util.mean(series('rot', P.cgIdx, [m])) },
    famVinc:{ label: 'Famílias em pobreza por 100 vínculos formais', unit: 'dec', polarity: -1, value: (m, P) => { const p = agg('pob', P.cadLast, [m]), e = agg('est', P.cgLast, [m]); return (p != null && e) ? p / e * 100 : null; } },
    ipvs:   { label: '% de domicílios vulneráveis (IPVS 2022)', unit: '%', polarity: -1, value: m => ipvsPct([m], 'vuln') },
  };

  /** Formata um valor conforme a unidade do indicador */
  function fmtMetric(key, v) {
    const u = ODS.util;
    switch (METRICS[key].unit) {
      case '%': return u.fmtPct(v);
      case 'var': return u.fmtSigned(v);
      case 'int': return u.fmtSignedInt(v);
      case 'dec': return u.fmt1(v);
      default: return u.fmt(v);
    }
  }

  /** Ranking: [{m, v, rank}] ordenado do maior para o menor valor (1º = maior valor) */
  function rank(key, P) {
    const def = METRICS[key];
    const rows = MUNIS.map(m => ({ m, v: def.value(m, P) })).filter(r => isNum(r.v));
    rows.sort((a, b) => b.v - a.v);
    rows.forEach((r, k) => { r.rank = k + 1; });
    return rows;
  }

  return { L, MUNIS, agg, series, sumOver, periodIdx, firstWith, lastWith, trimTail, period, extLastIdx,
           IPVS_METRICS, ipvsGroups, ipvsTotal, ipvsPct, METRICS, fmtMetric, rank };
})();
