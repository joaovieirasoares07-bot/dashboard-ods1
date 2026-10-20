/* =====================================================================
   features/story.js — Narrativa da apresentação.

   GUIDES[pagina] = { question, items(P, munis) }
     Faixa "O que observar" no topo de cada etapa: a pergunta que a etapa
     responde + 2–3 frases curtas que orientam a leitura dos gráficos.
     Todo número citado é calculado dos dados (acompanha os filtros).

   conclusions()
     Achados finais — SEMPRE para o período completo e os 7 municípios,
     para não mudarem com os filtros durante a apresentação.
   ===================================================================== */
ODS.story = (() => {
  const u = ODS.util, D = ODS.data;
  const { fmt, fmtPct, fmtMes, fmtSigned, pct, isNum, esc, icon } = u;
  const L = D.L;
  const b = s => `<strong>${s}</strong>`;
  const J5 = L.indexOf('2023-06');

  /** Pico de uma série no período: {i, v} */
  function peak(key, idx, munis) {
    let best = null;
    idx.forEach(i => { const v = D.agg(key, i, munis); if (isNum(v) && (!best || v > best.v)) best = { i, v }; });
    return best;
  }
  const scopeTxt = munis => munis.length === 1 ? `em ${munis[0]}` : 'nos 7 municípios';
  const corrReading = r => !isNum(r) ? 'indefinida'
    : Math.abs(r) < .3 ? `${u.corrStrength(r)} (r = ${u.fmt2(r)}): os dados não mostram uma relação direta, mês a mês, entre o ritmo do emprego formal e o da pobreza registrada`
    : r < 0 ? `${u.corrStrength(r)} e negativa (r = ${u.fmt2(r)}): meses de mais emprego tendem a coincidir com menor crescimento da pobreza`
    : `${u.corrStrength(r)} e positiva (r = ${u.fmt2(r)}): as duas séries tendem a crescer juntas`;
  function monthlyCorr(P, munis) {
    const ch = ODS.insights.monthlyChanges;
    return u.pearson(ch(D.series('est', P.idx, munis)), ch(D.series('pob', P.idx, munis)));
  }

  const GUIDES = {
    geral: {
      question: 'O que aconteceu entre 2021 e 2026?',
      items(P, M) {
        const t0 = D.agg('tot', P.cadFirst, M), t1 = D.agg('tot', P.cadLast, M);
        const pk = peak('pob', P.idx, M), p1 = D.agg('pob', P.cadLast, M);
        const sal = D.series('sal', P.cgIdx, M).filter(isNum), pos = sal.filter(v => v > 0).length;
        return [
          `Observe a linha vermelha: as famílias no CadÚnico ${scopeTxt(M)} passaram de ${b(fmt(t0))} (${fmtMes(L[P.cadFirst])}) para ${b(fmt(t1))} (${fmtMes(L[P.cadLast])}), ${b(fmtSigned(pct(t1, t0)))}.`,
          `A pobreza (linha amarela) atingiu o pico em ${b(fmtMes(L[pk.i]))} (${fmt(pk.v)} famílias) e terminou em ${fmt(p1)}${P.idx.includes(J5) && P.idx.includes(J5 - 1) ? ' — a queda brusca em jun/2023 é, em boa parte, reclassificação entre faixas na base, não necessariamente melhora real' : ''}.`,
          `No emprego formal, o saldo foi positivo em ${b(`${pos} de ${sal.length}`)} meses: ${pos > sal.length / 2 ? 'as admissões superaram os desligamentos na maior parte do período' : 'os desligamentos predominaram'}.`,
        ];
      },
    },
    vuln: {
      question: 'Quantas famílias estão em situação de vulnerabilidade — e onde?',
      items(P, M) {
        const i = P.cadLast;
        const out = [`Em ${fmtMes(L[i])}, ${b(fmtPct(D.agg('pctPob', i, M)))} das famílias cadastradas ${scopeTxt(M)} estavam em situação de pobreza e ${fmtPct(D.agg('br', i, M) / D.agg('tot', i, M) * 100)} em baixa renda.`];
        const rAbs = D.rank('pob', P), rPct = D.rank('pctPob', P);
        if (M.length > 1) {
          out.push(rAbs[0].m === rPct[0].m
            ? `${b(rAbs[0].m)} lidera tanto em número de famílias em pobreza (${fmt(rAbs[0].v)}) quanto em proporção (${fmtPct(rPct[0].v)}).`
            : `Compare tamanho e proporção: ${b(rAbs[0].m)} tem mais famílias em pobreza (${fmt(rAbs[0].v)}), mas a maior proporção está em ${b(rPct[0].m)} (${fmtPct(rPct[0].v)}).`);
        } else {
          const r = rPct.find(x => x.m === M[0]);
          out.push(`${b(M[0])} é o ${r.rank}º município em proporção de famílias em pobreza entre os 7 (${fmtPct(r.v)}).`);
        }
        out.push('Use o filtro de município (tecla M) para ver cada realidade separadamente.');
        return out;
      },
    },
    trab: {
      question: 'Como evoluiu o emprego formal?',
      items(P, M) {
        const v = pct(D.agg('est', P.cgLast, M), D.agg('est', P.cgFirst, M));
        const rEst = D.rank('varEst', P);
        const neg = D.MUNIS.filter(m => (D.agg('sal', P.cgLast, [m]) || 0) < 0).length;
        return [
          'Admissões (verde) e desligamentos (vermelho) andam juntos; o saldo é a diferença entre eles.',
          `O estoque de empregos formais ${scopeTxt(M)} variou ${b(fmtSigned(v))} entre ${fmtMes(L[P.cgFirst])} e ${fmtMes(L[P.cgLast])}${M.length > 1 ? `; ${b(rEst[0].m)} teve o maior crescimento (${fmtSigned(rEst[0].v)}) e ${rEst[rEst.length - 1].m} o menor (${fmtSigned(rEst[rEst.length - 1].v)})` : ''}.`,
          `No gráfico por município, barras vermelhas indicam mais desligamentos que admissões: ${b(`${neg} de 7`)} municípios tiveram saldo negativo em ${fmtMes(L[P.cgLast])}.`,
        ];
      },
    },
    comp: {
      question: 'Quais municípios apresentam maiores desafios?',
      items(P) {
        const r = D.rank('pctPob', P), top = r[0], low = r[r.length - 1];
        const rv = D.rank('varPob', P);
        return [
          'Compare os municípios para identificar diferenças na vulnerabilidade: troque o indicador do ranking no seletor ao lado.',
          `Em proporção de famílias em pobreza, ${b(top.m)} (${fmtPct(top.v)}) lidera e ${b(low.m)} (${fmtPct(low.v)}) tem o menor valor — diferença de ${fmtSigned(top.v - low.v, ' p.p.').replace('+', '')}. No período, a pobreza cresceu mais em ${b(rv[0].m)} (${fmtSigned(rv[0].v)}).`,
          'Na evolução temporal, o índice 100 coloca todos no mesmo ponto de partida e permite comparar municípios de tamanhos muito diferentes.',
        ];
      },
    },
    geo: {
      question: 'Onde a vulnerabilidade está concentrada no território?',
      items() {
        const r = [...D.MUNIS].sort((a, c) => D.ipvsPct([c]) - D.ipvsPct([a]));
        const v = m => fmtPct(D.ipvsPct([m]));
        return [
          'O mapa permite visualizar a distribuição territorial da vulnerabilidade: quanto mais escura a cor, maior a proporção de domicílios em vulnerabilidade média, alta ou muito alta.',
          `${b(r[0])} (${v(r[0])}) e ${b(r[1])} (${v(r[1])}) se destacam; ${r[6]} tem o menor percentual (${v(r[6])}).`,
          'Passe o mouse para ver os detalhes e clique para filtrar o dashboard. O IPVS é um retrato de 2022.',
        ];
      },
    },
    integ: {
      question: 'O emprego formal acompanha a vulnerabilidade social?',
      items(P, M) {
        const a = pct(D.agg('tot', P.cadLast, M), D.agg('tot', P.cadFirst, M));
        const e = pct(D.agg('est', P.cgLast, M), D.agg('est', P.cgFirst, M));
        const c = monthlyCorr(P, M);
        return [
          'As duas linhas partem de 100. Quando a vermelha (famílias no CadÚnico) fica acima da azul (empregos formais), o cadastro cresceu mais rápido que o emprego.',
          `No período, as famílias no CadÚnico variaram ${b(fmtSigned(a))} e os empregos formais ${b(fmtSigned(e))}.`,
          `Mês a mês, a correlação entre as variações do emprego e da pobreza é ${corrReading(c.r)}.`,
        ];
      },
    },
  };

  /** Desenha a faixa-guia */
  function renderGuide(el, question, items) {
    el.innerHTML = `<div class="guide-q">${icon('target')}<div><span class="guide-k">Pergunta desta etapa</span><p>${esc(question)}</p></div></div>
      <div class="guide-obs"><span class="guide-k">${icon('lightbulb')}O que observar</span><ul>${items.map(t => `<li>${t}</li>`).join('')}</ul></div>`;
  }

  /* ---------------- Conclusões (período completo, 7 municípios) ---------------- */
  function conclusions() {
    const P = D.period(''), M = D.MUNIS;
    const ip = [...M].sort((a, c) => D.ipvsPct([c]) - D.ipvsPct([a]));
    const rPct = D.rank('pctPob', P);
    const t0 = D.agg('tot', P.cadFirst), t1 = D.agg('tot', P.cadLast);
    const p0 = D.agg('pob', P.cadFirst), p1 = D.agg('pob', P.cadLast), pk = peak('pob', P.idx, M);
    const e0 = D.agg('est', P.cgFirst), e1 = D.agg('est', P.cgLast);
    const rEst = D.rank('varEst', P);
    const shareOsasco = D.agg('est', P.cgLast, ['Osasco']) / e1 * 100;
    const c = monthlyCorr(P, M);
    // concentração absoluta: 2 municípios com mais famílias em pobreza
    const rAbs = D.rank('pob', P), share2 = (rAbs[0].v + rAbs[1].v) / p1 * 100;
    const highIpvs = ip.filter(m => D.ipvsPct([m]) >= 50);

    return [
      { ic: 'map', goto: 'geo', gotoLabel: 'Mapa de vulnerabilidade',
        title: 'Os municípios têm níveis muito diferentes de vulnerabilidade',
        big: `${fmtPct(D.ipvsPct([ip[6]]), 0)} – ${fmtPct(D.ipvsPct([ip[0]]), 0)}`, bigLabel: 'domicílios vulneráveis (IPVS 2022)',
        text: `A proporção de domicílios em vulnerabilidade média, alta ou muito alta vai de ${fmtPct(D.ipvsPct([ip[6]]))} em ${ip[6]} a ${fmtPct(D.ipvsPct([ip[0]]))} em ${ip[0]}. No CadÚnico, a parcela de famílias em pobreza varia de ${fmtPct(rPct[rPct.length - 1].v)} (${rPct[rPct.length - 1].m}) a ${fmtPct(rPct[0].v)} (${rPct[0].m}).` },
      { ic: 'users', goto: 'geral', gotoLabel: 'Panorama 2021–2026',
        title: 'A demanda por proteção social cresceu no período',
        big: fmtSigned(pct(t1, t0), '%'), bigLabel: `famílias no CadÚnico (${fmtMes(L[P.cadFirst])} → ${fmtMes(L[P.cadLast])})`,
        text: `As famílias cadastradas passaram de ${fmt(t0)} para ${fmt(t1)}. As famílias em pobreza subiram de ${fmt(p0)} para um pico de ${fmt(pk.v)} em ${fmtMes(L[pk.i])} e terminaram em ${fmt(p1)} (${fmtSigned(pct(p1, p0))} no período) — parte da queda de jun/2023 decorre de reclassificação na base.` },
      { ic: 'briefcase', goto: 'trab', gotoLabel: 'Mercado de trabalho',
        title: 'O emprego formal cresceu, mas de forma desigual',
        big: fmtSigned(pct(e1, e0), '%'), bigLabel: `vínculos formais (${fmtMes(L[P.cgFirst])} → ${fmtMes(L[P.cgLast])})`,
        text: `O estoque passou de ${fmt(e0)} para ${fmt(e1)} vínculos. O crescimento variou de ${fmtSigned(rEst[rEst.length - 1].v)} em ${rEst[rEst.length - 1].m} a ${fmtSigned(rEst[0].v)} em ${rEst[0].m}; Osasco concentra ${fmtPct(shareOsasco, 0)} dos empregos formais dos 7 municípios.` },
      { ic: 'git-compare', goto: 'integ', gotoLabel: 'Análise integrada',
        title: 'Mais emprego não significou, sozinho, menos vulnerabilidade registrada',
        big: `r = ${u.fmt2(c.r)}`, bigLabel: `correlação mensal emprego × pobreza (n = ${c.n})`,
        text: `Enquanto o emprego formal cresceu ${fmtSigned(pct(e1, e0))}, as famílias no CadÚnico cresceram ${fmtSigned(pct(t1, t0))}. Mês a mês, a correlação entre as variações do emprego e da pobreza é ${u.corrStrength(c.r)}. Uma explicação possível (não testada): o CAGED registra o emprego no município da empresa, não no de residência, e parte das vagas pode não alcançar as famílias cadastradas.` },
      { ic: 'triangle-alert', goto: 'vuln', gotoLabel: 'Vulnerabilidade social',
        title: 'A vulnerabilidade está concentrada em poucos municípios',
        big: fmtPct(share2, 0), bigLabel: `das famílias em pobreza estão em ${rAbs[0].m} e ${rAbs[1].m}`,
        text: `Em números absolutos, ${rAbs[0].m} e ${rAbs[1].m} reúnem ${fmtPct(share2)} das ${fmt(p1)} famílias em pobreza. Em proporção, ${highIpvs.length === 1 ? `${highIpvs[0]} é o único município` : `${highIpvs.join(' e ')} são os municípios`} com metade ou mais dos domicílios em vulnerabilidade média, alta ou muito alta.` },
      { ic: 'database', goto: 'metodo', gotoLabel: 'Metodologia',
        title: 'Dados públicos permitem acompanhar o ODS 1 no nível municipal — com limites',
        big: `${L.length} meses`, bigLabel: '3 bases públicas, 7 municípios',
        text: `CadÚnico, Novo CAGED e IPVS permitem acompanhar mês a mês a vulnerabilidade e o emprego. Mas as séries têm quebras (mar/2023 e jun/2023), não há dados de população para taxas por habitante e o IPVS é um retrato de 2022.` },
    ];
  }

  return { GUIDES, renderGuide, conclusions, monthlyCorr };
})();
