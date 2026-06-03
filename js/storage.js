/**
 * Persistance localStorage — draft et pool.
 */
(function (global) {
  const DRAFT_KEY = 'pokemonDraft.v1';
  const POOL_KEY = 'pokemonDraft.pool';
  const VIEW_MODE_KEY = 'pokemonDraft.viewMode';

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

  global.DraftStorage = {
    saveDraft,
    loadDraft,
    savePool,
    loadPool,
    clearPool,
    saveViewMode,
    loadViewMode,
  };
})(typeof window !== 'undefined' ? window : globalThis);
