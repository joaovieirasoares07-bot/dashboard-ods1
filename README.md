# Erradicação da Pobreza · ODS 1

Dashboard analítico sobre pobreza e mercado de trabalho formal em sete municípios paulistas: Barueri, Carapicuíba, Itapevi, Jandira, Osasco, Pirapora do Bom Jesus e Santana de Parnaíba. Combina **Cadastro Único**, **Novo CAGED** e o **IPVS 2022 (SEADE)**, de jan/2021 a ago/2026.

**Acesse:** https://joaovieirasoares07-bot.github.io/dashboard-ods1/

## Páginas

| # | Página | Conteúdo |
|---|---|---|
| 1 | Resumo Executivo | Resumo em texto, 8 KPIs com comparação anual, mini mapa, insights automáticos, ranking e tendências |
| 2 | Visão Geral | Famílias no CadÚnico; admissões, desligamentos e saldo |
| 3 | Vulnerabilidade Social | Faixas de renda, pobreza por município, tabela detalhada |
| 4 | Mercado de Trabalho | Fluxos do CAGED e saldo por município |
| 5 | Vulnerabilidade Geográfica | Mapa IPVS com zoom, tooltip e legenda interativa; composição por grupo |
| 6 | Comparações | Ranking automático, comparação lado a lado, evolução temporal |
| 7 | Análise Integrada | Índices base 100 de famílias e empregos; crescimento por município |
| 8 | Análise Estatística | Estatística descritiva, boxplots, matriz de correlação e dispersão |
| 9 | Metodologia | Fontes, tratamento, fórmulas, métodos, período e limitações |

Filtros globais de **município** e **ano**. Também há **modo escuro**, **atalhos de teclado** (tecla `?`), **impressão/PDF** de todas as páginas e versão para **celular**. O arquivo funciona **offline**.

## Estrutura do projeto

```
├── index.html              ← arquivo único gerado (publicado no GitHub Pages)
├── src/
│   ├── index.html          ← estrutura das páginas (template)
│   ├── partials/           ← conteúdo da Metodologia
│   ├── css/                ← tokens.css · base.css · components.css · pages.css · print.css
│   └── js/
│       ├── core/           ← util (formatação/estatística) · data · state · theme · charts · router
│       ├── features/       ← kpis · insights · map · stats · compare · a11y
│       ├── pages/          ← exec · panels · geo · comp · stats
│       └── main.js
├── data/
│   ├── raw/                ← planilhas originais e malha municipal
│   └── dashboard-data.json ← dados tratados (gerado)
├── scripts/
│   ├── build_data.py       ← planilhas → JSON (com conferência dos totais)
│   └── build.py            ← src + dados + bibliotecas → index.html único
├── tests/regression.js     ← teste automático (Playwright)
└── vendor/                 ← Chart.js 4.4.1 (MIT) e ícones Lucide (ISC)
```

## Como reproduzir

```bash
pip install pandas openpyxl
python3 scripts/build_data.py   # gera data/dashboard-data.json
python3 scripts/build.py        # gera index.html
npm i playwright && node tests/regression.js   # opcional: teste de regressão
```

## Decisões metodológicas principais

- **Quebra do CadÚnico em mar/2023.** A extrema pobreza passou a ser contada dentro de "pobreza". Até fev/2023 a série de pobreza soma as duas faixas, para ficar comparável.
- **Reclassificação em jun/2023.** Cerca de 33 mil famílias passam de "pobreza" para "acima de 1/2 SM" sem que o total mude. Os dados foram mantidos como na fonte, e o painel avisa sobre esse ponto.
- **Estoques e fluxos.** Estoques (famílias, empregos) usam o último mês do período. Fluxos (admissões, desligamentos, saldo) são somados.
- **Correlação.** O padrão é calculá-la sobre as variações mensais dentro de cada município, o que evita correlação espúria causada pelo porte dos municípios.
- **Insights automáticos.** Os números vêm dos dados. As hipóteses aparecem marcadas como hipótese e não foram testadas.

Detalhes completos na página **Metodologia** do dashboard.
