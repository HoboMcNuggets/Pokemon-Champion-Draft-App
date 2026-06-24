/**
 * Application draft Pokémon — opérateur stream.
 */
(function () {
  const { DraftState, SpriteImg, SpriteResolver, AbilityDisplay } = window;
  const PHASE = DraftState.PHASE;
  const { DraftStorage } = window;
  const { PoolImport } = window;
  const { PokemonSpecies } = window;
  const { TypeDisplay } = window;
  const { PokedexView } = window;
  const { StreamView } = window;
  const { PoolActive } = window;
  const { MockDraft } = window;

  const POKEDEX_URL = 'dev/data/pokemon-pokedex.json';
  /** Seuil sous lequel le cache localStorage est considéré comme un ancien pool partiel. */
  const FULL_POKEDEX_MIN = 1000;

  let poolData = null;
  let state = DraftState.createInitialState();

  function lookupPokemon(ref) {
    if (!ref) return null;
    const id = ref.id || ref.pokemonId;
    if (id && poolData?.pokemon) {
      const found = DraftState.findPokemon(poolData, id);
      if (found) return found;
    }
    return ref;
  }
  let uiState = {
    pokedexFilters: {
      search: '',
      sortKey: 'name',
      sortDir: 'asc',
      enabledFilter: 'all',
      typeFilters: [],
      page: 1,
    },
    lastConfigTab: 'draft',
  };
  let editingPlayerName = null;
  let slotPickerContext = null;
  /** Référence persistante — le panneau J8 est re-rendu à chaque tick stream. */
  let viewModeSwitchEl = null;
  let lastDashboardRecapKey = '';
  let recapExportInProgress = false;
  let lastSearchListKey = '';
  let undoRenderRaf = 0;

  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => document.querySelectorAll(sel);

  function showMessage(text, type) {
    const bar = $('#message-bar');
    if (!bar) return;
    if (isStreamMode()) {
      bar.classList.add('hidden');
      return;
    }
    if (!text) {
      bar.classList.add('hidden');
      return;
    }
    bar.textContent = text;
    bar.className = 'message-bar message-bar--inline ' + (type || 'info');
    bar.classList.remove('hidden');
    if (type === 'success' || type === 'info') {
      setTimeout(() => bar.classList.add('hidden'), 4000);
    }
  }

  function persist() {
    DraftStorage.saveDraft(DraftState.serialize(state));
  }

  function isFullPokedex(pool) {
    return (pool?.pokemon?.length || 0) >= FULL_POKEDEX_MIN;
  }

  function setPool(pool) {
    poolData = pool;
    if (pool) {
      if (isFullPokedex(pool)) {
        // Le Pokédex complet est trop volumineux pour localStorage ; rechargement depuis le fichier.
        DraftStorage.clearPool();
      } else {
        DraftStorage.savePool(pool);
      }
    }
    renderAll();
  }

  function initializePoolActiveState(pool) {
    if (!pool || !PoolActive) return;
    PoolActive.captureBaseline(pool);
    const saved = DraftStorage.loadActiveProfile();
    if (!saved?.activeIds?.length) return;
    const check = PoolActive.validateStoredProfile(saved, pool);
    if (check.ok) {
      PoolActive.applyProfile(pool, saved.activeIds);
    } else {
      DraftStorage.clearActiveProfile();
    }
  }

  function loadPoolIntoApp(pool) {
    initializePoolActiveState(pool);
    setPool(pool);
  }

  function persistActiveProfile() {
    if (!poolData || !PoolActive) return;
    if (PoolActive.isBaselineProfile(poolData)) {
      DraftStorage.clearActiveProfile();
      return;
    }
    DraftStorage.saveActiveProfile(PoolActive.createStorageProfile(poolData));
  }

  function canEditActivePool() {
    return state.phase === PHASE.SETUP && Boolean(poolData?.pokemon?.length);
  }

  function getPoolLeagueLabel() {
    return poolData?.leagueName?.trim() || 'Champions';
  }

  function getRestoreActiveLabel() {
    return `Restaurer les actifs ${getPoolLeagueLabel()}`;
  }

  function syncActivePoolSettingsFields() {
    const canEdit = canEditActivePool();
    const disabledTitle = 'Modifiable uniquement avant le démarrage du draft.';
    const importBtn = $('#btn-import-active-profile');
    const resetBtn = $('#btn-reset-active-profile');

    if (importBtn) {
      importBtn.disabled = !canEdit;
      importBtn.title = canEdit ? '' : disabledTitle;
    }
    if (resetBtn) {
      resetBtn.disabled = !canEdit;
      resetBtn.textContent = getRestoreActiveLabel();
      resetBtn.title = canEdit ? '' : disabledTitle;
    }
  }

  function toggleActivePokemon(pokemonId) {
    if (!canEditActivePool()) {
      showMessage('Le pool actif est modifiable uniquement avant le démarrage du draft.', 'error');
      renderPokedex();
      return;
    }
    const result = PoolActive.togglePokemon(poolData, pokemonId);
    if (!result.ok) {
      showMessage(result.message, 'error');
      renderPokedex();
      return;
    }
    persistActiveProfile();
    renderAll();
  }

  function applyImportedActiveProfile(activeIds, meta) {
    const applied = PoolActive.applyActiveIds(poolData, activeIds);
    if (!applied.ok) {
      showMessage(applied.errors.join(' '), 'error');
      return;
    }
    persistActiveProfile();
    renderAll();
    const count = PoolActive.countActive(poolData);
    const parts = [`Profil actif appliqué (${count} Pokémon actifs).`];
    if (meta?.exportedAt) {
      parts.push(`Export du ${new Date(meta.exportedAt).toLocaleString('fr-FR')}.`);
    }
    showMessage(parts.join(' '), 'success');
  }

  function exportActiveProfile() {
    if (!poolData) {
      showMessage('Pokédex non chargé.', 'error');
      return;
    }
    const payload = PoolActive.createExportPayload(poolData, {
      leagueName: poolData.leagueName,
    });
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'pool-active-profile.json';
    a.click();
    URL.revokeObjectURL(a.href);
    showMessage('Profil actif exporté.', 'success');
  }

  function importActiveProfileFromText(text) {
    if (!canEditActivePool()) {
      showMessage('Le pool actif est modifiable uniquement avant le démarrage du draft.', 'error');
      return;
    }
    if (!poolData) {
      showMessage('Pokédex non chargé.', 'error');
      return;
    }
    const parsed = PoolActive.parseImportPayload(text);
    if (!parsed.ok) {
      showMessage(parsed.errors.join(' '), 'error');
      return;
    }
    const poolCheck = PoolActive.validateImportAgainstPool(parsed.payload, poolData);
    if (!poolCheck.ok) {
      showMessage(poolCheck.errors.join(' '), 'error');
      return;
    }
    const warnings = [...(parsed.warnings || []), ...(poolCheck.warnings || [])];
    const warningText = warnings.length ? `\n\n${warnings.join('\n')}` : '';
    const exportedAt = parsed.payload.exportedAt
      ? new Date(parsed.payload.exportedAt).toLocaleString('fr-FR')
      : null;
    const body = exportedAt
      ? `Remplacer les Pokémon actifs par le profil exporté le ${exportedAt} (${parsed.payload.activeCount} actifs) ?${warningText}`
      : `Remplacer les Pokémon actifs par ce profil (${parsed.payload.activeCount} actifs) ?${warningText}`;

    showModal('Importer le profil actif', body, () => {
      applyImportedActiveProfile(parsed.payload.activeIds, parsed.payload);
    });
  }

  function importActiveProfileFromFile(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      importActiveProfileFromText(String(reader.result || ''));
    };
    reader.onerror = () => {
      showMessage('Impossible de lire le fichier.', 'error');
    };
    reader.readAsText(file);
  }

  function resetActiveProfileToBaseline() {
    if (!canEditActivePool()) {
      showMessage('Le pool actif est modifiable uniquement avant le démarrage du draft.', 'error');
      return;
    }
    if (!poolData) {
      showMessage('Pokédex non chargé.', 'error');
      return;
    }
    const leagueLabel = getPoolLeagueLabel();
    showModal(
      getRestoreActiveLabel(),
      `Rétablir la liste des Pokémon actifs issue de ${leagueLabel} ? Vos modifications seront perdues.`,
      () => {
        PoolActive.restoreBaseline(poolData);
        DraftStorage.clearActiveProfile();
        renderAll();
        showMessage(`Actifs ${leagueLabel} restaurés.`, 'success');
      }
    );
  }

  function isPokedexTabActive() {
    const panel = document.getElementById('panel-pokedex');
    return panel?.classList.contains('active') ?? false;
  }

  function switchToTab(tabId) {
    const btn = document.querySelector(`.tab-btn[data-tab="${tabId}"]`);
    if (!btn) return;
    if (!isStreamMode()) {
      uiState.lastConfigTab = tabId;
    }
    $$('.tab-btn').forEach((b) => {
      const active = b.dataset.tab === tabId;
      b.classList.toggle('active', active);
      b.setAttribute('aria-selected', active ? 'true' : 'false');
    });
    $$('.tab-panel').forEach((p) => {
      p.classList.toggle('active', p.dataset.panel === tabId);
    });
    if (tabId === 'pokedex') {
      renderPokedex();
    }
    if (tabId === 'settings') {
      syncTimerConfigFields();
      syncActivePoolSettingsFields();
    }
  }

  function loadInitial() {
    const savedPool = DraftStorage.loadPool();
    if (savedPool) {
      const v = PoolImport.validatePoolData(savedPool);
      if (v.ok && isFullPokedex(v.pool)) {
        initializePoolActiveState(v.pool);
        poolData = v.pool;
      } else {
        DraftStorage.clearPool();
      }
    }
    if (!poolData && window.DEFAULT_EXAMPLE_POOL) {
      const v = PoolImport.validatePoolData(window.DEFAULT_EXAMPLE_POOL);
      if (v.ok) {
        initializePoolActiveState(v.pool);
        poolData = v.pool;
      }
    }
    const savedDraft = DraftStorage.loadDraft();
    if (savedDraft) state = DraftState.deserialize(savedDraft);
  }

  function getPhaseLabel() {
    switch (state.phase) {
      case PHASE.SETUP:
        return 'Tableau de bord';
      case PHASE.BAN:
        return `Phase bans (${state.totalBansDone}/${DraftState.TOTAL_BANS})`;
      case PHASE.DRAFT:
        return `Phase draft (${state.totalPicksDone}/${DraftState.TOTAL_PICKS})`;
      case PHASE.COMPLETE:
        return 'Terminé';
      default:
        return '';
    }
  }

  function getPhaseHint() {
    if (state.phase === PHASE.SETUP) {
      if (isStreamMode()) {
        return 'Renommez les joueurs en mode Tableau de bord si besoin, puis démarrez le draft.';
      }
      return 'Renommez les joueurs dans la grille, passez en mode Stream, puis démarrez le draft.';
    }
    if (state.phase === PHASE.BAN) {
      return 'Chaque joueur bannit 1 Pokémon et 1 Mega (ordre libre), en 2 tours J1→J8 puis J1→J8 : recherchez, puis Bannir pour le joueur en cours.';
    }
    if (state.phase === PHASE.DRAFT) {
      return '';
    }
    return '';
  }

  function isPlayingPhase() {
    return state.phase === PHASE.BAN || state.phase === PHASE.DRAFT;
  }

  function updatePlayerName(slotIndex, name) {
    const trimmed = String(name || '').trim();
    if (!trimmed) {
      showMessage(`Le nom du participant ${slotIndex + 1} est requis.`, 'error');
      return false;
    }
    const players = state.players.map((p, i) =>
      i === slotIndex ? { ...p, name: trimmed } : p
    );
    state = DraftState.setPlayerNames(state, players);
    persist();
    return true;
  }

  const PLAYER_DRAG_TYPE = 'application/x-pokemon-draft-player';

  function renderPlayerDragHandle(playerIndex) {
    return `<span class="player-card__drag-handle" draggable="true" data-player="${playerIndex}" role="button" tabindex="0" aria-label="Déplacer le joueur" title="Déplacer le joueur"><svg class="player-card__drag-icon" width="14" height="14" viewBox="0 0 14 14" aria-hidden="true"><circle cx="4" cy="3" r="1.25" fill="currentColor"/><circle cx="10" cy="3" r="1.25" fill="currentColor"/><circle cx="4" cy="7" r="1.25" fill="currentColor"/><circle cx="10" cy="7" r="1.25" fill="currentColor"/><circle cx="4" cy="11" r="1.25" fill="currentColor"/><circle cx="10" cy="11" r="1.25" fill="currentColor"/></svg></span>`;
  }

  function buildDashboardBanMatrix() {
    const round1 = Array.from({ length: DraftState.PLAYER_COUNT }, () => null);
    const round2 = Array.from({ length: DraftState.PLAYER_COUNT }, () => null);
    (state.bans || []).forEach((ban, index) => {
      const playerIndex =
        typeof ban.playerIndex === 'number' && ban.playerIndex >= 0
          ? ban.playerIndex
          : DraftState.getBanPlayerIndex(index);
      const round = DraftState.getBanRound(index);
      if (round === 1) round1[playerIndex] = ban;
      else if (round === 2) round2[playerIndex] = ban;
    });
    return { round1, round2 };
  }

  function renderDashboardBanSlot(ban, playerIndex, banRound) {
    const editable = DraftState.canEditBanSlot(state, playerIndex, banRound);
    const slotAttrs = editable
      ? `data-ban-player="${playerIndex}" data-ban-round="${banRound}" role="button" tabindex="0"`
      : '';
    const clickableClass = editable ? ' ban-slot--clickable' : '';

    if (ban?.pokemon) {
      const pokemon = lookupPokemon(ban.pokemon);
      return `<div class="ban-slot ban-slot--filled${clickableClass}" ${slotAttrs}>${SpriteImg.renderSlotForPokemon(pokemon, {
        alt: ban.pokemon.name,
        draggable: false,
        poolData,
        alwaysWrap: true,
        wrapClass: 'sprite-slot-wrap sprite-slot-wrap--ban',
        megaLabelClass: 'sprite-mega-label sprite-mega-label--ban',
      })}</div>`;
    }

    return `<div class="ban-slot ban-slot--empty${clickableClass}" ${slotAttrs}><img src="assets/pokemon-ball.png" alt="" draggable="false"></div>`;
  }

  function renderDashboardBans() {
    const section = $('#dashboard-bans');
    const board = $('#dashboard-bans-board');
    if (!section || !board) return;

    const showBans =
      !isStreamMode() &&
      (state.phase === PHASE.BAN || state.phase === PHASE.DRAFT || state.phase === PHASE.COMPLETE);
    section.classList.toggle('hidden', !showBans);
    if (!showBans) return;

    const { round1, round2 } = buildDashboardBanMatrix();
    const headers = state.players
      .map(
        (player, i) =>
          `<div class="dashboard-bans__col-head" title="${escapeAttr(player.name)}">${escapeHtml(player.name)}</div>`
      )
      .join('');

    const row = (bansByPlayer, banRound) =>
      Array.from({ length: DraftState.PLAYER_COUNT }, (_, playerIndex) =>
        renderDashboardBanSlot(bansByPlayer[playerIndex], playerIndex, banRound)
      ).join('');

    board.innerHTML = `
      <div class="dashboard-bans__grid">
        <div class="dashboard-bans__corner" aria-hidden="true"></div>
        ${headers}
        <span class="dashboard-bans__round-label">Tour 1</span>
        ${row(round1, 1)}
        <span class="dashboard-bans__round-label">Tour 2</span>
        ${row(round2, 2)}
      </div>`;
  }

  function renderPlayersGrid() {
    const grid = $('#players-grid');
    const active = DraftState.getActivePlayerIndex(state);
    const showDragHandle = !isStreamMode();

    grid.innerHTML = state.players
      .map((player, i) => {
        const isActive = i === active && isPlayingPhase();
        const team = state.teams[i] || [];
        const dragHandle = showDragHandle ? renderPlayerDragHandle(i) : '';

        const slots = Array.from({ length: DraftState.PICKS_PER_PLAYER }, (_, s) => {
          const pick = team[s];
          const slotAttrs = `data-player="${i}" data-slot="${s}" role="button" tabindex="0" title="Choisir un Pokémon"`;
          if (pick) {
            return `<div class="team-slot team-slot--clickable team-slot--filled" ${slotAttrs}>${SpriteImg.renderSlotForPokemon(lookupPokemon(pick), {
              alt: pick.name,
              draggable: false,
              poolData,
              wrapClass: 'sprite-slot-wrap sprite-slot-wrap--dashboard',
              megaLabelClass: 'sprite-mega-label sprite-mega-label--dashboard',
            })}</div>`;
          }
          return `<div class="team-slot empty team-slot--clickable" ${slotAttrs}><img src="assets/pokemon-ball.png" alt="" draggable="false"></div>`;
        }).join('');

        return `
        <article class="player-card ${isActive ? 'active' : ''}" data-player="${i}">
          <div class="player-card__header">
            <button type="button" class="player-card__name" data-player="${i}" title="Renommer">${escapeHtml(player.name)}</button>
            ${dragHandle}
          </div>
          <div class="player-card__team">${slots}</div>
        </article>`;
      })
      .join('');
  }

  function clearPlayerDragVisuals() {
    $$('.player-card--dragging').forEach((el) => el.classList.remove('player-card--dragging'));
    $$('.player-card--drop-target').forEach((el) => el.classList.remove('player-card--drop-target'));
  }

  function swapPlayersByDrag(indexA, indexB) {
    if (!DraftState.canSwapPlayerSlots(state, indexA, indexB)) return;
    state = DraftState.swapPlayerSlots(state, indexA, indexB);
    persist();
    renderAll();
  }

  function initPlayerDragDrop() {
    const grid = $('#players-grid');
    if (!grid) return;

    grid.addEventListener('dragstart', (e) => {
      if (isStreamMode() || editingPlayerName !== null) return;
      const handle = e.target.closest('.player-card__drag-handle');
      if (!handle) return;
      const indexA = Number(handle.dataset.player);
      e.dataTransfer.setData(PLAYER_DRAG_TYPE, String(indexA));
      e.dataTransfer.effectAllowed = 'move';
      handle.closest('.player-card')?.classList.add('player-card--dragging');
    });

    grid.addEventListener('dragend', () => {
      clearPlayerDragVisuals();
    });

    grid.addEventListener('dragover', (e) => {
      if (isStreamMode()) return;
      const card = e.target.closest('.player-card');
      if (!card) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      $$('.player-card--drop-target').forEach((el) => {
        if (el !== card) el.classList.remove('player-card--drop-target');
      });
      card.classList.add('player-card--drop-target');
    });

    grid.addEventListener('dragleave', (e) => {
      const card = e.target.closest('.player-card');
      if (!card) return;
      const related = e.relatedTarget;
      if (related && card.contains(related)) return;
      card.classList.remove('player-card--drop-target');
    });

    grid.addEventListener('drop', (e) => {
      if (isStreamMode()) return;
      e.preventDefault();
      clearPlayerDragVisuals();
      const card = e.target.closest('.player-card');
      if (!card) return;
      const indexB = Number(card.dataset.player);
      const indexA = Number(e.dataTransfer.getData(PLAYER_DRAG_TYPE));
      swapPlayersByDrag(indexA, indexB);
    });
  }

  function escapeAttr(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;')
      .replace(/</g, '&lt;');
  }

  function escapeHtml(s) {
    const d = document.createElement('div');
    d.textContent = s;
    return d.innerHTML;
  }

  function getSearchCandidates() {
    if (!poolData || !isPlayingPhase()) return [];
    const selectable = PokemonSpecies.filterSelectable(poolData.pokemon, state);
    if (state.phase === PHASE.BAN) {
      return selectable.filter((p) => DraftState.canBan(p, state));
    }
    return selectable;
  }

  function clearPokemonSearch() {
    const searchInput = $('#pokemon-search');
    if (searchInput) searchInput.value = '';
  }


  function updateDockActions() {
    const setup = state.phase === PHASE.SETUP;
    const banPhase = state.phase === PHASE.BAN;
    const draftPhase = state.phase === PHASE.DRAFT;
    const complete = state.phase === PHASE.COMPLETE;
    const playing = isPlayingPhase();
    const stream = isStreamMode();
    const activePlayer = DraftState.getActivePlayerIndex(state);
    const hasSelection = !!state.selectedPokemonId;
    const hasHistory = (state.actionHistory || []).length > 0;
    const pokemon = hasSelection && poolData
      ? DraftState.findPokemon(poolData, state.selectedPokemonId)
      : null;

    const btnStartStream = $('#btn-start-draft-stream');
    const btnBan = $('#btn-ban');
    const btnPick = $('#btn-pick');
    const btnUndoDock = $('#btn-undo-dock');

    const showStreamDock = stream && (setup || playing || complete);

    if (btnStartStream) {
      const showStart = setup && stream;
      btnStartStream.classList.toggle('hidden', !showStart);
      btnStartStream.disabled = showStart ? !canStartDraftSilent() : true;
    }

    if (btnBan) {
      btnBan.classList.toggle('hidden', !banPhase || setup);
      btnBan.disabled = !banPhase || !pokemon || !DraftState.canBan(pokemon, state);
    }
    if (btnPick) {
      btnPick.classList.toggle('hidden', !draftPhase || setup);
      btnPick.disabled =
        !draftPhase ||
        !pokemon ||
        activePlayer < 0 ||
        !DraftState.canAssignPick(pokemon, state, activePlayer);
    }
    if (btnUndoDock) {
      const canUndo = hasHistory && (playing || (complete && stream));
      btnUndoDock.disabled = !canUndo;
      btnUndoDock.classList.toggle('hidden', setup || !canUndo);
    }

    const streamActions = $('.stream-actions');
    if (streamActions) {
      streamActions.classList.toggle('hidden', !showStreamDock);
    }
  }

  function renderSearch() {
    const searchInput = $('#pokemon-search');
    if (!searchInput) return;

    const q = searchInput.value;
    let candidates = getSearchCandidates();

    if (state.selectedPokemonId && poolData) {
      const selected = DraftState.findPokemon(poolData, state.selectedPokemonId);
      const isBannedSpotlight =
        state.phase === PHASE.BAN &&
        (state.bans || []).some((b) => b.pokemonId === state.selectedPokemonId);
      const stillValid =
        selected &&
        (state.phase !== PHASE.BAN ||
          DraftState.canBan(selected, state) ||
          isBannedSpotlight);
      if (!stillValid) {
        state = { ...state, selectedPokemonId: null };
      }
    }

    let list = PokemonSpecies.searchPokemon(candidates, q);

    const container = $('#search-results');
    if (!poolData) {
      lastSearchListKey = '';
      container.innerHTML = '<p>Chargement du Pokédex…</p>';
      updateDockActions();
      return;
    }

    if (state.phase === PHASE.SETUP || state.phase === PHASE.COMPLETE) {
      lastSearchListKey = '';
      container.innerHTML = '<p>Draft non démarré ou terminé.</p>';
      updateDockActions();
      return;
    }

    if (list.length === 0) {
      lastSearchListKey = '';
      container.innerHTML = '<p>Aucun Pokémon disponible.</p>';
      updateDockActions();
      return;
    }

    const listKey = `${state.phase}|${q}|${list.map((p) => p.id).join(',')}`;
    if (listKey === lastSearchListKey) {
      container.querySelectorAll('.search-result-item').forEach((el) => {
        el.classList.toggle('selected', el.dataset.id === state.selectedPokemonId);
      });
      updateDockActions();
      return;
    }
    lastSearchListKey = listKey;

    container.innerHTML = list
      .map((p) => {
        const sel = state.selectedPokemonId === p.id;
        return `
        <div class="search-result-item ${sel ? 'selected' : ''}" data-id="${escapeAttr(p.id)}" role="button" tabindex="0">
          ${SpriteImg.tagForPokemon(p, { loading: 'lazy', decoding: 'async', pokemonId: p.id, id: p.id })}
          <div class="search-result-item__info">
            <div class="search-result-item__name">${escapeHtml(p.name)}</div>
            <div class="search-result-item__meta">${escapeHtml(p.pokedexId)} · BST ${PokemonSpecies.getBaseTotal(p)}</div>
          </div>
        </div>`;
      })
      .join('');

    container.querySelectorAll('.search-result-item').forEach((el) => {
      el.addEventListener('click', () => {
        state = { ...state, selectedPokemonId: el.dataset.id };
        renderSearch();
        renderAll();
      });
    });

    updateDockActions();
  }

  function updateSidebarStats() {
    const bansMax = $('#stat-bans-max');
    const picksMax = $('#stat-picks-max');
    const statBans = $('#stat-bans');
    const statAvailable = $('#stat-available');
    const statPicks = $('#stat-picks');
    if (!bansMax && !picksMax && !statBans && !statAvailable && !statPicks) return;

    if (bansMax) bansMax.textContent = String(DraftState.TOTAL_BANS);
    if (picksMax) picksMax.textContent = String(DraftState.TOTAL_PICKS);
    if (statBans) statBans.textContent = String(state.totalBansDone ?? 0);

    if (!poolData) {
      if (statAvailable) statAvailable.textContent = '—';
      return;
    }
    const counts = PokemonSpecies.countPoolStats(poolData.pokemon, state);
    if (statAvailable) statAvailable.textContent = String(counts.disponibles);
    if (statPicks) statPicks.textContent = String(state.totalPicksDone);
  }

  function renderPhaseBanner() {
    if (isStreamMode()) return;
    $('#phase-label').textContent = getPhaseLabel();
    $('#phase-hint').textContent = getPhaseHint();
    renderBannerPoolStats();
    renderBannerSession();
  }

  function setBannerSub(el, text) {
    if (!el) return;
    el.textContent = text || '';
  }

  function setPhaseBadge(el, label, modifier) {
    if (!el) return;
    el.textContent = label;
    el.className = 'phase-banner__badge' + (modifier ? ` phase-banner__badge--${modifier}` : '');
  }

  function renderBannerPoolStats() {
    const totalEl = $('#banner-pokedex-total');
    const activeEl = $('#banner-pokedex-active');
    const megaEl = $('#banner-mega-count');
    const typesEl = $('#banner-type-counts');
    if (!totalEl || !activeEl || !megaEl || !typesEl) return;

    setBannerSub($('#banner-pokedex-total-sub'), '');
    setBannerSub($('#banner-pokedex-active-sub'), '');
    setBannerSub($('#banner-mega-sub'), '');

    if (!poolData?.pokemon?.length) {
      totalEl.textContent = '—';
      activeEl.textContent = '—';
      megaEl.textContent = '—';
      typesEl.innerHTML = '<span class="phase-banner__types-empty">Pool non chargé</span>';
      return;
    }

    const stats = PokemonSpecies.countActivePoolStats(poolData.pokemon);
    totalEl.textContent = String(stats.total);
    activeEl.textContent = String(stats.actifs);
    megaEl.textContent = String(stats.megaCount);

    if (stats.total > 0) {
      const activePct = Math.round((stats.actifs / stats.total) * 100);
      setBannerSub($('#banner-pokedex-active-sub'), `${activePct} % du Pokédex`);
    }
    if (stats.actifs > 0) {
      const megaPct = Math.round((stats.megaCount / stats.actifs) * 100);
      setBannerSub($('#banner-mega-sub'), `${megaPct} % des actifs`);
    }
    const inactive = stats.total - stats.actifs;
    if (inactive > 0) {
      setBannerSub($('#banner-pokedex-total-sub'), `${inactive} inactif${inactive > 1 ? 's' : ''}`);
    }

    const entries = Object.entries(stats.typeCounts).sort((a, b) => {
      if (b[1] !== a[1]) return b[1] - a[1];
      const labelA = TypeDisplay?.displayLabel?.(a[0]) ?? a[0];
      const labelB = TypeDisplay?.displayLabel?.(b[0]) ?? b[0];
      return labelA.localeCompare(labelB, 'fr');
    });

    if (!entries.length) {
      typesEl.innerHTML = '<span class="phase-banner__types-empty">Aucun Pokémon actif</span>';
      return;
    }

    typesEl.innerHTML = entries
      .map(([type, count]) => {
        const badge = TypeDisplay?.renderBadge?.(type, { variant: 'badge' }) ?? '';
        return `<div class="phase-banner__type-item">${badge}<span class="phase-banner__type-count">${count}</span></div>`;
      })
      .join('');
  }

  function setBannerTurn(turnEl, turnMaxEl, turnWrapEl, turn, maxTurn) {
    if (turnWrapEl) turnWrapEl.hidden = turn == null;
    if (turnEl) turnEl.textContent = turn == null ? '—' : String(turn);
    if (turnMaxEl) {
      turnMaxEl.textContent = turn == null || maxTurn == null ? '' : ` / ${maxTurn}`;
      turnMaxEl.className = 'phase-banner__turn-max';
    }
  }

  function renderBannerSession() {
    const phaseEl = $('#banner-session-phase');
    const turnEl = $('#banner-session-turn');
    const turnMaxEl = $('#banner-session-turn-max');
    const turnWrapEl = $('#banner-session-turn-wrap');
    const activeEl = $('#banner-session-active');
    const timerEl = $('#banner-session-timer');
    const nextEl = $('#banner-session-next');
    if (!phaseEl || !turnEl || !activeEl || !timerEl || !nextEl) return;

    const resetTimerClasses = () => {
      timerEl.classList.remove('phase-banner__timer--warning', 'phase-banner__timer--expired');
    };

    const clearSession = (badgeLabel, badgeModifier) => {
      setPhaseBadge(phaseEl, badgeLabel, badgeModifier);
      setBannerTurn(turnEl, turnMaxEl, turnWrapEl, null, null);
      activeEl.textContent = '—';
      timerEl.textContent = '—';
      resetTimerClasses();
      nextEl.textContent = '—';
    };

    if (state.phase === PHASE.SETUP) {
      clearSession('Tableau de bord', 'setup');
      return;
    }

    if (state.phase === PHASE.COMPLETE) {
      clearSession('Terminé', 'complete');
      return;
    }

    if (!isPlayingPhase()) {
      clearSession('—', null);
      return;
    }

    const active = DraftState.getActivePlayerIndex(state);
    const nextIdx = DraftState.getNextPlayerIndex(state);

    if (state.phase === PHASE.BAN) {
      setPhaseBadge(phaseEl, 'Ban', 'ban');
      setBannerTurn(
        turnEl,
        turnMaxEl,
        turnWrapEl,
        DraftState.getBanRound(state.totalBansDone),
        DraftState.BANS_PER_PLAYER
      );
    } else {
      setPhaseBadge(phaseEl, 'Draft', 'draft');
      setBannerTurn(
        turnEl,
        turnMaxEl,
        turnWrapEl,
        DraftState.getDraftRound(state.totalPicksDone),
        DraftState.PICKS_PER_PLAYER
      );
    }

    activeEl.textContent =
      active >= 0 && state.players[active] ? state.players[active].name : '—';
    nextEl.textContent =
      nextIdx >= 0 && state.players[nextIdx] ? state.players[nextIdx].name : '—';

    const timerDisplay = StreamView?.getTimerDisplay?.() ?? '—';
    timerEl.textContent = timerDisplay;
    resetTimerClasses();
    if (timerDisplay !== '—' && StreamView?.getTimerRemainingSec) {
      const remaining = StreamView.getTimerRemainingSec();
      if (remaining > 0 && remaining <= 10) {
        timerEl.classList.add('phase-banner__timer--warning');
      } else if (remaining <= 0) {
        timerEl.classList.add('phase-banner__timer--expired');
      }
    }
  }

  function updateControls() {
    const setup = state.phase === PHASE.SETUP;
    const complete = state.phase === PHASE.COMPLETE;
    const playing = isPlayingPhase();

    const btnStartStream = $('#btn-start-draft-stream');
    if (btnStartStream) {
      const showStart = setup && isStreamMode();
      btnStartStream.disabled = showStart ? !canStartDraftSilent() : true;
      btnStartStream.classList.toggle('hidden', !showStart);
    }
    $('#draft-main--classic')?.classList.toggle('hidden', isStreamMode());
    $('#complete-panel').classList.toggle('hidden', !complete || isStreamMode());
    renderDashboardRecap();

    if (searchInputEnabled(playing)) {
      $('#pokemon-search').disabled = false;
    } else {
      $('#pokemon-search').disabled = true;
    }

    updateMockDraftButton();
    updateDockActions();
  }

  function canRunMockDraftSilent() {
    if (!poolData?.pokemon?.length) return false;
    return poolData.pokemon.some((p) => p.enabled);
  }

  function updateMockDraftButton() {
    const btn = $('#btn-mock-draft');
    if (!btn) return;
    btn.disabled = !canRunMockDraftSilent();
  }

  function applyMockDraftResult() {
    const result = MockDraft.runInstantMockDraft(state, poolData);
    if (!result.ok) {
      showMessage(result.message, 'error');
      return;
    }
    state = result.state;
    persist();
    renderAll();
    showMessage('Draft simulé — 16 bans et 64 picks enregistrés.', 'success');
  }

  function runMockDraft() {
    if (!canRunMockDraftSilent()) {
      showMessage('Aucun Pokémon activé dans le pool.', 'error');
      return;
    }

    if (state.phase === PHASE.SETUP) {
      applyMockDraftResult();
      return;
    }

    showModal(
      'Simuler un draft complet',
      'Le draft en cours sera remplacé par une simulation automatique. Continuer ?',
      applyMockDraftResult
    );
  }

  function searchInputEnabled(playing) {
    return playing && poolData && isStreamMode();
  }

  function canStartDraftSilent() {
    const v = DraftState.validatePlayerNames(state.players);
    if (!v.ok) return false;
    if (!poolData?.pokemon?.length) return false;
    return poolData.pokemon.some((p) => p.enabled);
  }

  function renderPokedex() {
    const root = $('#pokedex-root');
    PokedexView.render(root, poolData, uiState, {
      canEditActive: canEditActivePool(),
    });
  }

  function isStreamMode() {
    return document.body.classList.contains('stream-mode');
  }

  function placeMessageBar() {
    const bar = $('#message-bar');
    if (!bar) return;
    const streamNotify = document.getElementById('stream-notify-slot');
    const phaseHeader = document.querySelector('.phase-banner__header');
    const target = isStreamMode() ? streamNotify : phaseHeader;
    if (target && bar.parentElement !== target) {
      target.appendChild(bar);
    }
  }

  function getViewModeSwitchEl() {
    if (!viewModeSwitchEl) {
      viewModeSwitchEl = document.querySelector('.view-mode-switch');
    }
    return viewModeSwitchEl;
  }

  function placeViewModeSwitch() {
    const sw = getViewModeSwitchEl();
    if (!sw) return;
    if (isStreamMode()) {
      const anchor = document.getElementById('view-mode-switch-anchor');
      if (anchor && sw.parentElement !== anchor) {
        anchor.appendChild(sw);
      }
      return;
    }
    const fixedAnchor = document.getElementById('view-mode-switch-anchor-fixed');
    if (fixedAnchor && sw.parentElement !== fixedAnchor) {
      fixedAnchor.appendChild(sw);
    }
  }

  function setViewMode(mode) {
    const stream = mode === 'stream';
    document.body.classList.toggle('stream-mode', stream);
    const layout = $('#stream-layout');
    if (layout) layout.setAttribute('aria-hidden', stream ? 'false' : 'true');

    if (stream) {
      switchToTab('draft');
    } else {
      switchToTab(uiState.lastConfigTab || 'draft');
    }

    placeMessageBar();
    placeViewModeSwitch();
    if (stream) showMessage('');

    $$('.view-mode-btn').forEach((btn) => {
      const active = btn.dataset.viewMode === mode;
      btn.classList.toggle('active', active);
      btn.setAttribute('aria-pressed', active ? 'true' : 'false');
    });

    DraftStorage.saveViewMode(mode);
    updateControls();
    renderAll();
  }

  function initViewMode() {
    const saved = DraftStorage.loadViewMode();
    setViewMode(saved);
  }

  function setTheme(theme) {
    const valid = DraftStorage.VALID_THEMES || ['default'];
    const id = valid.includes(theme) ? theme : 'default';
    if (id === 'default') {
      delete document.documentElement.dataset.theme;
    } else {
      document.documentElement.dataset.theme = id;
    }
    document.querySelectorAll('.theme-switch .theme-btn').forEach((btn) => {
      const active = btn.dataset.themeId === id;
      btn.classList.toggle('active', active);
      btn.setAttribute('aria-pressed', active ? 'true' : 'false');
    });
    DraftStorage.saveTheme(id);
  }

  function initTheme() {
    setTheme(DraftStorage.loadTheme());
  }

  function setSpriteMode(mode) {
    const id = SpriteResolver?.setMode?.(mode) ?? DraftStorage.saveSpriteMode(mode);
    document.querySelectorAll('.sprite-mode-btn').forEach((btn) => {
      const active = btn.dataset.spriteMode === id;
      btn.classList.toggle('active', active);
      btn.setAttribute('aria-pressed', active ? 'true' : 'false');
    });
    renderAll();
  }

  function initSpriteMode() {
    const saved = DraftStorage.loadSpriteMode();
    document.querySelectorAll('.sprite-mode-btn').forEach((btn) => {
      const active = btn.dataset.spriteMode === saved;
      btn.classList.toggle('active', active);
      btn.setAttribute('aria-pressed', active ? 'true' : 'false');
    });
    SpriteResolver?.setMode?.(saved);
  }

  function syncTimerConfigFields() {
    const total = StreamView?.getTurnDurationSec?.() ?? DraftStorage.loadTurnTimerDuration();
    const minInput = $('#config-timer-min');
    const secInput = $('#config-timer-sec');
    if (minInput) minInput.value = String(Math.floor(total / 60));
    if (secInput) secInput.value = String(total % 60);
  }

  function parseTimerConfigFields() {
    const min = Number($('#config-timer-min')?.value ?? 0);
    const sec = Number($('#config-timer-sec')?.value ?? 0);
    const minSafe = Number.isFinite(min) ? Math.max(0, Math.min(10, Math.floor(min))) : 0;
    const secSafe = Number.isFinite(sec) ? Math.max(0, Math.min(59, Math.floor(sec))) : 0;
    return minSafe * 60 + secSafe;
  }

  function applyTimerConfigFromFields() {
    let total = parseTimerConfigFields();
    if (total < DraftStorage.TIMER_DURATION_MIN) {
      total = DraftStorage.TIMER_DURATION_MIN;
      showMessage(
        `Durée minimale : ${DraftStorage.TIMER_DURATION_MIN} secondes.`,
        'info'
      );
    }
    const clamped = DraftStorage.clampTurnTimerDuration(total);
    StreamView?.setTurnDurationSec?.(clamped);
    syncTimerConfigFields();
  }

  function initTimerConfig() {
    syncTimerConfigFields();
    const onTimerFieldChange = () => applyTimerConfigFromFields();
    $('#config-timer-min')?.addEventListener('change', onTimerFieldChange);
    $('#config-timer-sec')?.addEventListener('change', onTimerFieldChange);
  }

  function renderDashboardRecap() {
    const el = $('#dashboard-recap');
    if (!el || !window.DraftRecap) return;
    const complete = state.phase === PHASE.COMPLETE;
    const show = complete && !isStreamMode();
    el.classList.toggle('hidden', !show);
    if (!show) {
      lastDashboardRecapKey = '';
      return;
    }
    const recap = window.DraftRecap.computeRecap(state, poolData);
    const recapKey = JSON.stringify(recap);
    if (recapKey !== lastDashboardRecapKey) {
      window.DraftRecap.renderStream(el, recap);
      lastDashboardRecapKey = recapKey;
    }
  }

  function renderAll() {
    if (editingPlayerName === null) {
      renderPlayersGrid();
      renderDashboardBans();
    }
    renderPhaseBanner();
    renderSearch();
    updateSidebarStats();
    updateControls();
    if (isPokedexTabActive()) {
      renderPokedex();
    }
    if (StreamView) StreamView.render(state, poolData);
    renderDashboardRecap();
    placeViewModeSwitch();
    syncActivePoolSettingsFields();
  }

  function selectSpotlightPokemon(id) {
    if (!id || !poolData) return;
    const pokemon = DraftState.findPokemon(poolData, id);
    if (!pokemon) return;
    const nextId = state.selectedPokemonId === id ? null : id;
    state = { ...state, selectedPokemonId: nextId };
    renderSearch();
    renderAll();
  }

  function banSelection() {
    if (!state.selectedPokemonId || !poolData) return;
    const pokemon = DraftState.findPokemon(poolData, state.selectedPokemonId);
    if (!pokemon) return;

    if (!DraftState.canBan(pokemon, state)) {
      const playerIndex = DraftState.getActivePlayerIndex(state);
      const requiredKind = DraftState.getRequiredBanKind(state, playerIndex);
      if (requiredKind === 'pokemon') {
        showMessage('Ce joueur doit bannir un Pokémon (forme de base).', 'error');
      } else if (requiredKind === 'mega') {
        showMessage('Ce joueur doit bannir une Mega.', 'error');
      } else {
        showMessage('Ce Pokémon ne peut pas être banni.', 'error');
      }
      return;
    }

    state = DraftState.applyBan(state, pokemon, poolData);
    clearPokemonSearch();
    persist();
    renderAll();
    if (isStreamMode() && StreamView?.onTurnActionCompleted) {
      StreamView.onTurnActionCompleted();
    }
  }

  function assignSelection() {
    if (!state.selectedPokemonId || !poolData) return;
    const pokemon = DraftState.findPokemon(poolData, state.selectedPokemonId);
    if (!pokemon) return;

    const playerIndex = DraftState.getActivePlayerIndex(state);
    if (!DraftState.canAssignPick(pokemon, state, playerIndex)) {
      showMessage('Draft impossible pour ce joueur ou ce Pokémon.', 'error');
      return;
    }

    state = DraftState.assignPick(state, playerIndex, pokemon, poolData);
    clearPokemonSearch();
    persist();
    renderAll();
    if (isStreamMode() && StreamView?.onTurnActionCompleted) {
      StreamView.onTurnActionCompleted();
    }
  }

  function startDraft() {
    const check = DraftState.canStartDraft(state, poolData);
    if (!check.ok) {
      showMessage(check.message, 'error');
      return;
    }
    state = DraftState.startDraft(state);
    persist();
    renderAll();
  }

  function flushUndoRender() {
    undoRenderRaf = 0;
    renderAll();
    if (isStreamMode() && StreamView?.onTurnActionCompleted) {
      StreamView.onTurnActionCompleted();
    }
  }

  function undo() {
    state = DraftState.undo(state);
    persist();
    if (undoRenderRaf) cancelAnimationFrame(undoRenderRaf);
    undoRenderRaf = requestAnimationFrame(flushUndoRender);
  }

  function getSlotPickerCandidates(playerIndex, slotIndex) {
    if (!poolData) return [];
    const availability = DraftState.getPoolAvailability(state, poolData, {
      excludeSlot: { playerIndex, slotIndex },
    });
    return PokemonSpecies.filterSelectable(poolData.pokemon, availability);
  }

  function updateSlotPickerClearButton() {
    const btn = $('#slot-picker-clear');
    if (!btn || !slotPickerContext) return;
    let canClear = false;
    if (slotPickerContext.type === 'ban') {
      const { playerIndex, banRound } = slotPickerContext;
      canClear = DraftState.canClearBanSlot(state, playerIndex, banRound);
    } else {
      const { playerIndex, slotIndex } = slotPickerContext;
      canClear = DraftState.canClearTeamSlot(state, playerIndex, slotIndex);
    }
    btn.classList.toggle('hidden', !canClear);
  }

  function getBanPickerCandidates(playerIndex, banRound) {
    if (!poolData) return [];
    const availability = DraftState.getBanAvailability(state, poolData, {
      excludeBan: { playerIndex, banRound },
    });
    return PokemonSpecies.filterSelectable(poolData.pokemon, availability).filter((p) =>
      DraftState.canPickForBanSlot(p, state, poolData, playerIndex, banRound)
    );
  }

  function renderSlotPickerResults() {
    const container = $('#slot-picker-results');
    const searchInput = $('#slot-picker-search');
    if (!container || !slotPickerContext) return;

    updateSlotPickerClearButton();

    let candidates = [];
    if (slotPickerContext.type === 'ban') {
      const { playerIndex, banRound } = slotPickerContext;
      candidates = getBanPickerCandidates(playerIndex, banRound);
    } else {
      const { playerIndex, slotIndex } = slotPickerContext;
      candidates = getSlotPickerCandidates(playerIndex, slotIndex);
    }
    const q = searchInput ? searchInput.value : '';
    const list = PokemonSpecies.searchPokemon(candidates, q);

    if (list.length === 0) {
      container.innerHTML = '<p class="slot-picker-empty">Aucun Pokémon disponible.</p>';
      return;
    }

    container.innerHTML = list
      .map(
        (p) => `
        <div class="search-result-item slot-picker-item" data-id="${escapeAttr(p.id)}" role="button" tabindex="0">
          ${SpriteImg.tagForPokemon(p)}
          <div class="search-result-item__info">
            <div class="search-result-item__name">${escapeHtml(p.name)}</div>
            <div class="search-result-item__meta">${escapeHtml(p.pokedexId)} · BST ${PokemonSpecies.getBaseTotal(p)}</div>
          </div>
        </div>`
      )
      .join('');

    container.querySelectorAll('.slot-picker-item').forEach((el) => {
      el.addEventListener('click', () => selectSlotPokemon(el.dataset.id));
    });
  }

  function closeSlotPicker() {
    const overlay = $('#slot-picker-overlay');
    overlay?.classList.add('hidden');
    overlay?.classList.remove('modal-overlay--ban-picker');
    slotPickerContext = null;
    const searchInput = $('#slot-picker-search');
    if (searchInput) searchInput.value = '';
  }

  function selectSlotPokemon(pokemonId) {
    if (!slotPickerContext || !poolData) return;
    const pokemon = DraftState.findPokemon(poolData, pokemonId);
    if (!pokemon) return;

    if (slotPickerContext.type === 'ban') {
      const { playerIndex, banRound } = slotPickerContext;
      if (!DraftState.canPickForBanSlot(pokemon, state, poolData, playerIndex, banRound)) {
        const kind = DraftState.getRequiredBanKindForSlot(state, playerIndex, banRound);
        if (kind === 'mega') {
          showMessage('Ce ban doit être une Mega.', 'error');
        } else if (kind === 'pokemon') {
          showMessage('Ce ban doit être un Pokémon (forme de base).', 'error');
        } else {
          showMessage('Ce Pokémon ne peut pas être banni ici.', 'error');
        }
        return;
      }
      state = DraftState.setBanSlot(state, playerIndex, banRound, pokemon, poolData);
    } else {
      const { playerIndex, slotIndex } = slotPickerContext;
      state = DraftState.setTeamSlot(state, playerIndex, slotIndex, pokemon, poolData);
    }
    closeSlotPicker();
    persist();
    renderAll();
  }

  function clearSlotPokemon() {
    if (!slotPickerContext) return;

    if (slotPickerContext.type === 'ban') {
      const { playerIndex, banRound } = slotPickerContext;
      if (!DraftState.canClearBanSlot(state, playerIndex, banRound)) return;
      state = DraftState.setBanSlot(state, playerIndex, banRound, null, poolData);
    } else {
      const { playerIndex, slotIndex } = slotPickerContext;
      if (!DraftState.canClearTeamSlot(state, playerIndex, slotIndex)) return;
      state = DraftState.setTeamSlot(state, playerIndex, slotIndex, null, poolData);
    }
    closeSlotPicker();
    persist();
    renderAll();
  }

  function openSlotPicker(playerIndex, slotIndex) {
    if (isStreamMode()) return;
    if (!poolData) {
      showMessage('Chargement du Pokédex…', 'error');
      return;
    }
    if (!DraftState.canEditTeamSlot(state, playerIndex, slotIndex)) {
      showMessage('Remplissez les emplacements précédents avant celui-ci.', 'error');
      return;
    }

    const playerName = state.players[playerIndex]?.name || `Joueur ${playerIndex + 1}`;
    slotPickerContext = { type: 'team', playerIndex, slotIndex };
    $('#slot-picker-title').textContent = `Emplacement ${slotIndex + 1} — ${playerName}`;
    const searchInput = $('#slot-picker-search');
    if (searchInput) searchInput.value = '';
    renderSlotPickerResults();
    const overlay = $('#slot-picker-overlay');
    overlay?.classList.remove('modal-overlay--ban-picker');
    overlay?.classList.remove('hidden');
    searchInput?.focus();
  }

  function openBanPicker(playerIndex, banRound) {
    if (isStreamMode()) return;
    if (!poolData) {
      showMessage('Chargement du Pokédex…', 'error');
      return;
    }
    if (!DraftState.canEditBanSlot(state, playerIndex, banRound)) {
      showMessage('Ce ban ne peut pas être modifié pour le moment.', 'error');
      return;
    }

    const playerName = state.players[playerIndex]?.name || `Joueur ${playerIndex + 1}`;
    const kind = DraftState.getRequiredBanKindForSlot(state, playerIndex, banRound);
    const kindHint =
      kind === 'mega' ? ' (Mega requis)' : kind === 'pokemon' ? ' (Pokémon requis)' : '';
    slotPickerContext = { type: 'ban', playerIndex, banRound };
    $('#slot-picker-title').textContent = `Ban tour ${banRound} — ${playerName}${kindHint}`;
    const searchInput = $('#slot-picker-search');
    if (searchInput) searchInput.value = '';
    renderSlotPickerResults();
    const overlay = $('#slot-picker-overlay');
    overlay?.classList.add('modal-overlay--ban-picker');
    overlay?.classList.remove('hidden');
    searchInput?.focus();
  }

  function startNameEdit(playerIndex, buttonEl) {
    if (isStreamMode() || editingPlayerName !== null) return;

    const currentName = state.players[playerIndex]?.name || '';
    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'player-card__name-input';
    input.value = currentName;
    input.placeholder = `Joueur ${playerIndex + 1}`;
    input.setAttribute('aria-label', `Nom du joueur ${playerIndex + 1}`);

    editingPlayerName = playerIndex;
    buttonEl.replaceWith(input);
    input.focus();
    input.select();

    let cancelled = false;

    const finish = (save) => {
      if (editingPlayerName !== playerIndex) return;
      editingPlayerName = null;
      if (save && !cancelled) {
        if (updatePlayerName(playerIndex, input.value)) {
          renderAll();
          return;
        }
      }
      renderPlayersGrid();
    };

    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        input.blur();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        cancelled = true;
        editingPlayerName = null;
        renderPlayersGrid();
      }
    });

    input.addEventListener('blur', () => finish(true));
  }

  function showModal(title, body, onConfirm) {
    $('#modal-title').textContent = title;
    $('#modal-body').textContent = body;
    $('#modal-overlay').classList.remove('hidden');
    const confirm = () => {
      $('#modal-overlay').classList.add('hidden');
      $('#modal-confirm').removeEventListener('click', onOk);
      $('#modal-cancel').removeEventListener('click', onCancel);
      onConfirm();
    };
    const onOk = () => confirm();
    const onCancel = () => {
      $('#modal-overlay').classList.add('hidden');
      $('#modal-confirm').removeEventListener('click', onOk);
      $('#modal-cancel').removeEventListener('click', onCancel);
    };
    $('#modal-confirm').addEventListener('click', onOk);
    $('#modal-cancel').addEventListener('click', onCancel);
  }

  function resetDraft() {
    showModal(
      'Réinitialiser le draft',
      'Effacer bans et picks ? Le Pokédex sera conservé.',
      () => {
        const players = state.players;
        state = DraftState.resetDraft(true);
        state = DraftState.setPlayerNames(state, players);
        persist();
        renderAll();
      }
    );
  }

  function newGame() {
    showModal(
      'Nouveau draft',
      'Le draft en cours sera supprimé (joueurs remis par défaut, bans et picks effacés). Continuer ?',
      () => {
        state = DraftState.resetDraft(false);
        persist();
        renderAll();
      }
    );
  }

  function exportRecapImage() {
    if (recapExportInProgress) return;
    if (state.phase !== PHASE.COMPLETE) {
      showMessage('Le récapitulatif est disponible uniquement en fin de draft.', 'error');
      return;
    }
    if (!window.DraftRecap?.exportRecapImage) {
      showMessage('Export image indisponible.', 'error');
      return;
    }

    const buttons = [$('#btn-export-recap-image'), $('#btn-export-recap-stream')].filter(Boolean);
    const originalLabels = buttons.map((btn) => btn.textContent);

    recapExportInProgress = true;
    buttons.forEach((btn) => {
      btn.disabled = true;
      btn.textContent = 'Export…';
    });

    const recap = window.DraftRecap.computeRecap(state, poolData);
    window.DraftRecap.exportRecapImage(recap, { poolData }).then((result) => {
      if (!result.ok) {
        showMessage(result.error || 'Échec de l\'export image.', 'error');
        return;
      }
      const msg = result.degraded
        ? 'Image exportée (certains sprites n’ont pas pu être inclus).'
        : 'Récapitulatif exporté en image.';
      showMessage(msg, 'success');
    }).finally(() => {
      recapExportInProgress = false;
      buttons.forEach((btn, index) => {
        btn.disabled = false;
        btn.textContent = originalLabels[index];
      });
    });
  }

  function exportDraft() {
    const payload = DraftState.createExportPayload(state, {
      leagueName: poolData?.leagueName,
      poolVersion: poolData?.version,
    });
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'draft-export.json';
    a.click();
    URL.revokeObjectURL(a.href);
    showMessage('Export téléchargé.', 'success');
  }

  function applyImportedDraft(rawState, meta) {
    state = DraftState.importDraftState(rawState, poolData);
    editingPlayerName = null;
    slotPickerContext = null;
    closeSlotPicker();
    persist();
    renderAll();

    const parts = ['Draft importé.'];
    if (meta?.exportedAt) {
      parts.push(`Export du ${new Date(meta.exportedAt).toLocaleString('fr-FR')}.`);
    }
    const poolMismatch =
      meta?.poolVersion != null &&
      poolData?.version != null &&
      meta.poolVersion !== poolData.version;
    if (poolMismatch) {
      parts.push(`Attention : pool export v${meta.poolVersion}, pool actuel v${poolData.version}.`);
    }
    showMessage(parts.join(' '), poolMismatch ? 'info' : 'success');
  }

  function importDraftFromText(text) {
    const parsed = DraftState.parseImportPayload(text);
    if (!parsed.ok) {
      showMessage(parsed.errors.join(' '), 'error');
      return;
    }

    const imported = DraftState.importDraftState(parsed.rawState, poolData);
    const poolCheck = DraftState.validateStateAgainstPool(imported, poolData);
    if (!poolCheck.ok) {
      showMessage(poolCheck.errors.join(' '), 'error');
      return;
    }

    const warnings = [...(parsed.warnings || []), ...(poolCheck.warnings || [])];
    const warningText = warnings.length ? `\n\n${warnings.join('\n')}` : '';
    const exportedAt = parsed.meta?.exportedAt
      ? new Date(parsed.meta.exportedAt).toLocaleString('fr-FR')
      : null;
    const body = exportedAt
      ? `Remplacer le draft en cours par l'export du ${exportedAt} ?${warningText}`
      : `Remplacer le draft en cours par celui du fichier ?${warningText}`;

    showModal('Importer le draft', body, () => {
      applyImportedDraft(parsed.rawState, parsed.meta);
    });
  }

  function importDraftFromFile(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      importDraftFromText(String(reader.result || ''));
    };
    reader.onerror = () => {
      showMessage('Impossible de lire le fichier.', 'error');
    };
    reader.readAsText(file);
  }

  function loadEmbeddedPokedex() {
    const raw = window.POKEDEX_POOL;
    if (!raw) return false;
    const result = PoolImport.validatePoolData(raw);
    if (!result.ok) {
      console.error('Pokédex embarqué invalide :', result.errors);
      return false;
    }
    loadPoolIntoApp(result.pool);
    return true;
  }

  function loadPoolFromUrl(url, successMessage) {
    return fetch(url)
      .then((r) => {
        if (!r.ok) throw new Error('Fichier introuvable');
        return r.text();
      })
      .then((text) => {
        const result = PoolImport.parsePoolJson(text);
        if (!result.ok) {
          showMessage(result.errors.join(' '), 'error');
          return false;
        }
        loadPoolIntoApp(result.pool);
        if (successMessage) {
          showMessage(successMessage, 'success');
        }
        return true;
      })
      .catch(() => false);
  }

  function getPokedexFilteredList() {
    const pool = poolData?.pokemon || [];
    return PokedexView.filterList(pool, uiState.pokedexFilters);
  }

  function getPokedexTotalPages(listLength) {
    return Math.max(1, Math.ceil(listLength / PokedexView.PAGE_SIZE));
  }

  function onPokedexFilterEvent(e, extra) {
    const f = uiState.pokedexFilters;

    if (extra?.toggleId) {
      toggleActivePokemon(extra.toggleId);
      return;
    }
    if (extra?.pageNav) {
      const totalPages = getPokedexTotalPages(getPokedexFilteredList().length);
      let next = f.page || 1;
      const nav = extra.pageNav;
      if (nav === 'first') next = 1;
      else if (nav === 'prev') next = Math.max(1, next - 1);
      else if (nav === 'next') next = Math.min(totalPages, next + 1);
      else if (nav === 'last') next = totalPages;
      else {
        const n = Number.parseInt(nav, 10);
        if (Number.isFinite(n)) next = n;
      }
      f.page = Math.min(totalPages, Math.max(1, next));
      renderPokedex();
      PokedexView.scrollToTop($('#pokedex-root'));
      return;
    }
    if (extra?.sortKey) {
      if (f.sortKey === extra.sortKey) {
        f.sortDir = f.sortDir === 'asc' ? 'desc' : 'asc';
      } else {
        f.sortKey = extra.sortKey;
        f.sortDir = 'asc';
      }
      f.page = 1;
    } else if (e.target.id === 'pokedex-search') {
      f.search = e.target.value;
      f.page = 1;
    } else if (e.target.id === 'pokedex-enabled-filter') {
      f.enabledFilter = e.target.value;
      f.page = 1;
    } else if (extra?.typeFilterClear) {
      f.typeFilters = [];
      f.page = 1;
    } else if (extra?.typeFilterToggle !== undefined) {
      const current = PokedexView.normalizeTypeFilters(f);
      const slug = extra.typeFilterToggle;
      const idx = current.indexOf(slug);
      if (idx >= 0) {
        f.typeFilters = current.filter((t) => t !== slug);
      } else if (current.length < PokedexView.MAX_TYPE_FILTERS) {
        f.typeFilters = [...current, slug];
      } else {
        return;
      }
      f.page = 1;
    } else if (e.target.closest('.pokedex-page-jump')) {
      const totalPages = getPokedexTotalPages(getPokedexFilteredList().length);
      const n = Number.parseInt(e.target.value, 10);
      if (Number.isFinite(n)) {
        f.page = Math.min(totalPages, Math.max(1, n));
      }
      renderPokedex();
      PokedexView.scrollToTop($('#pokedex-root'));
      return;
    }

    renderPokedex();
  }

  function initTabs() {
    $$('.tab-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        if (isStreamMode()) return;
        switchToTab(btn.dataset.tab);
      });
    });
  }

  function initEvents() {
    $('#players-grid')?.addEventListener('click', (e) => {
      if (isStreamMode()) return;

      const nameBtn = e.target.closest('.player-card__name');
      if (nameBtn) {
        startNameEdit(Number(nameBtn.dataset.player), nameBtn);
        return;
      }

      const slot = e.target.closest('.team-slot--clickable');
      if (slot) {
        openSlotPicker(Number(slot.dataset.player), Number(slot.dataset.slot));
      }
    });

    $('#players-grid')?.addEventListener('keydown', (e) => {
      if (isStreamMode()) return;
      if (e.key !== 'Enter' && e.key !== ' ') return;
      const slot = e.target.closest('.team-slot--clickable');
      if (!slot) return;
      e.preventDefault();
      openSlotPicker(Number(slot.dataset.player), Number(slot.dataset.slot));
    });

    $('#dashboard-bans-board')?.addEventListener('click', (e) => {
      if (isStreamMode()) return;
      const slot = e.target.closest('.ban-slot--clickable');
      if (!slot) return;
      openBanPicker(Number(slot.dataset.banPlayer), Number(slot.dataset.banRound));
    });

    $('#dashboard-bans-board')?.addEventListener('keydown', (e) => {
      if (isStreamMode()) return;
      if (e.key !== 'Enter' && e.key !== ' ') return;
      const slot = e.target.closest('.ban-slot--clickable');
      if (!slot) return;
      e.preventDefault();
      openBanPicker(Number(slot.dataset.banPlayer), Number(slot.dataset.banRound));
    });

    initPlayerDragDrop();

    $('#slot-picker-search')?.addEventListener('input', renderSlotPickerResults);
    $('#slot-picker-clear')?.addEventListener('click', clearSlotPokemon);
    $('#slot-picker-cancel')?.addEventListener('click', closeSlotPicker);
    $('#slot-picker-overlay')?.addEventListener('click', (e) => {
      if (e.target.id === 'slot-picker-overlay') closeSlotPicker();
    });

    $('#btn-start-draft-stream')?.addEventListener('click', startDraft);
    $('#btn-ban')?.addEventListener('click', banSelection);
    $('#btn-pick')?.addEventListener('click', assignSelection);
    $('#btn-undo-dock')?.addEventListener('click', undo);
    $('#btn-reset-draft').addEventListener('click', resetDraft);
    $('#btn-mock-draft')?.addEventListener('click', runMockDraft);
    $('#btn-new-game').addEventListener('click', newGame);
    $('#btn-export-recap-image')?.addEventListener('click', exportRecapImage);
    $('#btn-export-recap-stream')?.addEventListener('click', exportRecapImage);
    $('#btn-export').addEventListener('click', exportDraft);
    $('#btn-import').addEventListener('click', () => {
      const input = $('#draft-import-file');
      if (input) {
        input.value = '';
        input.click();
      }
    });
    $('#draft-import-file')?.addEventListener('change', (e) => {
      const file = e.target.files?.[0];
      if (file) importDraftFromFile(file);
    });

    $('#btn-export-active-profile')?.addEventListener('click', exportActiveProfile);
    $('#btn-import-active-profile')?.addEventListener('click', () => {
      const input = $('#active-profile-import-file');
      if (input) {
        input.value = '';
        input.click();
      }
    });
    $('#active-profile-import-file')?.addEventListener('change', (e) => {
      const file = e.target.files?.[0];
      if (file) importActiveProfileFromFile(file);
    });
    $('#btn-reset-active-profile')?.addEventListener('click', resetActiveProfileToBaseline);

    $('#pokemon-search').addEventListener('input', renderSearch);

    const streamLayout = $('#stream-layout');
    streamLayout?.addEventListener('click', (e) => {
      const el = e.target.closest('.stream-spotlight-selectable');
      if (!el?.dataset.pokemonId) return;
      selectSpotlightPokemon(el.dataset.pokemonId);
    });
    streamLayout?.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      const el = e.target.closest('.stream-spotlight-selectable');
      if (!el?.dataset.pokemonId) return;
      e.preventDefault();
      selectSpotlightPokemon(el.dataset.pokemonId);
    });

    $('#btn-mode-config').addEventListener('click', () => setViewMode('config'));
    $('#btn-mode-stream').addEventListener('click', () => setViewMode('stream'));

    document.querySelectorAll('.theme-switch .theme-btn').forEach((btn) => {
      btn.addEventListener('click', () => setTheme(btn.dataset.themeId));
    });

    document.querySelectorAll('.sprite-mode-btn').forEach((btn) => {
      btn.addEventListener('click', () => setSpriteMode(btn.dataset.spriteMode));
    });

    document.addEventListener('keydown', (e) => {
      if (e.ctrlKey && e.key === 'z') {
        e.preventDefault();
        undo();
      }
      if (e.key === 'Enter' && state.selectedPokemonId && isStreamMode()) {
        const pokemon = poolData
          ? DraftState.findPokemon(poolData, state.selectedPokemonId)
          : null;
        if (pokemon) {
          if (state.phase === PHASE.BAN && DraftState.canBan(pokemon, state)) {
            banSelection();
          } else if (state.phase === PHASE.DRAFT) {
            const playerIndex = DraftState.getActivePlayerIndex(state);
            if (DraftState.canAssignPick(pokemon, state, playerIndex)) {
              assignSelection();
            }
          }
        }
      }
      if (e.key === 'Escape') {
        if (!$('#slot-picker-overlay')?.classList.contains('hidden')) {
          closeSlotPicker();
          return;
        }
        state = { ...state, selectedPokemonId: null };
        clearPokemonSearch();
        persist();
        renderSearch();
        renderAll();
      }
    });

    PokedexView.bindFilters($('#pokedex-root'), onPokedexFilterEvent);
  }

  async function init() {
    loadInitial();
    initTabs();
    initEvents();
    initTheme();
    initSpriteMode();
    initTimerConfig();
    initViewMode();
    placeMessageBar();

    await Promise.all([
      SpriteResolver?.loadIndex?.(),
      AbilityDisplay?.loadIndex?.(),
    ]);
    AbilityDisplay?.bindTooltips?.(document);
    renderAll();

    if (isFullPokedex(poolData)) return;

    function onPokedexReady() {
      showMessage(
        `Pokédex chargé : ${poolData.pokemon.length} Pokémon.`,
        'success'
      );
    }

    function onPokedexFailed() {
      showMessage(
        'Impossible de charger le Pokédex. Vérifiez js/pokemon-pokedex-data.js ou dev/data/pokemon-pokedex.json.',
        'error'
      );
      if (!poolData && window.DEFAULT_EXAMPLE_POOL) {
        const result = PoolImport.validatePoolData(window.DEFAULT_EXAMPLE_POOL);
        if (result.ok) {
          loadPoolIntoApp(result.pool);
        }
      }
    }

    if (location.protocol === 'file:') {
      if (loadEmbeddedPokedex()) onPokedexReady();
      else onPokedexFailed();
      return;
    }

    loadPoolFromUrl(POKEDEX_URL).then((loaded) => {
      if (loaded) {
        onPokedexReady();
        return;
      }
      if (loadEmbeddedPokedex()) onPokedexReady();
      else onPokedexFailed();
    });
  }

  init();
})();
