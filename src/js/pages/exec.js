/* =====================================================================
   pages/exec.js — Resumo Executivo (página inicial).
   Uma tela com: resumo em texto, 8 KPIs, mini mapa, insights,
   ranking e tendências (sparklines em SVG, sem custo de Chart.js).
   ===================================================================== */
ODS.pages = ODS.pages || {};

ODS.pages.exec = (() => {
  const u = ODS.util, D = ODS.data, S = ODS.state;
  const { $, fmt, fmtMes, fmtSigned, fmtSignedInt, pct, isNum, esc } = u;
  let miniMap = null;
  const RANK_OPTS = ['pctPob', 'pob', 'varPob', 'est', 'varEst', 'saldo', 'famVinc', 'ipvs'];

  /** Sparkline SVG (linha com área, ou barras em torno de zero) */
  function spark(values, color, { bars = false } = {}) {
    const W = 200, H = 46, pts = values.map((v, k) => ({ v, k })).filter(p => isNum(p.v));
    if (pts.length < 2) return '';
    const vs = pts.map(p => p.v);
    let lo = Math.min(...vs), hi = Math.max(...vs);
    if (bars) { lo = Math.min(0, lo); hi = Math.max(0, hi); }
    const span = hi - lo || 1, n = values.length - 1 || 1;
    const X = k => k / n * W, Y = v => H - (v - lo) / span * H;
    if (bars) {
      const bw = Math.max(1, W / values.length - 1), y0 = Y(0);
      return `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" aria-hidden="true">${pts.map(p => {
        const y = Y(p.v); const c = p.v >= 0 ? 'var(--good)' : 'var(--bad)';
        return `<rect x="${(X(p.k) - bw / 2).toFixed(1)}" y="${Math.min(y, y0).toFixed(1)}" width="${bw.toFixed(1)}" height="${Math.max(1, Math.abs(y - y0)).toFixed(1)}" fill="${c}" rx="1"/>`;
      }).join('')}<line x1="0" x2="${W}" y1="${y0}" y2="${y0}" stroke="var(--line-strong)" stroke-width="1"/></svg>`;
    }
    const d = pts.map((p, i) => `${i ? 'L' : 'M'}${X(p.k).toFixed(1)},${Y(p.v).toFixed(1)}`).join('');
    const area = `${d}L${X(pts[pts.length - 1].k).toFixed(1)},${H}L${X(pts[0].k).toFixed(1)},${H}Z`;
    const last = pts[pts.length - 1];
    const gid = 'g' + Math.random().toString(36).slice(2, 8);
    return `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" aria-hidden="true">
      <defs><linearGradient id="${gid}" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="${color}" stop-opacity=".25"/><stop offset="1" stop-color="${color}" stop-opacity="0"/></linearGradient></defs>
      <path d="${area}" fill="url(#${gid})"/><path d="${d}" fill="none" stroke="${color}" stroke-width="2" vector-effect="non-scaling-stroke" stroke-linejoin="round"/>
      <circle cx="${X(last.k)}" cy="${Y(last.v)}" r="3" fill="${color}" vector-effect="non-scaling-stroke"/></svg>`;
  }

  function trends(P, munis) {
    const c = ODS.theme.colors();
    const idxCad = D.trimTail(P.idx, 'pob'), idxCg = P.cgIdx;
    const item = (label, key, idx, color, polarity, opts = {}) => {
      const s = D.series(key, idx, munis);
      const first = s.find(isNum), lastV = [...s].reverse().find(isNum);
      const value = opts.sum ? D.sumOver(key, idx, munis) : lastV;
      const ch = opts.sum ? null : pct(lastV, first);
      const tone = ODS.kpis.tone(ch, polarity);
      return `<div class="spark">
        <div class="spark-head"><span class="spark-label">${label}</span>${isNum(ch) ? ODS.kpis.chip(ch, '%', polarity) : ''}</div>
        <div class="spark-val">${opts.sum ? fmtSignedInt(value) : fmt(value)}</div>
        ${spark(s, color, { bars: opts.bars })}
        <p class="spark-foot">${opts.sum ? `Soma de ${fmtMes(D.L[idx[0]])} a ${fmtMes(D.L[idx[idx.length - 1]])}` : `${fmtMes(D.L[idx[0]])} → ${fmtMes(D.L[idx[idx.length - 1]])}`}<span class="sr-only">, ${tone === 'good' ? 'melhora' : tone === 'bad' ? 'piora' : 'estável'}</span></p>
      </div>`;
    };
    return item('Famílias no CadÚnico', 'tot', idxCad, c.brand, -1)
      + item('Famílias em pobreza', 'pob', idxCad, c.gold, -1)
      + item('Empregos formais', 'est', idxCg, c.blue, 1)
      + item('Saldo mensal de empregos', 'sal', idxCg, c.sage, 1, { bars: true, sum: true });
  }

  function ranking(P, sel) {
    const key = $('#execRankMetric').value || 'pctPob';
    const def = D.METRICS[key];
    const rows = D.rank(key, P);
    const max = Math.max(...rows.map(r => Math.abs(r.v))) || 1;
    const c = ODS.theme.colors();
    $('#execRankSub').textContent = `${def.polarity < 0 ? 'Maior valor = situação mais crítica' : 'Maior valor = melhor desempenho'} · ${def.label}`;
    $('#execRank').innerHTML = rows.map(r => {
      const good = def.polarity ? (r.v > 0) === (def.polarity > 0) : null;
      const col = def.unit === 'var' || def.unit === 'int' ? (good ? c.good : c.bad) : (def.polarity < 0 ? c.brand : c.sage);
      return `<li class="rank-row${sel === r.m ? ' is-sel' : ''}">
        <span class="rank-pos">${r.rank}</span><span class="rank-name">${esc(r.m)}</span>
        <span class="rank-bar" aria-hidden="true"><i style="width:${(Math.abs(r.v) / max * 100).toFixed(1)}%;background:${col}"></i></span>
        <span class="rank-val">${D.fmtMetric(key, r.v)}</span></li>`;
    }).join('');
  }

  function render() {
    const P = S.period(), munis = S.munis(), sel = S.get().muni;
    $('#execSummary').innerHTML = ODS.insights.summary(P, munis);
    $('#kpiGrid').innerHTML = ODS.kpis.execCards(P, munis);

    if (!miniMap) miniMap = ODS.map.create($('#execMap'), $('#execMapLegend'), { compact: true, onSelect: m => S.set({ muni: S.get().muni === m ? '' : m }) });
    miniMap.update({ metric: 'vuln', selected: sel, P });

    $('#insightsList').innerHTML = ODS.insights.render(ODS.insights.generate(P, munis));
    ranking(P, sel);
    $('#execTrendSub').textContent = `${S.scopeLabel()} · ${P.label}`;
    $('#execTrends').innerHTML = trends(P, munis);
  }

  function init() {
    u.fillSelect($('#execRankMetric'), RANK_OPTS.map(k => ({ value: k, label: D.METRICS[k].label })), 'pctPob');
    $('#execRankMetric').addEventListener('change', () => ranking(S.period(), S.get().muni));
    ODS.router.register('exec', {
      title: 'Painel resumo',
      sub: () => `${S.scopeLabel()} · ${S.period().label}`,
      render,
    });
  }
  return { init };
})();
