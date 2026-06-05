/**

 * Utilitaires pool Pokémon : éligibilité, filtres, statuts Pokédex.

 */

(function (global) {

  const STAT_KEYS = ['hp', 'attack', 'defense', 'spAtk', 'spDef', 'speed'];



  function getBaseTotal(pokemon) {

    if (pokemon.baseTotal != null && !Number.isNaN(Number(pokemon.baseTotal))) {

      return Number(pokemon.baseTotal);

    }

    return STAT_KEYS.reduce((sum, k) => sum + (Number(pokemon[k]) || 0), 0);

  }



  function normalizeAvailability(availability) {

    if (availability && typeof availability === 'object' && !Array.isArray(availability)) {

      return {

        usedSpecies: availability.usedSpecies || [],

        bannedPokemonIds: availability.bannedPokemonIds || [],

      };

    }

    if (Array.isArray(availability)) {

      return { usedSpecies: availability, bannedPokemonIds: [] };

    }

    return { usedSpecies: [], bannedPokemonIds: [] };

  }



  function isSpeciesUsed(speciesKey, usedSpecies) {

    return usedSpecies.includes(speciesKey);

  }



  function isPokemonIdBanned(pokemonId, bannedPokemonIds) {

    return bannedPokemonIds.includes(pokemonId);

  }



  /**

   * Éligibilité draft : espèce bloquée (ban base ou pick) ou id précis banni (ban méga).

   * @param {object} pokemon

   * @param {string[]|object} availability — usedSpecies[], ou état { usedSpecies, bannedPokemonIds }

   */

  function isSelectable(pokemon, availability) {

    const { usedSpecies, bannedPokemonIds } = normalizeAvailability(availability);

    return (

      pokemon.enabled === true &&

      !isSpeciesUsed(pokemon.speciesKey, usedSpecies) &&

      !isPokemonIdBanned(pokemon.id, bannedPokemonIds)

    );

  }



  function filterSelectable(pool, availability) {

    return pool.filter((p) => isSelectable(p, availability));

  }



  function countPoolStats(pool, state) {

    const enabled = pool.filter((p) => p.enabled);

    const horsPool = pool.length - enabled.length;

    const disponibles = enabled.filter((p) => isSelectable(p, state)).length;

    const actifs = enabled.length;



    return { total: pool.length, actifs, horsPool, disponibles };

  }



  function countActivePoolStats(pool) {

    const enabled = pool.filter((p) => p.enabled);

    let megaCount = 0;

    const typeCounts = {};



    for (const p of enabled) {

      if (p.isMega) megaCount += 1;

      [p.type1, p.type2]

        .filter((t) => t && String(t).trim())

        .forEach((type) => {

          typeCounts[type] = (typeCounts[type] || 0) + 1;

        });

    }



    return {

      total: pool.length,

      actifs: enabled.length,

      megaCount,

      typeCounts,

    };

  }



  function searchPokemon(pool, query) {

    const q = (query || '').trim().toLowerCase();

    if (!q) return pool;

    return pool.filter(

      (p) =>

        p.name.toLowerCase().includes(q) ||

        p.pokedexId.toLowerCase().includes(q) ||

        p.id.toLowerCase().includes(q)

    );

  }



  function formatAbilityName(ability, options) {
    if (!ability || !ability.name) return '';
    const opts = options || {};
    if (opts.markHidden !== false && ability.isHidden) {
      return `${ability.name} (Hidden)`;
    }
    return ability.name;
  }



  function renderAbilitiesList(pokemon, options) {

    const opts = options || {};

    const listClass = opts.listClass || 'ability-list';

    const itemClass = opts.itemClass || 'ability-list__item';

    const hiddenClass = opts.hiddenClass || 'ability-list__item--hidden';
    const distinguishHidden = opts.distinguishHidden !== false;

    const abilities = pokemon?.abilities;

    if (!Array.isArray(abilities) || abilities.length === 0) return '';

    const items = abilities

      .map((ability) => {

        const cls =
          distinguishHidden && ability.isHidden
            ? `${itemClass} ${hiddenClass}`
            : itemClass;

        const label = formatAbilityName(ability, {
          markHidden: distinguishHidden,
        });

        return `<li class="${cls}">${escapeHtml(label)}</li>`;

      })

      .join('');

    return `<ul class="${listClass}">${items}</ul>`;

  }



  function escapeHtml(s) {

    const d = document.createElement('div');

    d.textContent = s;

    return d.innerHTML;

  }



  global.PokemonSpecies = {

    STAT_KEYS,

    getBaseTotal,

    normalizeAvailability,

    isSelectable,

    filterSelectable,

    countPoolStats,

    countActivePoolStats,

    searchPokemon,

    formatAbilityName,

    renderAbilitiesList,

  };

})(typeof window !== 'undefined' ? window : globalThis);

/**
 * Chargement des sprites animés — retry en cas d'échec réseau transitoire.
 */
(function (global) {
  if (global.SpriteImg) return;

  const PLACEHOLDER = 'assets/sprites/placeholder.svg';
  const MAX_RETRIES = 2;

  function escapeAttr(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  function handleSpriteError(img) {
    const original = img.dataset.spriteSrc;
    if (!original || original === PLACEHOLDER) return;

    const retries = Number(img.dataset.spriteRetries || 0);
    if (retries >= MAX_RETRIES) {
      img.onerror = null;
      img.src = PLACEHOLDER;
      return;
    }

    img.dataset.spriteRetries = String(retries + 1);
    const delay = 400 * (retries + 1);
    setTimeout(() => {
      if (!img.isConnected) return;
      const sep = original.includes('?') ? '&' : '?';
      img.src = `${original}${sep}_r=${retries + 1}`;
    }, delay);
  }

  function tag(spriteUrl, options) {
    const opts = options || {};
    const src = spriteUrl || PLACEHOLDER;
    const cls = opts.className ? ` class="${escapeAttr(opts.className)}"` : '';
    const alt = opts.alt != null ? ` alt="${escapeAttr(opts.alt)}"` : ' alt=""';
    const loading = opts.loading ? ` loading="${escapeAttr(opts.loading)}"` : '';
    const draggable = opts.draggable === false ? ' draggable="false"' : '';
    return `<img${cls} src="${escapeAttr(src)}" data-sprite-src="${escapeAttr(src)}"${alt}${loading}${draggable} onerror="handleSpriteError(this)">`;
  }

  function isMegaPokemon(ref, poolData) {
    if (!ref) return false;
    if (ref.isMega === true) return true;
    if (ref.isMega === false) return false;
    const url = String(ref.spriteUrl || '').toLowerCase();
    if (/-mega|mega-|megax|megay|primal|gmax/.test(url)) return true;
    const id = ref.id || ref.pokemonId;
    if (poolData && id && global.DraftState?.findPokemon) {
      const pokemon = global.DraftState.findPokemon(poolData, id);
      return !!pokemon?.isMega;
    }
    return false;
  }

  /** Sprite + libellé MÉGA sous l'image (sans zoom). */
  function renderSlotContent(spriteUrl, options) {
    const opts = options || {};
    const img = tag(spriteUrl, {
      className: opts.className,
      alt: opts.alt,
      draggable: opts.draggable,
    });
    const mega = isMegaPokemon(
      { id: opts.id, pokemonId: opts.pokemonId, spriteUrl, isMega: opts.isMega },
      opts.poolData
    );
    if (!mega) return img;
    const wrapClass = opts.wrapClass || 'sprite-slot-wrap';
    const labelClass = opts.megaLabelClass || 'sprite-mega-label';
    return `<div class="${wrapClass}">${img}<span class="${labelClass}">MEGA</span></div>`;
  }

  global.handleSpriteError = handleSpriteError;
  global.SpriteImg = {
    PLACEHOLDER,
    escapeAttr,
    tag,
    isMegaPokemon,
    renderSlotContent,
    handleError: handleSpriteError,
  };
})(typeof window !== 'undefined' ? window : globalThis);

