/* =====================================================================
   core/router.js — Navegação entre páginas com renderização sob demanda.

   - Cada página se registra com register(id, {group, title, sub, render}).
   - Só a página visível é renderizada; as demais ficam marcadas como
     "sujas" e são desenhadas quando abertas (carregamento mais rápido e
     gráficos sempre com o tamanho certo).
   - Mudança de filtro ou de tema => invalidate() marca todas como sujas.
   - O endereço (#pagina) permite links diretos e o botão "voltar".
   - Padrão ARIA de abas: role=tab/tabpanel, aria-selected, setas do teclado.
   ===================================================================== */
ODS.router = (() => {
  const { $, $$ } = ODS.util;
  const pages = new Map();
  const dirty = new Set();
  let current = null;

  const register = (id, def) => { pages.set(id, def); dirty.add(id); };
  const ids = () => $$('.nav-item').map(b => b.dataset.page);

  function renderPage(id) {
    const def = pages.get(id);
    if (!def) return;
    try { def.render(); } catch (err) { console.error(`[${id}]`, err); }
    dirty.delete(id);
  }

  function updateHeader() {
    const def = pages.get(current) || {};
    $('#pageEyebrow').textContent = def.group || '';
    $('#pageTitle').textContent = def.title || '';
    $('#pageSub').textContent = typeof def.sub === 'function' ? def.sub() : (def.sub || '');
  }

  function show(id, { focusTab = false, updateHash = true } = {}) {
    if (!pages.has(id)) id = 'exec';
    current = id;
    $$('.nav-item').forEach(b => {
      const on = b.dataset.page === id;
      b.setAttribute('aria-selected', String(on));
      b.tabIndex = on ? 0 : -1;
      if (on && focusTab) b.focus();
      if (on) b.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    });
    $$('.page').forEach(p => { const on = p.id === 'page-' + id; p.classList.toggle('active', on); p.hidden = !on; });
    updateHeader();
    document.title = `${pages.get(id).title} · Erradicação da Pobreza (ODS 1)`;
    if (dirty.has(id)) renderPage(id);
    if (updateHash && location.hash !== '#' + id) history.replaceState(null, '', '#' + id);
    ODS.a11y && ODS.a11y.announce(`Página ${pages.get(id).title}`);
  }

  /** Filtros/tema mudaram: tudo fica sujo; redesenha a página atual */
  function invalidate() {
    pages.forEach((_, id) => dirty.add(id));
    if (current) { renderPage(current); updateHeader(); }
  }

  /** Renderiza todas as páginas (impressão) */
  function renderAll() { pages.forEach((_, id) => { if (dirty.has(id)) renderPage(id); }); }

  function step(delta) {
    const list = ids(); const k = list.indexOf(current);
    show(list[(k + delta + list.length) % list.length], { focusTab: document.activeElement && document.activeElement.classList.contains('nav-item') });
  }

  function init() {
    // clique nas abas
    $$('.nav-item').forEach(b => b.addEventListener('click', () => show(b.dataset.page)));
    // setas dentro da lista de abas (padrão WAI-ARIA)
    $('.nav').addEventListener('keydown', e => {
      const map = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 };
      if (map[e.key]) { e.preventDefault(); step(map[e.key]); $('.nav-item[aria-selected="true"]').focus(); }
      if (e.key === 'Home') { e.preventDefault(); show(ids()[0], { focusTab: true }); }
      if (e.key === 'End') { e.preventDefault(); const l = ids(); show(l[l.length - 1], { focusTab: true }); }
    });
    // links internos (data-goto)
    document.addEventListener('click', e => {
      const a = e.target.closest('[data-goto]');
      if (a) { e.preventDefault(); show(a.dataset.goto); window.scrollTo({ top: 0, behavior: ODS.util.reducedMotion() ? 'auto' : 'smooth' }); }
    });
    window.addEventListener('hashchange', () => { const id = location.hash.slice(1); if (pages.has(id) && id !== current) show(id, { updateHash: false }); });
    const start = location.hash.slice(1);
    show(pages.has(start) ? start : 'exec', { updateHash: false });
  }

  return { register, show, invalidate, renderAll, step, init, current: () => current, updateHeader };
})();
