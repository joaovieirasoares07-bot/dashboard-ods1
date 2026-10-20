/* =====================================================================
   core/state.js — Estado global dos filtros (município, ano) e eventos.
   Qualquer módulo chama ODS.state.set({...}); os inscritos recebem 'change'.
   ===================================================================== */
ODS.state = (() => {
  const s = { muni: '', ano: '' };
  const subs = new Set();

  const get = () => ({ ...s });
  /** Municípios no escopo atual (todos ou o filtrado) */
  const munis = () => s.muni ? [s.muni] : DATA.municipios;
  const scopeLabel = () => s.muni || 'Os 7 municípios';
  const period = () => ODS.data.period(s.ano);

  function set(patch) {
    let changed = false;
    for (const k of Object.keys(patch)) if (k in s && s[k] !== patch[k]) { s[k] = patch[k]; changed = true; }
    if (!changed) return;
    // mantém os <select> do topo sincronizados (o mapa e atalhos também alteram o estado)
    const mf = document.getElementById('muniFilter'), af = document.getElementById('anoFilter');
    if (mf && mf.value !== s.muni) mf.value = s.muni;
    if (af && af.value !== s.ano) af.value = s.ano;
    subs.forEach(fn => fn(get()));
  }
  const on = fn => { subs.add(fn); return () => subs.delete(fn); };

  return { get, set, on, munis, scopeLabel, period };
})();
