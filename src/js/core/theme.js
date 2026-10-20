/* =====================================================================
   core/theme.js — Modo claro/escuro e paleta de gráficos.
   Ordem de prioridade: escolha manual salva > preferência do sistema.
   As cores dos gráficos são lidas das variáveis CSS, para que gráficos,
   mapa e interface fiquem sempre coerentes com o tema ativo.
   ===================================================================== */
ODS.theme = (() => {
  const { store } = ODS.util;
  const KEY = 'ods1-theme';
  const mq = window.matchMedia ? matchMedia('(prefers-color-scheme: dark)') : null;
  const subs = new Set();

  const effective = () => {
    const t = document.documentElement.dataset.theme;
    if (t === 'dark' || t === 'light') return t;
    return mq && mq.matches ? 'dark' : 'light';
  };

  function apply(t) {
    const root = document.documentElement;
    if (t) root.dataset.theme = t; else delete root.dataset.theme;
    root.dataset.themeEffective = effective();
    document.querySelectorAll('.theme-label').forEach(el => { el.textContent = effective() === 'dark' ? 'Modo claro' : 'Modo escuro'; });
    document.querySelectorAll('[data-action="theme"]').forEach(el => el.setAttribute('aria-pressed', String(effective() === 'dark')));
    subs.forEach(fn => fn(effective()));
  }

  function toggle() {
    const next = effective() === 'dark' ? 'light' : 'dark';
    store.set(KEY, next);
    apply(next);
    ODS.a11y && ODS.a11y.announce(next === 'dark' ? 'Modo escuro ativado' : 'Modo claro ativado');
  }

  function init() {
    const saved = store.get(KEY);
    apply(saved === 'dark' || saved === 'light' ? saved : null);
    if (mq && mq.addEventListener) mq.addEventListener('change', () => { if (!store.get(KEY)) apply(null); });
  }

  /** Paleta atual (lida do CSS) */
  function colors() {
    const cs = getComputedStyle(document.documentElement);
    const v = n => cs.getPropertyValue(n).trim();
    const dark = effective() === 'dark';
    return {
      dark,
      ink: v('--ink'), ink2: v('--ink-2'), ink3: v('--ink-3'), line: v('--line'), surface: v('--surface'), surface2: v('--surface-2'),
      brand: v('--brand'), gold: v('--gold'), sage: v('--sage'), blue: v('--blue'),
      good: v('--good'), bad: v('--bad'), muted: dark ? '#4A505A' : '#CDD1D8',
      grid: dark ? 'rgba(255,255,255,.07)' : 'rgba(28,35,48,.07)',
      // 7 cores categóricas (uma por município) — harmonizadas com a identidade
      cat: dark
        ? ['#E2766A', '#E3B152', '#6FB98A', '#7FA6D6', '#B48AD0', '#5CC3C0', '#C9CDD4']
        : ['#9C2B2B', '#C98A1E', '#3F7556', '#3F6593', '#7B4B94', '#2A8C8C', '#5B6472'],
      // escala sequencial do mapa (YlOrRd, ColorBrewer — segura para daltonismo)
      seq: ['#FFF3B0', '#FDCB6E', '#F58E47', '#D9472B', '#9E1B2F'],
      // grupos do IPVS (1 = baixíssima … 6 = muito alta)
      ipvs: ['#1F7A4D', '#86C06C', '#F1D35B', '#EE9B45', '#D4513A', '#7D1D3F'],
    };
  }

  const on = fn => { subs.add(fn); return () => subs.delete(fn); };
  return { init, toggle, effective, colors, on };
})();
