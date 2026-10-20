# Erradicação da Pobreza · ODS 1

Dashboard analítico sobre pobreza e mercado de trabalho formal em sete municípios paulistas: Barueri, Carapicuíba, Itapevi, Jandira, Osasco, Pirapora do Bom Jesus e Santana de Parnaíba. Combina **Cadastro Único**, **Novo CAGED** e o **IPVS 2022 (SEADE)**, de jan/2021 a ago/2026.

**Acesse:** https://joaovieirasoares07-bot.github.io/dashboard-ods1/

## Roteiro da apresentação

O dashboard serve de apoio visual a uma apresentação acadêmica. As abas formam uma história em 8 etapas. Cada uma abre com a **pergunta** que responde e uma faixa **"O que observar"**, com números calculados a partir dos dados.

| Etapa | Página | Pergunta |
|---|---|---|
| 1 | Introdução | O que é o ODS 1? Qual o objetivo, quais dados, municípios e período? |
| 2 | Panorama 2021–2026 | O que aconteceu entre 2021 e 2026? |
| 3 | Vulnerabilidade social | Quantas famílias estão em situação de vulnerabilidade — e onde? |
| 4 | Mercado de trabalho | Como evoluiu o emprego formal? |
| 5 | Comparação entre municípios | Quais municípios apresentam maiores desafios? |
| 6 | Mapa de vulnerabilidade | Onde a vulnerabilidade está concentrada no território? |
| 7 | Análise integrada | O emprego formal acompanha a vulnerabilidade social? |
| 8 | Conclusões | Seis achados com evidência, limites e mensagem final |
| Apêndice | Painel resumo · Análise estatística · Metodologia | Para perguntas da banca |

**Durante a apresentação:** as setas `←` `→` (ou os botões no fim de cada página) avançam pelas etapas. A tecla `F` abre o **modo apresentação**, em tela cheia, com letras maiores e uma barra de navegação flutuante. A tecla `?` lista os atalhos.

Filtros globais de **município** e **ano**. As Conclusões usam sempre o período completo e os 7 municípios. Também há modo escuro, impressão/PDF de todas as páginas e versão para celular. O arquivo funciona **offline**.

## Estrutura do projeto

```
├── index.html              ← arquivo único gerado (publicado no GitHub Pages)
├── src/
│   ├── index.html          ← estrutura das páginas (template)
│   ├── partials/           ← Introdução, Conclusões e Metodologia
│   ├── css/                ← tokens.css · base.css · components.css · pages.css · print.css
│   └── js/
│       ├── core/           ← util (formatação/estatística) · data · state · theme · charts · router
│       ├── features/       ← kpis · insights · map · stats · compare · a11y · story (narrativa)
│       ├── pages/          ← story-pages (Introdução, Conclusões) · exec · panels · geo · comp · stats
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
