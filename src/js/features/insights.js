/* =====================================================================
   features/insights.js — Geração automática de "Principais Insights".

   Cada insight é calculado a partir dos dados filtrados (nenhum número é
   digitado à mão). Os textos seguem três regras:
     1. todo número citado vem de um cálculo mostrado no dashboard;
     2. correlação nunca é apresentada como causalidade;
     3. "possíveis explicações" aparecem marcadas como HIPÓTESE — elas
        indicam o que investigar, não conclusões dos dados.
   ===================================================================== */
ODS.insights = (() => {
  const u = ODS.util, D = ODS.data;
  const { fmt, fmtPct, fmtMes, fmtSigned, fmtSignedInt, pct, isNum, esc } = u;

  const ord = n => `${n}º`;
  const L = D.L;

  /** Variação mensal em % de uma série */
  const monthlyChanges = arr => arr.map((v, k) => k && isNum(v) && isNum(arr[k - 1]) && arr[k - 1] ? (v - arr[k - 1]) / arr[k - 1] * 100 : null);

  /** Tendência linear: variação anual estimada em % da média */
  function trend(key, idx, munis) {
    const ys = D.series(key, idx, munis);
    const xs = idx.map((_, k) => k);
    const fit = u.linreg(xs, ys);
    const m = u.mean(ys);
    if (!fit || !m) return null;
    return { perYear: fit.b * 12, perYearPct: fit.b * 12 / m * 100 };
  }
  const trendWord = p => !isNum(p) ? 'estável' : Math.abs(p) < 1 ? 'estabilidade' : p > 0 ? 'alta' : 'queda';

  /** Frase-resumo do topo da página executiva */
  function summary(P, munis) {
    const scope = munis.length === 1 ? munis[0] : 'os 7 municípios';
    const tot = D.agg('tot', P.cadLast, munis), pob = D.agg('pob', P.cadLast, munis), pp = D.agg('pctPob', P.cadLast, munis);
    const est = D.agg('est', P.cgLast, munis);
    const sal = D.sumOver('sal', P.cgIdx, munis);
    return `${u.icon('info')}<p>Em <strong>${fmtMes(L[P.cadLast])}</strong>, ${scope === 'os 7 municípios' ? 'os 7 municípios somavam' : `<strong>${esc(scope)}</strong> tinha`} <strong>${fmt(tot)}</strong> famílias no CadÚnico, das quais <strong>${fmt(pob)}</strong> (${fmtPct(pp)}) em situação de pobreza. O emprego formal chegou a <strong>${fmt(est)}</strong> vínculos em ${fmtMes(L[P.cgLast])}, com saldo acumulado de <strong>${fmtSignedInt(sal)}</strong> em ${P.ano ? P.ano : 'todo o período'}.</p>`;
  }

  /** Lista de insights para o escopo atual */
  function generate(P, munis) {
    const out = [];
    const all = D.MUNIS;
    const single = munis.length === 1 ? munis[0] : null;
    const periodTxt = `entre ${fmtMes(L[P.cadFirst])} e ${fmtMes(L[P.cadLast])}`;
    const periodCg = `entre ${fmtMes(L[P.cgFirst])} e ${fmtMes(L[P.cgLast])}`;

    /* 1. Vulnerabilidade territorial (IPVS) */
    const rIpvs = D.rank('ipvs', P);
    const avgIpvs = D.ipvsPct(all, 'vuln');
    if (single) {
      const r = rIpvs.find(x => x.m === single);
      out.push({ ic: 'map', tone: r.v > avgIpvs ? 'bad' : 'good', title: 'Vulnerabilidade territorial',
        text: `${fmtPct(r.v)} dos domicílios de ${single} estão em vulnerabilidade média, alta ou muito alta (IPVS 2022) — ${ord(r.rank)} maior percentual entre os 7 municípios (conjunto: ${fmtPct(avgIpvs)}).` });
    } else {
      const top = rIpvs[0], low = rIpvs[rIpvs.length - 1];
      out.push({ ic: 'map', tone: 'bad', title: 'Município com maior vulnerabilidade',
        text: `${top.m} tem ${fmtPct(top.v)} dos domicílios em vulnerabilidade média, alta ou muito alta (IPVS 2022), ${fmtSigned(top.v - avgIpvs, ' p.p.')} acima do conjunto (${fmtPct(avgIpvs)}). O menor percentual é o de ${low.m} (${fmtPct(low.v)}).` });
    }

    /* 2. Concentração de pobreza no CadÚnico */
    const rPct = D.rank('pctPob', P);
    if (!single) {
      const t = rPct[0];
      out.push({ ic: 'triangle-alert', tone: 'bad', title: 'Maior concentração de pobreza no CadÚnico',
        text: `Em ${fmtMes(L[P.cadLast])}, ${t.m} tem a maior proporção de famílias cadastradas em situação de pobreza: ${fmtPct(t.v)}, contra ${fmtPct(D.agg('pctPob', P.cadLast))} no conjunto.` });
    }

    /* 3–4. Maior redução / aumento da pobreza */
    const rVar = D.rank('varPob', P); // maior variação primeiro
    if (rVar.length && P.cadFirst !== P.cadLast) {
      if (single) {
        const r = rVar.find(x => x.m === single);
        const avg = pct(D.agg('pob', P.cadLast), D.agg('pob', P.cadFirst));
        out.push({ ic: r.v > 0 ? 'trending-up' : 'trending-down', tone: r.v > 0 ? 'bad' : 'good', title: 'Evolução da pobreza',
          text: `As famílias em pobreza em ${single} variaram ${fmtSigned(r.v)} ${periodTxt} (de ${fmt(D.agg('pob', P.cadFirst, munis))} para ${fmt(D.agg('pob', P.cadLast, munis))}), ${r.v > avg ? 'acima' : 'abaixo'} da variação do conjunto (${fmtSigned(avg)}). É a ${ord(8 - r.rank)} menor variação entre os 7.` });
      } else {
        const best = rVar[rVar.length - 1], worst = rVar[0];
        if (best.v < 0) {
          out.push({ ic: 'trending-down', tone: 'good', title: 'Maior redução da pobreza',
            text: `${best.m} teve a maior redução de famílias em pobreza ${periodTxt}: ${fmtSigned(best.v)} (de ${fmt(D.agg('pob', P.cadFirst, [best.m]))} para ${fmt(D.agg('pob', P.cadLast, [best.m]))}).` });
        } else {
          out.push({ ic: 'trending-down', tone: 'gold', title: 'Nenhum município reduziu a pobreza',
            text: `Todos os 7 municípios registraram aumento de famílias em pobreza ${periodTxt}. O menor aumento foi em ${best.m} (${fmtSigned(best.v)}).` });
        }
        out.push({ ic: 'trending-up', tone: worst.v > 0 ? 'bad' : 'good', title: 'Maior aumento da pobreza',
          text: `${worst.m} teve a maior variação de famílias em pobreza ${periodTxt}: ${fmtSigned(worst.v)} (de ${fmt(D.agg('pob', P.cadFirst, [worst.m]))} para ${fmt(D.agg('pob', P.cadLast, [worst.m]))}).`,
          hyp: worst.v > 0 ? 'Hipótese: o aumento de famílias registradas pode refletir tanto piora de renda quanto maior cobertura do cadastro (busca ativa, reformulação do Bolsa Família em 2023). Os dados disponíveis não separam esses dois efeitos.' : null });
      }
    }

    /* 5. Crescimento do emprego formal */
    const rEst = D.rank('varEst', P);
    if (rEst.length && P.cgFirst !== P.cgLast) {
      if (single) {
        const r = rEst.find(x => x.m === single);
        out.push({ ic: 'briefcase', tone: r.v >= 0 ? 'good' : 'bad', title: 'Emprego formal',
          text: `O estoque de empregos formais em ${single} variou ${fmtSigned(r.v)} ${periodCg} — ${ord(r.rank)} maior crescimento entre os 7 municípios.` });
      } else {
        const top = rEst[0], low = rEst[rEst.length - 1];
        out.push({ ic: 'briefcase', tone: 'good', title: 'Maior crescimento do emprego',
          text: `${top.m} teve o maior crescimento do estoque de empregos formais ${periodCg}: ${fmtSigned(top.v)} (de ${fmt(D.agg('est', P.cgFirst, [top.m]))} para ${fmt(D.agg('est', P.cgLast, [top.m]))} vínculos). O menor desempenho foi em ${low.m} (${fmtSigned(low.v)}).` });
      }
    }

    /* 6. Tendências (regressão linear sobre o período) */
    const idxCad = D.trimTail(P.idx, 'pob'), idxCg = P.cgIdx;
    const tp = trend('pob', idxCad, munis), te = trend('est', idxCg, munis);
    const sal = D.series('sal', idxCg, munis).filter(isNum);
    const posMonths = sal.filter(v => v > 0).length;
    if (tp && te && idxCad.length >= 4) {
      out.push({ ic: 'activity', tone: 'brand', title: 'Tendências observadas',
        text: `Famílias em pobreza: tendência de ${trendWord(tp.perYearPct)} (${fmtSigned(tp.perYearPct)} ao ano, ≈ ${fmtSignedInt(tp.perYear)} famílias/ano). Emprego formal: tendência de ${trendWord(te.perYearPct)} (${fmtSigned(te.perYearPct)} ao ano). O saldo de empregos foi positivo em ${posMonths} de ${sal.length} meses.` });
    }

    /* 7. Relação emprego × pobreza (variações mensais) */
    const cP = monthlyChanges(D.series('pob', P.idx, munis));
    const cE = monthlyChanges(D.series('est', P.idx, munis));
    const corr = u.pearson(cE, cP);
    if (isNum(corr.r) && corr.n >= 6) {
      const s = u.corrStrength(corr.r);
      const reading = Math.abs(corr.r) < .3
        ? 'não há associação clara, mês a mês, entre o ritmo do emprego formal e o da pobreza registrada'
        : corr.r < 0 ? 'meses de maior crescimento do emprego tendem a coincidir com menor crescimento da pobreza registrada'
        : 'as duas séries tendem a crescer juntas, o que sugere fatores comuns (como crescimento populacional ou do cadastro)';
      const bothUp = tp && te && tp.perYear > 0 && te.perYear > 0;
      out.push({ ic: 'git-compare', tone: 'gold', title: 'Emprego e pobreza',
        text: `Correlação de Pearson entre as variações mensais do emprego formal e das famílias em pobreza: r = ${u.fmt2(corr.r)} (${s}, n = ${corr.n} meses) — ${reading}. Correlação não implica causalidade.`,
        hyp: bothUp ? 'Hipótese: o emprego cresce sem reduzir a pobreza registrada porque o CAGED conta vínculos pelo endereço do estabelecimento, não da residência — vagas em polos como Barueri podem ser ocupadas por moradores de outros municípios — e porque parte das vagas pode não alcançar as famílias do cadastro.' : null });
    }

    /* Qualidade dos dados: reclassificação entre faixas em jun/2023 */
    const i5 = L.indexOf('2023-05'), i6 = L.indexOf('2023-06');
    if (P.idx.includes(i5) && P.idx.includes(i6)) {
      const dPob = D.agg('pob', i6, munis) - D.agg('pob', i5, munis);
      const dAc = D.agg('ac', i6, munis) - D.agg('ac', i5, munis);
      const dTot = D.agg('tot', i6, munis) - D.agg('tot', i5, munis);
      if (dPob < 0 && dAc > 0 && Math.abs(dPob) > 0.1 * D.agg('pob', i5, munis)) {
        out.push({ ic: 'info', tone: 'gold', title: 'Atenção à série: jun/2023',
          text: `De mai para jun/2023, as famílias em pobreza variaram ${fmtSignedInt(dPob)} e as famílias acima de 1/2 SM ${fmtSignedInt(dAc)}, enquanto o total do CadÚnico variou só ${fmtSignedInt(dTot)}. O movimento indica reclassificação entre faixas de renda na base, não necessariamente mudança real de renda — variações que atravessam essa data devem ser lidas com cautela.`,
          hyp: 'Hipótese: mudança de critério de cálculo da renda familiar no CadÚnico em 2023 (a base não informa a causa).' });
      }
    }

    /* 8. Rotatividade */
    const rRot = D.rank('rot', P);
    if (!single && rRot.length) {
      const t = rRot[0];
      out.push({ ic: 'rotate-ccw', tone: 'gold', title: 'Rotatividade do emprego',
        text: `${t.m} tem a maior taxa média de rotatividade (${fmtPct(t.v)} ao mês: média de admissões e desligamentos sobre o estoque). No conjunto, a taxa média é de ${fmtPct(u.mean(D.series('rot', P.cgIdx)))}.` });
    }
    return out;
  }

  /** HTML da lista */
  function render(list) {
    return list.map((it, k) => `<li class="insight tone-${it.tone}" style="animation-delay:${k * 0.04}s">
      <span class="insight-icon">${u.icon(it.ic)}</span>
      <div><h3>${esc(it.title)}</h3><p>${esc(it.text)}${it.hyp ? `<span class="hyp">${esc(it.hyp)}</span>` : ''}</p></div>
    </li>`).join('');
  }

  return { generate, render, summary, trend, monthlyChanges };
})();
