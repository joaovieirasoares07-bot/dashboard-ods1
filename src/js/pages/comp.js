/* =====================================================================
   pages/comp.js — Comparações entre municípios:
     ranking automático · comparação lado a lado · evolução temporal.
   ===================================================================== */
ODS.pages.comp = (() => {
  const u = ODS.util, D = ODS.data, S = ODS.state, CH = ODS.charts, C = ODS.compare;
  const { $, $$, fmtMes, fmtMesCurto, esc } = u;
  let evoMode = 'idx';

  function renderRank(P) {
    const key = $('#rankMetric').value, def = D.METRICS[key], c = ODS.theme.colors(), sel = S.get().muni;
    const rows = D.rank(key, P);
    $('#rankSub').textContent = `${def.label} · ${def.polarity < 0 ? 'quanto maior, mais crítico' : def.polarity > 0 ? 'quanto maior, melhor' : ''} · ${P.label}`;
    const colorOf = v => {
      if (def.unit === 'var' || def.unit === 'int') return (v >= 0) === (def.polarity > 0) ? c.good : c.bad;
      return def.polarity < 0 ? c.brand : c.sage;
    };
    CH.upsert('chartRank', {
      type: 'bar',
      data: { labels: rows.map(r => `${r.rank}º  ${r.m}`), datasets: [{ label: def.label, data: rows.map(r => r.v),
        backgroundColor: rows.map(r => sel && sel !== r.m ? c.muted : colorOf(r.v)), borderRadius: 5, maxBarThickness: 30 }] },
      options: CH.barOptions({ horizontal: true, unit: def.unit === '%' ? '%' : 'n', valueFmt: v => D.fmtMetric(key, v) }),
    }, `Ranking — ${def.label}: ${rows.map(r => `${r.rank}º ${r.m} (${D.fmtMetric(key, r.v)})`).join('; ')}.`);
  }

  function renderSbs(P) {
    const a = $('#sbsA').value, b = $('#sbsB').value;
    const ca = CH.muniColor(a), cb = CH.muniColor(b);
    $('#sbsSub').textContent = `${P.label} · ● indica o melhor valor em cada linha`;
    const rows = C.sbsRows(a, b, P);
    $('#sbsTable').innerHTML =
      `<div class="h">Indicador</div><div class="h a"><span class="dot" style="background:${ca}"></span>${esc(a)}</div><div class="h b"><span class="dot" style="background:${cb}"></span>${esc(b)}</div><div class="h d" style="justify-content:flex-end">Diferença</div>` +
      rows.map(r => `<div class="lab">${esc(r.label)}</div><div class="va${r.win === 'a' ? ' win' : ''}">${r.a}</div><div class="vb${r.win === 'b' ? ' win' : ''}">${r.b}</div><div class="vd">${r.diff}</div>`).join('');
    $('#sbsTable').setAttribute('role', 'table');

    const idx = D.trimTail(P.idx, 'pob'), idg = P.cgIdx;
    const lab = i => fmtMesCurto(D.L[i]);
    const mk = (id, key, ix, title) => CH.upsert(id, {
      type: 'line',
      data: { labels: ix.map(lab), datasets: [
        CH.line(a, C.evoSeries(key, ix, a, true), ca, { unit: 'idx' }),
        CH.line(b, C.evoSeries(key, ix, b, true), cb, { unit: 'idx' }),
      ] },
      options: CH.lineOptions({ unit: 'idx' }),
    }, `${title}: ${a} vs ${b}, índice base 100.`);
    mk('chartSbsPob', 'pob', idx, 'Famílias em pobreza');
    mk('chartSbsEst', 'est', idg, 'Estoque de empregos');
  }

  function renderEvo(P) {
    const key = $('#evoMetric').value, def = C.EVO[key], sel = S.get().muni;
    const asIdx = evoMode === 'idx' && def.idx;
    $$('[data-evo-mode]').forEach(btn => { btn.disabled = !def.idx && btn.dataset.evoMode === 'idx'; });
    const src = ['est', 'sal', 'rot'].includes(key) ? 'est' : 'pob';
    const idx = D.trimTail(P.idx, src);
    $('#evoSub').textContent = `${def.label}${asIdx ? ` · índice (${fmtMes(D.L[idx[0]])} = 100)` : ''}${!def.idx && evoMode === 'idx' ? ' · este indicador é mostrado em valores absolutos' : ''} · clique na legenda para ocultar municípios`;
    const ds = D.MUNIS.map(m => CH.line(m, C.evoSeries(key, idx, m, asIdx), CH.muniColor(m), {
      borderWidth: sel ? (sel === m ? 3 : 1.2) : 2, unit: asIdx ? 'idx' : def.unit,
      borderColor: sel && sel !== m ? CH.hexA(CH.muniColor(m), .35) : CH.muniColor(m), order: sel === m ? 0 : 1,
    }));
    CH.upsert('chartEvo', {
      type: 'line',
      data: { labels: idx.map(i => fmtMesCurto(D.L[i])), datasets: ds },
      options: CH.lineOptions({ unit: asIdx ? 'idx' : def.unit }),
    }, `Evolução de ${def.label} nos 7 municípios, ${fmtMes(D.L[idx[0]])} a ${fmtMes(D.L[idx[idx.length - 1]])}.`);
  }

  function render() {
    const P = S.period();
    // lado a lado: o município filtrado entra como A
    const sel = S.get().muni;
    if (sel && $('#sbsA').value !== sel) { $('#sbsA').value = sel; if ($('#sbsB').value === sel) $('#sbsB').value = D.MUNIS.find(m => m !== sel); }
    renderRank(P); renderSbs(P); renderEvo(P);
  }

  function init() {
    u.fillSelect($('#rankMetric'), C.options(C.RANK_KEYS), 'pctPob');
    const mo = D.MUNIS.map(m => ({ value: m, label: m }));
    u.fillSelect($('#sbsA'), mo, 'Osasco');
    u.fillSelect($('#sbsB'), mo, 'Barueri');
    u.fillSelect($('#evoMetric'), Object.entries(C.EVO).map(([k, v]) => ({ value: k, label: v.label })), 'pob');
    $('#rankMetric').addEventListener('change', () => renderRank(S.period()));
    ['#sbsA', '#sbsB'].forEach(id => $(id).addEventListener('change', () => renderSbs(S.period())));
    $('#evoMetric').addEventListener('change', () => renderEvo(S.period()));
    $$('[data-evo-mode]').forEach(btn => btn.addEventListener('click', () => {
      evoMode = btn.dataset.evoMode;
      $$('[data-evo-mode]').forEach(b => b.setAttribute('aria-checked', String(b === btn)));
      renderEvo(S.period());
    }));
    ODS.router.register('comp', { group: 'Análises', title: 'Comparações', sub: () => `Ranking, lado a lado e evolução · ${S.period().label}`, render });
  }
  return { init };
})();
