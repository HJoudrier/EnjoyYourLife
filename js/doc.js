/* Enjoy your life — documentation : les tableaux sont calculés à partir de life.js, pour rester fidèles à l'application. */
(function () {
  'use strict';

  const L = window.Life;
  const nf1 = new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  const nf = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 4 });
  const pct = new Intl.NumberFormat('fr-FR', { style: 'percent', maximumFractionDigits: 0 });
  const SEXES = [['F', 'Femmes'], ['M', 'Hommes']];

  function esc(value) {
    return String(value).replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]);
  }

  function fill(id, rows) {
    const body = document.querySelector(`#${id} tbody`);
    if (body) body.innerHTML = rows.join('');
  }

  function years(value) {
    return `${nf1.format(value)} ans`;
  }

  function gap(value) {
    if (Math.abs(value) < 0.05) return '0';
    return `${value > 0 ? '+' : '−'}${nf1.format(Math.abs(value))} an${Math.abs(value) >= 2 ? 's' : ''}`;
  }

  // Mortalité : paramètres du modèle et espérances de vie qu'il redonne.
  const INSEE = { F: { e0: 85.9, e60: 27.9, e65: 23.6 }, M: { e0: 80.3, e60: 23.9, e65: 20.0 } };
  fill('t-mortality', SEXES.map(([sex, label]) => {
    return `<tr><th scope="row">${label}</th>
      <td class="num">${years(INSEE[sex].e0)}</td><td class="num">${years(L.remainingYears(sex, 0))}</td>
      <td class="num">${years(INSEE[sex].e60)}</td><td class="num">${years(L.remainingYears(sex, 60))}</td>
      <td class="num">${years(INSEE[sex].e65)}</td><td class="num">${years(L.remainingYears(sex, 65))}</td></tr>`;
  }));
  fill('t-parameters', SEXES.map(([sex, label]) => {
    const p = L.MORTALITY[sex];
    return `<tr><th scope="row">${label}</th><td class="num">${nf.format(p.A)}</td><td class="num">${p.B.toExponential(4).replace('.', ',')}</td>
      <td class="num">${nf.format(p.c)}</td><td class="num">${nf.format(p.fade)}</td></tr>`;
  }));

  // Catégories socioprofessionnelles : espérance de vie à 35 ans (Insee 2020-2022).
  fill('t-categories', L.CATEGORIES.map((c) => {
    const cells = SEXES.map(([sex]) => {
      const e35 = L.E35[sex][c.id];
      return `<td class="num">${years(e35)}</td><td class="num">${gap(e35 - L.E35[sex].ensemble)}</td>`;
    }).join('');
    const label = c.id === 'ensemble' ? 'Ensemble de la population' : c.label;
    return `<tr><th scope="row">${esc(label)}<br><span class="note">${esc(c.id === 'ensemble' ? 'utilisé pour « Autre ou non précisé »' : c.examples)}</span></th>${cells}</tr>`;
  }));

  // Secteurs d'activité : écarts indicatifs.
  fill('t-sectors', L.SECTORS.filter((s) => s.id).map((s) => `<tr><th scope="row">${esc(s.label)}</th><td class="num">${gap(s.gap)}</td></tr>`));

  // Années en bonne santé : chiffres DREES et valeurs du modèle.
  const DREES = {
    any: { F: [64.1, 11.8], M: [63.7, 10.5] },
    severe: { F: [77.5, 18.5], M: [73.8, 15.8] },
  };
  const KINDS = [['any', 'Sans incapacité', '2024', '2024'], ['severe', 'Sans incapacité forte', '2023', '2024']];
  fill('t-disability', KINDS.flatMap(([kind, label, yearBirth, year65]) => SEXES.map(([sex, sexLabel]) => {
    const [birth, at65] = DREES[kind][sex];
    return `<tr><th scope="row">${label}, ${sexLabel.toLowerCase()}</th>
      <td class="num">${years(birth)} <span class="note">(${yearBirth})</span></td><td class="num">${years(L.disabilityFreeYears(kind, sex, 0))}</td>
      <td class="num">${years(at65)} <span class="note">(${year65})</span></td><td class="num">${years(L.disabilityFreeYears(kind, sex, 65))}</td></tr>`;
  })));
  fill('t-prevalence', KINDS.flatMap(([kind, label]) => SEXES.map(([sex, sexLabel]) => {
    const ages = [20, 40, 60, 75, 90].map((age) => `<td class="num">${pct.format(L.disabilityShare(kind, sex, age))}</td>`).join('');
    return `<tr><th scope="row">${label}, ${sexLabel.toLowerCase()}</th>${ages}</tr>`;
  })));

  // Chances d'atteindre chaque âge, pour une personne de 35 ans aujourd'hui.
  const now = L.today();
  const birth35 = L.toISO(L.addYears(now, -35));
  const targets = [50, 60, 70, 80, 90, 100];
  fill('t-chances', SEXES.map(([sex, label]) => {
    const curve = L.survivalCurve({ birth: birth35, sex }, now);
    const cells = targets.map((age) => `<td class="num">${pct.format(curve.at(L.addYears(L.parseDate(birth35), age)))}</td>`).join('');
    return `<tr><th scope="row">${label}</th>${cells}</tr>`;
  }));
  fill('t-risk', SEXES.map(([sex, label]) => {
    const curve = L.survivalCurve({ birth: birth35, sex }, now);
    const risk = new Intl.NumberFormat('fr-FR', { style: 'percent', maximumFractionDigits: 2 });
    const cells = [40, 50, 60, 70, 80, 90].map((age) => `<td class="num">${risk.format(curve.yearlyRisk(L.addYears(L.parseDate(birth35), age)))}</td>`).join('');
    return `<tr><th scope="row">${label}</th>${cells}</tr>`;
  }));

  // Temps ensemble : rythmes et étapes proposées.
  fill('t-frequencies', L.FREQUENCIES.map((f) => `<tr><th scope="row">${esc(f.label)}</th><td class="num">${f.days}</td></tr>`));
  fill('t-relations', Object.values(L.RELATION_TYPES).map((t) => {
    const stages = t.phases.map((p) => {
      const until = p.until == null ? 'ensuite' : `jusqu’à ${p.until} ans`;
      return `${esc(p.label)} : ${until}, ${p.days} jours par an`;
    }).join('<br>');
    return `<tr><th scope="row">${esc(t.label)}</th><td>${esc(L.REFS[t.ref])}</td><td>${stages}</td></tr>`;
  }));
})();
