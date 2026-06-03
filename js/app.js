/**
 * Application draft Pokémon — opérateur stream.
 */
(function () {
  const { DraftState } = window;
  const PHASE = DraftState.PHASE;
  const { DraftStorage } = window;
  const { PoolImport } = window;
  const { PokemonSpecies } = window;
  const { PokedexView } = window;
  const { StreamView } = window;

  const POKEDEX_URL = 'data/pokemon-pokedex.json';
  /** Seuil sous lequel le cache localStorage est considéré comme un ancien pool partiel. */
  const FULL_POKEDEX_MIN = 1000;

  let poolData = null;
  let state = DraftState.createInitialState();
  let uiState = {
    pokedexFilters: {
      search: '',
      sortKey: 'name',
      sortDir: 'asc',
      enabledFilter: 'all',
    },
    lastConfigTab: 'draft',
  };
  let editingPlayerName = null;
  let slotPickerContext = null;

  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => document.querySelectorAll(sel);

  function showMessage(text, type) {
    const bar = $('#message-bar');
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
  }

  function loadInitial() {
    const savedPool = DraftStorage.loadPool();
    if (savedPool) {
      const v = PoolImport.validatePoolData(savedPool);
      if (v.ok && isFullPokedex(v.pool)) {
        poolData = v.pool;
      } else {
        DraftStorage.clearPool();
      }
    }
    if (!poolData && window.DEFAULT_EXAMPLE_POOL) {
      const v = PoolImport.validatePoolData(window.DEFAULT_EXAMPLE_POOL);
      if (v.ok) poolData = v.pool;
    }
    const savedDraft = DraftStorage.loadDraft();
    if (savedDraft) state = DraftState.deserialize(savedDraft);
  }

  function getPhaseLabel() {
    switch (state.phase) {
      case PHASE.SETUP:
        return 'Configuration';
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
        return 'Renommez les joueurs en mode Config si besoin, puis démarrez le draft.';
      }
      return 'Renommez les joueurs dans la grille, passez en mode Stream, puis démarrez le draft.';
    }
    if (state.phase === PHASE.BAN) {
      return 'Bans en 2 tours (J1→J8, puis J1→J8) : recherchez, puis Bannir pour le joueur en cours.';
    }
    if (state.phase === PHASE.DRAFT) {
      return 'Snake draft (8 picks/joueur) : recherchez, puis Choisir pour le joueur en cours.';
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

  function renderPlayersGrid() {
    const grid = $('#players-grid');
    const active = DraftState.getActivePlayerIndex(state);

    grid.innerHTML = state.players
      .map((player, i) => {
        const isActive = i === active && isPlayingPhase();
        const team = state.teams[i] || [];

        const slots = Array.from({ length: DraftState.PICKS_PER_PLAYER }, (_, s) => {
          const pick = team[s];
          const slotAttrs = `data-player="${i}" data-slot="${s}" role="button" tabindex="0" title="Choisir un Pokémon"`;
          if (pick) {
            return `<div class="team-slot team-slot--clickable" ${slotAttrs}><img src="${escapeAttr(pick.spriteUrl)}" onerror="this.src='assets/sprites/placeholder.svg'" alt="${escapeAttr(pick.name)}" title="${escapeAttr(pick.name)}"></div>`;
          }
          return `<div class="team-slot empty team-slot--clickable" ${slotAttrs}><img src="assets/pokemon-ball.png" alt=""></div>`;
        }).join('');

        return `
        <article class="player-card ${isActive ? 'active' : ''}" data-player="${i}">
          <button type="button" class="player-card__name" data-player="${i}" title="Renommer">${escapeHtml(player.name)}</button>
          <div class="player-card__team">${slots}</div>
        </article>`;
      })
      .join('');
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
    return PokemonSpecies.filterSelectable(poolData.pokemon, state.usedSpecies);
  }

  function clearPokemonSearch() {
    const searchInput = $('#pokemon-search');
    if (searchInput) searchInput.value = '';
  }


  function updateDockActions() {
    const setup = state.phase === PHASE.SETUP;
    const banPhase = state.phase === PHASE.BAN;
    const draftPhase = state.phase === PHASE.DRAFT;
    const playing = isPlayingPhase();
    const stream = isStreamMode();
    const activePlayer = DraftState.getActivePlayerIndex(state);
    const hasSelection = !!state.selectedPokemonId;
    const pokemon = hasSelection && poolData
      ? DraftState.findPokemon(poolData, state.selectedPokemonId)
      : null;

    const btnStartStream = $('#btn-start-draft-stream');
    const btnBan = $('#btn-ban');
    const btnPick = $('#btn-pick');
    const btnUndoDock = $('#btn-undo-dock');

    const showStreamDock = stream && (setup || playing);

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
      const hasHistory = (state.actionHistory || []).length > 0;
      btnUndoDock.disabled = !playing || !hasHistory;
      btnUndoDock.classList.toggle('hidden', !playing || setup);
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

    if (
      state.selectedPokemonId &&
      !candidates.some((p) => p.id === state.selectedPokemonId)
    ) {
      state = { ...state, selectedPokemonId: null };
    }

    let list = PokemonSpecies.searchPokemon(candidates, q);

    const container = $('#search-results');
    if (!poolData) {
      container.innerHTML = '<p>Chargement du Pokédex…</p>';
      updateDockActions();
      return;
    }

    if (state.phase === PHASE.SETUP || state.phase === PHASE.COMPLETE) {
      container.innerHTML = '<p>Draft non démarré ou terminé.</p>';
      updateDockActions();
      return;
    }

    if (list.length === 0) {
      container.innerHTML = '<p>Aucun Pokémon disponible.</p>';
      updateDockActions();
      return;
    }

    container.innerHTML = list
      .map((p) => {
        const sel = state.selectedPokemonId === p.id;
        return `
        <div class="search-result-item ${sel ? 'selected' : ''}" data-id="${escapeAttr(p.id)}" role="button" tabindex="0">
          <img src="${escapeAttr(p.spriteUrl)}" onerror="this.src='assets/sprites/placeholder.svg'" alt="">
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
    if (bansMax) bansMax.textContent = String(DraftState.TOTAL_BANS);
    if (picksMax) picksMax.textContent = String(DraftState.TOTAL_PICKS);
    const statBans = $('#stat-bans');
    if (statBans) statBans.textContent = String(state.totalBansDone ?? 0);

    if (!poolData) {
      $('#stat-available').textContent = '—';
      return;
    }
    const counts = PokemonSpecies.countPoolStats(poolData.pokemon, state);
    $('#stat-available').textContent = String(counts.disponibles);
    $('#stat-picks').textContent = String(state.totalPicksDone);
  }

  function renderPhaseBanner() {
    $('#phase-label').textContent = getPhaseLabel();
    const active = DraftState.getActivePlayerIndex(state);
    if (active >= 0 && state.players[active] && isPlayingPhase()) {
      const verb = state.phase === PHASE.BAN ? 'bannez pour' : 'draftez pour';
      $('#active-player-label').textContent = `En cours : ${state.players[active].name} — ${verb}`;
    } else if (state.phase === PHASE.COMPLETE) {
      $('#active-player-label').textContent = 'Draft terminé';
    } else {
      $('#active-player-label').textContent = '—';
    }
    $('#phase-hint').textContent = getPhaseHint();
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
    $('#draft-workspace')?.classList.toggle('hidden', setup || complete);
    $('#draft-main--classic')?.classList.toggle('hidden', isStreamMode());
    $('#complete-panel').classList.toggle('hidden', !complete);

    if (searchInputEnabled(playing)) {
      $('#pokemon-search').disabled = false;
    } else {
      $('#pokemon-search').disabled = true;
    }

    updateDockActions();
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
    PokedexView.render(root, poolData, uiState);
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

  function renderAll() {
    if (editingPlayerName === null) {
      renderPlayersGrid();
    }
    renderPhaseBanner();
    renderSearch();
    updateSidebarStats();
    updateControls();
    renderPokedex();
    if (StreamView) StreamView.render(state, poolData);
  }

  function banSelection() {
    if (!state.selectedPokemonId || !poolData) return;
    const pokemon = DraftState.findPokemon(poolData, state.selectedPokemonId);
    if (!pokemon) return;

    if (!DraftState.canBan(pokemon, state)) {
      showMessage('Ce Pokémon ne peut pas être banni.', 'error');
      return;
    }

    const playerIndex = DraftState.getActivePlayerIndex(state);
    const playerName = state.players[playerIndex]?.name || `Joueur ${playerIndex + 1}`;
    state = DraftState.applyBan(state, pokemon);
    clearPokemonSearch();
    const msg =
      state.phase === PHASE.DRAFT
        ? `Ban enregistré : ${pokemon.name} (${playerName}). Phase draft.`
        : `Ban enregistré : ${pokemon.name} (${playerName})`;
    showMessage(msg, 'success');
    persist();
    renderAll();
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

    const playerName = state.players[playerIndex]?.name || `Joueur ${playerIndex + 1}`;
    state = DraftState.assignPick(state, playerIndex, pokemon);
    clearPokemonSearch();
    showMessage(`Pick enregistré : ${pokemon.name} → ${playerName}`, 'success');
    persist();
    renderAll();
  }

  function startDraft() {
    const check = DraftState.canStartDraft(state, poolData);
    if (!check.ok) {
      showMessage(check.message, 'error');
      return;
    }
    state = DraftState.startDraft(state);
    persist();
    showMessage('Phase bans démarrée. Recherchez un Pokémon, puis Bannir.', 'success');
    renderAll();
  }

  function undo() {
    state = DraftState.undo(state);
    persist();
    showMessage('Dernière action annulée.', 'info');
    renderAll();
  }

  function getSlotPickerCandidates(playerIndex, slotIndex) {
    if (!poolData) return [];
    const team = state.teams[playerIndex] || [];
    const current = team[slotIndex];
    let usedExcluding = state.usedSpecies;
    if (current?.speciesKey) {
      usedExcluding = state.usedSpecies.filter((k) => k !== current.speciesKey);
    }
    return PokemonSpecies.filterSelectable(poolData.pokemon, usedExcluding);
  }

  function updateSlotPickerClearButton() {
    const btn = $('#slot-picker-clear');
    if (!btn || !slotPickerContext) return;
    const { playerIndex, slotIndex } = slotPickerContext;
    const canClear = DraftState.canClearTeamSlot(state, playerIndex, slotIndex);
    btn.classList.toggle('hidden', !canClear);
  }

  function renderSlotPickerResults() {
    const container = $('#slot-picker-results');
    const searchInput = $('#slot-picker-search');
    if (!container || !slotPickerContext) return;

    updateSlotPickerClearButton();

    const { playerIndex, slotIndex } = slotPickerContext;
    const candidates = getSlotPickerCandidates(playerIndex, slotIndex);
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
          <img src="${escapeAttr(p.spriteUrl)}" onerror="this.src='assets/sprites/placeholder.svg'" alt="">
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
    $('#slot-picker-overlay')?.classList.add('hidden');
    slotPickerContext = null;
    const searchInput = $('#slot-picker-search');
    if (searchInput) searchInput.value = '';
  }

  function selectSlotPokemon(pokemonId) {
    if (!slotPickerContext || !poolData) return;
    const pokemon = DraftState.findPokemon(poolData, pokemonId);
    if (!pokemon) return;

    const { playerIndex, slotIndex } = slotPickerContext;
    state = DraftState.setTeamSlot(state, playerIndex, slotIndex, pokemon);
    closeSlotPicker();
    persist();
    showMessage(`${pokemon.name} assigné à ${state.players[playerIndex]?.name || `Joueur ${playerIndex + 1}`}.`, 'success');
    renderAll();
  }

  function clearSlotPokemon() {
    if (!slotPickerContext) return;

    const { playerIndex, slotIndex } = slotPickerContext;
    if (!DraftState.canClearTeamSlot(state, playerIndex, slotIndex)) return;

    const playerName = state.players[playerIndex]?.name || `Joueur ${playerIndex + 1}`;
    const removedName = state.teams[playerIndex]?.[slotIndex]?.name || 'Pokémon';
    state = DraftState.setTeamSlot(state, playerIndex, slotIndex, null);
    closeSlotPicker();
    persist();
    showMessage(`${removedName} retiré de ${playerName}.`, 'success');
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
    slotPickerContext = { playerIndex, slotIndex };
    $('#slot-picker-title').textContent = `Emplacement ${slotIndex + 1} — ${playerName}`;
    const searchInput = $('#slot-picker-search');
    if (searchInput) searchInput.value = '';
    renderSlotPickerResults();
    $('#slot-picker-overlay')?.classList.remove('hidden');
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
        showMessage('Draft réinitialisé.', 'success');
        renderAll();
      }
    );
  }

  function newGame() {
    showModal(
      'Nouvelle partie',
      'Réinitialiser joueurs, bans et picks ?',
      () => {
        state = DraftState.resetDraft(false);
        persist();
        renderAll();
      }
    );
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
    setPool(result.pool);
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
        setPool(result.pool);
        if (successMessage) {
          showMessage(successMessage, 'success');
        }
        return true;
      })
      .catch(() => false);
  }

  function onPokedexFilterEvent(e, extra) {
    const f = uiState.pokedexFilters;

    if (extra?.sortKey) {
      if (f.sortKey === extra.sortKey) {
        f.sortDir = f.sortDir === 'asc' ? 'desc' : 'asc';
      } else {
        f.sortKey = extra.sortKey;
        f.sortDir = 'asc';
      }
    } else if (e.target.id === 'pokedex-search') {
      f.search = e.target.value;
    } else if (e.target.id === 'pokedex-enabled-filter') {
      f.enabledFilter = e.target.value;
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

    $('#slot-picker-search')?.addEventListener('input', renderSlotPickerResults);
    $('#slot-picker-clear')?.addEventListener('click', clearSlotPokemon);
    $('#slot-picker-cancel')?.addEventListener('click', closeSlotPicker);
    $('#slot-picker-overlay')?.addEventListener('click', (e) => {
      if (e.target.id === 'slot-picker-overlay') closeSlotPicker();
    });

    $('#btn-start-draft-stream')?.addEventListener('click', startDraft);
    $('#btn-ban')?.addEventListener('click', banSelection);
    $('#btn-pick')?.addEventListener('click', assignSelection);
    $('#btn-undo').addEventListener('click', undo);
    $('#btn-undo-dock')?.addEventListener('click', undo);
    $('#btn-reset-draft').addEventListener('click', resetDraft);
    $('#btn-new-game').addEventListener('click', newGame);
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

    $('#pokemon-search').addEventListener('input', renderSearch);

    $('#btn-mode-config').addEventListener('click', () => setViewMode('config'));
    $('#btn-mode-stream').addEventListener('click', () => setViewMode('stream'));

    document.addEventListener('keydown', (e) => {
      if (e.ctrlKey && e.key === 'z') {
        e.preventDefault();
        undo();
      }
      if (e.key === 'Enter' && state.selectedPokemonId && isStreamMode()) {
        if (state.phase === PHASE.BAN) banSelection();
        else if (state.phase === PHASE.DRAFT) assignSelection();
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

  function init() {
    loadInitial();
    initTabs();
    initEvents();
    initViewMode();
    placeMessageBar();
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
        'Impossible de charger le Pokédex. Vérifiez js/pokemon-pokedex-data.js ou data/pokemon-pokedex.json.',
        'error'
      );
      if (!poolData && window.DEFAULT_EXAMPLE_POOL) {
        const result = PoolImport.validatePoolData(window.DEFAULT_EXAMPLE_POOL);
        if (result.ok) {
          poolData = result.pool;
          renderAll();
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
