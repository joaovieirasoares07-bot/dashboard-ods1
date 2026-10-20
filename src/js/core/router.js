/* =====================================================================
   core/router.js — Navegação como ROTEIRO DE APRESENTAÇÃO.

   - STORY define a sequência narrativa (8 etapas); APPENDIX, as páginas
     de consulta. O menu, a barra de progresso, os botões "anterior /
     próxima" no fim de cada etapa e as setas ← → seguem essa ordem.
   - Só a página visível é renderizada; as demais ficam "sujas" e são
     desenhadas quando abertas (carregamento rápido, gráficos no tamanho certo).
   - Filtro ou tema mudou => invalidate() marca todas como sujas.
   - #pagina no endereço permite links diretos e o botão "voltar".
   - Padrão ARIA de abas (role=tab/tabpanel, aria-selected, setas no menu).
   - Modo apresentação (tecla F): tela cheia, letras maiores, barra flutuante.
   ===================================================================== */
ODS.router = (() => {
  const { $, $$, icon, esc } = ODS.util;
  const STORY = ['intro', 'geral', 'vuln', 'trab', 'comp', 'geo', 'integ', 'concl'];
  const APPENDIX = ['exec', 'stats', 'metodo'];
  const ORDER = [...STORY, ...APPENDIX];
  const pages = new Map();
  const dirty = new Set();
  let current = null;

  const register = (id, def) => { pages.set(id, def); dirty.add(id); };
  const titleOf = id => (pages.get(id) || {}).title || id;

  function renderPage(id) {
    const def = pages.get(id);
    if (!def) return;
    try {
      def.render();
      // faixa "O que observar" (textos em features/story.js)
      const g = document.getElementById('guide-' + id), G = ODS.story && ODS.story.GUIDES[id];
      if (g && G) ODS.story.renderGuide(g, G.question, G.items(ODS.state.period(), ODS.state.munis()));
    } catch (err) { console.error(`[${id}]`, err); }
    dirty.delete(id);
  }

  function updateHeader() {
    const def = pages.get(current) || {};
    const k = STORY.indexOf(current);
    $('#pageEyebrow').textContent = k >= 0 ? `Etapa ${k + 1} de ${STORY.length}` : 'Apêndice';
    $('#pageTitle').textContent = def.title || '';
    $('#pageSub').textContent = typeof def.sub === 'function' ? def.sub() : (def.sub || '');
    // barra de progresso clicável
    $('#storyProgress').innerHTML = STORY.map((id, i) =>
      `<li><button type="button" class="${i < k ? 'done' : i === k ? 'now' : ''}" data-goto="${id}" aria-label="Etapa ${i + 1}: ${esc(titleOf(id))}"${i === k ? ' aria-current="step"' : ''}></button></li>`).join('');
    const pl = $('#presentLabel');
    if (pl) pl.textContent = k >= 0 ? `${k + 1}/${STORY.length} · ${def.title}` : `Apêndice · ${def.title}`;
  }

  function show(id, { focusTab = false, updateHash = true, scroll = true } = {}) {
    if (!pages.has(id)) id = STORY[0];
    const changed = id !== current;
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
    document.title = `${titleOf(id)} · Erradicação da Pobreza (ODS 1)`;
    if (dirty.has(id)) renderPage(id);
    if (updateHash && location.hash !== '#' + id) history.replaceState(null, '', '#' + id);
    if (changed && scroll) window.scrollTo({ top: 0 });
    ODS.a11y && ODS.a11y.announce(`${STORY.includes(id) ? `Etapa ${STORY.indexOf(id) + 1} de ${STORY.length}: ` : 'Apêndice: '}${titleOf(id)}`);
  }

  function invalidate() {
    pages.forEach((_, id) => dirty.add(id));
    if (current) { renderPage(current); updateHeader(); }
  }
  function renderAll() { pages.forEach((_, id) => { if (dirty.has(id)) renderPage(id); }); }

  /** Avança/recua na ordem do roteiro (história e depois apêndice) */
  function step(delta) {
    const k = ORDER.indexOf(current);
    const next = ORDER[Math.min(ORDER.length - 1, Math.max(0, k + delta))];
    if (next !== current) show(next, { focusTab: document.activeElement && document.activeElement.classList.contains('nav-item') });
  }

  /** Rodapé "anterior / próxima" em cada página */
  function buildStoryNav() {
    ORDER.forEach((id, k) => {
      const sec = document.getElementById('page-' + id); if (!sec) return;
      const prev = ORDER[k - 1], next = ORDER[k + 1];
      const inStory = STORY.includes(id);
      const lbl = (pid, dir) => `<span class="sn-dir">${dir}</span><span class="sn-title">${STORY.includes(pid) ? `${STORY.indexOf(pid) + 1}. ` : ''}${esc(titleOf(pid))}</span>`;
      const nav = document.createElement('nav');
      nav.className = 'story-nav'; nav.setAttribute('aria-label', 'Navegação entre etapas');
      nav.innerHTML =
        (prev ? `<button type="button" class="sn prev" data-goto="${prev}">${icon('arrow-left')}<span>${lbl(prev, 'Anterior')}</span></button>` : '<span></span>') +
        (inStory ? `<span class="sn-count">${STORY.indexOf(id) + 1} / ${STORY.length}</span>` : '<span class="sn-count">Apêndice</span>') +
        (next ? `<button type="button" class="sn next" data-goto="${next}"><span>${lbl(next, id === 'concl' ? 'Apêndice' : 'Próxima')}</span>${icon('arrow-right')}</button>` : `<button type="button" class="sn next" data-goto="intro"><span>${lbl('intro', 'Voltar ao início')}</span>${icon('rotate-ccw')}</button>`);
      sec.appendChild(nav);
    });
  }

  /* ---------- Modo apresentação ---------- */
  function setPresenting(on) {
    document.body.classList.toggle('presenting', on);
    $('#presentBar').hidden = !on;
    document.querySelectorAll('[data-action="present"]').forEach(b => b.setAttribute('aria-pressed', String(on)));
    if (on && document.documentElement.requestFullscreen && !document.fullscreenElement) document.documentElement.requestFullscreen().catch(() => {});
    if (!on && document.fullscreenElement && document.exitFullscreen) document.exitFullscreen().catch(() => {});
    ODS.charts.applyDefaults(); invalidate(); ODS.charts.resizeAll();
    ODS.a11y && ODS.a11y.announce(on ? 'Modo apresentação ativado' : 'Modo apresentação desativado');
  }
  const togglePresenting = () => setPresenting(!document.body.classList.contains('presenting'));

  function init() {
    buildStoryNav();
    $$('.nav-item').forEach(b => b.addEventListener('click', () => show(b.dataset.page)));
    $('.nav').addEventListener('keydown', e => {
      const map = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 };
      if (map[e.key]) { e.preventDefault(); step(map[e.key]); $('.nav-item[aria-selected="true"]').focus(); }
      if (e.key === 'Home') { e.preventDefault(); show(ORDER[0], { focusTab: true }); }
      if (e.key === 'End') { e.preventDefault(); show(ORDER[ORDER.length - 1], { focusTab: true }); }
    });
    document.addEventListener('click', e => {
      const a = e.target.closest('[data-goto]');
      if (a) { e.preventDefault(); show(a.dataset.goto); return; }
      const s = e.target.closest('[data-story]');
      if (s) step(s.dataset.story === 'next' ? 1 : -1);
    });
    document.addEventListener('fullscreenchange', () => { if (!document.fullscreenElement && document.body.classList.contains('presenting')) setPresenting(false); });
    window.addEventListener('hashchange', () => { const id = location.hash.slice(1); if (pages.has(id) && id !== current) show(id, { updateHash: false }); });
    const start = location.hash.slice(1);
    show(pages.has(start) ? start : STORY[0], { updateHash: false });
  }

  return { STORY, APPENDIX, ORDER, register, show, invalidate, renderAll, step, init, togglePresenting,
           current: () => current, updateHeader, presenting: () => document.body.classList.contains('presenting') };
})();
