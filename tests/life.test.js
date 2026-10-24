const test = require('node:test');
const assert = require('node:assert/strict');
const Life = require('../js/life.js');

const d = Life.parseDate;
const near = (actual, expected, tolerance, message) =>
  assert.ok(Math.abs(actual - expected) <= tolerance, `${message} : ${actual} au lieu de ${expected} ± ${tolerance}`);

test('le modèle reproduit les espérances de vie Insee 2025', () => {
  near(Life.remainingYears('M', 0), 80.3, 0.05, 'hommes à la naissance');
  near(Life.remainingYears('F', 0), 85.9, 0.05, 'femmes à la naissance');
  near(Life.remainingYears('M', 60), 23.9, 0.05, 'hommes à 60 ans');
  near(Life.remainingYears('F', 60), 27.9, 0.05, 'femmes à 60 ans');
  near(Life.remainingYears('M', 65), 20.0, 0.15, 'hommes à 65 ans');
  near(Life.remainingYears('F', 65), 23.6, 0.25, 'femmes à 65 ans');
});

test('la catégorie socioprofessionnelle décale l’espérance de vie à 35 ans de l’écart Insee', () => {
  for (const sex of ['M', 'F']) {
    const base = Life.remainingYears(sex, 35);
    for (const [category, e35] of Object.entries(Life.E35[sex])) {
      const expected = base + e35 - Life.E35[sex].ensemble;
      near(Life.remainingYears(sex, 35, Life.categoryFactor(sex, category)), expected, 0.01, `${sex} ${category}`);
    }
  }
});

test('l’espérance de vie est conditionnelle à l’âge atteint', () => {
  const now = d('2026-10-24');
  const young = Life.expectedLifespan({ birth: '2000-01-01', sex: 'M' }, now);
  const old = Life.expectedLifespan({ birth: '1936-01-01', sex: 'M' }, now);
  assert.ok(old > young, 'une personne de 90 ans a dépassé l’espérance de vie à la naissance');
  assert.ok(old > 90);
  const unborn = Life.expectedLifespan({ birth: '2028-01-01', sex: 'F' }, now);
  near(unborn, 85.9, 0.05, 'un enfant à naître');
  const unspecified = Life.expectedLifespan({ birth: '2000-01-01', sex: 'X' }, now);
  near(unspecified, (young + Life.expectedLifespan({ birth: '2000-01-01', sex: 'F' }, now)) / 2, 1e-9, 'sexe non précisé');
  const adjusted = Life.expectedLifespan({ birth: '2000-01-01', sex: 'M', adjust: 3 }, now);
  near(adjusted, young + 3, 1e-9, 'ajustement personnel');
});

test('dates : années bissextiles et écarts calendaires', () => {
  assert.equal(Life.toISO(Life.addYears(d('2000-02-29'), 1)), '2001-02-28');
  assert.equal(Life.toISO(Life.addYears(d('2000-02-29'), 4)), '2004-02-29');
  assert.equal(Life.toISO(Life.addMonths(d('2024-01-31'), 1)), '2024-02-29');
  assert.deepEqual(Life.diffParts(d('1991-04-17'), d('2026-10-24')), { years: 35, months: 6, days: 7 });
  assert.equal(Life.parseDate('2023-02-30'), null);
  assert.equal(Life.parseDate(''), null);
});

test('chaque date tombe dans la semaine que lui attribue la grille', () => {
  const birth = d('1991-04-17');
  for (let t = birth; t < d('2030-01-01'); t += 5 * Life.DAY) {
    const cell = Life.weekOf(birth, t);
    const range = Life.weekRange(birth, cell.year, cell.week);
    assert.ok(range.start <= t && t < range.end, Life.toISO(t));
  }
  assert.deepEqual(Life.weekOf(birth, birth), { year: 0, week: 0, index: 0 });
  assert.equal(Life.weekOf(birth, d('1991-04-16')), null);
});

test('résumé de vie', () => {
  const now = d('2026-10-24');
  const s = Life.lifeSummary({ birth: '1991-04-17', sex: 'F', category: 'inter' }, now);
  assert.equal(s.age.years, 35);
  assert.equal(s.weeksLived, 35 * 52 + 27);
  assert.ok(s.fraction > 0.38 && s.fraction < 0.43);
  assert.equal(s.weeksLived + s.weeksLeft, s.weeksTotal);
  assert.equal(s.christmases, s.left.years + 1);
});

test('un enfant : à la maison, puis le week-end, puis une fois par mois', () => {
  const now = d('2026-10-24');
  const profile = { birth: '1991-04-17', sex: 'F' };
  const rel = { kind: 'child', start: '2019-09-03', phases: Life.RELATION_TYPES.child.phases };
  const t = Life.relationTimeline(rel, profile, now);
  assert.equal(t.status, 'ongoing');
  assert.equal(t.endReason, 'self');
  assert.equal(t.phases.length, 3);
  assert.equal(Life.toISO(t.phases[0].to), '2037-09-03');
  assert.equal(Life.toISO(t.phases[1].to), '2042-09-03');
  near(t.phases[0].totalDays, Life.daysBetween(d('2019-09-03'), d('2037-09-03')), 1e-9, 'jours à la maison');
  near(t.phases[1].totalDays, Life.daysBetween(d('2037-09-03'), d('2042-09-03')) * 104 / 365, 1e-9, 'jours pendant les études');
  near(t.pastDays, Life.daysBetween(d('2019-09-03'), now), 1e-9, 'jours déjà passés');
  assert.ok(t.share > t.calendarShare, 'le temps ensemble se concentre dans l’enfance');
  assert.equal(Life.ratioAt(t, d('2030-01-01')), 1);
  assert.equal(Life.ratioAt(t, d('2040-01-01')), 104 / 365);
  assert.equal(Life.ratioAt(t, d('2010-01-01')), null);
});

test('un parent : l’essentiel du temps ensemble est déjà passé', () => {
  const now = d('2026-10-24');
  const profile = { birth: '1991-04-17', sex: 'F' };
  const rel = { kind: 'parent', start: '1991-04-17', otherBirth: '1963-08-30', otherSex: 'F', phases: Life.RELATION_TYPES.parent.phases };
  const t = Life.relationTimeline(rel, profile, now);
  assert.equal(t.endReason, 'other');
  assert.ok(t.share > 0.9, `part déjà vécue : ${t.share}`);
});

test('une relation terminée ou à venir', () => {
  const now = d('2026-10-24');
  const profile = { birth: '1991-04-17', sex: 'F' };
  const ended = Life.relationTimeline({ kind: 'friend', start: '2005-01-01', end: '2015-01-01', phases: [{ label: 'Amitié', until: null, days: 52 }] }, profile, now);
  assert.equal(ended.status, 'ended');
  assert.equal(ended.share, 1);
  assert.equal(ended.futureDays, 0);
  const planned = Life.relationTimeline({ kind: 'child', start: '2028-06-01', phases: Life.RELATION_TYPES.child.phases }, profile, now);
  assert.equal(planned.status, 'future');
  assert.equal(planned.share, 0);
  assert.ok(planned.futureDays > 6000);
});

test('rattachement d’un métier à sa catégorie', () => {
  assert.equal(Life.matchJob('Infirmière'), 'inter');
  assert.equal(Life.matchJob('professeur des écoles'), 'inter');
  assert.equal(Life.matchJob('Professeure de mathématiques'), 'cadre');
  assert.equal(Life.matchJob('Ingénieure logiciel'), 'cadre');
  assert.equal(Life.matchJob('aide-soignante'), 'employe');
  assert.equal(Life.matchJob('ouvrier agricole'), 'ouvrier');
  assert.equal(Life.matchJob('éleveur de chèvres'), 'agri');
  assert.equal(Life.matchJob('élève'), 'ensemble');
  assert.equal(Life.matchJob('chef d’entreprise'), 'artisan');
  assert.equal(Life.matchJob('technicien de surface'), 'ouvrier');
  assert.equal(Life.matchJob('astronaute'), null);
  assert.equal(Life.matchJob(''), null);
});

test('le secteur d’activité décale l’espérance de vie à 35 ans de son écart indicatif', () => {
  for (const sex of ['M', 'F']) {
    const base = Life.remainingYears(sex, 35);
    for (const sector of Life.SECTORS) {
      assert.ok(Math.abs(sector.gap) <= 1, `écart limité à un an : ${sector.id}`);
      near(Life.remainingYears(sex, 35, Life.sectorFactor(sex, sector.id)), base + sector.gap, 0.01, `${sex} ${sector.id}`);
    }
    const both = Life.workFactor(sex, 'ouvrier', 'construction');
    const expected = base + Life.E35[sex].ouvrier - Life.E35[sex].ensemble + Life.sectorGap('construction');
    near(Life.remainingYears(sex, 35, both), expected, 0.01, `${sex} ouvrier du BTP`);
  }
  assert.equal(Life.sectorFactor('M', ''), 1);
  assert.equal(Life.sectorFactor('M', undefined), 1);
  assert.equal(Life.sectorFactor('M', 'inconnu'), 1);
});

test('le métier et le secteur d’un proche comptent dans son espérance de vie', () => {
  const now = d('2026-10-24');
  const profile = { birth: '1991-04-17', sex: 'F' };
  const base = { kind: 'parent', start: '1991-04-17', otherBirth: '1960-03-01', otherSex: 'M', phases: Life.RELATION_TYPES.parent.phases };
  const average = Life.relationTimeline(base, profile, now);
  const builder = Life.relationTimeline({ ...base, category: 'ouvrier', sector: 'construction' }, profile, now);
  const teacher = Life.relationTimeline({ ...base, category: 'cadre', sector: 'enseignement' }, profile, now);
  assert.equal(average.endReason, 'other');
  assert.ok(builder.otherLifespan < average.otherLifespan && average.otherLifespan < teacher.otherLifespan);
  assert.ok(builder.end < average.end && average.end < teacher.end);
  assert.ok(builder.futureDays < teacher.futureDays);
  near(average.otherLifespan, Life.expectedLifespan({ birth: '1960-03-01', sex: 'M' }, now), 1e-9, 'sans métier : la moyenne');
});

test('rattachement d’un métier à son secteur', () => {
  assert.equal(Life.matchSector('Maçon'), 'construction');
  assert.equal(Life.matchSector('Infirmière'), 'sante');
  assert.equal(Life.matchSector('professeur des écoles'), 'enseignement');
  assert.equal(Life.matchSector('chauffeur routier'), 'transport');
  assert.equal(Life.matchSector('conducteur de travaux'), 'construction');
  assert.equal(Life.matchSector('ouvrier agricole'), 'agriculture');
  assert.equal(Life.matchSector('Développeuse web'), 'numerique');
  assert.equal(Life.matchSector('cadre'), null);
  assert.equal(Life.matchSector(''), null);
});

test('l’écart entre cadres et ouvriers se réduit avec l’âge comme le mesure l’Insee', () => {
  for (const [sex, at35, at60] of [['M', 5.3, 3.6], ['F', 3.4, 2.3]]) {
    const gap = (age) => Life.remainingYears(sex, age, Life.categoryFactor(sex, 'cadre')) - Life.remainingYears(sex, age, Life.categoryFactor(sex, 'ouvrier'));
    near(gap(35), at35, 0.02, `${sex} à 35 ans`);
    near(gap(60), at60, 0.05, `${sex} à 60 ans`);
    assert.ok(gap(80) < gap(60), `${sex} : l’écart continue de se réduire`);
  }
});
