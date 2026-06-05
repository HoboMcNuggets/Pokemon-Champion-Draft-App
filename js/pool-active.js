/**
 * Gestion du profil de Pokémon actifs (overlay d'IDs sur le Pokédex).
 */
(function (global) {
  const EXPORT_FORMAT_VERSION = 1;
  const MIN_ACTIVE_COUNT = 1;

  /** @type {Set<string>} */
  let baselineActiveIds = new Set();

  function toActiveIdSet(activeIds) {
    if (activeIds instanceof Set) return activeIds;
    if (!Array.isArray(activeIds)) return new Set();
    return new Set(activeIds.filter((id) => typeof id === 'string' && id.length > 0));
  }

  function captureBaseline(pool) {
    baselineActiveIds = new Set();
    if (!pool?.pokemon?.length) return baselineActiveIds;
    for (const p of pool.pokemon) {
      if (p.enabled === true) baselineActiveIds.add(p.id);
    }
    return baselineActiveIds;
  }

  function getBaselineIds() {
    return new Set(baselineActiveIds);
  }

  function applyProfile(pool, activeIds) {
    if (!pool?.pokemon?.length) return pool;
    const ids = toActiveIdSet(activeIds);
    for (const p of pool.pokemon) {
      p.enabled = ids.has(p.id);
    }
    return pool;
  }

  function getActiveIds(pool) {
    if (!pool?.pokemon?.length) return [];
    return pool.pokemon.filter((p) => p.enabled === true).map((p) => p.id);
  }

  function countActive(pool) {
    if (!pool?.pokemon?.length) return 0;
    return pool.pokemon.filter((p) => p.enabled === true).length;
  }

  function findPokemon(pool, id) {
    if (!pool?.pokemon?.length || !id) return null;
    return pool.pokemon.find((p) => p.id === id) || null;
  }

  function canDisable(pool, id) {
    const pokemon = findPokemon(pool, id);
    if (!pokemon?.enabled) {
      return { ok: false, message: 'Ce Pokémon est déjà inactif.' };
    }
    if (countActive(pool) <= MIN_ACTIVE_COUNT) {
      return {
        ok: false,
        message: 'Au moins un Pokémon doit rester actif dans le pool.',
      };
    }
    return { ok: true };
  }

  function togglePokemon(pool, id) {
    const pokemon = findPokemon(pool, id);
    if (!pokemon) {
      return { ok: false, message: 'Pokémon introuvable dans le Pokédex.' };
    }

    if (pokemon.enabled) {
      const check = canDisable(pool, id);
      if (!check.ok) return { ok: false, message: check.message };
      pokemon.enabled = false;
    } else {
      pokemon.enabled = true;
    }

    return {
      ok: true,
      enabled: pokemon.enabled,
      activeIds: getActiveIds(pool),
    };
  }

  function createStorageProfile(pool) {
    const activeIds = getActiveIds(pool);
    return {
      formatVersion: EXPORT_FORMAT_VERSION,
      activeIds,
      updatedAt: new Date().toISOString(),
    };
  }

  function createExportPayload(pool, meta = {}) {
    const activeIds = getActiveIds(pool);
    return {
      formatVersion: EXPORT_FORMAT_VERSION,
      exportedAt: new Date().toISOString(),
      leagueName: meta.leagueName ?? pool?.leagueName ?? null,
      activeCount: activeIds.length,
      activeIds,
    };
  }

  function parseImportPayload(text) {
    const errors = [];
    const warnings = [];

    if (typeof text !== 'string' || !text.trim()) {
      return { ok: false, errors: ['Fichier vide.'], warnings, payload: null };
    }

    let data;
    try {
      data = JSON.parse(text);
    } catch {
      return { ok: false, errors: ['JSON invalide.'], warnings, payload: null };
    }

    if (!data || typeof data !== 'object') {
      return { ok: false, errors: ['Structure JSON invalide.'], warnings, payload: null };
    }

    if (data.formatVersion != null && data.formatVersion !== EXPORT_FORMAT_VERSION) {
      warnings.push(
        `Version de profil ${data.formatVersion} (attendu ${EXPORT_FORMAT_VERSION}).`
      );
    }

    if (!Array.isArray(data.activeIds) || data.activeIds.length === 0) {
      errors.push('Le tableau "activeIds" doit contenir au moins un identifiant.');
      return { ok: false, errors, warnings, payload: null };
    }

    const activeIds = [];
    const seen = new Set();
    data.activeIds.forEach((id, index) => {
      if (typeof id !== 'string' || !id.trim()) {
        errors.push(`activeIds[${index}] : identifiant invalide.`);
        return;
      }
      if (seen.has(id)) return;
      seen.add(id);
      activeIds.push(id);
    });

    if (activeIds.length < MIN_ACTIVE_COUNT) {
      errors.push('Le profil doit contenir au moins un Pokémon actif.');
    }

    if (errors.length) {
      return { ok: false, errors, warnings, payload: null };
    }

    return {
      ok: true,
      errors,
      warnings,
      payload: {
        formatVersion: EXPORT_FORMAT_VERSION,
        exportedAt: data.exportedAt ?? null,
        leagueName: data.leagueName ?? null,
        activeCount: activeIds.length,
        activeIds,
      },
    };
  }

  function validateImportAgainstPool(payload, pool) {
    const errors = [];
    const warnings = [];

    if (!payload?.activeIds?.length) {
      return { ok: false, errors: ['Profil actif vide.'], warnings };
    }

    if (!pool?.pokemon?.length) {
      return { ok: false, errors: ['Pokédex non chargé.'], warnings };
    }

    const byId = new Set(pool.pokemon.map((p) => p.id));
    const missing = payload.activeIds.filter((id) => !byId.has(id));

    if (missing.length) {
      const preview = missing.slice(0, 5).join(', ');
      const suffix = missing.length > 5 ? ` (+${missing.length - 5} autres)` : '';
      errors.push(`Identifiants absents du Pokédex : ${preview}${suffix}.`);
    }

    return { ok: errors.length === 0, errors, warnings };
  }

  function validateStoredProfile(profile, pool) {
    if (!profile?.activeIds?.length) {
      return { ok: false, errors: ['Profil stocké vide.'], warnings: [] };
    }
    return validateImportAgainstPool(
      { activeIds: profile.activeIds, formatVersion: profile.formatVersion },
      pool
    );
  }

  function isBaselineProfile(pool) {
    const current = new Set(getActiveIds(pool));
    if (current.size !== baselineActiveIds.size) return false;
    for (const id of baselineActiveIds) {
      if (!current.has(id)) return false;
    }
    return true;
  }

  function applyActiveIds(pool, activeIds) {
    const validation = validateImportAgainstPool({ activeIds }, pool);
    if (!validation.ok) return validation;
    applyProfile(pool, activeIds);
    return { ok: true, activeIds: getActiveIds(pool) };
  }

  function restoreBaseline(pool) {
    applyProfile(pool, baselineActiveIds);
    return { ok: true, activeIds: getActiveIds(pool) };
  }

  global.PoolActive = {
    EXPORT_FORMAT_VERSION,
    MIN_ACTIVE_COUNT,
    captureBaseline,
    getBaselineIds,
    applyProfile,
    getActiveIds,
    countActive,
    togglePokemon,
    canDisable,
    createStorageProfile,
    createExportPayload,
    parseImportPayload,
    validateImportAgainstPool,
    validateStoredProfile,
    isBaselineProfile,
    applyActiveIds,
    restoreBaseline,
  };
})(typeof window !== 'undefined' ? window : globalThis);
