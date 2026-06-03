/**
 * Import et validation du JSON pool Pokémon.
 */
(function (global) {
  const REQUIRED_FIELDS = [
    'pokedexId',
    'id',
    'name',
    'type1',
    'baseTotal',
    'hp',
    'attack',
    'defense',
    'spAtk',
    'spDef',
    'speed',
    'spriteUrl',
    'enabled',
    'speciesKey',
    'isMega',
  ];

  const NUMERIC_FIELDS = [
    'baseTotal',
    'hp',
    'attack',
    'defense',
    'spAtk',
    'spDef',
    'speed',
  ];

  function validatePoolData(data) {
    const errors = [];
    const warnings = [];

    if (!data || typeof data !== 'object') {
      return { ok: false, errors: ['Fichier JSON invalide.'], warnings: [], pool: null };
    }

    if (data.version == null) {
      errors.push('Champ racine "version" manquant.');
    }

    if (!Array.isArray(data.pokemon) || data.pokemon.length === 0) {
      errors.push('Le tableau "pokemon" doit contenir au moins une entrée.');
      return { ok: false, errors, warnings, pool: null };
    }

    const ids = new Set();
    let enabledCount = 0;

    data.pokemon.forEach((entry, index) => {
      const label = `Entrée #${index + 1} (${entry?.id ?? 'sans id'})`;

      for (const field of REQUIRED_FIELDS) {
        if (entry[field] === undefined || entry[field] === null) {
          if (field === 'type2') continue;
          errors.push(`${label} : champ "${field}" manquant.`);
        }
      }

      if (typeof entry.enabled !== 'boolean') {
        errors.push(`${label} : "enabled" doit être true ou false.`);
      } else if (entry.enabled) {
        enabledCount++;
      }

      if (typeof entry.isMega !== 'boolean') {
        errors.push(`${label} : "isMega" doit être true ou false.`);
      }

      if (entry.pokedexId && String(entry.pokedexId).endsWith('-M') && !entry.isMega) {
        warnings.push(
          `${label} : pokedexId se termine par -M mais isMega est false.`
        );
      }

      if (entry.id) {
        if (ids.has(entry.id)) {
          errors.push(`${label} : id "${entry.id}" en double.`);
        }
        ids.add(entry.id);
      }

      for (const field of NUMERIC_FIELDS) {
        if (entry[field] != null && Number.isNaN(Number(entry[field]))) {
          errors.push(`${label} : "${field}" doit être un nombre.`);
        }
      }

      if (entry.type2 === undefined) {
        entry.type2 = '';
      }
    });

    if (enabledCount === 0) {
      errors.push('Au moins une entrée doit avoir enabled: true.');
    }

    if (errors.length > 0) {
      return { ok: false, errors, warnings, pool: null };
    }

    const pool = {
      version: data.version,
      leagueName: data.leagueName || 'Ligue',
      poolLabel: data.poolLabel || '',
      pokemon: data.pokemon.map((e) => ({
        ...e,
        type2: e.type2 == null ? '' : String(e.type2),
      })),
    };

    return { ok: true, errors: [], warnings, pool };
  }

  function parsePoolJson(text) {
    try {
      const data = JSON.parse(text);
      return validatePoolData(data);
    } catch (e) {
      return {
        ok: false,
        errors: ['JSON illisible : ' + (e.message || 'erreur de syntaxe')],
        warnings: [],
        pool: null,
      };
    }
  }

  global.PoolImport = {
    validatePoolData,
    parsePoolJson,
  };
})(typeof window !== 'undefined' ? window : globalThis);
