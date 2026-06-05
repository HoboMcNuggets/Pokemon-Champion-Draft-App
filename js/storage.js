/**
 * Persistance localStorage — draft et pool.
 */
(function (global) {
  const DRAFT_KEY = 'pokemonDraft.v1';
  const POOL_KEY = 'pokemonDraft.pool';
  const ACTIVE_PROFILE_KEY = 'pokemonDraft.activeProfile';
  const VIEW_MODE_KEY = 'pokemonDraft.viewMode';
  const THEME_KEY = 'pokemonDraft.theme';
  const TIMER_DURATION_KEY = 'pokemonDraft.timerDurationSec';
  const SPRITE_MODE_KEY = 'pokemonDraft.spriteMode';
  const TIMER_DURATION_MIN = 10;
  const TIMER_DURATION_MAX = 600;
  const TIMER_DURATION_DEFAULT = 60;
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

  function saveActiveProfile(profile) {
    try {
      localStorage.setItem(ACTIVE_PROFILE_KEY, JSON.stringify(profile));
      return true;
    } catch (e) {
      console.warn('Sauvegarde profil actif impossible', e);
      return false;
    }
  }

  function loadActiveProfile() {
    try {
      const raw = localStorage.getItem(ACTIVE_PROFILE_KEY);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch (e) {
      console.warn('Chargement profil actif impossible', e);
      return null;
    }
  }

  function clearActiveProfile() {
    localStorage.removeItem(ACTIVE_PROFILE_KEY);
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

  function clampTurnTimerDuration(sec) {
    const n = Number(sec);
    if (!Number.isFinite(n)) return TIMER_DURATION_DEFAULT;
    return Math.min(TIMER_DURATION_MAX, Math.max(TIMER_DURATION_MIN, Math.round(n)));
  }

  function saveTurnTimerDuration(sec) {
    try {
      localStorage.setItem(TIMER_DURATION_KEY, String(clampTurnTimerDuration(sec)));
      return true;
    } catch (e) {
      return false;
    }
  }

  function loadTurnTimerDuration() {
    try {
      const v = localStorage.getItem(TIMER_DURATION_KEY);
      if (v == null) return TIMER_DURATION_DEFAULT;
      return clampTurnTimerDuration(Number(v));
    } catch (e) {
      return TIMER_DURATION_DEFAULT;
    }
  }

  function normalizeSpriteMode(mode) {
    return mode === 'new' ? 'new' : 'retro';
  }

  function saveSpriteMode(mode) {
    try {
      localStorage.setItem(SPRITE_MODE_KEY, normalizeSpriteMode(mode));
      return true;
    } catch (e) {
      return false;
    }
  }

  function loadSpriteMode() {
    try {
      const v = localStorage.getItem(SPRITE_MODE_KEY);
      return normalizeSpriteMode(v);
    } catch (e) {
      return 'retro';
    }
  }

  global.DraftStorage = {
    saveDraft,
    loadDraft,
    savePool,
    loadPool,
    clearPool,
    saveActiveProfile,
    loadActiveProfile,
    clearActiveProfile,
    saveViewMode,
    loadViewMode,
    saveTheme,
    loadTheme,
    VALID_THEMES,
    saveTurnTimerDuration,
    loadTurnTimerDuration,
    clampTurnTimerDuration,
    TIMER_DURATION_MIN,
    TIMER_DURATION_MAX,
    TIMER_DURATION_DEFAULT,
    saveSpriteMode,
    loadSpriteMode,
    normalizeSpriteMode,
  };
})(typeof window !== 'undefined' ? window : globalThis);
