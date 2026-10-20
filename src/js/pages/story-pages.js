/* =====================================================================
   pages/story-pages.js — Etapas narrativas: Introdução (1) e Conclusões (8).
   ===================================================================== */
ODS.pages = ODS.pages || {};

ODS.pages.story = (() => {
  const u = ODS.util, D = ODS.data, S = ODS.state;
  const { $, fmt, fmtMes, esc, icon } = u;
  let introMap = null;

  function renderIntro() {
    const P = D.period('');
    if (!introMap) introMap = ODS.map.create($('#introMap'), null, { compact: true, plain: true, onSelect: m => S.set({ muni: S.get().muni === m ? '' : m }) });
    introMap.update({ metric: 'vuln', selected: S.get().muni, P });
    $('#introMunis').innerHTML = D.MUNIS.map(m => `<li>
      <span class="dot" style="background:${ODS.charts.muniColor(m)}"></span>
      <span class="mn">${esc(m)}</span>
      <span class="mm">${fmt(D.agg('tot', P.cadLast, [m]))} famílias no CadÚnico · ${fmt(D.agg('est', P.cgLast, [m]))} empregos formais</span></li>`).join('');
    $('#introPeriod').textContent = `${fmtMes(D.L[0])} a ${fmtMes(D.L[D.L.length - 1])} · ${D.L.length} meses de dados mensais`;
  }

  function renderConcl() {
    $('#conclList').innerHTML = ODS.story.conclusions().map((c, k) => `<li class="concl">
      <div class="concl-num" aria-hidden="true">${k + 1}</div>
      <div class="concl-body">
        <h2>${esc(c.title)}</h2>
        <p>${esc(c.text)}</p>
        <button type="button" class="btn-link" data-goto="${c.goto}">Ver evidência: ${esc(c.gotoLabel)} ${icon('arrow-right')}</button>
      </div>
      <div class="concl-fig"><span class="concl-ic">${icon(c.ic)}</span><b>${esc(c.big)}</b><span>${esc(c.bigLabel)}</span></div>
    </li>`).join('');
  }

  function init() {
    ODS.router.register('intro', { title: 'Introdução', sub: 'ODS 1 · objetivo, dados, municípios e período', render: renderIntro });
    ODS.router.register('concl', { title: 'Conclusões', sub: 'Principais achados · período completo e 7 municípios', render: renderConcl });
  }
  return { init };
})();
