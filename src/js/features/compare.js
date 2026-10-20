/* =====================================================================
   features/compare.js — Lógica das comparações entre municípios.
   (ranking automático, lado a lado, evolução temporal)
   ===================================================================== */
ODS.compare = (() => {
  const u = ODS.util, D = ODS.data;

  /** Indicadores oferecidos no ranking */
  const RANK_KEYS = ['pctPob', 'pob', 'varPob', 'tot', 'est', 'varEst', 'saldo', 'rot', 'famVinc', 'ipvs'];
  /** Indicadores da comparação lado a lado */
  const SBS_KEYS = ['tot', 'pob', 'pctPob', 'varPob', 'est', 'varEst', 'saldo', 'rot', 'famVinc', 'ipvs'];
  /** Séries temporais para a evolução; idx = aceita índice base 100 */
  const EVO = {
    pob:    { label: 'Famílias em pobreza', idx: true, unit: 'n' },
    tot:    { label: 'Famílias no CadÚnico', idx: true, unit: 'n' },
    br:     { label: 'Famílias de baixa renda', idx: true, unit: 'n' },
    pctPob: { label: '% do CadÚnico em pobreza', idx: false, unit: '%' },
    est:    { label: 'Estoque de empregos formais', idx: true, unit: 'n' },
    sal:    { label: 'Saldo mensal de empregos', idx: false, unit: 'n' },
    rot:    { label: 'Taxa de rotatividade mensal', idx: false, unit: '%' },
  };

  const options = keys => keys.map(k => ({ value: k, label: D.METRICS[k].label }));

  /** Linhas da tabela lado a lado: {label, a, b, diff, win: 'a'|'b'|null} */
  function sbsRows(a, b, P) {
    return SBS_KEYS.map(k => {
      const def = D.METRICS[k];
      const va = def.value(a, P), vb = def.value(b, P);
      let win = null;
      if (u.isNum(va) && u.isNum(vb) && va !== vb && def.polarity) win = (va > vb) === (def.polarity > 0) ? 'a' : 'b';
      const diff = (u.isNum(va) && u.isNum(vb)) ? va - vb : null;
      const diffTxt = def.unit === '%' || def.unit === 'var' ? u.fmtSigned(diff, ' p.p.') : def.unit === 'dec' ? u.fmtSigned(diff, '') : u.fmtSignedInt(diff);
      return { key: k, label: def.label, a: D.fmtMetric(k, va), b: D.fmtMetric(k, vb), diff: diffTxt, win };
    });
  }

  /** Série (absoluta ou índice 100) de um município */
  function evoSeries(key, idx, m, asIndex) {
    const s = D.series(key, idx, [m]);
    if (!asIndex || !EVO[key].idx) return s;
    const b = s.find(u.isNum);
    return s.map(v => u.isNum(v) && b ? v / b * 100 : null);
  }

  return { RANK_KEYS, SBS_KEYS, EVO, options, sbsRows, evoSeries };
})();
