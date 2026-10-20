"""
build.py — Empacota o projeto em um único index.html autocontido (funciona offline).

  src/index.html       -> template com marcadores <!-- @inline-... -->
  src/css/*.css        -> embutidos em <style> (ordem definida em CSS_FILES)
  vendor/icons/*.svg   -> convertidos em um sprite SVG (<symbol id="i-NOME">)
  vendor/chart.umd.js  -> Chart.js 4.4.1 (MIT)
  data/dashboard-data.json -> const DATA
  src/js/**            -> embutidos na ordem de JS_FILES

Uso:  python3 scripts/build.py      (gera ./index.html na raiz, publicado pelo GitHub Pages)
"""
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "src"

CSS_FILES = ["tokens.css", "base.css", "components.css", "pages.css", "story.css", "print.css"]
JS_FILES = [
    "core/util.js",      # formatação, estatística, DOM
    "core/data.js",      # agregações e períodos (com cache)
    "core/state.js",     # filtros e eventos
    "core/theme.js",     # modo claro/escuro e paleta
    "core/charts.js",    # fábrica de gráficos Chart.js
    "core/router.js",    # abas e renderização sob demanda
    "features/kpis.js",
    "features/insights.js",
    "features/map.js",
    "features/stats.js",
    "features/compare.js",
    "features/a11y.js",
    "features/story.js",   # narrativa: textos "O que observar" e conclusões
    "pages/story-pages.js",  # Introdução e Conclusões
    "pages/exec.js",
    "pages/panels.js",   # Visão Geral, Vulnerabilidade, Trabalho, Integrada (painéis originais)
    "pages/geo.js",
    "pages/comp.js",
    "pages/stats.js",
    "main.js",
]


def icon_sprite():
    symbols = []
    for f in sorted((ROOT / "vendor" / "icons").glob("*.svg")):
        svg = f.read_text(encoding="utf-8")
        inner = re.search(r"<svg[^>]*>(.*)</svg>", svg, re.S).group(1)
        inner = re.sub(r"\s+", " ", inner).strip()
        symbols.append(f'<symbol id="i-{f.stem}" viewBox="0 0 24 24">{inner}</symbol>')
    return ('<svg xmlns="http://www.w3.org/2000/svg" style="display:none" aria-hidden="true">'
            "<!-- Ícones: Lucide (ISC) -->" + "".join(symbols) + "</svg>")


def safe_script(code):
    # impede que um "</script" literal feche a tag antes da hora
    return code.replace("</script", "<\\/script")


def main():
    html = (SRC / "index.html").read_text(encoding="utf-8")

    def partial(m):
        return (SRC / "partials" / m.group(1)).read_text(encoding="utf-8")
    html = re.sub(r"<!-- @inline-partial:([\w.-]+) -->", partial, html)

    css = "\n".join(f"/* ==== {n} ==== */\n" + (SRC / "css" / n).read_text(encoding="utf-8") for n in CSS_FILES)
    data = json.loads((ROOT / "data" / "dashboard-data.json").read_text(encoding="utf-8"))
    js = "\n".join(f"/* ==== {n} ==== */\n" + (SRC / "js" / n).read_text(encoding="utf-8") for n in JS_FILES)
    chart = (ROOT / "vendor" / "chart.umd.js").read_text(encoding="utf-8")

    html = html.replace("<!-- @inline-css -->", f"<style>\n{css}\n</style>")
    html = html.replace("<!-- @inline-icons -->", icon_sprite())
    scripts = (
        f"<script>/* Chart.js 4.4.1 — MIT */\n{safe_script(chart)}\n</script>\n"
        f"<script>const DATA = {json.dumps(data, ensure_ascii=False, separators=(',', ':'))};</script>\n"
        f"<script>\n'use strict';\n{safe_script(js)}\n</script>"
    )
    html = html.replace("<!-- @inline-js -->", scripts)
    leftover = re.findall(r"<!-- @inline-[^>]*-->", html)
    assert not leftover, f"Marcadores não substituídos: {leftover}"
    out = ROOT / "index.html"
    out.write_text(html, encoding="utf-8")
    print(f"OK — index.html ({out.stat().st_size/1024:.0f} KB)")


if __name__ == "__main__":
    main()
