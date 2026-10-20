"""
build_data.py — Gera data/dashboard-data.json a partir das bases brutas.

Entradas (data/raw/):
  - cadunico_caged_2021_2026.xlsx  (abas CadUnico e CAGED; cabeçalho na 3ª linha)
  - ipvs_2022_seade.xlsx           (aba DPPO_ESP: domicílios por grupo IPVS 2022)
  - geojs-35-mun.json              (limites municipais de SP — IBGE, via tbrugz/geodata-br)

Tratamentos (documentados também na aba "Metodologia" do dashboard):
  1. Série mensal por município, alinhada ao calendário jan/2021–ago/2026.
     Meses sem registro ficam como null (ex.: CadÚnico abr/2025, CAGED ago/2026).
  2. Quebra metodológica do CadÚnico em mar/2023: até fev/2023 a base separa
     "pobreza" e "extrema pobreza"; a partir de mar/2023 as duas faixas aparecem
     unificadas em "pobreza". Para manter a série comparável, "pob" soma
     extrema pobreza à pobreza até fev/2023. A série "ext" guarda a extrema
     pobreza original apenas no período em que ela existe (até fev/2023).
  3. IPVS: contagens dos 6 grupos (colunas "Total" do estado, setores urbanos+rurais).
  4. Mapa: polígonos projetados (equiretangular com correção de latitude) para
     coordenadas SVG, arredondadas a 0,1 px — sem dependência externa no navegador.

Uso:  python3 scripts/build_data.py
"""
import json
import math
from pathlib import Path

import pandas as pd

ROOT = Path(__file__).resolve().parent.parent
RAW = ROOT / "data" / "raw"
OUT = ROOT / "data" / "dashboard-data.json"

# Código IBGE (7 dígitos) -> nome exibido
MUNICIPIOS = {
    "3505708": "Barueri",
    "3510609": "Carapicuíba",
    "3522505": "Itapevi",
    "3525003": "Jandira",
    "3534401": "Osasco",
    "3539103": "Pirapora do Bom Jesus",
    "3547304": "Santana de Parnaíba",
}
QUEBRA_CADUNICO = pd.Timestamp("2023-03-01")


def load_panel():
    f = RAW / "cadunico_caged_2021_2026.xlsx"
    cad = pd.read_excel(f, sheet_name="CadUnico", header=2)
    cag = pd.read_excel(f, sheet_name="CAGED", header=2)
    for df in (cad, cag):
        df["Data"] = pd.to_datetime(df["Data"])
    ext = cad["Familias_Extrema_Pobreza"].fillna(0)
    antes = cad["Data"] < QUEBRA_CADUNICO
    cad["pob"] = cad["Familias_Pobreza"] + ext.where(antes, 0)          # série reconciliada
    cad["ext"] = cad["Familias_Extrema_Pobreza"].where(antes)            # só até fev/2023
    return cad, cag


def series(df, muni, col, months):
    s = df[df["Municipio"] == muni].set_index("Data")[col]
    out = []
    for d in months:
        v = s.get(d)
        out.append(None if v is None or pd.isna(v) else int(round(float(v))))
    return out


def load_ipvs():
    df = pd.read_excel(RAW / "ipvs_2022_seade.xlsx", sheet_name="DPPO_ESP", header=None)
    g = {}
    for _, r in df.iterrows():
        code = str(r[0]).split(" - ")[0].strip()
        if code in MUNICIPIOS:
            g[MUNICIPIOS[code]] = [int(round(float(r[i]))) for i in range(2, 8)]
    assert len(g) == len(MUNICIPIOS), "IPVS: município faltando"
    return g


def rings(geom):
    if geom["type"] == "Polygon":
        return geom["coordinates"]
    return [r for p in geom["coordinates"] for r in p]


def load_geo():
    g = json.loads((RAW / "geojs-35-mun.json").read_text(encoding="utf-8"))
    feats = {f["properties"]["id"]: f for f in g["features"]}
    xs, ys = [], []
    for code in MUNICIPIOS:
        for ring in rings(feats[code]["geometry"]):
            for x, y in ring:
                xs.append(x); ys.append(y)
    pad = 0.04
    minx, maxx, miny, maxy = min(xs) - pad, max(xs) + pad, min(ys) - pad, max(ys) + pad
    k = math.cos(math.radians((miny + maxy) / 2))
    W = 800
    scale = W / ((maxx - minx) * k)
    H = round((maxy - miny) * scale)

    def proj(x, y):
        return ((x - minx) * k * scale, (maxy - y) * scale)

    def path(f):
        parts = []
        for ring in rings(f["geometry"]):
            pts, last = [], None
            for x, y in ring:
                q = tuple(round(v, 1) for v in proj(x, y))
                if q != last:
                    pts.append(q); last = q
            parts.append("M" + "L".join(f"{a:g},{b:g}" for a, b in pts) + "Z")
        return "".join(parts)

    def centroid(f):
        ring = max(rings(f["geometry"]), key=len)
        P = [proj(x, y) for x, y in ring]
        A = cx = cy = 0.0
        for (x0, y0), (x1, y1) in zip(P, P[1:]):
            c = x0 * y1 - x1 * y0
            A += c; cx += (x0 + x1) * c; cy += (y0 + y1) * c
        A /= 2
        return [round(cx / (6 * A), 1), round(cy / (6 * A), 1)]

    def touches_view(f):
        return any(minx <= x <= maxx and miny <= y <= maxy
                   for ring in rings(f["geometry"]) for x, y in ring)

    neigh = [
        {"n": f["properties"]["name"], "d": path(f), "c": centroid(f)}
        for code, f in feats.items() if code not in MUNICIPIOS and touches_view(f)
    ]
    ours = {name: {"d": path(feats[code]), "c": centroid(feats[code])} for code, name in MUNICIPIOS.items()}
    return {"w": W, "h": H, "ours": ours, "neigh": neigh}


def main():
    cad, cag = load_panel()
    months = pd.date_range(min(cad.Data.min(), cag.Data.min()), max(cad.Data.max(), cag.Data.max()), freq="MS")
    munis = sorted(MUNICIPIOS.values())
    data = {
        "meta": {
            "fontes": {
                "cadunico": "Cadastro Único (MDS) — planilha consolidada do projeto",
                "caged": "Novo CAGED (MTE) — planilha consolidada do projeto",
                "ipvs": "SEADE — Índice Paulista de Vulnerabilidade Social 2022",
                "mapa": "IBGE — malha municipal (via tbrugz/geodata-br)",
            },
            "quebraCadunico": "2023-03",
        },
        "municipios": munis,
        "codigos": {v: k for k, v in MUNICIPIOS.items()},
        "labels": [d.strftime("%Y-%m") for d in months],
        "series": {
            m: {
                "pob": series(cad, m, "pob", months),
                "ext": series(cad, m, "ext", months),
                "br": series(cad, m, "Familias_Baixa_Renda", months),
                "ac": series(cad, m, "Familias_Acima_Meio_SM", months),
                "est": series(cag, m, "Estoque", months),
                "adm": series(cag, m, "Admissoes", months),
                "des": series(cag, m, "Desligamentos", months),
                "sal": series(cag, m, "Saldo", months),
            }
            for m in munis
        },
        "ipvs": load_ipvs(),
        "geo": load_geo(),
    }
    OUT.write_text(json.dumps(data, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")

    # Conferência dos totais já publicados (não podem mudar)
    i_cad, i_cag = data["labels"].index("2026-08"), data["labels"].index("2026-07")
    tot = lambda k, i: sum(data["series"][m][k][i] or 0 for m in munis)
    fam = tot("pob", i_cad) + tot("br", i_cad) + tot("ac", i_cad)
    fam0 = tot("pob", 0) + tot("br", 0) + tot("ac", 0)
    assert (fam, fam0, tot("est", i_cag), tot("sal", i_cag)) == (300517, 179416, 796286, 3052), "Totais divergentes!"
    print(f"OK — {OUT.relative_to(ROOT)} ({OUT.stat().st_size/1024:.0f} KB), {len(months)} meses, {len(munis)} municípios")


if __name__ == "__main__":
    main()
