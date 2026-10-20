/* =====================================================================
   main.js — Inicialização.
   Ordem: tema → padrões dos gráficos → filtros → páginas → navegação.
   ===================================================================== */
(() => {
  const u = ODS.util, D = ODS.data, S = ODS.state;
  const { $ } = u;

  /** Página "Metodologia": conteúdo estático + fatos calculados dos dados */
  function registerMethod() {
    ODS.router.register('metodo', {
      group: 'Sobre', title: 'Metodologia', sub: 'Fontes, tratamento, métodos e limitações',
      render() {
        const el = $('#methodFacts'); if (!el) return;
        const P = D.period('');
        const extLast = D.extLastIdx(D.L.length - 1);
        el.innerHTML = [
          [D.MUNIS.length, 'municípios'],
          [D.L.length, `meses (${u.fmtMes(D.L[0])} – ${u.fmtMes(D.L[D.L.length - 1])})`],
          [D.MUNIS.length * D.L.length, 'observações município × mês'],
          [u.fmtMes(D.L[P.cadLast]), 'último mês do CadÚnico'],
          [u.fmtMes(D.L[P.cgLast]), 'último mês do CAGED'],
          [u.fmtMes(D.L[extLast]), 'último mês com extrema pobreza'],
        ].map(([b, s]) => `<div class="fact"><b>${b}</b><span>${s}</span></div>`).join('');
      },
    });
  }

  /** Índice da metodologia: rola até a seção sem trocar o #endereço da página */
  function bindMethodToc() {
    document.querySelectorAll('.method-toc a').forEach(a => a.addEventListener('click', e => {
      e.preventDefault();
      const t = document.querySelector(a.getAttribute('href'));
      if (t) { t.scrollIntoView({ behavior: u.reducedMotion() ? 'auto' : 'smooth', block: 'start' }); t.setAttribute('tabindex', '-1'); t.focus({ preventScroll: true }); }
    }));
  }

  function printInfo() {
    const s = S.get();
    $('#printInfo').textContent = `Filtros: ${s.muni || 'Todos os municípios'} · ${s.ano || 'Todos os anos'} — impresso em ${new Date().toLocaleDateString('pt-BR')}`;
  }

  function init() {
    ODS.theme.init();
    ODS.charts.applyDefaults();
    ODS.a11y.init();

    // Filtros do topo
    u.fillSelect($('#muniFilter'), [{ value: '', label: 'Todos os municípios' }, ...D.MUNIS.map(m => ({ value: m, label: m }))], '');
    const anos = [...new Set(D.L.map(l => l.slice(0, 4)))];
    u.fillSelect($('#anoFilter'), [{ value: '', label: 'Todos os anos' }, ...anos.map(a => ({ value: a, label: a }))], '');
    $('#muniFilter').addEventListener('change', e => S.set({ muni: e.target.value }));
    $('#anoFilter').addEventListener('change', e => S.set({ ano: e.target.value }));

    // Páginas
    ODS.pages.exec.init();
    ODS.pages.panels.init();
    ODS.pages.geo.init();
    ODS.pages.comp.init();
    ODS.pages.stats.init();
    registerMethod();
    bindMethodToc();

    // Reações globais
    S.on(st => {
      ODS.router.invalidate(); printInfo();
      ODS.a11y.announce(`Filtro: ${st.muni || 'todos os municípios'}, ${st.ano || 'todos os anos'}`);
    });
    ODS.theme.on(() => { ODS.charts.applyDefaults(); ODS.router.invalidate(); });

    // Impressão: desenha todas as páginas e ajusta o tamanho dos gráficos
    window.addEventListener('beforeprint', () => {
      document.querySelectorAll('.page').forEach(p => { p.hidden = false; p.style.display = 'flex'; });
      ODS.router.renderAll(); ODS.charts.resizeAll();
    });
    window.addEventListener('afterprint', () => {
      document.querySelectorAll('.page').forEach(p => { p.style.display = ''; p.hidden = !p.classList.contains('active'); });
      ODS.charts.resizeAll();
    });

    printInfo();
    ODS.router.init();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
