/* =====================================================================
   tests/regression.js — Teste automático de regressão (Playwright).

   Verifica, no index.html gerado e SEM internet:
     1. nenhuma exceção / erro de console;
     2. todas as 9 páginas abrem e desenham seus gráficos e componentes;
     3. números de referência continuam iguais (não alterar resultados);
     4. filtros de município e ano, clique no mapa, atalhos de teclado;
     5. modo escuro, impressão (todas as páginas) e ausência de rolagem
        horizontal em 390 px (celular).
   Uso: node tests/regression.js [--shots DIR]
   ===================================================================== */
const path = require('path');
const { chromium } = require('playwright');

const FILE = 'file://' + path.resolve(__dirname, '..', 'index.html');
const SHOTS = process.argv.includes('--shots') ? process.argv[process.argv.indexOf('--shots') + 1] : null;
const PAGES = ['intro', 'geral', 'vuln', 'trab', 'comp', 'geo', 'integ', 'concl', 'exec', 'stats', 'metodo'];
const CHARTS = {
  geral: ['chartCadLine', 'chartCagedLine'], vuln: ['chartVulnBar', 'chartFaixaBar'], trab: ['chartAdmDesl', 'chartSaldoBar'],
  geo: ['chartIpvs'], comp: ['chartRank', 'chartSbsPob', 'chartSbsEst', 'chartEvo'], integ: ['chartIndice'],
  stats: ['chartBox', 'chartScatter'],
};
let failures = 0;
const ok = (cond, msg) => { console.log(`${cond ? '  ✓' : '  ✗'} ${msg}`); if (!cond) failures++; };

(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium' });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error' && !/net::|Failed to load resource/.test(m.text())) errors.push('console: ' + m.text()); });
  await page.route(/^https?:/, r => r.abort()); // offline
  await page.goto(FILE);
  await page.waitForTimeout(400);

  const go = async id => { await page.click(`.nav-item[data-page="${id}"]`); await page.waitForTimeout(250); };
  const text = sel => page.$eval(sel, e => e.innerText);

  console.log('1. Páginas e componentes');
  for (const id of PAGES) {
    await go(id);
    const active = await page.$eval(`#page-${id}`, e => e.classList.contains('active'));
    const charts = await page.evaluate(ids => ids.filter(i => ODS.charts.registry.has(i)), CHARTS[id] || []);
    ok(active && charts.length === (CHARTS[id] || []).length, `${id}: ativa, ${charts.length}/${(CHARTS[id] || []).length} gráficos`);
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/${id}.png`, fullPage: true });
  }
  console.log('1b. Narrativa');
  await go('intro');
  ok(await page.$$eval('#introMunis li', e => e.length) === 7 && await page.$$eval('#introMap path.muni', e => e.length) === 7, 'intro: 7 municípios na lista e no mapa');
  ok(await page.$eval('#page-intro .story-nav .sn.next', e => e.dataset.goto) === 'geral', 'intro: botão "Próxima" leva ao Panorama');
  for (const id of ['geral', 'vuln', 'trab', 'comp', 'geo', 'integ']) {
    await go(id);
    ok(await page.$$eval(`#guide-${id} li`, e => e.length) >= 3, `${id}: faixa "O que observar" com 3 frases`);
  }
  await go('concl');
  ok(await page.$$eval('#conclList .concl', e => e.length) === 6, 'concl: 6 conclusões');
  ok((await text('#conclList')).includes('+67,5%'), 'concl: usa período completo (+67,5% famílias no CadÚnico)');
  await go('intro');
  await page.keyboard.press('ArrowRight'); await page.waitForTimeout(200);
  ok(await page.$eval('#page-geral', e => e.classList.contains('active')), 'Seta → avança para a etapa 2');
  ok((await page.$eval('#pageEyebrow', e => e.textContent)) === 'Etapa 2 de 8', 'Cabeçalho mostra "Etapa 2 de 8"');
  await page.keyboard.press('f'); await page.waitForTimeout(300);
  ok(await page.evaluate(() => document.body.classList.contains('presenting')) && await page.$eval('#presentBar', e => !e.hidden), 'Tecla F ativa o modo apresentação');
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/present-geral.png` });
  await page.click('#presentBar [data-story="next"]'); await page.waitForTimeout(250);
  ok(await page.$eval('#page-vuln', e => e.classList.contains('active')), 'Barra do modo apresentação avança etapa');
  await page.keyboard.press('f'); await page.waitForTimeout(250);
  ok(await page.evaluate(() => !document.body.classList.contains('presenting')), 'Tecla F sai do modo apresentação');

  await go('exec');
  ok(await page.$$eval('#kpiGrid .kpi', e => e.length) === 8, 'exec: 8 KPIs');
  ok(await page.$$eval('#insightsList .insight', e => e.length) >= 5, 'exec: ≥ 5 insights');
  ok(await page.$$eval('#execRank .rank-row', e => e.length) === 7, 'exec: ranking com 7 municípios');
  ok(await page.$$eval('#execTrends .spark > svg', e => e.length) === 4, 'exec: 4 tendências');
  ok(await page.$$eval('#execMap path.muni', e => e.length) === 7, 'exec: mini mapa com 7 municípios');

  console.log('2. Números de referência (sem filtro)');
  await go('geral');
  const g = await text('#cards-geral');
  ok(g.includes('300.517') && g.includes('796.286') && g.includes('112.504'), 'Panorama: 300.517 famílias, 796.286 empregos, 112.504 em pobreza');
  await go('vuln');
  const v = await text('#cards-vuln');
  ok(['112.504', '63.938', '124.075'].every(n => v.includes(n)), 'Vulnerabilidade: pobreza 112.504, baixa renda 63.938, acima 124.075');
  await go('geo');
  ok((await text('#tableIpvs')).includes('80,3%'), 'IPVS: Pirapora 80,3%');

  console.log('3. Filtros (Osasco · 2024)');
  await page.selectOption('#anoFilter', '2024');
  await page.selectOption('#muniFilter', 'Osasco');
  await page.waitForTimeout(300);
  await go('geral');
  const g2 = await text('#cards-geral');
  ok(['105.999', '20.415', '202.138', '12.678'].every(n => g2.includes(n)), 'Visão Geral filtrada: 105.999 · 20.415 · 202.138 · +12.678');
  await go('trab');
  const t2 = await text('#cards-trab');
  ok(t2.includes('112.002') && t2.includes('99.324'), 'Trabalho filtrado: admissões 112.002, desligamentos 99.324');
  await go('exec');
  ok((await text('#execSummary')).includes('Osasco'), 'Resumo executivo reflete o filtro');

  console.log('4. Mapa e teclado');
  await page.keyboard.press('l'); await page.waitForTimeout(200);
  ok(await page.$eval('#muniFilter', e => e.value) === '' && await page.$eval('#anoFilter', e => e.value) === '', 'Tecla L limpa filtros');
  await go('geo');
  await page.click('#ipvsMap path.muni[data-m="Itapevi"]'); await page.waitForTimeout(200);
  ok(await page.$eval('#muniFilter', e => e.value) === 'Itapevi', 'Clique no mapa filtra Itapevi');
  await page.click('#ipvsMap path.muni[data-m="Itapevi"]'); await page.waitForTimeout(200);
  ok(await page.$eval('#muniFilter', e => e.value) === '', 'Segundo clique remove o filtro');
  await page.hover('#ipvsMap path.muni[data-m="Osasco"]'); await page.waitForTimeout(150);
  ok(await page.$eval('#mapTip', e => !e.hidden && e.innerText.includes('Osasco')), 'Tooltip do mapa ao passar o mouse');
  const vb0 = await page.$eval('#ipvsMap svg', e => e.getAttribute('viewBox'));
  await page.click('#ipvsMap [data-z="in"]'); await page.waitForTimeout(100);
  ok(vb0 !== await page.$eval('#ipvsMap svg', e => e.getAttribute('viewBox')), 'Botão de zoom altera o enquadramento');
  await page.mouse.move(5, 5);
  await page.locator('body').click({ position: { x: 600, y: 5 } }).catch(() => {});
  await page.keyboard.press('3'); await page.waitForTimeout(200);
  ok(await page.$eval('#page-vuln', e => e.classList.contains('active')), 'Tecla 3 abre a etapa 3 (Vulnerabilidade social)');
  await page.keyboard.press('?'); await page.waitForTimeout(100);
  ok(await page.$eval('#helpDialog', e => e.open), 'Tecla ? abre a ajuda');
  await page.keyboard.press('Escape');

  console.log('5. Modo escuro e impressão');
  await page.keyboard.press('d'); await page.waitForTimeout(300);
  ok(await page.evaluate(() => document.documentElement.dataset.themeEffective === 'dark'), 'Tecla D ativa o modo escuro');
  await go('stats');
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/stats-dark.png`, fullPage: true });
  await go('exec');
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/exec-dark.png` });
  await page.keyboard.press('d'); await page.waitForTimeout(200);
  await page.emulateMedia({ media: 'print' });
  await page.evaluate(() => window.dispatchEvent(new Event('beforeprint')));
  await page.waitForTimeout(400);
  const all = Object.values(CHARTS).flat();
  const drawn = await page.evaluate(ids => ids.filter(i => ODS.charts.registry.has(i)).length, all);
  ok(drawn === all.length, `Impressão: ${drawn}/${all.length} gráficos desenhados`);
  if (SHOTS) await page.pdf({ path: `${SHOTS}/dashboard.pdf`, format: 'A4', landscape: true, printBackground: true });
  await page.evaluate(() => window.dispatchEvent(new Event('afterprint')));
  await page.emulateMedia({ media: 'screen' });

  console.log('6. Celular (390 px)');
  const m = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  m.on('pageerror', e => errors.push('mobile pageerror: ' + e.message));
  await m.route(/^https?:/, r => r.abort());
  await m.goto(FILE); await m.waitForTimeout(300);
  for (const id of PAGES) {
    await m.click(`.nav-item[data-page="${id}"]`); await m.waitForTimeout(200);
    const w = await m.evaluate(() => document.documentElement.scrollWidth);
    ok(w <= 390, `${id}: largura ${w}px`);
    if (SHOTS && ['intro', 'geral', 'concl', 'geo'].includes(id)) await m.screenshot({ path: `${SHOTS}/m-${id}.png`, fullPage: true });
  }

  console.log('7. Erros');
  ok(errors.length === 0, `Sem erros (${errors.length})`);
  errors.slice(0, 10).forEach(e => console.log('    ' + e));
  await browser.close();
  console.log(failures ? `\n${failures} falha(s)` : '\nTodos os testes passaram');
  process.exit(failures ? 1 : 0);
})();
