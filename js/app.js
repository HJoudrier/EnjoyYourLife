/* Le reste de ta vie — interface. Les calculs sont dans life.js (window.Life). */
(function () {
  'use strict';

  const L = window.Life;
  // Clé d'origine (ancien nom de l'application), gardée pour ne pas perdre les données déjà enregistrées.
  const STORE_KEY = 'enjoyyourlife.v1';
  const COLORS = ['#d9485f', '#e8833a', '#d9a400', '#3fa34d', '#1f9e9a', '#3d7dd8', '#8e5cd9', '#d65db1'];
  const EMOJIS = ['⭐', '💍', '❤️', '👶', '🎓', '💼', '🏠', '✈️', '🎉', '🌱', '🏃', '🕊️'];
  const START_EMOJI = { child: '👶', partner: '❤️', friend: '🤝' };

  const $ = (sel) => document.querySelector(sel);
  const nf = new Intl.NumberFormat('fr-FR');
  const nf1 = new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  const pct = new Intl.NumberFormat('fr-FR', { style: 'percent', maximumFractionDigits: 0 });
  const pct1 = new Intl.NumberFormat('fr-FR', { style: 'percent', minimumFractionDigits: 1, maximumFractionDigits: 1 });
  const pct2 = new Intl.NumberFormat('fr-FR', { style: 'percent', maximumFractionDigits: 2 });
  const dfLong = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
  const dfMonth = new Intl.DateTimeFormat('fr-FR', { month: 'long', year: 'numeric', timeZone: 'UTC' });
  const dfDay = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', timeZone: 'UTC' });

  /* ------------------------------------------------------------------ *
   * Texte
   * ------------------------------------------------------------------ */

  function esc(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]);
  }

  function plural(n, one, many) {
    return `${nf.format(n)} ${Math.abs(n) >= 2 ? many : one}`;
  }

  function joinParts(parts) {
    if (parts.length <= 1) return parts.join('');
    return parts.slice(0, -1).join(', ') + ' et ' + parts[parts.length - 1];
  }

  // { years, months, days } → « 35 ans, 6 mois et 7 jours »
  // Les jours ne s'affichent que si on les demande ou s'il n'y a rien d'autre à dire.
  function formatParts(p, withDays) {
    const out = [];
    if (p.years) out.push(plural(p.years, 'an', 'ans'));
    if (p.months) out.push(`${nf.format(p.months)} mois`);
    if (p.days && (withDays || !out.length)) out.push(plural(p.days, 'jour', 'jours'));
    return out.length ? joinParts(out) : 'moins d’un jour';
  }

  function formatSpan(a, b) {
    return formatParts(L.diffParts(a, b), false);
  }

  // Jours passés ensemble, cumulés : 3 960 → « , soit 10 ans et 310 jours » (rien sous un an).
  function formatTogether(days) {
    const total = Math.round(days);
    const years = Math.floor(total / 365);
    const rest = total - years * 365;
    if (!years) return '';
    return `, soit ${plural(years, 'an', 'ans')}${rest ? ` et ${plural(rest, 'jour', 'jours')}` : ''}`;
  }

  function relative(t, now) {
    const day = L.daysBetween(now, t);
    if (day === 0) return 'aujourd’hui';
    if (Math.abs(day) < 7) return day > 0 ? `dans ${plural(day, 'jour', 'jours')}` : `il y a ${plural(-day, 'jour', 'jours')}`;
    return day > 0 ? `dans ${formatSpan(now, t)}` : `il y a ${formatSpan(t, now)}`;
  }

  function ageText(years) {
    return years <= 0 ? 'la première année' : `à ${plural(years, 'an', 'ans')}`;
  }

  // Chances d'être en vie : « 87 % », sans afficher 100 % ni 0 % pour l'avenir.
  function chanceText(p) {
    if (p >= 0.995) return 'plus de 99 %';
    if (p < 0.005) return 'moins de 1 %';
    return pct.format(p);
  }

  function chanceLabel(p) {
    if (p >= 0.995) return '&gt;99<small>%</small>';
    if (p < 0.005) return '&lt;1<small>%</small>';
    return `${Math.round(p * 100)}<small>%</small>`;
  }

  function riskText(q) {
    return q < 0.01 ? pct2.format(q) : pct1.format(q);
  }

  function yearsText(years) {
    return years < 1 ? 'moins d’un an' : plural(Math.round(years), 'an', 'ans');
  }

  function freqLabel(days) {
    const preset = L.FREQUENCIES.find((f) => f.days === Number(days));
    return preset ? preset.label : `${nf.format(days)} jours par an`;
  }

  function rgba(hex, alpha) {
    const n = parseInt(hex.slice(1), 16);
    return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha.toFixed(3)})`;
  }

  function uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  /* ------------------------------------------------------------------ *
   * Données
   * ------------------------------------------------------------------ */

  function clonePhases(kind) {
    return (L.RELATION_TYPES[kind] || L.RELATION_TYPES.other).phases.map((p) => ({ ...p }));
  }

  function demoState() {
    const rel = (kind, data) => ({ id: uid(), demo: true, kind, ref: L.RELATION_TYPES[kind].ref, phases: clonePhases(kind), otherSex: 'X', job: '', category: 'ensemble', sector: '', ...data });
    const ev = (data) => ({ id: uid(), demo: true, type: 'point', ...data });
    return {
      demo: true,
      settings: { gridMode: 'life', expanded: [], relSort: { by: 'custom', dir: 'desc' } },
      profile: { birth: '1991-04-17', sex: 'F', job: 'Infirmière', category: 'inter', sector: 'sante', adjust: 0 },
      relations: [
        rel('child', { name: 'Léa', start: '2019-09-03', otherSex: 'F', color: COLORS[4] }),
        rel('child', { name: 'Malo', start: '2022-02-11', otherSex: 'M', color: COLORS[1] }),
        rel('partner', { name: 'Karim', start: '2013-06-21', otherBirth: '1989-11-02', otherSex: 'M', job: 'Électricien', category: 'ouvrier', sector: 'construction', color: COLORS[0] }),
        rel('parent', { name: 'Maman', start: '1991-04-17', otherBirth: '1963-08-30', otherSex: 'F', job: 'Professeure des écoles', category: 'inter', sector: 'enseignement', color: COLORS[6] }),
      ],
      events: [
        ev({ type: 'period', title: 'Études d’infirmière', emoji: '🎓', start: '2009-09-01', end: '2012-07-06', color: COLORS[5] }),
        ev({ title: 'Mariage avec Karim', emoji: '💍', start: '2017-07-08', color: COLORS[0] }),
        ev({ title: 'Voyage au Japon en famille', emoji: '✈️', start: '2028-04-15', color: COLORS[2] }),
        ev({ type: 'period', title: 'Année sabbatique', emoji: '🌱', start: '2031-09-01', end: '2032-06-30', color: COLORS[3] }),
        ev({ title: 'Retraite', emoji: '⭐', start: '2055-05-01', color: COLORS[7] }),
      ],
    };
  }

  const isDate = (v) => typeof v === 'string' && L.parseDate(v) != null;
  const isColor = (v) => typeof v === 'string' && /^#[0-9a-f]{6}$/i.test(v);
  const isCategory = (v) => L.CATEGORIES.some((c) => c.id === v);
  const isSector = (v) => L.SECTORS.some((s) => s.id === v);
  const text = (v, max) => String(v == null ? '' : v).trim().slice(0, max);

  // Valeurs selon lesquelles on peut trier les proches.
  const SORT_KEYS = {
    share: (tl) => (tl.status === 'future' ? 0 : tl.status === 'ended' ? 1 : tl.share),
    calendar: (tl) => tl.calendarShare,
    days: (tl) => tl.futureDays,
  };

  // Remet d'aplomb un état lu dans le navigateur ou dans une sauvegarde.
  function cleanState(raw) {
    if (!raw || typeof raw !== 'object' || !raw.profile || !isDate(raw.profile.birth)) return null;
    const p = raw.profile;
    const profile = {
      birth: p.birth,
      sex: ['F', 'M', 'X'].includes(p.sex) ? p.sex : 'X',
      job: text(p.job, 80),
      category: isCategory(p.category) ? p.category : 'ensemble',
      sector: isSector(p.sector) ? p.sector : '',
      adjust: Math.max(-10, Math.min(10, Math.round(Number(p.adjust) || 0))),
    };
    const relations = (Array.isArray(raw.relations) ? raw.relations : [])
      .filter((r) => r && isDate(r.start))
      .map((r, i) => {
        const kind = L.RELATION_TYPES[r.kind] ? r.kind : 'other';
        const phases = (Array.isArray(r.phases) ? r.phases : [])
          .map((ph) => ({
            label: text(ph && ph.label, 60),
            until: ph && ph.until !== '' && ph.until != null && isFinite(ph.until) ? Math.max(0, Math.min(120, Number(ph.until))) : null,
            days: Math.max(0, Math.min(365, Math.round(Number(ph && ph.days) || 0))),
          }));
        return {
          id: text(r.id, 40) || uid(),
          demo: !!r.demo,
          kind,
          name: text(r.name, 40) || L.RELATION_TYPES[kind].label,
          start: r.start,
          otherBirth: kind !== 'child' && isDate(r.otherBirth) ? r.otherBirth : '',
          otherSex: ['F', 'M', 'X'].includes(r.otherSex) ? r.otherSex : 'X',
          job: text(r.job, 80),
          category: isCategory(r.category) ? r.category : 'ensemble',
          sector: isSector(r.sector) ? r.sector : '',
          end: isDate(r.end) ? r.end : '',
          ref: L.REFS[r.ref] ? r.ref : L.RELATION_TYPES[kind].ref,
          phases: phases.length ? phases : clonePhases(kind),
          color: isColor(r.color) ? r.color : COLORS[i % COLORS.length],
        };
      });
    const events = (Array.isArray(raw.events) ? raw.events : [])
      .filter((e) => e && isDate(e.start))
      .map((e, i) => {
        const type = e.type === 'period' && isDate(e.end) && e.end >= e.start ? 'period' : 'point';
        return {
          id: text(e.id, 40) || uid(),
          demo: !!e.demo,
          type,
          title: text(e.title, 80) || 'Événement',
          emoji: EMOJIS.includes(e.emoji) ? e.emoji : EMOJIS[0],
          start: e.start,
          end: type === 'period' ? e.end : '',
          color: isColor(e.color) ? e.color : COLORS[i % COLORS.length],
        };
      });
    const saved = raw.settings || {};
    const settings = {
      gridMode: L.GRID_MODES[saved.gridMode] ? saved.gridMode : 'life',
      // Proches dont la vignette est dépliée.
      expanded: Array.isArray(saved.expanded) ? saved.expanded.filter((id) => relations.some((r) => r.id === id)) : [],
      // Ordre des vignettes : personnalisé (celui de la liste) ou trié.
      relSort: {
        by: saved.relSort && (saved.relSort.by === 'custom' || SORT_KEYS[saved.relSort.by]) ? saved.relSort.by : 'custom',
        dir: saved.relSort && saved.relSort.dir === 'asc' ? 'asc' : 'desc',
      },
    };
    return { demo: !!raw.demo, settings, profile, relations, events };
  }

  function load() {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      const state = raw && cleanState(JSON.parse(raw));
      if (state) return state;
    } catch (e) { /* stockage indisponible ou illisible : on repart de l'exemple */ }
    return demoState();
  }

  function save() {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); } catch (e) { /* navigation privée */ }
  }

  let state = load();
  const ui = { focus: null, selected: null, hover: null };
  let view = null; // calculs du dernier rendu

  /* ------------------------------------------------------------------ *
   * Rendu
   * ------------------------------------------------------------------ */

  function compute() {
    const now = L.today();
    const life = L.lifeSummary(state.profile, now);
    const timelines = new Map(state.relations.map((r) => [r.id, L.relationTimeline(r, state.profile, now)]));
    // Les carrés de la grille : alignés sur les anniversaires ou sur les 1er janvier.
    const mode = state.settings.gridMode;
    const scheme = L.gridScheme(mode);
    const curve = L.survivalCurve(state.profile, now);
    // La grille continue après l'espérance de vie, jusqu'à l'âge qu'on a
    // moins d'une chance sur dix d'atteindre.
    let tail = life.death;
    const limit = L.addYears(life.birth, 120);
    while (curve.at(tail) >= 0.1 && tail < limit) tail = L.addDays(tail, 91);
    const cellOf = (t) => scheme.weekOf(life.birth, Math.max(t, now));
    const cells = {
      mode,
      scheme,
      birthYear: new Date(life.birth).getUTCFullYear(),
      birth: scheme.weekOf(life.birth, life.birth),
      now: scheme.weekOf(life.birth, now),
      death: scheme.weekOf(life.birth, life.death),
      tail: scheme.weekOf(life.birth, Math.min(tail, limit)),
      // Premières semaines passées, en moyenne, avec une incapacité puis une incapacité forte.
      disabled: cellOf(life.health.freeEnd).index,
      severe: cellOf(life.health.severeFreeEnd).index,
    };
    return { now, life, timelines, cells, curve };
  }

  function render() {
    view = compute();
    if (ui.focus && !state.relations.some((r) => r.id === ui.focus)) ui.focus = null;
    $('#demo-banner').hidden = !state.demo;
    document.querySelectorAll('input[name="grid-mode"]').forEach((r) => { r.checked = r.value === view.cells.mode; });
    $('#legend-pct').textContent = view.cells.mode === 'calendar' ? 'Chances d’être en vie au 1er janvier' : 'Chances d’atteindre cet âge';
    renderSummary();
    renderGrid();
    renderRelations();
    renderEvents();
    showCell(ui.selected);
  }

  function renderSummary() {
    const { life } = view;
    const health = life.health;
    const position = (t) => Math.min(1, Math.max(life.fraction, (t - life.birth) / (life.death - life.birth))) * 100;
    const disabledAt = position(health.freeEnd);
    const severeAt = position(health.severeFreeEnd);
    const yearsLeft = (life.death - view.now) / L.YEAR;
    const job = state.profile.job ? ` · ${esc(state.profile.job)}` : '';
    const minutes = Math.min(1439, Math.floor(life.fraction * 1440));
    const clock = `${Math.floor(minutes / 60)} h ${String(minutes % 60).padStart(2, '0')}`;
    const left = formatParts(life.left, false);
    const moment = minutes < 360 ? 'le jour se lève' : minutes < 720 ? 'c’est encore le matin' : minutes < 1080 ? 'c’est l’après-midi' : 'la soirée est là';
    $('#summary').innerHTML = `
      <div>
        <p class="eyebrow">${esc(formatParts(life.age, true))}${job}</p>
        <p class="thesis">Tu as vécu <b>${nf.format(life.weeksLived)}</b> semaines. Il t’en reste environ <b>${nf.format(life.weeksLeft)}</b>.</p>
      </div>
      <div class="lifebar">
        <div class="lifebar-track" role="img" aria-label="${pct1.format(life.fraction)} de ta vie">
          <span class="lifebar-fill" style="width:${(life.fraction * 100).toFixed(2)}%"></span>
          <span class="lifebar-h1" style="left:${disabledAt.toFixed(2)}%;width:${(severeAt - disabledAt).toFixed(2)}%"></span>
          <span class="lifebar-h2" style="left:${severeAt.toFixed(2)}%;width:${(100 - severeAt).toFixed(2)}%"></span>
          <span class="lifebar-now" style="left:${(life.fraction * 100).toFixed(2)}%"></span>
        </div>
        <div class="lifebar-labels">
          <span>${dfLong.format(life.birth)}</span>
          <span><strong>${pct1.format(life.fraction)}</strong> de ta vie</span>
          <span>${dfMonth.format(life.death)}</span>
        </div>
        <p class="lifebar-note">En moyenne, encore <b>${yearsText(health.freeYears)}</b> sans incapacité, puis
          <i class="sw sw-h1"></i>${yearsText(yearsLeft - health.freeYears)} avec une incapacité, dont
          <i class="sw sw-h2"></i>${yearsText(yearsLeft - health.severeFreeYears)} avec une incapacité forte.</p>
      </div>
      <dl class="facts">
        <div><dt>Espérance de vie</dt><dd>${nf1.format(life.lifespan)} ans</dd><small>soit jusqu’en ${dfMonth.format(life.death)} environ</small></div>
        <div><dt>Il te reste</dt><dd>${esc(left)}</dd><small>soit ${nf.format(life.daysLeft)} jours</small></div>
        <div><dt>Sans incapacité</dt><dd>${yearsText(health.freeYears)}</dd><small>en moyenne, jusqu’en ${dfMonth.format(health.freeEnd)}</small></div>
        <div><dt>Sans incapacité forte</dt><dd>${yearsText(health.severeFreeYears)}</dd><small>en moyenne, jusqu’en ${dfMonth.format(health.severeFreeEnd)}</small></div>
        <div><dt>Encore</dt><dd>${plural(life.summers, 'été', 'étés')}</dd><small>et ${plural(life.christmases, 'Noël', 'Noëls')}</small></div>
        <div><dt>Si ta vie était une journée</dt><dd>${clock}</dd><small>${moment}</small></div>
      </dl>`;
  }

  // Ce qui s'affiche dans chaque carré : périodes, puis événements ponctuels.
  function collectMarks() {
    const birth = view.life.birth;
    const marks = new Map();
    const weekOf = view.cells.scheme.weekOf;
    let lastYear = Math.max(view.cells.death.year, view.cells.tail.year);
    const mark = (index, item, kind) => {
      let m = marks.get(index);
      if (!m) marks.set(index, (m = { items: [], kind: null, color: null }));
      m.items.push(item);
      if (kind === 'e' || m.kind !== 'e') { m.kind = kind; m.color = item.color; }
    };

    const periods = state.events
      .filter((e) => e.type === 'period')
      .map((e) => ({ ...e, t0: L.parseDate(e.start), t1: L.parseDate(e.end) }))
      .filter((e) => e.t1 >= birth)
      .sort((a, b) => (b.t1 - b.t0) - (a.t1 - a.t0));
    for (const e of periods) {
      const a = weekOf(birth, Math.max(e.t0, birth));
      const b = weekOf(birth, e.t1);
      for (let i = a.index; i <= b.index; i++) mark(i, e, 'r');
      lastYear = Math.max(lastYear, b.year);
    }

    const points = state.events.filter((e) => e.type === 'point').map((e) => ({ ...e, t0: L.parseDate(e.start) }));
    for (const r of state.relations) {
      const t0 = L.parseDate(r.start);
      if (t0 <= birth) continue;
      const label = r.kind === 'child' ? `Naissance de ${r.name}` : r.kind === 'partner' ? `Rencontre avec ${r.name}` : `Début avec ${r.name}`;
      points.push({ title: label, emoji: START_EMOJI[r.kind] || '✨', color: r.color, t0, relation: r.id });
    }
    for (const e of points) {
      const c = e.t0 >= birth && weekOf(birth, e.t0);
      if (!c) continue;
      mark(c.index, e, 'e');
      lastYear = Math.max(lastYear, c.year);
    }
    return { marks, lastYear: Math.min(lastYear, 120) };
  }

  const MONTH_TICKS = [[1, 'janv.'], [13, 'avr.'], [26, 'juil.'], [40, 'oct.']];
  const WEEK_TICKS = [[1, '1'], [13, '13'], [26, '26'], [39, '39'], [52, '52']];

  function renderGrid() {
    const { life, cells } = view;
    const calendar = cells.mode === 'calendar';
    const { marks, lastYear } = collectMarks();
    const focusRel = ui.focus && state.relations.find((r) => r.id === ui.focus);
    const focusTl = focusRel && view.timelines.get(focusRel.id);
    view.marks = marks;
    view.lastIndex = (lastYear + 1) * L.WEEKS - 1;

    const birthIdx = cells.birth.index;
    const nowIdx = cells.now.index;
    const deathIdx = cells.death.index;
    let html = '';
    for (let y = 0; y <= lastYear; y++) {
      const label = calendar ? cells.birthYear + y : y;
      // À droite, les chances d'arriver au début de la ligne.
      const rowStart = cells.scheme.weekRange(life.birth, y, 0).start;
      const chance = rowStart > view.now
        ? `<span class="pct${label % 5 ? ' minor' : ''}">${chanceLabel(view.curve.at(rowStart))}</span>`
        : '';
      html += `<div class="yr"><b>${label % 5 === 0 ? label : ''}</b>${chance}`;
      for (let w = 0; w < L.WEEKS; w++) {
        const i = y * L.WEEKS + w;
        if (i < birthIdx) {
          html += `<i class="c b" data-i="${i}"></i>`;
          continue;
        }
        let cls = i < nowIdx ? 'c p'
          : i === nowIdx ? 'c n'
          : i > deathIdx ? 'c x'
          : i >= cells.severe ? 'c h2'
          : i >= cells.disabled ? 'c h1'
          : 'c';
        let style = '';
        if (focusTl) {
          const range = cells.scheme.weekRange(life.birth, y, w);
          const ratio = L.ratioAt(focusTl, Math.max(range.start, Math.min(range.end - L.DAY, focusTl.start)));
          if (ratio != null && range.end > focusTl.start && range.start < focusTl.end) {
            cls += ' in';
            style = ` style="--fc:${rgba(focusRel.color, 0.16 + 0.84 * ratio)}"`;
          }
        } else {
          const m = marks.get(i);
          if (m) { cls += ' ' + m.kind; style = ` style="--c:${m.color}"`; }
        }
        if (i === ui.selected) cls += ' sel';
        html += `<i class="${cls}" data-i="${i}"${style}></i>`;
      }
      html += '</div>';
    }
    const grid = $('#grid');
    grid.innerHTML = html;
    grid.classList.toggle('focus', !!focusTl);
    $('.grid-wrap').classList.toggle('cal', calendar);
    $('#grid-weeks').innerHTML = (calendar ? MONTH_TICKS : WEEK_TICKS)
      .map(([col, text]) => `<span style="grid-column: ${col}">${text}</span>`).join('');

    const bar = $('#focus-bar');
    bar.hidden = !focusTl;
    if (focusTl) {
      bar.style.setProperty('--fc', focusRel.color);
      bar.innerHTML = `
        <span class="dot" style="--c:${focusRel.color}"></span>
        <p>Les semaines passées avec <strong>${esc(focusRel.name)}</strong>. Plus le carré est foncé, plus vous vous voyez souvent. Le carré rouge marque cette semaine.</p>
        <button type="button" class="btn btn-small" data-action="unfocus">Revenir à toute ma vie</button>`;
    }
    $('#legend').hidden = !!focusTl;
  }

  function cellIndex(i) {
    return Math.max(view.cells.birth.index, Math.min(view.lastIndex, i));
  }

  function showCell(i) {
    const box = $('#cell-info');
    if (i == null) {
      box.innerHTML = `<div class="muted">Survole ou touche une semaine pour la voir en détail. Touche-la à nouveau pour y ajouter un événement.</div>`;
      return;
    }
    const { life, now, cells } = view;
    if (i < cells.birth.index) {
      box.innerHTML = `<div class="muted">Avant ta naissance.</div>`;
      return;
    }
    const y = Math.floor(i / L.WEEKS), w = i % L.WEEKS;
    const range = cells.scheme.weekRange(life.birth, y, w);
    const last = range.end - L.DAY;
    const when = i === cells.now.index ? 'cette semaine' : relative(range.start, now);
    const status = i > cells.death.index ? ' · au-delà de ton espérance de vie' : '';
    const title = cells.mode === 'calendar'
      ? `${cells.birthYear + y}, semaine ${w + 1}`
      : `${y === 0 ? 'Première année' : plural(y, 'an', 'ans')}, semaine ${w + 1}`;
    const age = cells.mode === 'calendar' ? ` · ${ageText(L.fullYears(life.birth, Math.max(range.start, life.birth)))}` : '';
    let stats = '';
    if (range.start > now) {
      const health = i > cells.death.index ? ''
        : i >= cells.severe ? ' · en moyenne, avec une incapacité forte'
        : i >= cells.disabled ? ' · en moyenne, avec une incapacité'
        : ' · en moyenne, sans incapacité';
      stats = `<p class="cell-stats">Chances d’être encore en vie : <b>${chanceText(view.curve.at(range.start))}</b> · risque de décès dans l’année à cet âge : ${riskText(view.curve.yearlyRisk(range.start))}${health}</p>`;
    }
    const m = view.marks.get(i);
    let items = m ? m.items.map((e) => `<li>${esc(e.emoji)} ${esc(e.title)}</li>`).join('') : '';
    if (ui.focus) {
      const rel = state.relations.find((r) => r.id === ui.focus);
      const ratio = L.ratioAt(view.timelines.get(ui.focus), range.start);
      items = ratio == null
        ? `<li class="muted">Pas encore ou plus de temps ensemble avec ${esc(rel.name)} cette semaine-là.</li>`
        : `<li>Avec ${esc(rel.name)} : environ ${plural(Math.round(ratio * 7 * 10) / 10, 'jour', 'jours')} sur 7</li>`;
    }
    box.innerHTML = `
      <div>
        <strong>${title}</strong>
        <span class="muted"> · du ${dfDay.format(range.start)} au ${dfLong.format(last)}${age} · ${when}${status}</span>
        ${stats}
        ${items ? `<ul>${items}</ul>` : ''}
      </div>
      <button type="button" class="btn btn-small" data-action="add-at" data-i="${i}">Ajouter un événement cette semaine</button>`;
  }

  function relationEndText(rel, tl) {
    if (tl.endReason === 'fixed') return `jusqu’au ${dfLong.format(tl.end)}`;
    if (tl.endReason === 'other') return `jusqu’en ${new Date(tl.end).getUTCFullYear()}, selon l’espérance de vie de ${esc(rel.name)} (${nf1.format(tl.otherLifespan)} ans)`;
    return `jusqu’en ${new Date(tl.end).getUTCFullYear()}, la fin de ta vie estimée`;
  }

  function phaseWhen(rel, tl, phase, index) {
    const who = (n) => tl.refKind === 'other' ? `ses ${nf.format(n)} ans` : tl.refKind === 'self' ? `tes ${nf.format(n)} ans` : `${plural(n, 'an', 'ans')} de relation`;
    const prev = index > 0 ? tl.phases[index - 1].until : null;
    let label;
    if (phase.until == null) label = prev == null ? 'toute la relation' : `à partir de ${who(prev)}`;
    else label = prev == null ? `jusqu’à ${who(phase.until)}` : `de ${who(prev)} à ${who(phase.until)}`;
    const y0 = new Date(phase.from).getUTCFullYear(), y1 = new Date(phase.to).getUTCFullYear();
    return `${label} · ${y0 === y1 ? y0 : `${y0}–${y1}`} · ${freqLabel(phase.days).toLowerCase()}`;
  }

  function renderRelations() {
    const box = $('#relations');
    if (!state.relations.length) {
      box.innerHTML = `
        <div class="empty">
          <p>Ajoute tes enfants, ton conjoint ou ta conjointe, tes parents ou tes amis pour voir combien de jours il vous reste à passer ensemble.</p>
          <button type="button" class="btn btn-small" data-action="add-rel">Ajouter un proche</button>
        </div>`;
      return;
    }
    const { now } = view;
    const sort = state.settings.relSort;
    const custom = sort.by === 'custom';
    $('#rel-sort').hidden = state.relations.length < 2;
    $('#rel-sort-by').value = sort.by;
    $('#rel-sort-dir').hidden = custom;
    document.querySelectorAll('input[name="rel-sort-dir"]').forEach((r) => { r.checked = r.value === sort.dir; });
    const list = orderedRelations();
    box.innerHTML = list.map((rel, index) => {
      const tl = view.timelines.get(rel.id);
      const type = L.RELATION_TYPES[rel.kind];
      let ageInfo = '';
      if (tl.otherBirth != null) {
        ageInfo = tl.otherBirth > now
          ? ` · naissance prévue en ${dfMonth.format(tl.otherBirth)}`
          : ` · ${formatParts(L.diffParts(tl.otherBirth, now), false)}`;
      }

      const open = state.settings.expanded.includes(rel.id);
      const domId = 'rel-' + String(rel.id).replace(/[^a-zA-Z0-9_-]/g, '');
      const percent = tl.status === 'future' ? 0 : tl.status === 'ended' ? 100 : Math.round(tl.share * 100);
      // Réduite, la vignette montre aussi la valeur du tri quand ce n'est pas la part du temps vécu.
      const sortValue = sort.by === 'days'
        ? `<span class="rel-key" title="Jours restants ensemble"${open ? ' hidden' : ''}>${nf.format(Math.round(tl.futureDays))} j<span class="visually-hidden"> restants ensemble</span></span>`
        : sort.by === 'calendar'
          ? `<span class="rel-key" title="Part de la relation écoulée"${open ? ' hidden' : ''}>${pct.format(tl.calendarShare)} écoulé<span class="visually-hidden"> de la relation</span></span>`
          : '';
      const move = custom && list.length > 1 ? `
            <span class="rel-move">
              <button type="button" class="move-btn" data-action="move-rel" data-dir="-1" data-id="${esc(rel.id)}" aria-label="Monter ${esc(rel.name)}"${index === 0 ? ' disabled' : ''}><svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 13V3M4 7l4-4 4 4" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg></button>
              <button type="button" class="move-btn" data-action="move-rel" data-dir="1" data-id="${esc(rel.id)}" aria-label="Descendre ${esc(rel.name)}"${index === list.length - 1 ? ' disabled' : ''}><svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 3v10M4 9l4 4 4-4" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg></button>
            </span>` : '';
      let share, left;
      if (tl.status === 'future') {
        share = `<span class="big">0<small>%</small></span><p>Cette relation commence en ${dfMonth.format(tl.start)}. Tout le temps ensemble est devant vous.</p>`;
        left = `Vous passerez environ <b>${nf.format(Math.round(tl.futureDays))} jours</b> ensemble${formatTogether(tl.futureDays)}, ${relationEndText(rel, tl)}.`;
      } else if (tl.status === 'ended') {
        share = `<span class="big">100<small>%</small></span><p>Cette relation a pris fin le ${dfLong.format(tl.end)}.</p>`;
        left = `Vous avez partagé environ <b>${nf.format(Math.round(tl.pastDays))} jours</b>${formatTogether(tl.pastDays)}.`;
      } else {
        share = `<span class="big">${percent}<small>%</small></span><p>du temps que vous passerez ensemble est déjà derrière vous, alors que ${pct.format(tl.calendarShare)} de la relation s’est écoulée.</p>`;
        left = `Il vous reste environ <b>${nf.format(Math.round(tl.futureDays))} jours</b> ensemble${formatTogether(tl.futureDays)}, répartis ${relationEndText(rel, tl)}.`;
      }

      const total = tl.totalDays || 1;
      const seg = [];
      if (tl.pastDays > 0) seg.push(`<span class="past" style="flex:${(tl.pastDays / total).toFixed(4)}" title="Déjà vécu : ${nf.format(Math.round(tl.pastDays))} jours"></span>`);
      tl.phases.forEach((p) => {
        if (p.futureDays / total < 0.002) return;
        const mix = Math.round(22 + 48 * p.ratio);
        seg.push(`<span class="fut" style="flex:${(p.futureDays / total).toFixed(4)};--mix:${mix}%" title="${esc(p.label)} : ${nf.format(Math.round(p.futureDays))} jours à venir"></span>`);
      });

      const phases = tl.phases.map((p, i) => {
        const done = p.to <= now;
        const current = p.from <= now && now < p.to;
        const val = done
          ? `${nf.format(Math.round(p.totalDays))} j<small>vécus</small>`
          : current
            ? `${nf.format(Math.round(p.futureDays))} j<small>encore</small>`
            : `${nf.format(Math.round(p.futureDays))} j<small>à venir</small>`;
        return `<li class="${done ? 'done' : ''}">
          <span>${esc(p.label || 'Étape')}${current ? '<span class="pill">en cours</span>' : ''}</span>
          <span class="when">${esc(phaseWhen(rel, tl, p, i))}</span>
          <span class="val">${val}</span>
        </li>`;
      }).join('');

      return `
        <article class="rel${open ? '' : ' is-compact'}${ui.focus === rel.id ? ' is-focus' : ''}" style="--c:${rel.color}">
          <div class="rel-top">
          <h3 class="rel-title">
            <button type="button" class="rel-toggle" data-action="toggle-rel" data-id="${esc(rel.id)}" aria-expanded="${open}" aria-controls="${domId}-share ${domId}-more">
              <span class="dot"></span>
              <span class="rel-id"><span class="rel-name">${esc(rel.name)}</span> <span class="rel-kind">${esc(type.label)}${ageInfo}${rel.job ? ` · ${esc(rel.job)}` : ''}</span></span>
              ${sortValue}
              <span class="rel-mini"${open ? ' hidden' : ''}>${percent}<small>%</small><span class="visually-hidden"> du temps ensemble déjà vécu</span></span>
              <svg class="chev" viewBox="0 0 16 16" aria-hidden="true"><path d="M4 6l4 4 4-4" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>
            </button>
          </h3>${move}
          </div>
          <div class="rel-share" id="${domId}-share"${open ? '' : ' hidden'}>${share}</div>
          <div class="rel-bar" aria-hidden="true">${seg.join('')}</div>
          <div class="rel-more" id="${domId}-more"${open ? '' : ' hidden'}>
            <div class="rel-bar-labels" aria-hidden="true"><span>déjà vécu</span><span>à venir</span></div>
            <p class="rel-left">${left}</p>
            ${phases ? `<ul class="phase-list">${phases}</ul>` : ''}
            <div class="rel-actions">
              <button type="button" class="btn btn-small" data-action="focus" data-id="${esc(rel.id)}" aria-pressed="${ui.focus === rel.id}">${ui.focus === rel.id ? 'Revenir à toute ma vie' : 'Voir sur la grille'}</button>
              <button type="button" class="btn btn-small btn-quiet" data-action="edit-rel" data-id="${esc(rel.id)}">Modifier</button>
            </div>
          </div>
        </article>`;
    }).join('');
  }

  function renderEvents() {
    const box = $('#events');
    if (!state.events.length) {
      box.innerHTML = `
        <div class="empty">
          <p>Ajoute un mariage, un diplôme, un déménagement ou un projet : il apparaîtra sur la grille.</p>
          <button type="button" class="btn btn-small" data-action="add-ev">Ajouter un événement</button>
        </div>`;
      return;
    }
    const { now, life } = view;
    const items = state.events
      .map((e) => ({ ...e, t0: L.parseDate(e.start), t1: L.parseDate(e.end || e.start) }))
      .sort((a, b) => a.t0 - b.t0);
    const upcoming = items.filter((e) => e.t1 >= now);
    const past = items.filter((e) => e.t1 < now).reverse();

    const row = (e) => {
      const date = e.type === 'period'
        ? `${dfMonth.format(e.t0)} – ${dfMonth.format(e.t1)}`
        : dfLong.format(e.t0);
      const when = e.type === 'period' && e.t0 <= now && now <= e.t1 ? 'en cours' : relative(e.t0, now);
      const age = e.t0 >= life.birth ? ` · ${ageText(L.fullYears(life.birth, e.t0))}` : '';
      return `<li><button type="button" class="ev" data-action="edit-ev" data-id="${esc(e.id)}" style="--c:${e.color}">
        <span class="ev-emoji" aria-hidden="true">${esc(e.emoji)}</span>
        <span class="ev-body"><span class="ev-title">${esc(e.title)}</span><span class="ev-meta">${date} · ${when}${age}</span></span>
      </button></li>`;
    };
    box.innerHTML = [
      upcoming.length ? `<div class="ev-group"><h3>À venir</h3><ul>${upcoming.map(row).join('')}</ul></div>` : '',
      past.length ? `<div class="ev-group"><h3>Derrière toi</h3><ul>${past.map(row).join('')}</ul></div>` : '',
    ].join('');
  }

  /* ------------------------------------------------------------------ *
   * Grille : survol, sélection, clavier
   * ------------------------------------------------------------------ */

  function select(i) {
    const grid = $('#grid');
    const prev = grid.querySelector('.c.sel');
    if (prev) prev.classList.remove('sel');
    ui.selected = i;
    if (i != null) {
      const el = grid.querySelector(`[data-i="${i}"]`);
      if (el) el.classList.add('sel');
    }
    showCell(i);
  }

  function dateOfCell(i) {
    const range = view.cells.scheme.weekRange(view.life.birth, Math.floor(i / L.WEEKS), i % L.WEEKS);
    return i === view.cells.now.index ? view.now : Math.max(range.start, view.life.birth);
  }

  const grid = $('#grid');
  let pointerDown = false;
  grid.addEventListener('mousedown', () => { pointerDown = true; });
  grid.addEventListener('mouseover', (e) => {
    const c = e.target.closest('.c');
    if (c) showCell(Number(c.dataset.i));
  });
  grid.addEventListener('mouseleave', () => showCell(ui.selected));
  grid.addEventListener('click', (e) => {
    const c = e.target.closest('.c');
    if (!c || c.classList.contains('b')) return;
    const i = Number(c.dataset.i);
    if (ui.selected === i) openEvent(null, L.toISO(dateOfCell(i)));
    else select(i);
  });
  grid.addEventListener('focus', () => {
    // Au clavier, on part de la semaine en cours ; à la souris, de la semaine touchée.
    if (!pointerDown && ui.selected == null) select(view.cells.now.index);
    pointerDown = false;
  });
  grid.addEventListener('keydown', (e) => {
    const moves = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -L.WEEKS, ArrowDown: L.WEEKS };
    const current = ui.selected == null ? view.cells.now.index : ui.selected;
    if (moves[e.key]) {
      e.preventDefault();
      select(cellIndex(current + moves[e.key]));
      const el = grid.querySelector('.c.sel');
      if (el) el.scrollIntoView({ block: 'nearest' });
    } else if (e.key === 'Home') {
      e.preventDefault();
      select(view.cells.now.index);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      openEvent(null, L.toISO(dateOfCell(current)));
    } else if (e.key === 'Escape' && ui.focus) {
      setFocus(null);
    }
  });

  // Changer l'alignement garde la même semaine sélectionnée.
  document.querySelectorAll('input[name="grid-mode"]').forEach((input) => input.addEventListener('change', () => {
    if (!input.checked) return;
    const date = ui.selected == null ? null : dateOfCell(ui.selected);
    state.settings.gridMode = input.value;
    ui.selected = null;
    save();
    render();
    if (date != null) select(view.cells.scheme.weekOf(view.life.birth, date).index);
  }));

  function orderedRelations() {
    const { by, dir } = state.settings.relSort;
    const key = SORT_KEYS[by];
    if (!key) return state.relations;
    const sign = dir === 'asc' ? 1 : -1;
    // Tri stable : à valeur égale, l'ordre personnalisé est conservé.
    return [...state.relations].sort((a, b) => sign * (key(view.timelines.get(a.id)) - key(view.timelines.get(b.id))));
  }

  // Monte ou descend un proche dans l'ordre personnalisé, en gardant le focus sur la flèche.
  function moveRel(id, delta) {
    const list = state.relations;
    const i = list.findIndex((r) => r.id === id);
    const j = i + delta;
    if (i < 0 || j < 0 || j >= list.length) return;
    [list[i], list[j]] = [list[j], list[i]];
    save();
    renderRelations();
    const buttons = [...document.querySelectorAll('[data-action="move-rel"]')].filter((b) => b.dataset.id === id);
    const target = buttons.find((b) => Number(b.dataset.dir) === delta && !b.disabled) || buttons.find((b) => !b.disabled);
    if (target) target.focus();
    $('#rel-live').textContent = `${list[j].name} est maintenant en position ${j + 1} sur ${list.length}.`;
  }

  $('#rel-sort-by').addEventListener('change', (e) => {
    state.settings.relSort.by = e.target.value;
    save();
    renderRelations();
  });
  document.querySelectorAll('input[name="rel-sort-dir"]').forEach((input) => input.addEventListener('change', () => {
    if (!input.checked) return;
    state.settings.relSort.dir = input.value;
    save();
    renderRelations();
  }));

  // Déplie ou réduit la vignette d'un proche, en gardant le focus clavier sur son bouton.
  function toggleRel(id) {
    const list = state.settings.expanded;
    const i = list.indexOf(id);
    if (i >= 0) list.splice(i, 1);
    else list.push(id);
    save();
    renderRelations();
    const btn = [...document.querySelectorAll('[data-action="toggle-rel"]')].find((b) => b.dataset.id === id);
    if (btn) btn.focus();
  }

  function setFocus(id) {
    ui.focus = id;
    render();
    if (id) {
      const life = document.querySelector('.life');
      const top = life.getBoundingClientRect().top;
      if (top < 0 || top > window.innerHeight * 0.6) {
        const smooth = !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        life.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto', block: 'start' });
      }
    }
  }

  /* ------------------------------------------------------------------ *
   * Fenêtres
   * ------------------------------------------------------------------ */

  function openDialog(dlg) {
    if (typeof dlg.showModal === 'function') dlg.showModal();
    else dlg.setAttribute('open', '');
  }

  function closeDialog(dlg) {
    if (typeof dlg.close === 'function') dlg.close();
    else dlg.removeAttribute('open');
  }

  document.querySelectorAll('dialog').forEach((dlg) => {
    dlg.addEventListener('click', (e) => {
      if (e.target === dlg || e.target.closest('[data-close]')) closeDialog(dlg);
    });
  });

  function showError(el, message) {
    el.textContent = message || '';
    el.hidden = !message;
  }

  function confirmAction(message, okLabel) {
    const dlg = $('#dlg-confirm');
    $('#dlg-confirm-text').textContent = message;
    $('#confirm-ok').textContent = okLabel || 'Confirmer';
    openDialog(dlg);
    return new Promise((resolve) => {
      const ok = $('#confirm-ok');
      const done = (value) => {
        ok.removeEventListener('click', onOk);
        dlg.removeEventListener('close', onClose);
        resolve(value);
      };
      const onOk = () => { done(true); closeDialog(dlg); };
      const onClose = () => done(false);
      ok.addEventListener('click', onOk);
      dlg.addEventListener('close', onClose);
    });
  }

  function swatches(container, name, selected) {
    container.innerHTML = COLORS.map((c, i) => `
      <label><input type="radio" name="${name}" value="${c}" id="${name}-${i}"${c === selected ? ' checked' : ''} aria-label="Couleur ${i + 1}"><span style="--c:${c}"></span></label>`).join('');
  }

  function nextColor(list) {
    const used = new Set(list.map((x) => x.color));
    return COLORS.find((c) => !used.has(c)) || COLORS[list.length % COLORS.length];
  }

  /* ---------- Métier et secteur (profil et proches) ---------- */

  const categoryOptions = L.CATEGORIES.map((c) => `<option value="${c.id}">${esc(c.label)}</option>`).join('');
  const sectorOptions = L.SECTORS.map((s) => `<option value="${s.id}">${esc(s.label)}</option>`).join('');

  function sectorHint(id) {
    if (!id) return 'Facultatif. Son effet sur l’espérance de vie est une estimation indicative.';
    const gap = L.sectorGap(id);
    if (gap === 0) return 'Pas d’écart estimé pour ce secteur.';
    return `Effet estimé : ${gap > 0 ? '+' : '−'}${nf.format(Math.abs(gap))} an (estimation indicative).`;
  }

  // Le métier saisi choisit la catégorie et, tant qu'on ne l'a pas choisi soi-même, le secteur.
  function jobFields(f) {
    f.category.innerHTML = categoryOptions;
    f.sector.innerHTML = sectorOptions;
    const defaultHint = f.jobHint.textContent;
    const refresh = () => {
      const cat = L.CATEGORIES.find((c) => c.id === f.category.value);
      f.categoryHint.textContent = cat ? `Par exemple : ${cat.examples}.` : '';
      f.sectorHint.textContent = sectorHint(f.sector.value);
    };
    f.job.addEventListener('input', () => {
      const cat = L.matchJob(f.job.value);
      const sector = L.matchSector(f.job.value);
      if (cat) f.category.value = cat;
      if (sector && (!f.sector.value || f.sector.dataset.auto)) {
        f.sector.value = sector;
        f.sector.dataset.auto = '1';
      }
      const parts = [];
      if (cat) parts.push(`Catégorie trouvée : ${L.CATEGORIES.find((c) => c.id === cat).label}.`);
      if (sector && f.sector.value === sector) parts.push(`Secteur : ${L.SECTORS.find((s) => s.id === sector).label}.`);
      if (parts.length) parts.push('Tu peux les changer ci-dessous.');
      if (!cat && f.job.value.trim()) parts.push('Choisis la catégorie qui correspond le mieux à ce métier.');
      f.jobHint.textContent = parts.length ? parts.join(' ') : defaultHint;
      refresh();
    });
    f.category.addEventListener('change', refresh);
    f.sector.addEventListener('change', () => { delete f.sector.dataset.auto; refresh(); });
    return {
      fill(p) {
        f.job.value = p.job || '';
        f.category.value = p.category || 'ensemble';
        f.sector.value = p.sector || '';
        delete f.sector.dataset.auto;
        f.jobHint.textContent = defaultHint;
        refresh();
      },
      read() {
        return { job: text(f.job.value, 80), category: f.category.value, sector: f.sector.value };
      },
    };
  }

  /* ---------- Profil ---------- */

  const pf = {
    birth: $('#pf-birth'),
    adjust: $('#pf-adjust'),
  };
  const pfJob = jobFields({
    job: $('#pf-job'),
    category: $('#pf-category'),
    sector: $('#pf-sector'),
    jobHint: $('#pf-job-hint'),
    categoryHint: $('#pf-category-hint'),
    sectorHint: $('#pf-sector-hint'),
  });
  $('#job-list').innerHTML = [
    'Agriculteur, agricultrice', 'Aide-soignant, aide-soignante', 'Architecte', 'Artisan', 'Assistante maternelle',
    'Auxiliaire de vie', 'Avocat, avocate', 'Boulanger, boulangère', 'Caissier, caissière', 'Cadre', 'Chauffeur routier',
    'Chef d’entreprise', 'Coiffeur, coiffeuse', 'Commerçant, commerçante', 'Commercial, commerciale', 'Comptable',
    'Cuisinier, cuisinière', 'Développeur, développeuse', 'Éducateur, éducatrice', 'Électricien', 'Éleveur, éleveuse',
    'Employé de bureau', 'Étudiant, étudiante', 'Infirmier, infirmière', 'Ingénieur, ingénieure', 'Journaliste',
    'Kinésithérapeute', 'Livreur', 'Maçon', 'Magasinier', 'Mécanicien', 'Médecin', 'Militaire', 'Ouvrier, ouvrière',
    'Pharmacien, pharmacienne', 'Plombier', 'Policier, policière', 'Pompier', 'Professeur des écoles',
    'Professeur, professeure', 'Restaurateur', 'Secrétaire', 'Serveur, serveuse', 'Technicien, technicienne',
    'Vendeur, vendeuse', 'Viticulteur',
  ].map((j) => `<option value="${esc(j)}"></option>`).join('');

  function readProfileForm() {
    const sex = document.querySelector('input[name="sex"]:checked');
    return {
      birth: pf.birth.value,
      sex: sex ? sex.value : 'X',
      ...pfJob.read(),
      adjust: Number(pf.adjust.value) || 0,
    };
  }

  function updateProfilePreview() {
    const p = readProfileForm();
    const adj = p.adjust;
    $('#pf-adjust-out').textContent = adj === 0 ? 'aucun' : `${adj > 0 ? '+' : '−'}${plural(Math.abs(adj), 'an', 'ans')}`;
    const birth = L.parseDate(p.birth);
    const now = L.today();
    if (birth == null || birth > now || birth < L.parseDate('1900-01-01')) {
      $('#pf-preview').textContent = '';
      return;
    }
    const lifespan = L.expectedLifespan(p, now);
    const death = L.deathDate(p, now);
    $('#pf-preview').innerHTML = `Espérance de vie estimée : <strong>${nf1.format(lifespan)} ans</strong>, soit jusqu’en ${dfMonth.format(death)} environ.`;
  }

  function openProfile() {
    const p = state.demo ? { birth: '', sex: '', job: '', category: 'ensemble', sector: '', adjust: 0 } : state.profile;
    pf.birth.value = p.birth;
    pf.birth.max = L.toISO(L.today());
    document.querySelectorAll('input[name="sex"]').forEach((r) => { r.checked = r.value === p.sex; });
    pfJob.fill(p);
    pf.adjust.value = p.adjust;
    showError($('#pf-error'), '');
    updateProfilePreview();
    openDialog($('#dlg-profile'));
  }

  ['input', 'change'].forEach((type) => $('#form-profile').addEventListener(type, updateProfilePreview));

  $('#form-profile').addEventListener('submit', (e) => {
    e.preventDefault();
    const p = readProfileForm();
    const birth = L.parseDate(p.birth);
    if (birth == null) return showError($('#pf-error'), 'Indique ta date de naissance.');
    if (birth > L.today()) return showError($('#pf-error'), 'La date de naissance ne peut pas être dans le futur.');
    if (birth < L.parseDate('1900-01-01')) return showError($('#pf-error'), 'Indique une date de naissance après 1900.');
    if (state.demo) {
      state.relations = state.relations.filter((r) => !r.demo);
      state.events = state.events.filter((ev) => !ev.demo);
      state.demo = false;
      ui.focus = null;
      ui.selected = null;
    }
    state.profile = p;
    save();
    render();
    closeDialog($('#dlg-profile'));
  });

  /* ---------- Événements ---------- */

  let editingEvent = null;

  function openEvent(ev, date) {
    editingEvent = ev ? ev.id : null;
    $('#dlg-event-title').textContent = ev ? 'Modifier l’événement' : 'Nouvel événement';
    $('#ev-title').value = ev ? ev.title : '';
    const type = ev ? ev.type : 'point';
    $('#ev-type-point').checked = type === 'point';
    $('#ev-type-period').checked = type === 'period';
    $('#ev-start').value = ev ? ev.start : date || L.toISO(L.today());
    $('#ev-end').value = ev ? ev.end : '';
    const emoji = ev ? ev.emoji : EMOJIS[0];
    $('#ev-emoji').innerHTML = EMOJIS.map((em, i) => `
      <label><input type="radio" name="emoji" value="${em}" id="ev-emoji-${i}"${em === emoji ? ' checked' : ''} aria-label="${em}"><span>${em}</span></label>`).join('');
    swatches($('#ev-color'), 'ev-color', ev ? ev.color : nextColor(state.events));
    $('#ev-delete').hidden = !ev;
    showError($('#ev-error'), '');
    syncEventType();
    openDialog($('#dlg-event'));
    $('#ev-title').focus();
  }

  function syncEventType() {
    const period = $('#ev-type-period').checked;
    $('#ev-end-field').hidden = !period;
    $('#ev-start-label').textContent = period ? 'Début' : 'Date';
  }
  document.querySelectorAll('input[name="type"]').forEach((r) => r.addEventListener('change', syncEventType));

  $('#form-event').addEventListener('submit', (e) => {
    e.preventDefault();
    const type = $('#ev-type-period').checked ? 'period' : 'point';
    const ev = {
      id: editingEvent || uid(),
      type,
      title: text($('#ev-title').value, 80),
      start: $('#ev-start').value,
      end: type === 'period' ? $('#ev-end').value : '',
      emoji: (document.querySelector('input[name="emoji"]:checked') || {}).value || EMOJIS[0],
      color: (document.querySelector('input[name="ev-color"]:checked') || {}).value || COLORS[0],
    };
    const err = $('#ev-error');
    if (!ev.title) return showError(err, 'Donne un titre à l’événement.');
    if (!isDate(ev.start)) return showError(err, 'Choisis une date.');
    if (type === 'period' && !isDate(ev.end)) return showError(err, 'Choisis la date de fin de la période.');
    if (type === 'period' && ev.end < ev.start) return showError(err, 'La fin doit venir après le début.');
    const old = state.events.find((x) => x.id === ev.id);
    if (old) Object.assign(old, ev, { demo: old.demo });
    else state.events.push(ev);
    save();
    render();
    closeDialog($('#dlg-event'));
  });

  $('#ev-delete').addEventListener('click', async () => {
    const ev = state.events.find((x) => x.id === editingEvent);
    if (!ev) return;
    closeDialog($('#dlg-event'));
    if (await confirmAction(`Supprimer « ${ev.title} » ?`, 'Supprimer')) {
      state.events = state.events.filter((x) => x.id !== ev.id);
      save();
      render();
    }
  });

  /* ---------- Proches ---------- */

  let editingRel = null;
  const rel = {
    kind: $('#rel-kind'),
    name: $('#rel-name'),
    start: $('#rel-start'),
    birth: $('#rel-birth'),
    end: $('#rel-end'),
    ref: $('#rel-ref'),
    phases: $('#rel-phases'),
  };
  const relJob = jobFields({
    job: $('#rel-job'),
    category: $('#rel-category'),
    sector: $('#rel-sector'),
    jobHint: $('#rel-job-hint'),
    categoryHint: $('#rel-category-hint'),
    sectorHint: $('#rel-sector-hint'),
  });
  rel.kind.innerHTML = Object.entries(L.RELATION_TYPES).map(([id, t]) => `<option value="${id}">${esc(t.label)}</option>`).join('');
  rel.ref.innerHTML = Object.entries(L.REFS).map(([id, label]) => `<option value="${id}">${esc(label)}</option>`).join('');

  function phaseRow(p, k) {
    const preset = L.FREQUENCIES.some((f) => f.days === p.days);
    const options = L.FREQUENCIES.map((f) => `<option value="${f.days}"${preset && f.days === p.days ? ' selected' : ''}>${esc(f.label)}</option>`).join('');
    return `
      <div class="phase" data-k="${k}">
        <input type="text" class="ph-label" id="ph-label-${k}" value="${esc(p.label)}" placeholder="Nom de l’étape" aria-label="Nom de l’étape" maxlength="60">
        <label class="ph-until">jusqu’à
          <input type="number" class="ph-until-n" id="ph-until-${k}" min="0" max="120" step="1" value="${p.until == null ? '' : p.until}" placeholder="fin" aria-label="Jusqu’à quel âge (vide : jusqu’à la fin)"> ans</label>
        <div class="ph-freq-wrap">
          <select class="ph-freq" id="ph-freq-${k}" aria-label="Fréquence">${options}<option value="custom"${preset ? '' : ' selected'}>Autre rythme…</option></select>
          <input type="number" class="ph-days" id="ph-days-${k}" min="0" max="365" step="1" value="${p.days}" aria-label="Jours ensemble par an"${preset ? ' hidden' : ''}>
        </div>
        <button type="button" class="btn btn-quiet ph-del" data-action="del-phase" aria-label="Supprimer cette étape">×</button>
      </div>`;
  }

  function renderPhases(phases) {
    rel.phases.innerHTML = phases.map(phaseRow).join('');
  }

  function readPhases() {
    return [...rel.phases.querySelectorAll('.phase')].map((row) => {
      const freq = row.querySelector('.ph-freq').value;
      const days = freq === 'custom' ? Number(row.querySelector('.ph-days').value) : Number(freq);
      const until = row.querySelector('.ph-until-n').value;
      return {
        label: text(row.querySelector('.ph-label').value, 60),
        until: until === '' ? null : Math.max(0, Math.min(120, Number(until))),
        days: Math.max(0, Math.min(365, Math.round(days) || 0)),
      };
    });
  }

  rel.phases.addEventListener('change', (e) => {
    if (!e.target.classList.contains('ph-freq')) return;
    const days = e.target.parentElement.querySelector('.ph-days');
    days.hidden = e.target.value !== 'custom';
    if (!days.hidden) days.focus();
    else days.value = e.target.value;
  });
  rel.phases.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-action="del-phase"]');
    if (!btn) return;
    const k = Number(btn.closest('.phase').dataset.k);
    const phases = readPhases();
    phases.splice(k, 1);
    renderPhases(phases);
  });
  $('#rel-add-phase').addEventListener('click', () => {
    const phases = readPhases();
    phases.push({ label: '', until: null, days: 12 });
    renderPhases(phases);
    const inputs = rel.phases.querySelectorAll('.ph-label');
    inputs[inputs.length - 1].focus();
  });

  function syncRelKind(applyPreset) {
    const kind = rel.kind.value;
    const type = L.RELATION_TYPES[kind];
    $('#rel-start-label').textContent = type.startLabel;
    $('#rel-birth-field').hidden = kind === 'child';
    $('#rel-life-hint').textContent = kind === 'child'
      ? 'Les étapes suivent l’âge de ton enfant. Une naissance à venir fonctionne aussi. Son métier, une fois adulte, affine son espérance de vie.'
      : 'Sa date de naissance, son métier et son secteur servent à estimer son espérance de vie, donc le temps que vous aurez ensemble.';
    if (applyPreset) {
      rel.ref.value = type.ref;
      renderPhases(clonePhases(kind));
      if (type.startIsMyBirth && !rel.start.value) rel.start.value = state.profile.birth;
      else if (!type.startIsMyBirth && rel.start.value === state.profile.birth) rel.start.value = '';
    }
  }
  rel.kind.addEventListener('change', () => syncRelKind(true));

  function updateRelPreview() {
    const out = $('#rel-preview');
    const birth = rel.kind.value === 'child' ? rel.start.value : rel.birth.value;
    if (!isDate(birth)) {
      out.textContent = '';
      return;
    }
    const sex = (document.querySelector('input[name="otherSex"]:checked') || {}).value || 'X';
    const person = { birth, sex, ...relJob.read() };
    const now = L.today();
    const name = text(rel.name.value, 40) || 'cette personne';
    out.innerHTML = `Espérance de vie estimée de ${esc(name)} : <strong>${nf1.format(L.expectedLifespan(person, now))} ans</strong>, soit jusqu’en ${dfMonth.format(L.deathDate(person, now))} environ.`;
  }
  ['input', 'change'].forEach((type) => $('#form-rel').addEventListener(type, updateRelPreview));

  function openRel(r) {
    editingRel = r ? r.id : null;
    $('#dlg-rel-title').textContent = r ? `Modifier ${r.name}` : 'Nouveau proche';
    rel.kind.value = r ? r.kind : 'child';
    rel.name.value = r ? r.name : '';
    rel.start.value = r ? r.start : '';
    rel.birth.value = r ? r.otherBirth : '';
    rel.end.value = r ? r.end : '';
    const sex = r ? r.otherSex : 'X';
    document.querySelectorAll('input[name="otherSex"]').forEach((x) => { x.checked = x.value === sex; });
    relJob.fill(r || {});
    syncRelKind(!r);
    if (r) {
      rel.ref.value = r.ref;
      renderPhases(r.phases);
    }
    swatches($('#rel-color'), 'rel-color', r ? r.color : nextColor(state.relations));
    $('#rel-delete').hidden = !r;
    showError($('#rel-error'), '');
    updateRelPreview();
    openDialog($('#dlg-rel'));
    rel.name.focus();
  }

  $('#form-rel').addEventListener('submit', (e) => {
    e.preventDefault();
    const kind = rel.kind.value;
    const r = {
      id: editingRel || uid(),
      kind,
      name: text(rel.name.value, 40),
      start: rel.start.value,
      otherBirth: kind === 'child' ? '' : rel.birth.value,
      otherSex: (document.querySelector('input[name="otherSex"]:checked') || {}).value || 'X',
      ...relJob.read(),
      end: rel.end.value,
      ref: rel.ref.value,
      phases: readPhases(),
      color: (document.querySelector('input[name="rel-color"]:checked') || {}).value || COLORS[0],
    };
    const err = $('#rel-error');
    if (!r.name) return showError(err, 'Indique son prénom.');
    if (!isDate(r.start)) return showError(err, `Indique la date : ${L.RELATION_TYPES[kind].startLabel.toLowerCase()}.`);
    if (r.otherBirth && !isDate(r.otherBirth)) return showError(err, 'Sa date de naissance n’est pas valide.');
    if (r.end && r.end <= r.start) return showError(err, 'La fin de la relation doit venir après son début.');
    if (!r.phases.length) return showError(err, 'Ajoute au moins une étape.');
    const old = state.relations.find((x) => x.id === r.id);
    if (old) Object.assign(old, r, { demo: old.demo });
    else {
      state.relations.push(r);
      state.settings.expanded.push(r.id);
    }
    save();
    render();
    closeDialog($('#dlg-rel'));
  });

  $('#rel-delete').addEventListener('click', async () => {
    const r = state.relations.find((x) => x.id === editingRel);
    if (!r) return;
    closeDialog($('#dlg-rel'));
    if (await confirmAction(`Retirer ${r.name} de tes proches ?`, 'Retirer')) {
      state.relations = state.relations.filter((x) => x.id !== r.id);
      state.settings.expanded = state.settings.expanded.filter((x) => x !== r.id);
      if (ui.focus === r.id) ui.focus = null;
      save();
      render();
    }
  });

  /* ---------- Sauvegarde ---------- */

  $('#btn-export').addEventListener('click', () => {
    const data = { app: 'lerestedetavie', version: 1, exported: new Date().toISOString(), ...state };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `le-reste-de-ta-vie-${L.toISO(L.today())}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  });

  $('#file-import').addEventListener('change', (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      let next = null;
      try { next = cleanState(JSON.parse(reader.result)); } catch (err) { next = null; }
      const msg = $('#data-msg');
      if (!next) {
        showError(msg, 'Ce fichier n’est pas une sauvegarde valide de l’application Le reste de ta vie.');
      } else {
        state = next;
        ui.focus = null;
        ui.selected = null;
        save();
        render();
        showError(msg, '');
        closeDialog($('#dlg-data'));
      }
      e.target.value = '';
    };
    reader.readAsText(file);
  });

  $('#btn-reset').addEventListener('click', async () => {
    closeDialog($('#dlg-data'));
    if (await confirmAction('Effacer ton profil, tes proches et tes événements de ce navigateur ? Cette action est définitive.', 'Tout effacer')) {
      try { localStorage.removeItem(STORE_KEY); } catch (err) { /* rien à effacer */ }
      state = demoState();
      ui.focus = null;
      ui.selected = null;
      render();
    }
  });

  /* ---------- Boutons généraux ---------- */

  $('#btn-profile').addEventListener('click', openProfile);
  $('#btn-start').addEventListener('click', openProfile);
  $('#btn-add-rel').addEventListener('click', () => openRel(null));
  $('#btn-add-ev').addEventListener('click', () => openEvent(null));
  $('#btn-data').addEventListener('click', () => { showError($('#data-msg'), ''); openDialog($('#dlg-data')); });

  document.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const id = btn.dataset.id;
    switch (btn.dataset.action) {
      case 'toggle-rel': toggleRel(id); break;
      case 'move-rel': moveRel(id, Number(btn.dataset.dir)); break;
      case 'focus': setFocus(ui.focus === id ? null : id); break;
      case 'unfocus': setFocus(null); break;
      case 'edit-rel': openRel(state.relations.find((r) => r.id === id)); break;
      case 'edit-ev': openEvent(state.events.find((ev) => ev.id === id)); break;
      case 'add-rel': openRel(null); break;
      case 'add-ev': openEvent(null); break;
      case 'add-at': openEvent(null, L.toISO(dateOfCell(Number(btn.dataset.i)))); break;
      default: break;
    }
  });

  // Passé minuit, la semaine en cours peut changer : on redessine au retour sur la page.
  let renderedDay = L.today();
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && L.today() !== renderedDay) {
      renderedDay = L.today();
      render();
    }
  });

  render();
})();
