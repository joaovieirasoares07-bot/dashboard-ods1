/* =====================================================================
   features/map.js — Mapa coroplético do IPVS 2022 (SVG puro, sem tiles).

   create(host, legendHost, {compact}) devolve um objeto com update()/zoom.
   Recursos:
     - escala sequencial YlOrRd em 5 classes de intervalos iguais "redondos"
       (ColorBrewer — legível para daltonismo), com contagem por classe;
     - zoom (roda do mouse, botões, teclas + − 0, pinça) e arraste;
     - destaque ao passar o mouse e tooltip rica (IPVS + CadÚnico + CAGED);
     - acessível pelo teclado (Tab entre municípios, Enter filtra).
   ===================================================================== */
ODS.map = (() => {
  const u = ODS.util, D = ODS.data;
  const { fmt, fmtPct, fmtMes, icon, esc } = u;
  const G = DATA.geo;
  const GROUPS = ['Baixíssima', 'Muito baixa', 'Baixa', 'Média', 'Alta', 'Muito alta'];
  const tip = () => document.getElementById('mapTip');

  /** Quebras de 5 classes: início múltiplo de 5, passo inteiro */
  function breaks(values) {
    const lo = Math.floor(Math.min(...values) / 5) * 5;
    const step = Math.max(1, Math.ceil((Math.max(...values) - lo) / 5));
    return [0, 1, 2, 3, 4, 5].map(k => lo + step * k);
  }
  const classOf = (v, br) => { for (let k = 4; k >= 0; k--) if (v >= br[k]) return k; return 0; };

  function create(host, legendHost, opts = {}) {
    const compact = !!opts.compact;
    const view = { x: 0, y: 0, w: G.w, h: G.h };
    let svg, last = {};

    /* ---------- Desenho ---------- */
    function update({ metric = 'vuln', selected = '', P }) {
      last = { metric, selected, P };
      const c = ODS.theme.colors();
      const vals = Object.fromEntries(D.MUNIS.map(m => [m, D.ipvsPct([m], metric)]));
      const br = breaks(Object.values(vals));
      const rank = [...D.MUNIS].sort((a, b) => vals[b] - vals[a]);
      last.vals = vals; last.br = br; last.rank = rank;

      let s = `<svg viewBox="${view.x} ${view.y} ${view.w} ${view.h}" role="group" aria-label="Mapa dos 7 municípios: ${esc(D.IPVS_METRICS[metric].label)} (IPVS 2022). Use Tab para percorrer os municípios.">`;
      s += '<g>' + G.neigh.map(n => `<path d="${n.d}" class="neigh"/>`).join('') + '</g><g>';
      D.MUNIS.forEach(m => {
        const v = vals[m];
        s += `<path d="${G.ours[m].d}" data-m="${esc(m)}" data-k="${classOf(v, br)}" class="muni${selected && selected !== m ? ' dim' : ''}" fill="${c.seq[classOf(v, br)]}"
          tabindex="${compact ? -1 : 0}" role="button" aria-pressed="${selected === m}"
          aria-label="${esc(m)}: ${fmtPct(v)}, ${rank.indexOf(m) + 1}º de 7. Enter para ${selected === m ? 'remover o filtro' : 'filtrar o dashboard'}."/>`;
      });
      s += '</g>';
      if (selected) s += `<path class="outline" d="${G.ours[selected].d}"/>`;
      s += '<path class="outline hover" d=""/><g class="labels">';
      G.neigh.forEach(n => { const [x, y] = n.c; if (x > 30 && x < G.w - 30 && y > 30 && y < G.h - 30) s += `<text x="${x}" y="${y}" class="nlbl" data-px="10">${esc(n.n)}</text>`; });
      D.MUNIS.forEach(m => {
        const [x, y] = G.ours[m].c;
        s += `<text x="${x}" y="${y}" class="mlbl" data-px="11.5">${esc(m)}</text><text x="${x}" y="${y}" class="mval" data-px="11">${fmtPct(vals[m])}</text>`;
      });
      s += '</g></svg>';
      if (!compact) s += `<div class="map-zoom" role="group" aria-label="Zoom do mapa">
          <button type="button" data-z="in" aria-label="Aproximar">${icon('plus')}</button>
          <button type="button" data-z="out" aria-label="Afastar">${icon('minus')}</button>
          <button type="button" data-z="reset" aria-label="Enquadrar mapa">${icon('rotate-ccw')}</button></div>
          <span class="map-scale-hint" aria-hidden="true"></span>`;
      host.innerHTML = s;
      svg = host.querySelector('svg');
      applyView();
      bind();
      renderLegend(metric, br, vals);
    }

    function renderLegend(metric, br, vals) {
      if (!legendHost) return;
      const c = ODS.theme.colors();
      const counts = [0, 0, 0, 0, 0]; Object.values(vals).forEach(v => counts[classOf(v, br)]++);
      legendHost.innerHTML = `<p class="lg-title">${esc(D.IPVS_METRICS[metric].label)}</p>
        <div class="lg-scale" role="list">${c.seq.map((col, k) => `<button type="button" class="lg-bin" data-k="${k}" role="listitem" aria-label="${br[k]} a ${br[k + 1]}%: ${counts[k]} município(s)">
          <i style="background:${col}"></i><span>${br[k]}–${br[k + 1]}% · <b>${counts[k]}</b></span></button>`).join('')}</div>
        <p class="lg-other"><i></i>Outros municípios (sem dados no recorte)</p>`;
      legendHost.querySelectorAll('.lg-bin').forEach(b => {
        const on = () => { host.classList.add('has-hover'); host.querySelectorAll('path.muni').forEach(p => p.classList.toggle('is-hover', p.dataset.k === b.dataset.k)); b.classList.add('is-active'); };
        const off = () => { host.classList.remove('has-hover'); host.querySelectorAll('path.muni').forEach(p => p.classList.remove('is-hover')); b.classList.remove('is-active'); };
        b.addEventListener('mouseenter', on); b.addEventListener('mouseleave', off);
        b.addEventListener('focus', on); b.addEventListener('blur', off);
      });
    }

    /* ---------- Tooltip ---------- */
    function tipHtml(m) {
      const { vals, rank, metric, P } = last;
      const c = ODS.theme.colors();
      const g = DATA.ipvs[m], t = g.reduce((a, b) => a + b, 0);
      const pob = D.agg('pob', P.cadLast, [m]), pp = D.agg('pctPob', P.cadLast, [m]), est = D.agg('est', P.cgLast, [m]);
      return `<h4>${esc(m)}</h4>
        <div class="tip-big">${fmtPct(vals[m])}</div>
        <div class="tip-row"><span>${esc(D.IPVS_METRICS[metric].short)}</span><b>${rank.indexOf(m) + 1}º de 7</b></div>
        <div class="stack" aria-hidden="true">${g.map((v, k) => `<span style="width:${v / t * 100}%;background:${c.ipvs[k]}"></span>`).join('')}</div>
        <div class="tip-row"><span>Domicílios (IPVS)</span><b>${fmt(t)}</b></div>
        <div class="tip-row"><span>Famílias em pobreza (${fmtMes(D.L[P.cadLast])})</span><b>${fmt(pob)}</b></div>
        <div class="tip-row"><span>% do CadÚnico em pobreza</span><b>${fmtPct(pp)}</b></div>
        <div class="tip-row"><span>Empregos formais (${fmtMes(D.L[P.cgLast])})</span><b>${fmt(est)}</b></div>
        ${compact ? '' : `<p class="tip-hint">${last.selected === m ? 'Clique para remover o filtro' : 'Clique para filtrar o dashboard'}</p>`}`;
    }
    function placeTip(x, y) {
      const el = tip(); const r = el.getBoundingClientRect();
      let left = x + 16, top = y + 14;
      if (left + r.width > innerWidth - 8) left = x - r.width - 16;
      if (top + r.height > innerHeight - 8) top = y - r.height - 14;
      el.style.left = Math.max(8, left) + 'px'; el.style.top = Math.max(8, top) + 'px';
    }
    function hover(p, x, y) {
      host.classList.add('has-hover');
      host.querySelectorAll('path.muni').forEach(q => q.classList.toggle('is-hover', q === p));
      host.querySelector('path.outline.hover').setAttribute('d', p.getAttribute('d'));
      const el = tip(); el.innerHTML = tipHtml(p.dataset.m); el.hidden = false; placeTip(x, y);
    }
    function unhover() {
      host.classList.remove('has-hover');
      host.querySelectorAll('path.muni').forEach(q => q.classList.remove('is-hover'));
      const o = host.querySelector('path.outline.hover'); if (o) o.setAttribute('d', '');
      tip().hidden = true;
    }

    /* ---------- Zoom e arraste ---------- */
    const MIN_W = G.w / 6;
    function clamp() {
      view.w = Math.min(G.w, Math.max(MIN_W, view.w)); view.h = view.w * G.h / G.w;
      view.x = Math.min(G.w - view.w, Math.max(0, view.x)); view.y = Math.min(G.h - view.h, Math.max(0, view.y));
    }
    function applyView() {
      if (!svg) return;
      clamp();
      svg.setAttribute('viewBox', `${view.x} ${view.y} ${view.w} ${view.h}`);
      // rótulos com tamanho constante NA TELA (em px), em qualquer largura e nível de zoom
      const k = view.w / G.w;
      const unitsPerPx = view.w / (svg.clientWidth || G.w);
      svg.querySelectorAll('text').forEach(t => {
        const fs = +t.dataset.px * unitsPerPx;
        t.setAttribute('font-size', fs.toFixed(2));
        t.style.strokeWidth = (3.2 * unitsPerPx) + 'px';
        if (t.classList.contains('mval')) t.setAttribute('dy', (fs * 1.0).toFixed(2));
        if (t.classList.contains('mlbl')) t.setAttribute('dy', (-fs * 0.1).toFixed(2));
      });
      const hint = host.querySelector('.map-scale-hint');
      if (hint) hint.textContent = k < .999 ? `Zoom ${Math.round(1 / k * 10) / 10}×` : '';
    }
    /** Zoom por fator f em torno do ponto (cx, cy) em coordenadas do SVG */
    function zoomAt(f, cx = view.x + view.w / 2, cy = view.y + view.h / 2) {
      const nw = Math.min(G.w, Math.max(MIN_W, view.w / f));
      const ratio = nw / view.w;
      view.x = cx - (cx - view.x) * ratio; view.y = cy - (cy - view.y) * ratio;
      view.w = nw; applyView();
    }
    const reset = () => { view.x = 0; view.y = 0; view.w = G.w; applyView(); };
    function toSvg(clientX, clientY) {
      const r = svg.getBoundingClientRect();
      return { x: view.x + (clientX - r.left) / r.width * view.w, y: view.y + (clientY - r.top) / r.height * view.h };
    }

    /* ---------- Eventos ---------- */
    function bind() {
      const pointers = new Map();
      let drag = null, pinch = null, moved = false;

      host.querySelectorAll('path.muni').forEach(p => {
        p.addEventListener('pointerenter', e => { if (!drag && e.pointerType !== 'touch') hover(p, e.clientX, e.clientY); });
        p.addEventListener('pointermove', e => { if (!drag && e.pointerType !== 'touch') placeTip(e.clientX, e.clientY); });
        p.addEventListener('pointerleave', unhover);
        p.addEventListener('click', () => {
          if (moved) return; // fim de um arraste: não conta como clique
          if (opts.onSelect) opts.onSelect(p.dataset.m);
        });
        p.addEventListener('focus', () => { const r = p.getBoundingClientRect(); hover(p, r.left + r.width / 2, r.top + r.height / 2); });
        p.addEventListener('blur', unhover);
        p.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); opts.onSelect && opts.onSelect(p.dataset.m); } });
      });
      if (compact) return;

      host.querySelectorAll('[data-z]').forEach(b => b.addEventListener('click', () => {
        if (b.dataset.z === 'in') zoomAt(1.5); else if (b.dataset.z === 'out') zoomAt(1 / 1.5); else reset();
      }));
      svg.addEventListener('wheel', e => {
        e.preventDefault();
        const pt = toSvg(e.clientX, e.clientY);
        zoomAt(e.deltaY < 0 ? 1.2 : 1 / 1.2, pt.x, pt.y);
      }, { passive: false });
      svg.addEventListener('pointerdown', e => {
        pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
        moved = false;
        if (pointers.size === 1) drag = { x: e.clientX, y: e.clientY, vx: view.x, vy: view.y };
        if (pointers.size === 2) {
          const [a, b] = [...pointers.values()];
          pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), w: view.w, c: toSvg((a.x + b.x) / 2, (a.y + b.y) / 2) };
          drag = null;
        }
      });
      svg.addEventListener('pointermove', e => {
        if (!pointers.has(e.pointerId)) return;
        pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
        if (pinch && pointers.size === 2) {
          const [a, b] = [...pointers.values()];
          const d = Math.hypot(a.x - b.x, a.y - b.y);
          zoomAt((pinch.w / view.w) * (d / pinch.d), pinch.c.x, pinch.c.y); moved = true; return;
        }
        if (drag) {
          const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
          if (Math.abs(dx) + Math.abs(dy) > 4) { moved = true; host.classList.add('is-dragging'); unhover(); }
          if (moved && view.w < G.w) {
            const r = svg.getBoundingClientRect();
            view.x = drag.vx - dx / r.width * view.w; view.y = drag.vy - dy / r.height * view.h; applyView();
          }
        }
      });
      const end = e => {
        pointers.delete(e.pointerId);
        if (pointers.size < 2) pinch = null;
        if (!pointers.size) { drag = null; host.classList.remove('is-dragging'); setTimeout(() => { moved = false; }, 0); }
      };
      svg.addEventListener('pointerup', end); svg.addEventListener('pointercancel', end); svg.addEventListener('pointerleave', end);
    }

    if (window.ResizeObserver) new ResizeObserver(() => applyView()).observe(host);
    return { update, zoomAt, reset, host };
  }

  /** Painel lateral: composição dos 6 grupos do IPVS + números-chave */
  function detailHtml(munis, P) {
    const c = ODS.theme.colors();
    const g = D.ipvsGroups(munis), t = g.reduce((a, b) => a + b, 0);
    const name = munis.length === 1 ? munis[0] : 'Os 7 municípios';
    return `<h3>${esc(name)}</h3><p class="sub">${fmt(t)} domicílios por grupo do IPVS 2022</p>
      <div class="stack" role="img" aria-label="Composição por grupo: ${g.map((v, k) => `${GROUPS[k]} ${fmtPct(v / t * 100)}`).join(', ')}" style="height:16px;margin:12px 0">
        ${g.map((v, k) => `<span style="width:${v / t * 100}%;background:${c.ipvs[k]}" title="${GROUPS[k]}: ${fmtPct(v / t * 100)}"></span>`).join('')}</div>
      <table class="ipvs-groups"><caption class="sr-only">Domicílios por grupo do IPVS</caption><tbody>
        ${g.map((v, k) => `<tr><td><i style="background:${c.ipvs[k]}"></i>${k + 1} · ${GROUPS[k]}</td><td>${fmt(v)}</td><td>${fmtPct(v / t * 100)}</td></tr>`).reverse().join('')}
      </tbody></table>
      <div class="detail-kv">
        <div><span>Vulnerável (média+alta+muito alta)</span><b>${fmtPct(D.ipvsPct(munis, 'vuln'))}</b></div>
        <div><span>Famílias em pobreza (${fmtMes(D.L[P.cadLast])})</span><b>${fmt(D.agg('pob', P.cadLast, munis))}</b></div>
        <div><span>% do CadÚnico em pobreza</span><b>${fmtPct(D.agg('pctPob', P.cadLast, munis))}</b></div>
        <div><span>Empregos formais (${fmtMes(D.L[P.cgLast])})</span><b>${fmt(D.agg('est', P.cgLast, munis))}</b></div>
      </div>`;
  }

  return { create, detailHtml, GROUPS };
})();
