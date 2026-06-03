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



  function isSpeciesUsed(speciesKey, usedSpecies) {

    return usedSpecies.includes(speciesKey);

  }



  function isSelectable(pokemon, usedSpecies) {

    return (

      pokemon.enabled === true &&

      !isSpeciesUsed(pokemon.speciesKey, usedSpecies)

    );

  }



  function filterSelectable(pool, usedSpecies) {

    return pool.filter((p) => isSelectable(p, usedSpecies));

  }



  function countPoolStats(pool, state) {

    const enabled = pool.filter((p) => p.enabled);

    const horsPool = pool.length - enabled.length;

    const disponibles = enabled.filter(

      (p) => !isSpeciesUsed(p.speciesKey, state.usedSpecies)

    ).length;

    const actifs = enabled.length;



    return { total: pool.length, actifs, horsPool, disponibles };

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



  function formatAbilityName(ability) {

    if (!ability || !ability.name) return '';

    if (ability.isHidden) return `${ability.name} (Hidden)`;

    return ability.name;

  }



  function renderAbilitiesList(pokemon, options) {

    const opts = options || {};

    const listClass = opts.listClass || 'ability-list';

    const itemClass = opts.itemClass || 'ability-list__item';

    const hiddenClass = opts.hiddenClass || 'ability-list__item--hidden';

    const abilities = pokemon?.abilities;

    if (!Array.isArray(abilities) || abilities.length === 0) return '';

    const items = abilities

      .map((ability) => {

        const cls = ability.isHidden ? `${itemClass} ${hiddenClass}` : itemClass;

        const label = formatAbilityName(ability);

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

    isSelectable,

    filterSelectable,

    countPoolStats,

    searchPokemon,

    formatAbilityName,

    renderAbilitiesList,

  };

})(typeof window !== 'undefined' ? window : globalThis);

