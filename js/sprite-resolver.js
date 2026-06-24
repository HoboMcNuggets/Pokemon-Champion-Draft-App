/**
 * Résolution sprites Rétro (Showdown) / Nouveau (Pokeos HOME).
 */
(function (global) {
  const PLACEHOLDER = 'assets/sprites/placeholder.svg';
  const INDEX_URL = 'dev/data/pokeos-sprite-index.json';
  const POKEOS_ANIMATED_BASE =
    'https://s3.pokeos.com/pokeos-uploads/assets/pokemon/home/animated/';
  const POKEOS_STATIC_BASE = 'https://s3.pokeos.com/pokeos-uploads/assets/pokemon/home/';
  const POKEOS_RENDER_BASE = 'https://s3.pokeos.com/pokeos-uploads/assets/pokemon/home/render/';

  const REGIONAL_SUFFIX = {
    alola: 'regional-a',
    galar: 'regional-g',
    hisui: 'regional-h',
  };

  const POKEOS_OVERRIDES = {
    '0351': ['351-sunny', '351-rainy', '351-snowy'],
    '0666': ['666-meadow', '666-continental', '666-modern'],
    '0671': ['671-red', '671-blue', '671-yellow', '671-orange', '671-white'],
    '0676': ['676-natural', '676-heart', '676-diamond', '676-debutante'],
    '0681': ['681-shield', '681-blade'],
    '0778': ['778-disguised', '778-busted'],
    '0877': ['877-full', '877-hangry'],
    '0925': ['925-family'],
    '0711-medium': ['711'],
    '0711-small': ['711-small', '711'],
    '0711-large': ['711-large', '711'],
    '0711-jumbo': ['711-super', '711-jumbo', '711-large'],
    '0128-p-combat': ['128-paldea'],
  };

  let indexById = null;
  let indexLoadPromise = null;

  function parseDexNum(pokedexId) {
    return parseInt(String(pokedexId).replace(/-M$/i, '').replace(/^#?/, ''), 10);
  }

  function normalizeAppSuffix(id) {
    return String(id).replace(/^\d{4}-/, '').replace(/-p\d+$/i, '');
  }

  function isGigantamaxPokemon(pokemon) {
    if (!pokemon?.id) return false;
    const suffix = normalizeAppSuffix(pokemon.id);
    return suffix === 'gigantamax' || suffix.startsWith('gigantamax');
  }

  function pokeosGmaxRenderUrl(pokedexId) {
    const num = parseDexNum(pokedexId);
    return POKEOS_RENDER_BASE + num + '-gmax.png';
  }

  function megaSlugsFromName(num, name) {
    if (/mega charizard y/i.test(name)) return [`${num}-mega-y`];
    if (/mega charizard x/i.test(name)) return [`${num}-mega-x`];
    if (/mega mewtwo y/i.test(name)) return [`${num}-mega-y`];
    if (/mega mewtwo x/i.test(name)) return [`${num}-mega-x`];
    if (/mega\s+\S+\s+[xy]\b/i.test(name)) {
      const axis = /y\b/i.test(name) ? 'y' : 'x';
      return [`${num}-mega-${axis}`];
    }
    return [`${num}-mega`];
  }

  function guessPokeosSlugs(pokemon) {
    if (!pokemon?.id) return [];

    const id = pokemon.id;
    if (POKEOS_OVERRIDES[id]) return POKEOS_OVERRIDES[id].slice();

    const num = parseDexNum(pokemon.pokedexId);
    if (!Number.isFinite(num)) return [];

    if (!id.includes('-')) return [String(num)];

    const suffix = normalizeAppSuffix(id);

    if (suffix === 'm' || /^m-/.test(suffix) || pokemon.isMega) {
      return megaSlugsFromName(num, pokemon.name || '');
    }
    if (suffix === 'm-x') return [`${num}-mega-x`];
    if (suffix === 'm-y') return [`${num}-mega-y`];
    if (REGIONAL_SUFFIX[suffix]) return [`${num}-${REGIONAL_SUFFIX[suffix]}`];
    if (suffix === 'gigantamax' || suffix.startsWith('gigantamax')) return [`${num}-gmax`];
    if (suffix === 'p-combat') return [`${num}-paldea`, `${num}-paldea-combat`, `${num}-combat`];
    if (suffix === 'p-blaze') return [`${num}-paldea-blaze`, `${num}-blaze`];
    if (suffix === 'p-aqua') return [`${num}-paldea-aqua`, `${num}-aqua`];
    if (suffix === 'female') return [`${num}-female`, `${num}-f`];
    if (suffix === 'male') return [`${num}-male`];
    if (suffix === 'jumbo') return [`${num}-jumbo`, `${num}-super`];
    if (suffix === 'totem') return [String(num)];
    if (suffix === 'totemdisguised') return [`${num}-disguised`];
    if (suffix === 'totembusted') return [`${num}-busted`];
    if (suffix === 'ototem') return [String(num)];

    return [`${num}-${suffix}`];
  }

  function pokeosRenderUrl(slug) {
    return POKEOS_RENDER_BASE + slug + '.png';
  }

  function buildPokeosUrlChain(pokemon) {
    const slugs = guessPokeosSlugs(pokemon);
    const urls = [];

    if (isGigantamaxPokemon(pokemon)) {
      urls.push(pokeosGmaxRenderUrl(pokemon.pokedexId));
    }

    for (const slug of slugs) {
      if (slug.endsWith('-gmax')) continue;
      urls.push(POKEOS_ANIMATED_BASE + slug + '.gif');
      urls.push(pokeosRenderUrl(slug));
      urls.push(POKEOS_STATIC_BASE + slug + '.png');
    }
    const unique = [];
    for (const u of urls) {
      if (!unique.includes(u)) unique.push(u);
    }
    return unique;
  }

  function normalizeMode(mode) {
    return mode === 'new' ? 'new' : 'retro';
  }

  function getMode() {
    return global.DraftStorage?.loadSpriteMode?.() || 'retro';
  }

  function setMode(mode) {
    const id = normalizeMode(mode);
    global.DraftStorage?.saveSpriteMode?.(id);
    return id;
  }

  function showdownUrl(pokemon) {
    const url = pokemon?.spriteUrl || '';
    return url && url !== PLACEHOLDER ? url : PLACEHOLDER;
  }

  function primaryPokeosRenderUrl(pokemon, entry) {
    if (entry?.s === 'render' && entry.u) return entry.u;
    if (isGigantamaxPokemon(pokemon)) return pokeosGmaxRenderUrl(pokemon.pokedexId);
    const slugs = guessPokeosSlugs(pokemon);
    for (const slug of slugs) {
      if (!slug.endsWith('-gmax')) return pokeosRenderUrl(slug);
    }
    return null;
  }

  /**
   * Entrée Pokeos : animé → Showdown → render → placeholder.
   * @returns {{ url: string, fallbacks: string[] }}
   */
  function resolvePokeosEntry(pokemon, entry) {
    const chain = [];

    if (entry.s === 'animated' && entry.u) {
      chain.push(entry.u);
    }

    const showdown = showdownUrl(pokemon);
    if (showdown !== PLACEHOLDER) {
      chain.push(showdown);
    }

    const renderUrl = primaryPokeosRenderUrl(pokemon, entry);
    if (renderUrl) {
      chain.push(renderUrl);
    }

    chain.push(PLACEHOLDER);

    const unique = [];
    for (const u of chain) {
      if (!unique.includes(u)) unique.push(u);
    }

    return {
      url: unique[0] || PLACEHOLDER,
      fallbacks: unique.slice(1),
    };
  }

  function resolveFromIndex(pokemon) {
    if (!indexById || !pokemon?.id) return null;
    const entry = indexById[pokemon.id];
    if (!entry) return null;

    if (entry.s === 'showdown') {
      const url = showdownUrl(pokemon);
      return {
        url,
        fallbacks: url !== PLACEHOLDER ? [PLACEHOLDER] : [],
      };
    }

    if (entry.u || entry.s === 'render') {
      return resolvePokeosEntry(pokemon, entry);
    }

    return null;
  }

  /**
   * @returns {{ url: string, fallbacks: string[] }}
   */
  function resolveShowdownOnly(pokemon) {
    const url = showdownUrl(pokemon);
    const fallbacks = url !== PLACEHOLDER ? [PLACEHOLDER] : [];
    return { url, fallbacks };
  }

  function resolve(pokemon, mode) {
    if (!pokemon) {
      return { url: PLACEHOLDER, fallbacks: [] };
    }

    const m = normalizeMode(mode ?? getMode());

    if (m === 'retro') {
      return resolveShowdownOnly(pokemon);
    }

    if (!indexById) {
      return resolveShowdownOnly(pokemon);
    }

    const indexed = resolveFromIndex(pokemon);
    if (indexed) return indexed;

    return resolveShowdownOnly(pokemon);
  }

  function applyIndexData(data) {
    if (data?.byId && typeof data.byId === 'object') {
      indexById = data.byId;
    }
    return indexById;
  }

  function loadEmbeddedIndex() {
    return applyIndexData(global.POKEOS_SPRITE_INDEX);
  }

  function loadIndex() {
    if (indexById) return Promise.resolve(indexById);
    if (indexLoadPromise) return indexLoadPromise;

    const embedded = loadEmbeddedIndex();
    if (embedded) return Promise.resolve(embedded);

    const cacheBust =
      global.POKEOS_SPRITE_INDEX?.generatedAt ||
      global.POKEOS_SPRITE_INDEX?.version ||
      '1';
    const indexUrl = INDEX_URL + '?v=' + encodeURIComponent(String(cacheBust));

    indexLoadPromise = fetch(indexUrl)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => applyIndexData(data) || loadEmbeddedIndex())
      .catch(() => loadEmbeddedIndex());

    return indexLoadPromise;
  }

  function isIndexLoaded() {
    return !!indexById;
  }

  global.SpriteResolver = {
    PLACEHOLDER,
    INDEX_URL,
    POKEOS_ANIMATED_BASE,
    POKEOS_STATIC_BASE,
    POKEOS_RENDER_BASE,
    pokeosRenderUrl,
    guessPokeosSlugs,
    buildPokeosUrlChain,
    getMode,
    setMode,
    resolve,
    loadIndex,
    isIndexLoaded,
    normalizeMode,
  };
})(typeof window !== 'undefined' ? window : globalThis);
