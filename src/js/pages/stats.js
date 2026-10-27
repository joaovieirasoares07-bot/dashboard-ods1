/* =====================================================================
   pages/stats.js — Análise Estatística:
     tabela descritiva (média, mediana, DP, CV, mín, quartis, máx),
     boxplot por município, matriz de correlação e dispersão com reta.
   ===================================================================== */
ODS.pages.stats = (() => {
  const u = ODS.util, D = ODS.data, S = ODS.state, CH = ODS.charts, ST = ODS.stats;
  const { $, $$, fmt, fmt1, fmt2, fmtPct, fmtMes, esc, isNum } = u;
  let mode = 'time', corrMode = 'diff', pair = ['est', 'pob'];

  const fv = (unit, v) => unit === '%' ? fmtPct(v) : (Math.abs(v) < 100 && !Number.isInteger(v) ? fmt1(v) : fmt(v));

  function renderTable(P, munis) {
    const rows = ST.describeAll(mode, P, munis);
    const unitTxt = mode === 'time' ? `meses (${S.scopeLabel()})` : 'municípios';
    $('#statsSub').textContent = mode === 'time'
      ? `Distribuição dos valores mensais · ${S.scopeLabel()} · ${P.label}`
      : `Distribuição entre os 7 municípios · estoques no último mês, fluxos somados no período · ${P.label}`;
    $('#statsTable').innerHTML = `<caption class="sr-only">Estatísticas descritivas</caption>
      <thead><tr><th scope="col">Indicador</th><th scope="col">n</th><th scope="col">Média</th><th scope="col">Mediana</th><th scope="col">Desvio padrão</th><th scope="col">CV</th><th scope="col">Mínimo</th><th scope="col">Q1</th><th scope="col">Q3</th><th scope="col">Máximo</th></tr></thead>
      <tbody>${rows.map(r => r.n ? `<tr><th scope="row">${esc(r.label)}${r.note ? `<small>${esc(r.note)}</small>` : ''}</th><td class="n">${r.n}</td>
        <td>${fv(r.unit, r.mean)}</td><td>${fv(r.unit, r.median)}</td><td>${isNum(r.std) ? fv(r.unit, r.std) : '—'}</td><td>${isNum(r.cv) ? fmtPct(r.cv) : '—'}</td>
        <td>${fv(r.unit, r.min)}</td><td>${fv(r.unit, r.q1)}</td><td>${fv(r.unit, r.q3)}</td><td>${fv(r.unit, r.max)}</td></tr>`
        : `<tr><th scope="row">${esc(r.label)}${r.note ? `<small>${esc(r.note)}</small>` : ''}</th><td class="n">0</td><td colspan="8" style="text-align:left;color:var(--ink-3)">Sem dados no período selecionado</td></tr>`).join('')}</tbody>`;
    $('#statsNote').textContent = `n = número de ${unitTxt} com dado. Desvio padrão amostral (n − 1); quartis por interpolação linear (método 7, o mesmo do Excel QUARTIL.INC e do R). CV = coeficiente de variação (desvio padrão / média). ${mode === 'cross' ? 'Com apenas 7 municípios, as medidas de dispersão são sensíveis a um único valor extremo (Barueri concentra quase metade dos empregos formais dos 7 municípios).' : ''}`;
  }

  function renderBox(P) {
    const key = $('#boxMetric').value, v = ST.VARS[key], c = ODS.theme.colors();
    const sel = S.get().muni;
    const stats = D.MUNIS.map(m => u.describe(D.series(key, P.idx, [m])));
    const has = stats.some(s => s.n);
    $('#boxSub').textContent = has ? `${v.label}: distribuição mensal em cada município · ${P.label} · caixa = Q1–Q3, traço = mediana, ◆ = média, bigodes = mín–máx` : `${v.label}: sem dados no período selecionado${v.note ? ` (${v.note})` : ''}`;
    const lo = Math.min(...stats.filter(s => s.n).map(s => s.min)), hi = Math.max(...stats.filter(s => s.n).map(s => s.max));
    const opts = CH.barOptions({ unit: v.unit === '%' ? '%' : 'n' });
    opts.scales.y.suggestedMin = has ? lo - (hi - lo) * .05 : 0;
    opts.scales.y.suggestedMax = has ? hi + (hi - lo) * .05 : 1;
    opts.plugins.tooltip.callbacks = {
      label: ctx => { const s = stats[ctx.dataIndex]; return s.n ? [`Mín ${fv(v.unit, s.min)} · Máx ${fv(v.unit, s.max)}`, `Q1 ${fv(v.unit, s.q1)} · Mediana ${fv(v.unit, s.median)} · Q3 ${fv(v.unit, s.q3)}`, `Média ${fv(v.unit, s.mean)} · n = ${s.n}`] : 'Sem dados'; },
    };
    CH.upsert('chartBox', {
      type: 'bar',
      data: { labels: D.MUNIS, datasets: [{ label: v.label, data: stats.map(s => s.n ? [s.q1, s.q3] : null),
        backgroundColor: D.MUNIS.map(m => CH.hexA(CH.muniColor(m), sel && sel !== m ? .12 : .35)),
        borderColor: D.MUNIS.map(m => CH.muniColor(m)), borderWidth: 1.5, borderSkipped: false, borderRadius: 3, maxBarThickness: 46,
        boxStats: stats, whiskerColor: c.ink2, meanColor: c.surface }] },
      options: opts,
    }, `Boxplot de ${v.label} por município: ${D.MUNIS.map((m, k) => stats[k].n ? `${m} mediana ${fv(v.unit, stats[k].median)}` : `${m} sem dados`).join('; ')}.`);
  }

  function renderCorr(P, munis) {
    const M = ST.matrix(corrMode, P, munis), dark = ODS.theme.effective() === 'dark';
    const vars = M.vars, n = vars.length;
    const scopeTxt = munis.length === 1 ? munis[0] : 'painel dos 7 municípios × meses';
    $('#corrSub').textContent = `Pearson · ${corrMode === 'diff' ? 'variações mensais (%)' : 'níveis'} · ${scopeTxt} · clique numa célula para ver a dispersão`;
    let h = `<div class="lbl"></div>` + vars.map(k => `<div class="lbl top">${esc(ST.CORR_SHORT[k])}</div>`).join('');
    vars.forEach((a, i) => {
      h += `<div class="lbl">${esc(ST.CORR_SHORT[a])}</div>`;
      vars.forEach((b, j) => {
        const { r, n: nn } = M.r[i][j];
        const bg = ST.corrColor(r, dark), fg = ST.corrText(bg);
        if (i === j) { h += `<div class="c" style="background:${bg};color:${fg}" aria-hidden="true">1</div>`; return; }
        const active = (pair[0] === a && pair[1] === b) || (pair[0] === b && pair[1] === a);
        h += `<button type="button" class="c${active ? ' is-active' : ''}" data-a="${a}" data-b="${b}" style="background:${bg};color:${fg}"
          aria-label="${esc(ST.CORR_SHORT[a])} × ${esc(ST.CORR_SHORT[b])}: r = ${isNum(r) ? fmt2(r) : 'indefinido'}, n = ${nn}, correlação ${u.corrStrength(r)}">${isNum(r) ? fmt2(r) : '—'}<small>n=${nn}</small></button>`;
      });
    });
    const grid = $('#corrMatrix');
    grid.style.gridTemplateColumns = `minmax(64px, .9fr) repeat(${n}, minmax(0, 1fr))`;
    grid.innerHTML = h;
    grid.querySelectorAll('button.c').forEach(b => b.addEventListener('click', () => { pair = [b.dataset.a, b.dataset.b]; renderCorr(S.period(), S.munis()); renderScatter(S.period(), S.munis()); }));
    $('#corrLegend').innerHTML = `<span>−1</span><span class="bar" style="background:linear-gradient(90deg, ${ST.corrColor(-1, dark)}, ${ST.corrColor(0, dark)}, ${ST.corrColor(1, dark)})"></span><span>+1</span><span>· azul = negativa, vermelho = positiva</span>`;
    $('#corrNote').textContent = `Como ler: r varia de −1 a +1; |r| < 0,3 fraca, 0,3–0,5 moderada, > 0,5 forte (Cohen, 1988). "Variação mensal" correlaciona as mudanças percentuais de um mês para o outro dentro de cada município — o que remove o efeito do tamanho do município e da tendência de longo prazo. "Níveis" compara valores absolutos e tende a refletir o porte dos municípios (correlação espúria). A extrema pobreza só existe até fev/2023, por isso seus pares têm n menor; e, como a série de pobreza inclui a extrema pobreza até fev/2023 (reconciliação metodológica), a correlação entre as duas é em parte mecânica. Correlação não indica causalidade.`;
  }

  function renderScatter(P, munis) {
    const [a, b] = pair, c = ODS.theme.colors();
    const pts = ST.pairs(a, b, corrMode, P, munis);
    const { r, n } = u.pearson(pts.map(p => p.x), pts.map(p => p.y));
    const fit = u.linreg(pts.map(p => p.x), pts.map(p => p.y));
    const unit = corrMode === 'diff' ? ' (var. % mensal)' : '';
    $('#scatterSub').textContent = `${ST.CORR_SHORT[a]} (x) × ${ST.CORR_SHORT[b]} (y)${unit} · r = ${isNum(r) ? fmt2(r) : '—'} · n = ${n}`;
    const byMuni = munis.map(m => ({
      type: 'scatter', label: m, data: pts.filter(p => p.m === m).map(p => ({ x: p.x, y: p.y, i: p.i })),
      backgroundColor: CH.hexA(CH.muniColor(m), .65), borderColor: CH.muniColor(m), pointRadius: 3.2, pointHoverRadius: 5,
    }));
    const xs = pts.map(p => p.x);
    const ds = [...byMuni];
    if (fit && xs.length > 2) {
      const x0 = Math.min(...xs), x1 = Math.max(...xs);
      ds.push({ type: 'line', label: 'Reta de regressão', data: [{ x: x0, y: fit.a + fit.b * x0 }, { x: x1, y: fit.a + fit.b * x1 }],
        borderColor: c.ink, borderDash: [6, 4], borderWidth: 1.6, pointRadius: 0, fill: false });
    }
    const f = v => corrMode === 'diff' ? fmtPct(v) : u.fmtCompact(v);
    CH.upsert('chartScatter', {
      type: 'scatter',
      data: { datasets: ds },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { position: 'bottom' },
          tooltip: { callbacks: { label: ctx => ctx.raw.i != null ? ` ${ctx.dataset.label} (${fmtMes(D.L[ctx.raw.i])}): x ${f(ctx.raw.x)} · y ${f(ctx.raw.y)}` : ` ${ctx.dataset.label}` } } },
        scales: {
          x: { type: 'linear', title: { display: true, text: ST.CORR_SHORT[a] + unit, color: c.ink3 }, grid: { color: c.grid }, ticks: { color: c.ink3, callback: f, maxTicksLimit: 6 } },
          y: { title: { display: true, text: ST.CORR_SHORT[b] + unit, color: c.ink3 }, grid: { color: c.grid }, ticks: { color: c.ink3, callback: f, maxTicksLimit: 6 } },
        },
      },
    }, `Dispersão entre ${ST.CORR_SHORT[a]} e ${ST.CORR_SHORT[b]}: r = ${isNum(r) ? fmt2(r) : 'indefinido'}, n = ${n}.`);
  }

  function render() {
    const P = S.period(), munis = S.munis();
    renderTable(P, munis); renderBox(P); renderCorr(P, munis); renderScatter(P, munis);
  }

  function seg(attr, set) {
    $$(`[${attr}]`).forEach(btn => btn.addEventListener('click', () => {
      $$(`[${attr}]`).forEach(b => b.setAttribute('aria-checked', String(b === btn)));
      set(btn.getAttribute(attr));
    }));
  }

  function init() {
    u.fillSelect($('#boxMetric'), Object.entries(ST.VARS).map(([k, v]) => ({ value: k, label: v.label + (v.note ? ` (${v.note})` : '') })), 'pctPob');
    $('#boxMetric').addEventListener('change', () => renderBox(S.period()));
    seg('data-stats-mode', v => { mode = v; renderTable(S.period(), S.munis()); });
    seg('data-corr-mode', v => { corrMode = v; renderCorr(S.period(), S.munis()); renderScatter(S.period(), S.munis()); });
    ODS.router.register('stats', { title: 'Análise estatística', sub: () => `${S.scopeLabel()} · ${S.period().label}`, render });
  }
  return { init };
})();
