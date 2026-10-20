/* =====================================================================
   features/a11y.js — Acessibilidade: atalhos de teclado, região "ao vivo"
   para leitores de tela e diálogo de ajuda.

   Atalhos (ignorados enquanto se digita em campos):
     1–8 etapas do roteiro · 9 painel resumo · ←/→ etapa anterior/próxima
     F modo apresentação · M município · A ano
     L limpar filtros · D modo escuro · P imprimir · ? ajuda
     + − 0 zoom do mapa (na página do mapa)
   ===================================================================== */
ODS.a11y = (() => {
  const { $ } = ODS.util;
  let live;

  /** Anuncia uma mensagem curta para leitores de tela */
  function announce(msg) {
    if (!live) return;
    live.textContent = '';
    setTimeout(() => { live.textContent = msg; }, 30);
  }

  function openHelp() {
    const d = $('#helpDialog');
    if (d.showModal) d.showModal(); else d.setAttribute('open', '');
  }
  function closeHelp() { const d = $('#helpDialog'); if (d.close) d.close(); else d.removeAttribute('open'); }

  function focusSelect(id) {
    const el = document.getElementById(id);
    el.focus();
    if (el.showPicker) { try { el.showPicker(); } catch (e) { /* alguns navegadores bloqueiam */ } }
  }

  function onKey(e) {
    const t = e.target;
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable)) return;
    if ($('#helpDialog').open && e.key !== '?') return;
    const k = e.key;
    if (/^[1-9]$/.test(k)) {
      const ids = [...document.querySelectorAll('.nav-item')].map(b => b.dataset.page);
      if (ids[+k - 1]) { e.preventDefault(); ODS.router.show(ids[+k - 1]); }
      return;
    }
    const inNav = t && t.closest && t.closest('.nav'); // setas dentro do menu são tratadas no router
    switch (k) {
      case 'ArrowRight': if (!inNav && !t.closest('.map-host, .chartwrap, .seg, .corr')) { ODS.router.step(1); } break;
      case 'ArrowLeft': if (!inNav && !t.closest('.map-host, .chartwrap, .seg, .corr')) { ODS.router.step(-1); } break;
      case 'm': case 'M': e.preventDefault(); focusSelect('muniFilter'); break;
      case 'a': case 'A': e.preventDefault(); focusSelect('anoFilter'); break;
      case 'l': case 'L': ODS.state.set({ muni: '', ano: '' }); announce('Filtros limpos'); break;
      case 'd': case 'D': ODS.theme.toggle(); break;
      case 'f': case 'F': e.preventDefault(); ODS.router.togglePresenting(); break;
      case 'p': case 'P': e.preventDefault(); window.print(); break;
      case '?': e.preventDefault(); $('#helpDialog').open ? closeHelp() : openHelp(); break;
      case '+': case '=': ODS.pages && ODS.pages.geoZoom && ODS.pages.geoZoom(1.5); break;
      case '-': case '_': ODS.pages && ODS.pages.geoZoom && ODS.pages.geoZoom(1 / 1.5); break;
      case '0': ODS.pages && ODS.pages.geoReset && ODS.pages.geoReset(); break;
      default: break;
    }
  }

  function init() {
    live = document.createElement('div');
    live.className = 'sr-only'; live.setAttribute('aria-live', 'polite'); live.setAttribute('role', 'status');
    document.body.appendChild(live);
    document.addEventListener('keydown', onKey);
    document.addEventListener('click', e => {
      const b = e.target.closest('[data-action]'); if (!b) return;
      const a = b.dataset.action;
      if (a === 'theme') ODS.theme.toggle();
      if (a === 'help') openHelp();
      if (a === 'close-help') closeHelp();
      if (a === 'print') window.print();
      if (a === 'present') ODS.router.togglePresenting();
    });
    $('#helpDialog').addEventListener('click', e => { if (e.target.id === 'helpDialog') closeHelp(); }); // clique fora fecha
  }

  return { init, announce, openHelp };
})();
