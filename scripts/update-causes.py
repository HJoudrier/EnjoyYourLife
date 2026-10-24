#!/usr/bin/env python3
"""Met à jour js/causes.js : les principales causes de décès par âge et par sexe.

Source : Eurostat, jeu de données hlth_cd_aro (« Causes de décès - nombres
absolus par pays de résidence et d'occurrence »), qui reprend pour la France
les données du CépiDc de l'Inserm. On garde les décès des résidents en France
pour la dernière année complète.

Usage : python3 scripts/update-causes.py [année]
"""

import json
import sys
import urllib.request
from pathlib import Path

API = (
    "https://ec.europa.eu/eurostat/api/dissemination/statistics/1.0/data/hlth_cd_aro"
    "?format=JSON&lang=FR&geo=FR&unit=NR&resid=TOT_IN&sinceTimePeriod={since}"
)
PAGE = "https://ec.europa.eu/eurostat/databrowser/view/hlth_cd_aro/default/table?lang=fr"
OUT = Path(__file__).resolve().parent.parent / "js" / "causes.js"
TOP = 10

# Tranches d'âge de l'application : [âge de début, âge de fin exclu, codes Eurostat].
GROUPS = [
    (0, 1, ["Y_LT1"]),
    (1, 5, ["Y1-4"]),
    (5, 15, ["Y5-9", "Y10-14"]),
    (15, 25, ["Y15-19", "Y20-24"]),
    (25, 35, ["Y25-29", "Y30-34"]),
    (35, 45, ["Y35-39", "Y40-44"]),
    (45, 55, ["Y45-49", "Y50-54"]),
    (55, 65, ["Y55-59", "Y60-64"]),
    (65, 75, ["Y65-69", "Y70-74"]),
    (75, 85, ["Y75-79", "Y80-84"]),
    (85, 95, ["Y85-89", "Y90-94"]),
    (95, None, ["Y_GE95"]),
]

# Causes précises, sans chevauchement, avec un nom courant. Les restes de
# chapitre (« autres tumeurs malignes », « autres maladies de l'appareil
# circulatoire », causes inconnues…) sont écartés : trop hétérogènes pour
# dire de quoi l'on meurt.
CAUSES = {
    "A15-A19_B90": "Tuberculose",
    "B15-B19_B942": "Hépatites virales",
    "B20-B24": "VIH-sida",
    "C00-C14": "Cancer de la bouche et du pharynx",
    "C15": "Cancer de l’œsophage",
    "C16": "Cancer de l’estomac",
    "C18-C21": "Cancer colorectal",
    "C22": "Cancer du foie",
    "C25": "Cancer du pancréas",
    "C32": "Cancer du larynx",
    "C33_C34": "Cancer du poumon",
    "C43": "Mélanome",
    "C50": "Cancer du sein",
    "C53": "Cancer du col de l’utérus",
    "C54_C55": "Cancer de l’utérus",
    "C56": "Cancer de l’ovaire",
    "C61": "Cancer de la prostate",
    "C64": "Cancer du rein",
    "C67": "Cancer de la vessie",
    "C70-C72": "Cancer du cerveau",
    "C73": "Cancer de la thyroïde",
    "C81-C86": "Lymphomes",
    "C88_C90_C96": "Myélomes et autres cancers du sang",
    "C91-C95": "Leucémies",
    "D00-D48": "Tumeurs bénignes ou incertaines",
    "D50-D89": "Maladies du sang et de l’immunité",
    "E10-E14": "Diabète",
    "F01_F03": "Démences",
    "F10": "Troubles liés à l’alcool",
    "TOXICO": "Toxicomanie",
    "G20": "Maladie de Parkinson",
    "G30": "Maladie d’Alzheimer",
    "I20-I25": "Infarctus et autres cardiopathies ischémiques",
    "I30-I51": "Insuffisance cardiaque et autres maladies du cœur",
    "I60-I69": "AVC et maladies cérébrovasculaires",
    "J09-J11": "Grippe",
    "J12-J18": "Pneumonie",
    "J45_J46": "Asthme",
    "J40-J44_J47": "BPCO et autres maladies respiratoires chroniques",
    "K25-K28": "Ulcère digestif",
    "K70_K73_K74": "Maladies chroniques du foie, dont cirrhose",
    "L": "Maladies de la peau",
    "RHEUM_ARTHRO": "Polyarthrite et arthrose",
    "N00-N29": "Maladies du rein",
    "O": "Complications de la grossesse",
    "P": "Affections de la période périnatale",
    "Q": "Malformations congénitales",
    "R95": "Mort subite du nourrisson",
    "COVID": "Covid-19",
    "V_Y85": "Accidents de transport",
    "W00-W19": "Chutes accidentelles",
    "W65-W74": "Noyades",
    "X40-X49": "Intoxications accidentelles, dont surdoses",
    "X60-X84_Y870": "Suicide",
    "X85-Y09_Y871": "Homicide",
    "Y10-Y34_Y872": "Morts violentes d’intention indéterminée",
}
COVID = ["U071", "U072", "U_COV19_OTH"]


def fetch(since):
    request = urllib.request.Request(API.format(since=since), headers={"User-Agent": "le-reste-de-ta-vie"})
    with urllib.request.urlopen(request, timeout=180) as response:
        return json.load(response)


def main():
    wanted = sys.argv[1] if len(sys.argv) > 1 else None
    data = fetch(int(wanted) if wanted else 2019)
    ids, size = data["id"], data["size"]
    index = {dim: data["dimension"][dim]["category"]["index"] for dim in ids}
    strides = [1] * len(ids)
    for i in range(len(ids) - 2, -1, -1):
        strides[i] = strides[i + 1] * size[i + 1]

    fixed = {"freq": "A", "unit": "NR", "resid": "TOT_IN", "geo": "FR"}

    def value(sex, age, icd, year):
        pos = {**fixed, "sex": sex, "age": age, "icd10": icd, "time": year}
        offset = sum(index[dim][pos[dim]] * strides[i] for i, dim in enumerate(ids))
        return data["value"].get(str(offset))

    years = sorted(index["time"], key=index["time"].get)
    complete = [y for y in years if value("T", "TOTAL", "TOTAL", y)]
    year = wanted or complete[-1]
    if year not in complete:
        sys.exit(f"Pas de données complètes pour {year} (disponibles : {', '.join(complete)}).")

    def deaths(sex, ages, icds):
        return sum(value(sex, age, icd, year) or 0 for age in ages for icd in icds)

    groups = []
    for start, end, ages in GROUPS:
        entry = {"from": start, "to": end}
        for sex in ("F", "M", "T"):
            total = deaths(sex, ages, ["TOTAL"])
            shares = []
            for code in CAUSES:
                count = deaths(sex, ages, COVID if code == "COVID" else [code])
                if count:
                    shares.append((count, code))
            shares.sort(reverse=True)
            entry[sex] = {
                "deaths": int(total),
                "top": [[code, round(count / total, 4)] for count, code in shares[:TOP]],
            }
        groups.append(entry)

    payload = {
        "year": int(year),
        "source": PAGE,
        "updated": data.get("updated", "")[:10],
        "labels": CAUSES,
        "groups": groups,
    }
    body = json.dumps(payload, ensure_ascii=False, indent=1)
    OUT.write_text(
        "/*\n"
        " * Principales causes de décès en France, par tranche d’âge et par sexe.\n"
        f" * Fichier généré par scripts/update-causes.py à partir d’Eurostat (hlth_cd_aro,\n"
        f" * données CépiDc-Inserm, décès de {year} des résidents en France). Ne pas modifier à la main.\n"
        " * Pour chaque tranche : nombre de décès et part des dix premières causes précises.\n"
        " */\n"
        "(function (root, data) {\n"
        "  if (typeof module === 'object' && module.exports) module.exports = data;\n"
        "  else root.Causes = data;\n"
        f"}})(typeof self !== 'undefined' ? self : this, {body});\n",
        encoding="utf-8",
    )
    print(f"{OUT} : décès de {year}, {len(groups)} tranches d’âge.")


if __name__ == "__main__":
    main()
