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



  function getPoolPokemon(pool) {

    if (!pool) return [];

    if (Array.isArray(pool)) return pool;

    if (Array.isArray(pool.pokemon)) return pool.pokemon;

    return [];

  }



  /**

   * Méga liées (ex. Charizard X/Y) : mêmes speciesKey, plusieurs isMega.

   * @returns {string[]} ids à bloquer ensemble lors d'un ban/pick méga

   */

  function getLinkedMegaIds(pokemon, pool) {

    if (!pokemon?.isMega) return [];

    const entries = getPoolPokemon(pool).filter(

      (p) => p.isMega === true && p.speciesKey === pokemon.speciesKey

    );

    if (entries.length <= 1) return [pokemon.id];

    return entries.map((p) => p.id);

  }



  function getLinkedMegaSiblingIds(pokemon, pool) {

    return getLinkedMegaIds(pokemon, pool).filter((id) => id !== pokemon.id);

  }



  function isMegaPickRef(pick) {

    if (!pick) return false;

    if (String(pick.pokedexId || '').endsWith('-M')) return true;

    return /-m(?:-|$)/.test(String(pick.id || ''));

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

    getPoolPokemon,

    getLinkedMegaIds,

    getLinkedMegaSiblingIds,

    isMegaPickRef,

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

  function parseFallbacks(img) {
    try {
      const raw = img.dataset.spriteFallbacks;
      if (!raw) return [];
      return JSON.parse(raw);
    } catch (e) {
      return [];
    }
  }

  function isExternalSpriteUrl(url) {
    return /pokeos\.com|pokemonshowdown\.com/i.test(String(url || ''));
  }

  function handleSpriteError(img) {
    if (!img.isConnected) return;

    const fallbacks = parseFallbacks(img);
    const fbIdx = Number(img.dataset.spriteFallbackIdx || 0);
    if (fbIdx < fallbacks.length) {
      const next = fallbacks[fbIdx];
      if (img.src === next || img.dataset.spriteSrc === next) {
        img.dataset.spriteFallbackIdx = String(fbIdx + 1);
        handleSpriteError(img);
        return;
      }
      img.dataset.spriteFallbackIdx = String(fbIdx + 1);
      img.dataset.spriteSrc = next;
      img.dataset.spriteRetries = '0';
      delete img.dataset.spriteLoaded;
      img.src = next;
      return;
    }

    const original = img.dataset.spriteSrc;
    if (!original || original === PLACEHOLDER) {
      img.onerror = null;
      if (img.src !== PLACEHOLDER) img.src = PLACEHOLDER;
      return;
    }

    if (isExternalSpriteUrl(original)) {
      img.onerror = null;
      img.src = PLACEHOLDER;
      return;
    }

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

  function spriteCacheKey(pokemon, url) {
    return `${pokemon?.id || ''}\0${url || ''}`;
  }

  function tag(spriteUrl, options) {
    const opts = options || {};
    const src = spriteUrl || PLACEHOLDER;
    const fallbacks = Array.isArray(opts.fallbacks)
      ? opts.fallbacks.filter((u) => u && u !== src)
      : [];
    const fbAttr = fallbacks.length
      ? ` data-sprite-fallbacks="${escapeAttr(JSON.stringify(fallbacks))}"`
      : '';
    const cls = opts.className ? ` class="${escapeAttr(opts.className)}"` : '';
    const alt = opts.alt != null ? ` alt="${escapeAttr(opts.alt)}"` : ' alt=""';
    const loading = opts.loading ? ` loading="${escapeAttr(opts.loading)}"` : '';
    const decoding = opts.decoding ? ` decoding="${escapeAttr(opts.decoding)}"` : '';
    const draggable = opts.draggable === false ? ' draggable="false"' : '';
    const pokeId = opts.pokemonId || opts.id;
    const pokeAttr = pokeId ? ` data-pokemon-id="${escapeAttr(pokeId)}"` : '';
    return `<img${cls} src="${escapeAttr(src)}" data-sprite-src="${escapeAttr(src)}"${pokeAttr}${fbAttr}${alt}${loading}${decoding}${draggable} onload="this.dataset.spriteLoaded='1'" onerror="handleSpriteError(this)">`;
  }

  /**
   * Met à jour le contenu sprite d'un slot sans recréer l'img si l'URL est inchangée.
   * @returns {boolean} true si le DOM a été modifié
   */
  function syncSlotContent(container, pokemon, options) {
    if (!container || !pokemon) return false;
    const resolved = resolveSprite(pokemon);
    const key = spriteCacheKey(pokemon, resolved.url);
    if (container.dataset.spriteCacheKey === key) return false;
    container.dataset.spriteCacheKey = key;
    container.innerHTML = renderSlotForPokemon(pokemon, options);
    return true;
  }

  function resolveSprite(pokemon) {
    if (global.SpriteResolver?.resolve) {
      return global.SpriteResolver.resolve(pokemon);
    }
    const url = pokemon?.spriteUrl || PLACEHOLDER;
    return { url, fallbacks: url !== PLACEHOLDER ? [PLACEHOLDER] : [] };
  }

  function tagForPokemon(pokemon, options) {
    const resolved = resolveSprite(pokemon);
    return tag(resolved.url, { ...options, fallbacks: resolved.fallbacks });
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
      fallbacks: opts.fallbacks,
    });
    const mega = isMegaPokemon(
      { id: opts.id, pokemonId: opts.pokemonId, spriteUrl, isMega: opts.isMega },
      opts.poolData
    );
    const wrapClass = opts.wrapClass || 'sprite-slot-wrap';
    if (!mega && !opts.alwaysWrap) return img;
    if (!mega) {
      return `<div class="${wrapClass}">${img}</div>`;
    }
    const labelClass = opts.megaLabelClass || 'sprite-mega-label';
    return `<div class="${wrapClass}">${img}<span class="${labelClass}">Mega</span></div>`;
  }

  function renderSlotForPokemon(pokemon, options) {
    const resolved = resolveSprite(pokemon);
    const opts = options || {};
    return renderSlotContent(resolved.url, {
      ...opts,
      fallbacks: resolved.fallbacks,
      id: opts.id ?? pokemon?.id,
      pokemonId: opts.pokemonId ?? pokemon?.id,
      isMega: opts.isMega ?? pokemon?.isMega,
    });
  }

  global.handleSpriteError = handleSpriteError;
  global.SpriteImg = {
    PLACEHOLDER,
    escapeAttr,
    tag,
    tagForPokemon,
    resolveSprite,
    isMegaPokemon,
    renderSlotContent,
    renderSlotForPokemon,
    syncSlotContent,
    spriteCacheKey,
    handleError: handleSpriteError,
  };
})(typeof window !== 'undefined' ? window : globalThis);

