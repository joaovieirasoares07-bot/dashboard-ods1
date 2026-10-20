/* =====================================================================
   pages/geo.js — Vulnerabilidade Geográfica: mapa completo (zoom, tooltip,
   legenda interativa), composição IPVS, gráfico e tabela por município.
   ===================================================================== */
ODS.pages.geo = (() => {
  const u = ODS.util, D = ODS.data, S = ODS.state, CH = ODS.charts;
  const { $, fmt, fmtPct, esc } = u;
  let map = null;

  function render() {
    const P = S.period(), sel = S.get().muni, c = ODS.theme.colors();
    if (!map) map = ODS.map.create($('#ipvsMap'), $('#mapLegend'), { onSelect: m => S.set({ muni: S.get().muni === m ? '' : m }) });
    map.update({ metric: $('#mapMetric').value, selected: sel, P });
    $('#mapDetail').innerHTML = ODS.map.detailHtml(S.munis(), P);

    const sorted = [...D.MUNIS].sort((a, b) => D.ipvsPct([b]) - D.ipvsPct([a]));
    CH.upsert('chartIpvs', {
      type: 'bar',
      data: { labels: sorted, datasets: [{ label: '% vulnerável', data: sorted.map(m => D.ipvsPct([m])), backgroundColor: sorted.map(m => sel && sel !== m ? c.muted : c.gold), borderRadius: 6, maxBarThickness: 60 }] },
      options: CH.barOptions({ unit: '%' }),
    }, `Percentual de domicílios em vulnerabilidade média, alta ou muito alta: maior em ${sorted[0]} (${fmtPct(D.ipvsPct([sorted[0]]))}), menor em ${sorted[6]} (${fmtPct(D.ipvsPct([sorted[6]]))}).`);

    let h = '';
    D.MUNIS.forEach(m => {
      const g = DATA.ipvs[m], t = g.reduce((a, b) => a + b, 0);
      h += `<tr${sel === m ? ' class="hl"' : ''}><th scope="row">${esc(m)}</th><td>${fmt(t)}</td><td>${fmt(g[3])}</td><td>${fmt(g[4])}</td><td>${fmt(g[5])}</td><td>${fmtPct(D.ipvsPct([m]))}</td></tr>`;
    });
    $('#tableIpvs tbody').innerHTML = h;
  }

  /** Atalhos de teclado + − 0 (apenas com a página do mapa aberta) */
  ODS.pages.geoZoom = f => { if (map && ODS.router.current() === 'geo') map.zoomAt(f); };
  ODS.pages.geoReset = () => { if (map && ODS.router.current() === 'geo') map.reset(); };

  function init() {
    $('#mapMetric').addEventListener('change', () => { if (map) map.update({ metric: $('#mapMetric').value, selected: S.get().muni, P: S.period() }); });
    ODS.router.register('geo', { group: 'Painéis', title: 'Vulnerabilidade Geográfica', sub: () => `IPVS 2022 (SEADE) · ${S.scopeLabel()}`, render });
  }
  return { init };
})();
