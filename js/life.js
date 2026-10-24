/*
 * Enjoy your life — calculs sans dépendance :
 * dates, espérance de vie, grille des semaines et temps passé avec ses proches.
 * Utilisable dans le navigateur (window.Life) comme dans Node (require).
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Life = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const DAY = 86400000;
  const YEAR = 365.2425 * DAY;

  /* ------------------------------------------------------------------ *
   * Dates : on travaille en millisecondes à minuit UTC pour que les
   * calculs en jours ne soient jamais faussés par l'heure d'été.
   * ------------------------------------------------------------------ */

  function parseDate(value) {
    if (typeof value === 'number') return value;
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value || '');
    if (!m) return null;
    const t = Date.UTC(+m[1], +m[2] - 1, +m[3]);
    const d = new Date(t);
    return d.getUTCMonth() === +m[2] - 1 ? t : null;
  }

  function toISO(t) {
    return new Date(t).toISOString().slice(0, 10);
  }

  function today(now) {
    const d = now || new Date();
    return Date.UTC(d.getFullYear(), d.getMonth(), d.getDate());
  }

  function addDays(t, n) {
    return t + n * DAY;
  }

  // Ajoute des mois entiers ; un 31 devient le dernier jour du mois s'il le faut.
  function addMonths(t, n) {
    const d = new Date(t);
    const total = d.getUTCMonth() + n;
    const y = d.getUTCFullYear() + Math.floor(total / 12);
    const m = ((total % 12) + 12) % 12;
    const last = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
    return Date.UTC(y, m, Math.min(d.getUTCDate(), last));
  }

  function addYears(t, n) {
    return addMonths(t, 12 * n);
  }

  function addYearsFrac(t, years) {
    const whole = Math.floor(years);
    return addYears(t, whole) + Math.round(((years - whole) * YEAR) / DAY) * DAY;
  }

  function daysBetween(a, b) {
    return Math.round((b - a) / DAY);
  }

  // Écart calendaire entre deux dates : { years, months, days } (a <= b).
  function diffParts(a, b) {
    if (b < a) return diffParts(b, a);
    const da = new Date(a), db = new Date(b);
    let months = (db.getUTCFullYear() - da.getUTCFullYear()) * 12 + db.getUTCMonth() - da.getUTCMonth();
    if (addMonths(a, months) > b) months--;
    const days = daysBetween(addMonths(a, months), b);
    return { years: Math.floor(months / 12), months: months % 12, days };
  }

  function fullYears(birth, date) {
    return diffParts(birth, date).years * (date < birth ? -1 : 1);
  }

  /* ------------------------------------------------------------------ *
   * Espérance de vie
   *
   * Mortalité de Gompertz-Makeham : μ(x) = A + k(x)·B·e^(c·x), avec x l'âge.
   * A, B et c sont calibrés pour reproduire les chiffres Insee 2025
   * (provisoires) de la France : espérance de vie à la naissance de
   * 80,3 ans (hommes) et 85,9 ans (femmes), à 60 ans de 23,9 et 27,9 ans.
   *
   * Le facteur k traduit l'écart lié au métier et au secteur. Il est
   * constant jusqu'à 60 ans puis s'estompe (k(x) = k^e^(−fade·(x−60))) :
   * l'Insee mesure entre cadres et ouvriers un écart de 5,3 ans (hommes)
   * et 3,4 ans (femmes) à 35 ans, mais de 3,6 et 2,3 ans à 60 ans
   * (2020-2022). `fade` est calibré pour retrouver ces deux écarts.
   * ------------------------------------------------------------------ */

  const MORTALITY = {
    M: { A: 0.0003, B: 3.0755766e-5, c: 0.091266456, fade: 0.0599188 },
    F: { A: 0.0003, B: 3.6412485e-6, c: 0.11210149, fade: 0.10526 },
  };
  const STEP = 0.02;
  const MAX_AGE = 125;
  const FADE_AGE = 60;

  // Espérance de vie résiduelle (en années) d'une personne qui a déjà `age` ans.
  function remainingYears(sex, age, k) {
    const p = MORTALITY[sex];
    const logK = Math.log(k == null ? 1 : k);
    let alive = 1, sum = 0;
    for (let x = age; x < MAX_AGE && alive > 1e-7; x += STEP) {
      const mid = x + STEP / 2;
      const factor = Math.exp(mid <= FADE_AGE ? logK : logK * Math.exp(-p.fade * (mid - FADE_AGE)));
      const mu = p.A + factor * p.B * Math.exp(p.c * mid);
      const next = alive * Math.exp(-mu * STEP);
      sum += ((alive + next) / 2) * STEP;
      alive = next;
    }
    return sum;
  }

  // Espérance de vie à 35 ans selon la catégorie socioprofessionnelle,
  // Insee, période 2020-2022 (Insee Première n° 2005, 2024).
  const E35 = {
    M: { ensemble: 45.3, cadre: 48.9, inter: 47.4, agri: 47.2, artisan: 46.4, employe: 45.1, ouvrier: 43.6 },
    F: { ensemble: 50.8, cadre: 53.0, inter: 52.3, agri: 50.5, artisan: 51.7, employe: 51.2, ouvrier: 49.6 },
  };

  const CATEGORIES = [
    { id: 'cadre', label: 'Cadre, profession intellectuelle supérieure', examples: 'ingénieur, médecin, avocat, enseignant du secondaire, chercheur, journaliste, artiste' },
    { id: 'inter', label: 'Profession intermédiaire', examples: 'infirmier, professeur des écoles, technicien, commercial, comptable, éducateur' },
    { id: 'artisan', label: 'Artisan, commerçant, chef d’entreprise', examples: 'boulanger, coiffeur, commerçant, restaurateur, entrepreneur' },
    { id: 'agri', label: 'Agriculteur exploitant', examples: 'agriculteur, éleveur, viticulteur, maraîcher' },
    { id: 'employe', label: 'Employé', examples: 'secrétaire, vendeur, aide-soignant, agent administratif, policier' },
    { id: 'ouvrier', label: 'Ouvrier', examples: 'maçon, électricien, chauffeur, mécanicien, cuisinier, cariste' },
    { id: 'ensemble', label: 'Autre ou non précisé', examples: 'moyenne nationale : étudiant, sans emploi, parent au foyer…' },
  ];

  // Secteurs d'activité (grandes sections de la nomenclature NAF).
  // Aucune source ne publie d'espérance de vie par secteur : les écarts
  // ci-dessous (en années, à 35 ans) sont des estimations indicatives,
  // limitées à un an. Ils suivent le sens des écarts de mortalité observés
  // par Santé publique France (programme Cosmop) : davantage de décès dans
  // la construction, l'industrie et les transports, moins dans l'agriculture,
  // l'enseignement et certains services. Ils s'ajoutent à l'effet de la
  // catégorie socioprofessionnelle.
  const SECTORS = [
    { id: '', label: 'Non précisé', gap: 0 },
    { id: 'agriculture', label: 'Agriculture, forêt, pêche', gap: 0.5 },
    { id: 'industrie', label: 'Industrie, énergie, mines', gap: -0.7 },
    { id: 'construction', label: 'Construction, BTP', gap: -1 },
    { id: 'commerce', label: 'Commerce, réparation automobile', gap: 0 },
    { id: 'transport', label: 'Transports, logistique', gap: -0.7 },
    { id: 'hotellerie', label: 'Hôtellerie, restauration', gap: -0.5 },
    { id: 'numerique', label: 'Information, communication, numérique', gap: 0.3 },
    { id: 'finance', label: 'Banque, assurance, immobilier', gap: 0.3 },
    { id: 'services', label: 'Services aux entreprises', gap: 0 },
    { id: 'public', label: 'Administration publique, défense', gap: 0 },
    { id: 'enseignement', label: 'Enseignement, recherche', gap: 0.7 },
    { id: 'sante', label: 'Santé, action sociale', gap: 0.3 },
    { id: 'culture', label: 'Arts, spectacles, sport, associations', gap: 0 },
  ];

  const factorCache = {};

  // Multiplicateur k de la mortalité qui décale de `gap` années
  // l'espérance de vie à 35 ans.
  function gapFactor(sex, gap) {
    const key = sex + ':' + gap;
    if (key in factorCache) return factorCache[key];
    if (gap === 0) return (factorCache[key] = 1);
    const target = remainingYears(sex, 35) + gap;
    let lo = 0.1, hi = 10;
    for (let i = 0; i < 40; i++) {
      const mid = Math.sqrt(lo * hi);
      if (remainingYears(sex, 35, mid) > target) lo = mid;
      else hi = mid;
    }
    return (factorCache[key] = Math.sqrt(lo * hi));
  }

  // Écart Insee entre la catégorie et l'ensemble de la population.
  function categoryGap(sex, category) {
    const table = E35[sex];
    return (table[category] == null ? table.ensemble : table[category]) - table.ensemble;
  }

  function sectorGap(sector) {
    const found = SECTORS.find((s) => s.id === (sector || ''));
    return found ? found.gap : 0;
  }

  function categoryFactor(sex, category) {
    return gapFactor(sex, categoryGap(sex, category));
  }

  function sectorFactor(sex, sector) {
    return gapFactor(sex, sectorGap(sector));
  }

  // Les écarts du métier et du secteur s'additionnent.
  function workFactor(sex, category, sector) {
    return gapFactor(sex, Math.round((categoryGap(sex, category) + sectorGap(sector)) * 100) / 100);
  }

  // Âge moyen au décès attendu (en années), sachant que la personne est en vie
  // aujourd'hui. person = { birth, sex: 'F'|'M'|'X', category, sector, adjust }.
  function expectedLifespan(person, now) {
    const birth = parseDate(person.birth);
    const age = Math.max(0, (now - birth) / YEAR);
    const sexes = person.sex === 'F' || person.sex === 'M' ? [person.sex] : ['F', 'M'];
    const category = person.category || 'ensemble';
    let total = 0;
    for (const s of sexes) total += remainingYears(s, age, workFactor(s, category, person.sector));
    const years = age + total / sexes.length + (Number(person.adjust) || 0);
    return Math.max(years, age + 7 / 365.2425);
  }

  function deathDate(person, now) {
    const birth = parseDate(person.birth);
    return addDays(birth, Math.round((expectedLifespan(person, now) * YEAR) / DAY));
  }

  /* ------------------------------------------------------------------ *
   * Grille : une ligne par année de vie, 52 carrés par ligne.
   * La semaine n de l'année d'âge y commence n×7 jours après le
   * y-ième anniversaire ; la 52e semaine va jusqu'à l'anniversaire suivant.
   * ------------------------------------------------------------------ */

  const WEEKS = 52;

  function weekOf(birth, date) {
    if (date < birth) return null;
    const year = fullYears(birth, date);
    const week = Math.min(WEEKS - 1, Math.floor(daysBetween(addYears(birth, year), date) / 7));
    return { year, week, index: year * WEEKS + week };
  }

  function weekRange(birth, year, week) {
    const start = addDays(addYears(birth, year), week * 7);
    const end = week === WEEKS - 1 ? addYears(birth, year + 1) : addDays(start, 7);
    return { start, end };
  }

  // Nombre de fois où la date jour/mois (mois 0-11) tombe dans [from, to].
  function countYearly(from, to, month, day) {
    let count = 0;
    for (let y = new Date(from).getUTCFullYear(); y <= new Date(to).getUTCFullYear(); y++) {
      const t = Date.UTC(y, month, day);
      if (t >= from && t <= to) count++;
    }
    return count;
  }

  function lifeSummary(profile, now) {
    const birth = parseDate(profile.birth);
    const lifespan = expectedLifespan(profile, now);
    const death = deathDate(profile, now);
    const nowCell = weekOf(birth, now);
    const deathCell = weekOf(birth, death);
    const weeksTotal = deathCell.index + 1;
    return {
      birth,
      death,
      lifespan,
      age: diffParts(birth, now),
      nowCell,
      deathCell,
      weeksLived: nowCell.index,
      weeksTotal,
      weeksLeft: weeksTotal - nowCell.index,
      daysLived: daysBetween(birth, now),
      daysLeft: Math.max(0, daysBetween(now, death)),
      left: diffParts(now, death),
      fraction: (now - birth) / (death - birth),
      summers: countYearly(now, death, 6, 15),
      christmases: countYearly(now, death, 11, 25),
    };
  }

  /* ------------------------------------------------------------------ *
   * Relations : le temps passé ensemble.
   *
   * Une relation est découpée en étapes ; chaque étape dure jusqu'à un
   * certain âge (de la personne, le vôtre, ou depuis le début de la
   * relation) et compte un nombre de jours passés ensemble par an.
   * La relation s'arrête à la première des fins : la vôtre, la sienne
   * (espérance de vie estimée) ou une date de fin choisie.
   * ------------------------------------------------------------------ */

  const FREQUENCIES = [
    { days: 365, label: 'Tous les jours' },
    { days: 156, label: 'Trois jours par semaine' },
    { days: 104, label: 'Tous les week-ends' },
    { days: 52, label: 'Une fois par semaine' },
    { days: 24, label: 'Deux fois par mois' },
    { days: 12, label: 'Une fois par mois' },
    { days: 6, label: 'Tous les deux mois' },
    { days: 4, label: 'Quelques fois par an' },
    { days: 1, label: 'Une fois par an' },
  ];

  const REFS = {
    other: 'son âge',
    self: 'votre âge',
    start: 'années depuis le début',
  };

  const RELATION_TYPES = {
    child: {
      label: 'Enfant',
      startLabel: 'Date de naissance',
      ref: 'other',
      phases: [
        { label: 'À la maison', until: 18, days: 365 },
        { label: 'Études, retour le week-end', until: 23, days: 104 },
        { label: 'Vie d’adulte, une visite par mois', until: null, days: 12 },
      ],
    },
    partner: {
      label: 'Conjoint ou conjointe',
      startLabel: 'Date de rencontre',
      ref: 'start',
      phases: [{ label: 'Vie commune', until: null, days: 365 }],
    },
    parent: {
      label: 'Parent',
      startLabel: 'Début de la relation',
      ref: 'self',
      startIsMyBirth: true,
      phases: [
        { label: 'Enfance à la maison', until: 18, days: 365 },
        { label: 'Études, retour le week-end', until: 23, days: 104 },
        { label: 'Visites, une fois par mois', until: null, days: 12 },
      ],
    },
    sibling: {
      label: 'Frère ou sœur',
      startLabel: 'Début de la relation',
      ref: 'self',
      startIsMyBirth: true,
      phases: [
        { label: 'Enfance sous le même toit', until: 18, days: 365 },
        { label: 'Vie d’adulte', until: null, days: 6 },
      ],
    },
    grandparent: {
      label: 'Grand-parent',
      startLabel: 'Début de la relation',
      ref: 'self',
      startIsMyBirth: true,
      phases: [
        { label: 'Vacances et week-ends', until: 18, days: 24 },
        { label: 'Visites', until: null, days: 4 },
      ],
    },
    friend: {
      label: 'Ami ou amie',
      startLabel: 'Date de rencontre',
      ref: 'start',
      phases: [{ label: 'Amitié', until: null, days: 24 }],
    },
    other: {
      label: 'Autre proche',
      startLabel: 'Début de la relation',
      ref: 'start',
      phases: [{ label: 'Relation', until: null, days: 12 }],
    },
  };

  function relationTimeline(rel, profile, now) {
    const type = RELATION_TYPES[rel.kind] || RELATION_TYPES.other;
    const myBirth = parseDate(profile.birth);
    // Le temps ensemble ne commence au plus tôt qu'à votre naissance.
    const start = Math.max(parseDate(rel.start), myBirth);
    const otherBirth = rel.kind === 'child' ? parseDate(rel.start) : parseDate(rel.otherBirth);

    let end = deathDate(profile, now);
    let endReason = 'self';
    let otherLifespan = null;
    if (otherBirth != null) {
      const other = { birth: otherBirth, sex: rel.otherSex, category: rel.category, sector: rel.sector };
      otherLifespan = expectedLifespan(other, now);
      const theirs = deathDate(other, now);
      if (theirs < end) { end = theirs; endReason = 'other'; }
    }
    const fixedEnd = parseDate(rel.end);
    if (fixedEnd != null && fixedEnd < end) { end = fixedEnd; endReason = 'fixed'; }

    const refKind = rel.ref || type.ref;
    const refBirth = refKind === 'self' ? myBirth : refKind === 'other' && otherBirth != null ? otherBirth : start;
    const sorted = (rel.phases || [])
      .map((p) => ({ label: p.label, until: p.until === '' || p.until == null ? null : Number(p.until), days: Number(p.days) || 0 }))
      .sort((a, b) => (a.until == null ? Infinity : a.until) - (b.until == null ? Infinity : b.until));

    const phases = [];
    let cursor = start;
    for (const p of sorted) {
      if (cursor >= end) break;
      const limit = p.until == null ? Infinity : addYearsFrac(refBirth, p.until);
      const to = Math.min(limit, end);
      if (to > cursor) {
        const ratio = Math.min(365, Math.max(0, p.days)) / 365;
        const totalDays = ((to - cursor) / DAY) * ratio;
        const pastDays = (Math.max(0, Math.min(to, now) - cursor) / DAY) * ratio;
        phases.push({ label: p.label, until: p.until, days: p.days, ratio, from: cursor, to, totalDays, pastDays, futureDays: totalDays - pastDays });
        cursor = to;
      }
    }

    const totalDays = phases.reduce((s, p) => s + p.totalDays, 0);
    const pastDays = phases.reduce((s, p) => s + p.pastDays, 0);
    const status = start > now ? 'future' : end <= now ? 'ended' : 'ongoing';
    return {
      start,
      end,
      endReason,
      otherBirth,
      otherLifespan,
      refKind,
      phases,
      totalDays,
      pastDays,
      futureDays: totalDays - pastDays,
      share: totalDays > 0 ? pastDays / totalDays : 0,
      calendarShare: end > start ? Math.min(1, Math.max(0, (now - start) / (end - start))) : 1,
      yearsLeft: Math.max(0, (end - Math.max(now, start)) / YEAR),
      status,
      current: phases.find((p) => p.from <= now && now < p.to) || null,
    };
  }

  // Part des jours passés ensemble à une date donnée (0 à 1), ou null hors relation.
  function ratioAt(timeline, t) {
    for (const p of timeline.phases) if (p.from <= t && t < p.to) return p.ratio;
    return null;
  }

  /* ------------------------------------------------------------------ *
   * Métiers : on rattache un métier saisi librement à sa catégorie
   * socioprofessionnelle (nomenclature Insee des PCS) et, quand c'est
   * clair, à son secteur d'activité le plus probable.
   * ------------------------------------------------------------------ */

  const JOB_KEYS = {
    cadre: [
      'ingenieur', 'medecin', 'chirurgien', 'avocat', 'notaire', 'magistrat', 'juge', 'pharmacien', 'dentiste',
      'veterinaire', 'architecte', 'cadre', 'directeur', 'directrice', 'manager', 'chercheur', 'chercheuse',
      'professeur', 'enseignant', 'maitre de conferences', 'journaliste', 'consultant', 'chef de projet',
      'juriste', 'psychologue', 'psychiatre', 'pilote de ligne', 'officier', 'economiste', 'expert comptable',
      'commissaire', 'developpeur', 'informaticien', 'data scientist', 'actuaire', 'auditeur', 'analyste',
      'artiste', 'musicien', 'comedien', 'acteur', 'actrice', 'ecrivain', 'auteur', 'realisateur', 'redacteur',
      'product manager', 'trader', 'banquier', 'diplomate', 'profession liberale', 'prof',
    ],
    inter: [
      'infirmier', 'infirmiere', 'instituteur', 'institutrice', 'professeur des ecoles', 'technicien',
      'technicienne', 'kinesitherapeute', 'kine', 'educateur', 'educatrice', 'assistant social', 'assistante sociale',
      'comptable', 'commercial', 'commerciale', 'agent de maitrise', 'contremaitre', 'sage femme', 'opticien',
      'animateur', 'animatrice', 'secretaire de direction', 'manipulateur radio', 'laborantin', 'dessinateur',
      'graphiste', 'photographe', 'designer', 'conseiller', 'conseillere', 'chef de rayon', 'chef d equipe',
      'superviseur', 'moniteur', 'monitrice', 'orthophoniste', 'ergotherapeute', 'psychomotricien', 'dieteticien',
      'osteopathe', 'podologue', 'preparateur en pharmacie', 'assistant de direction', 'webdesigner', 'infographiste',
      'chef de chantier', 'conducteur de travaux', 'controleur', 'gestionnaire', 'assistant ressources humaines',
      'pretre', 'pasteur', 'cpe', 'puericultrice', 'puericulteur', 'prof des ecoles',
    ],
    artisan: [
      'artisan', 'commercant', 'commercante', 'boulanger', 'boulangere', 'boucher', 'bouchere', 'patissier',
      'patissiere', 'charcutier', 'traiteur', 'fleuriste', 'coiffeur', 'coiffeuse', 'estheticienne', 'restaurateur',
      'restauratrice', 'chef d entreprise', 'entrepreneur', 'entrepreneuse', 'gerant', 'gerante', 'pdg',
      'independant', 'independante', 'auto entrepreneur', 'micro entrepreneur', 'taxi', 'libraire', 'epicier',
      'epiciere', 'bijoutier', 'garagiste', 'cafetier', 'buraliste', 'hotelier', 'agent immobilier', 'artisan d art',
    ],
    agri: [
      'agriculteur', 'agricultrice', 'eleveur', 'eleveuse', 'viticulteur', 'viticultrice', 'vigneron', 'vigneronne',
      'maraicher', 'maraichere', 'arboriculteur', 'cerealier', 'exploitant agricole', 'exploitante agricole', 'paysan',
      'paysanne', 'apiculteur', 'apicultrice', 'horticulteur', 'ostreiculteur', 'fermier', 'fermiere',
    ],
    employe: [
      'employe', 'employee', 'secretaire', 'vendeur', 'vendeuse', 'caissier', 'caissiere', 'aide soignant',
      'aide soignante', 'agent administratif', 'hotesse', 'steward', 'serveur', 'serveuse', 'policier', 'policiere',
      'gendarme', 'militaire', 'soldat', 'pompier', 'agent de securite', 'vigile', 'assistant maternel',
      'assistante maternelle', 'nounou', 'auxiliaire de vie', 'aide a domicile', 'agent d accueil', 'standardiste',
      'receptionniste', 'facteur', 'factrice', 'guichetier', 'atsem', 'teleconseiller', 'conseiller clientele',
      'ambulancier', 'agent de service', 'menage', 'femme de chambre', 'baby sitter', 'surveillant', 'aesh', 'avs',
      'agent territorial', 'agent de bureau', 'hote de caisse', 'equipier',
    ],
    ouvrier: [
      'ouvrier', 'ouvriere', 'macon', 'plombier', 'electricien', 'menuisier', 'charpentier', 'soudeur', 'mecanicien',
      'chauffeur', 'routier', 'livreur', 'livreuse', 'cariste', 'manutentionnaire', 'magasinier', 'agent d entretien',
      'jardinier', 'paysagiste', 'cuisinier', 'cuisiniere', 'commis', 'plongeur', 'peintre en batiment', 'couvreur',
      'carreleur', 'plaquiste', 'conducteur', 'operateur', 'operatrice', 'preparateur de commandes', 'docker', 'mineur',
      'ouvrier agricole', 'bucheron', 'chaudronnier', 'tourneur', 'fraiseur', 'serrurier', 'vitrier', 'demenageur',
      'eboueur', 'agent de proprete', 'technicien de surface', 'logisticien', 'monteur', 'regleur', 'usineur',
    ],
    ensemble: [
      'etudiant', 'etudiante', 'lyceen', 'eleve', 'sans emploi', 'chomeur', 'chomeuse', 'demandeur d emploi',
      'au foyer', 'parent au foyer', 'retraite', 'retraitee', 'sans profession', 'invalide', 'inactif', 'inactive',
    ],
  };

  function normalize(text) {
    return (text || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, ' ')
      .trim();
  }

  // Métiers dont le secteur ne fait guère de doute.
  const SECTOR_KEYS = {
    agriculture: [
      'agriculteur', 'agricultrice', 'eleveur', 'eleveuse', 'viticulteur', 'viticultrice', 'vigneron', 'vigneronne',
      'maraicher', 'maraichere', 'arboriculteur', 'cerealier', 'exploitant agricole', 'exploitante agricole', 'paysan',
      'paysanne', 'apiculteur', 'apicultrice', 'horticulteur', 'ostreiculteur', 'fermier', 'fermiere', 'ouvrier agricole',
      'bucheron', 'forestier', 'pecheur', 'marin pecheur',
    ],
    industrie: [
      'soudeur', 'chaudronnier', 'tourneur', 'fraiseur', 'usineur', 'regleur', 'operateur de production', 'mineur',
      'chimiste', 'metallurgiste', 'ouvrier d usine', 'ouvrier en usine', 'technicien de maintenance industrielle',
    ],
    construction: [
      'macon', 'plombier', 'electricien', 'menuisier', 'charpentier', 'couvreur', 'carreleur', 'plaquiste',
      'peintre en batiment', 'chef de chantier', 'conducteur de travaux', 'grutier', 'terrassier', 'serrurier',
      'vitrier', 'chauffagiste', 'ouvrier du batiment', 'ouvrier du btp', 'btp',
    ],
    commerce: [
      'vendeur', 'vendeuse', 'caissier', 'caissiere', 'commercant', 'commercante', 'epicier', 'epiciere', 'libraire',
      'fleuriste', 'boulanger', 'boulangere', 'boucher', 'bouchere', 'charcutier', 'garagiste', 'chef de rayon',
      'hote de caisse', 'bijoutier', 'buraliste',
    ],
    transport: [
      'chauffeur', 'routier', 'livreur', 'livreuse', 'cariste', 'manutentionnaire', 'magasinier', 'logisticien',
      'preparateur de commandes', 'docker', 'pilote', 'steward', 'hotesse de l air', 'conducteur de train',
      'conducteur de bus', 'conducteur de metro', 'taxi', 'coursier', 'demenageur', 'facteur', 'factrice',
      'controleur sncf', 'aiguilleur', 'cheminot',
    ],
    hotellerie: [
      'cuisinier', 'cuisiniere', 'chef cuisinier', 'serveur', 'serveuse', 'restaurateur', 'restauratrice', 'cafetier',
      'hotelier', 'commis de cuisine', 'plongeur', 'barman', 'barmaid', 'femme de chambre', 'equipier',
    ],
    numerique: [
      'developpeur', 'developpeuse', 'informaticien', 'informaticienne', 'data scientist', 'webdesigner',
      'infographiste', 'journaliste', 'product manager', 'administrateur systeme', 'devops', 'technicien informatique',
    ],
    finance: [
      'banquier', 'banquiere', 'trader', 'actuaire', 'assureur', 'agent immobilier', 'conseiller bancaire',
      'conseillere bancaire', 'gestionnaire de patrimoine', 'courtier',
    ],
    services: [
      'consultant', 'consultante', 'avocat', 'avocate', 'notaire', 'expert comptable', 'comptable', 'auditeur',
      'auditrice', 'agent de securite', 'vigile', 'agent d entretien', 'agent de proprete', 'technicien de surface',
      'interimaire', 'architecte', 'juriste',
    ],
    public: [
      'policier', 'policiere', 'gendarme', 'militaire', 'soldat', 'pompier', 'fonctionnaire', 'agent territorial',
      'magistrat', 'juge', 'diplomate', 'officier', 'douanier', 'douaniere', 'agent public',
    ],
    enseignement: [
      'professeur', 'professeure', 'prof', 'enseignant', 'enseignante', 'instituteur', 'institutrice',
      'maitre de conferences', 'chercheur', 'chercheuse', 'atsem', 'aesh', 'avs', 'cpe', 'surveillant',
      'formateur', 'formatrice',
    ],
    sante: [
      'medecin', 'chirurgien', 'infirmier', 'infirmiere', 'aide soignant', 'aide soignante', 'pharmacien',
      'pharmacienne', 'dentiste', 'kine', 'kinesitherapeute', 'sage femme', 'orthophoniste', 'ergotherapeute',
      'psychomotricien', 'dieteticien', 'osteopathe', 'podologue', 'manipulateur radio', 'ambulancier',
      'preparateur en pharmacie', 'psychologue', 'psychiatre', 'auxiliaire de vie', 'aide a domicile',
      'assistant social', 'assistante sociale', 'educateur', 'educatrice', 'assistant maternel',
      'assistante maternelle', 'puericultrice', 'puericulteur', 'veterinaire', 'opticien', 'opticienne',
    ],
    culture: [
      'artiste', 'musicien', 'musicienne', 'comedien', 'comedienne', 'acteur', 'actrice', 'ecrivain', 'auteur',
      'autrice', 'realisateur', 'realisatrice', 'photographe', 'danseur', 'danseuse', 'sportif', 'sportive',
      'coach sportif', 'animateur', 'animatrice', 'moniteur', 'monitrice',
    ],
  };

  // Les clés les plus longues d'abord, pour que « professeur des écoles »
  // l'emporte sur « professeur » et « ouvrier agricole » sur « ouvrier ».
  function keywordMatcher(groups) {
    const index = Object.entries(groups)
      .flatMap(([group, keys]) => keys.map((key) => ({ key, group })))
      .sort((a, b) => b.key.length - a.key.length);
    return function (text) {
      const words = ' ' + normalize(text) + ' ';
      if (words.trim() === '') return null;
      for (const { key, group } of index) {
        if (words.includes(' ' + key)) return group;
      }
      return null;
    };
  }

  const matchJob = keywordMatcher(JOB_KEYS);
  const matchSector = keywordMatcher(SECTOR_KEYS);

  return {
    DAY,
    YEAR,
    WEEKS,
    CATEGORIES,
    SECTORS,
    E35,
    FREQUENCIES,
    REFS,
    RELATION_TYPES,
    parseDate,
    toISO,
    today,
    addDays,
    addMonths,
    addYears,
    addYearsFrac,
    daysBetween,
    diffParts,
    fullYears,
    remainingYears,
    categoryFactor,
    sectorFactor,
    sectorGap,
    workFactor,
    expectedLifespan,
    deathDate,
    weekOf,
    weekRange,
    countYearly,
    lifeSummary,
    relationTimeline,
    ratioAt,
    normalize,
    matchJob,
    matchSector,
  };
});
