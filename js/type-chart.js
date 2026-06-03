/**
 * Matrice d'efficacité offensive Gen 6+ (18 types classiques).
 */
(function (global) {
  const ATTACK_TYPES = [
    'Normal',
    'Fire',
    'Water',
    'Electric',
    'Grass',
    'Ice',
    'Fighting',
    'Poison',
    'Ground',
    'Flying',
    'Psychic',
    'Bug',
    'Rock',
    'Ghost',
    'Dragon',
    'Dark',
    'Steel',
    'Fairy',
  ];

  const SLUG_TO_CANONICAL = {
    normal: 'Normal',
    fire: 'Fire',
    feu: 'Fire',
    water: 'Water',
    eau: 'Water',
    electric: 'Electric',
    electrik: 'Electric',
    électrik: 'Electric',
    grass: 'Grass',
    plante: 'Grass',
    ice: 'Ice',
    glace: 'Ice',
    fighting: 'Fighting',
    combat: 'Fighting',
    poison: 'Poison',
    ground: 'Ground',
    sol: 'Ground',
    flying: 'Flying',
    vol: 'Flying',
    psychic: 'Psychic',
    psy: 'Psychic',
    bug: 'Bug',
    insecte: 'Bug',
    rock: 'Rock',
    roche: 'Rock',
    ghost: 'Ghost',
    spectre: 'Ghost',
    dragon: 'Dragon',
    dark: 'Dark',
    ténèbres: 'Dark',
    tenebres: 'Dark',
    steel: 'Steel',
    acier: 'Steel',
    fairy: 'Fairy',
    fée: 'Fairy',
    fee: 'Fairy',
  };

  function slugify(type) {
    if (!type) return '';
    return String(type).toLowerCase().replace(/\s+/g, '-').replace(/é/g, 'e');
  }

  function normalizeType(type) {
    if (!type || !String(type).trim()) return null;
    const slug = slugify(type);
    if (SLUG_TO_CANONICAL[slug]) return SLUG_TO_CANONICAL[slug];
    const direct = ATTACK_TYPES.find((t) => t.toLowerCase() === slug);
    return direct || null;
  }

  function setMult(chart, attack, defend, mult) {
    if (!chart[attack]) chart[attack] = {};
    chart[attack][defend] = mult;
  }

  function buildChart() {
    const chart = {};
    for (const atk of ATTACK_TYPES) {
      chart[atk] = {};
      for (const def of ATTACK_TYPES) {
        chart[atk][def] = 1;
      }
    }

    const superEff = [
      ['Normal', ['Rock', 'Steel'], 0.5],
      ['Normal', ['Ghost'], 0],
      ['Fire', ['Grass', 'Ice', 'Bug', 'Steel'], 2],
      ['Fire', ['Fire', 'Water', 'Rock', 'Dragon'], 0.5],
      ['Water', ['Fire', 'Ground', 'Rock'], 2],
      ['Water', ['Water', 'Grass', 'Dragon'], 0.5],
      ['Electric', ['Water', 'Flying'], 2],
      ['Electric', ['Electric', 'Grass', 'Dragon'], 0.5],
      ['Electric', ['Ground'], 0],
      ['Grass', ['Water', 'Ground', 'Rock'], 2],
      ['Grass', ['Fire', 'Grass', 'Poison', 'Flying', 'Bug', 'Dragon', 'Steel'], 0.5],
      ['Ice', ['Grass', 'Ground', 'Flying', 'Dragon'], 2],
      ['Ice', ['Fire', 'Water', 'Ice', 'Steel'], 0.5],
      ['Fighting', ['Normal', 'Ice', 'Rock', 'Dark', 'Steel'], 2],
      ['Fighting', ['Poison', 'Flying', 'Psychic', 'Bug', 'Fairy'], 0.5],
      ['Fighting', ['Ghost'], 0],
      ['Poison', ['Grass', 'Fairy'], 2],
      ['Poison', ['Poison', 'Ground', 'Rock', 'Ghost', 'Steel'], 0.5],
      ['Ground', ['Fire', 'Electric', 'Poison', 'Rock', 'Steel'], 2],
      ['Ground', ['Grass', 'Bug'], 0.5],
      ['Ground', ['Flying'], 0],
      ['Flying', ['Grass', 'Fighting', 'Bug'], 2],
      ['Flying', ['Electric', 'Rock', 'Steel'], 0.5],
      ['Psychic', ['Fighting', 'Poison'], 2],
      ['Psychic', ['Psychic', 'Steel'], 0.5],
      ['Psychic', ['Dark'], 0],
      ['Bug', ['Grass', 'Psychic', 'Dark'], 2],
      ['Bug', ['Fire', 'Fighting', 'Poison', 'Flying', 'Ghost', 'Steel', 'Fairy'], 0.5],
      ['Rock', ['Fire', 'Ice', 'Flying', 'Bug'], 2],
      ['Rock', ['Fighting', 'Ground', 'Steel'], 0.5],
      ['Ghost', ['Psychic', 'Ghost'], 2],
      ['Ghost', ['Dark'], 0.5],
      ['Ghost', ['Normal'], 0],
      ['Dragon', ['Dragon'], 2],
      ['Dragon', ['Steel'], 0.5],
      ['Dragon', ['Fairy'], 0],
      ['Dark', ['Psychic', 'Ghost'], 2],
      ['Dark', ['Fighting', 'Dark', 'Fairy'], 0.5],
      ['Steel', ['Ice', 'Rock', 'Fairy'], 2],
      ['Steel', ['Fire', 'Water', 'Electric', 'Steel'], 0.5],
      ['Fairy', ['Fighting', 'Dragon', 'Dark'], 2],
      ['Fairy', ['Fire', 'Poison', 'Steel'], 0.5],
    ];

    for (const [attack, targets, mult] of superEff) {
      for (const defend of targets) {
        setMult(chart, attack, defend, mult);
      }
    }

    return chart;
  }

  const CHART = buildChart();

  function getOffensiveMultiplier(attackType, defendType) {
    const atk = normalizeType(attackType);
    const def = normalizeType(defendType);
    if (!atk || !def) return 1;
    return CHART[atk]?.[def] ?? 1;
  }

  function getDefensiveMultiplier(attackType, type1, type2) {
    const mult1 = getOffensiveMultiplier(attackType, type1);
    const t2 = type2 && String(type2).trim();
    if (!t2) return mult1;
    const mult2 = getOffensiveMultiplier(attackType, type2);
    return mult1 * mult2;
  }

  function compareWeaknessCandidate(a, b) {
    if (a.score !== b.score) return a.score - b.score;
    if (a.weakCount !== b.weakCount) return a.weakCount - b.weakCount;
    if (a.weak4xCount !== b.weak4xCount) return a.weak4xCount - b.weak4xCount;
    return a.type.localeCompare(b.type, 'en');
  }

  function computeDominantWeakness(teamPokemon) {
    const scores = {};
    for (const atk of ATTACK_TYPES) {
      scores[atk] = { type: atk, score: 0, weakCount: 0, weak4xCount: 0 };
    }

    for (const pokemon of teamPokemon) {
      if (!pokemon) continue;
      for (const atk of ATTACK_TYPES) {
        const mult = getDefensiveMultiplier(atk, pokemon.type1, pokemon.type2);
        if (mult > 1) {
          scores[atk].score += mult;
          if (mult >= 2) scores[atk].weakCount += 1;
          if (mult >= 4) scores[atk].weak4xCount += 1;
        }
      }
    }

    let best = null;
    for (const atk of ATTACK_TYPES) {
      const entry = scores[atk];
      if (entry.score <= 0) continue;
      if (!best || compareWeaknessCandidate(entry, best) > 0) {
        best = entry;
      }
    }

    return best;
  }

  global.TypeChart = {
    ATTACK_TYPES,
    normalizeType,
    getOffensiveMultiplier,
    getDefensiveMultiplier,
    computeDominantWeakness,
    compareWeaknessCandidate,
  };
})(typeof window !== 'undefined' ? window : globalThis);
