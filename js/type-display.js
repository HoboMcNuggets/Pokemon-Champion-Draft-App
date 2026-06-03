/**
 * Affichage des types Pokémon — icônes SVG couleur (partywhale) + pastilles.
 */
(function (global) {
  const ICON_BASE = 'assets/type-icons';

  /** Libellé affiché (EN) — source unique Pokédex + stream */
  const TYPE_LABEL_EN = {
    normal: 'Normal',
    fire: 'Fire',
    water: 'Water',
    grass: 'Grass',
    electric: 'Electric',
    ice: 'Ice',
    fighting: 'Fighting',
    poison: 'Poison',
    ground: 'Ground',
    flying: 'Flying',
    psychic: 'Psychic',
    bug: 'Bug',
    rock: 'Rock',
    ghost: 'Ghost',
    dragon: 'Dragon',
    dark: 'Dark',
    steel: 'Steel',
    fairy: 'Fairy',
    stellar: 'Stellar',
  };

  /** Libellés pool (EN/FR) → slug fichier SVG */
  const SLUG_OVERRIDES = {
    plante: 'grass',
    feu: 'fire',
    eau: 'water',
    electrik: 'electric',
    électrik: 'electric',
    glace: 'ice',
    combat: 'fighting',
    sol: 'ground',
    vol: 'flying',
    psy: 'psychic',
    insecte: 'bug',
    roche: 'rock',
    spectre: 'ghost',
    ténèbres: 'dark',
    tenebres: 'dark',
    acier: 'steel',
    fée: 'fairy',
    fee: 'fairy',
    stellaire: 'stellar',
  };

  function escapeHtml(s) {
    const d = document.createElement('div');
    d.textContent = s;
    return d.innerHTML;
  }

  function typeClass(type) {
    if (!type) return '';
    return 'type-' + String(type).toLowerCase().replace(/\s+/g, '-').replace(/é/g, 'e');
  }

  function typeSlug(type) {
    if (!type) return '';
    const key = String(type).toLowerCase().replace(/\s+/g, '-').replace(/é/g, 'e');
    if (SLUG_OVERRIDES[key]) return SLUG_OVERRIDES[key];
    return key;
  }

  function iconUrl(type) {
    const slug = typeSlug(type);
    return slug ? `${ICON_BASE}/${slug}.svg` : '';
  }

  /** Libellé visible : toujours EN (ex. Grass), même si le pool contient une variante FR. */
  function displayLabel(type) {
    if (!type) return '';
    const slug = typeSlug(type);
    return TYPE_LABEL_EN[slug] || String(type);
  }

  /**
   * Badge type — icône couleur (option A), libellé EN.
   * @param {string} type — type1 / type2 du pool
   * @param {{ variant?: 'badge'|'orb' }} [options] — badge = Pokédex, orb = stream
   */
  function renderBadge(type, options = {}) {
    if (!type) return '';
    const variant = options.variant === 'orb' ? 'orb' : 'badge';
    const cls = typeClass(type);
    const baseClass = variant === 'orb' ? 'stream-type-orb' : 'type-badge';
    const url = iconUrl(type);
    const label = escapeHtml(displayLabel(type));

    const iconHtml = url
      ? `<img class="${baseClass}__icon" src="${url}" alt="" decoding="async">`
      : '';

    return `<span class="${baseClass} ${cls}" title="${label}">${iconHtml}<span class="${baseClass}__label">${label}</span></span>`;
  }

  global.TypeDisplay = {
    ICON_BASE,
    TYPE_LABEL_EN,
    typeClass,
    typeSlug,
    iconUrl,
    displayLabel,
    renderBadge,
  };
})(typeof window !== 'undefined' ? window : globalThis);
