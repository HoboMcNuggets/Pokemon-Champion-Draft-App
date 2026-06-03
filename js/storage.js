/**
 * Persistance localStorage — draft et pool.
 */
(function (global) {
  const DRAFT_KEY = 'pokemonDraft.v1';
  const POOL_KEY = 'pokemonDraft.pool';
  const VIEW_MODE_KEY = 'pokemonDraft.viewMode';
  const THEME_KEY = 'pokemonDraft.theme';
  const VALID_THEMES = [
    'default',
    'normal',
    'fire',
    'water',
    'electric',
    'grass',
    'ice',
    'fighting',
    'poison',
    'ground',
    'flying',
    'psychic',
    'bug',
    'rock',
    'ghost',
    'dragon',
    'dark',
    'steel',
    'fairy',
    'stellar',
  ];
  const THEME_ALIASES = {
    'all-types': 'default',
    pikachu: 'electric',
    squirtle: 'water',
    charizard: 'fire',
    bulbasaur: 'grass',
  };

  function normalizeTheme(theme) {
    if (VALID_THEMES.includes(theme)) return theme;
    if (THEME_ALIASES[theme]) return THEME_ALIASES[theme];
    return 'default';
  }

  function saveDraft(state) {
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify(state));
      return true;
    } catch (e) {
      console.warn('Sauvegarde draft impossible', e);
      return false;
    }
  }

  function loadDraft() {
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch (e) {
      console.warn('Chargement draft impossible', e);
      return null;
    }
  }

  function savePool(pool) {
    try {
      localStorage.setItem(POOL_KEY, JSON.stringify(pool));
      return true;
    } catch (e) {
      console.warn('Sauvegarde pool impossible', e);
      return false;
    }
  }

  function loadPool() {
    try {
      const raw = localStorage.getItem(POOL_KEY);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch (e) {
      console.warn('Chargement pool impossible', e);
      return null;
    }
  }

  function clearPool() {
    localStorage.removeItem(POOL_KEY);
  }

  function saveViewMode(mode) {
    try {
      localStorage.setItem(VIEW_MODE_KEY, mode);
      return true;
    } catch (e) {
      return false;
    }
  }

  function loadViewMode() {
    try {
      const v = localStorage.getItem(VIEW_MODE_KEY);
      return v === 'stream' || v === 'config' ? v : 'config';
    } catch (e) {
      return 'config';
    }
  }

  function saveTheme(theme) {
    try {
      localStorage.setItem(THEME_KEY, theme);
      return true;
    } catch (e) {
      return false;
    }
  }

  function loadTheme() {
    try {
      const v = localStorage.getItem(THEME_KEY);
      return normalizeTheme(v);
    } catch (e) {
      return 'default';
    }
  }

  global.DraftStorage = {
    saveDraft,
    loadDraft,
    savePool,
    loadPool,
    clearPool,
    saveViewMode,
    loadViewMode,
    saveTheme,
    loadTheme,
    VALID_THEMES,
  };
})(typeof window !== 'undefined' ? window : globalThis);
