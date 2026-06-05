/**

 * Rendu layout stream (4+4 joueurs, centre, bans manuels).

 */

(function (global) {
  const SpriteImg = global.SpriteImg;
  if (!SpriteImg) {
    throw new Error('SpriteImg manquant : vérifiez que js/species.js est chargé avant stream-view.js.');
  }
  const PLACEHOLDER = SpriteImg.PLACEHOLDER;
  const POKEBALL = 'assets/pokemon-ball.png';

  const { DraftStorage } = global;
  let turnDurationSec = DraftStorage?.loadTurnTimerDuration?.() ?? 60;

  const STAT_MAX = 255;

  const STAT_ROWS = [

    { key: 'hp', label: 'HP', bar: 'hp' },

    { key: 'attack', label: 'Attack', bar: 'atk' },

    { key: 'defense', label: 'Defense', bar: 'def' },

    { key: 'spAtk', label: 'Sp. Atk', bar: 'spa' },

    { key: 'spDef', label: 'Sp. Def', bar: 'spd' },

    { key: 'speed', label: 'Speed', bar: 'spe' },

  ];



  function escapeHtml(s) {

    const d = document.createElement('div');

    d.textContent = s;

    return d.innerHTML;

  }



  function escapeAttr(s) {

    return String(s)

      .replace(/&/g, '&amp;')

      .replace(/"/g, '&quot;');

  }



  function renderTypeOrb(type) {
    if (!type || !global.TypeDisplay) return '';
    return global.TypeDisplay.renderBadge(type, { variant: 'orb' });
  }



  function getSpotlightPokemon(state, poolData) {
    if (!poolData || !state.selectedPokemonId) return null;
    return global.DraftState.findPokemon(poolData, state.selectedPokemonId);
  }



  function getNextPlayerIndex(state) {
    return global.DraftState.getNextPlayerIndex(state);
  }

  function renderPlayerPanel(player, index, team, isActive, side, poolData, selectedPokemonId) {
    const { DraftState } = global;
    const pickCount = DraftState.PICKS_PER_PLAYER;
    const slots = Array.from({ length: pickCount }, (_, s) => {
      const pick = team[s];
      if (pick) {
        const isSelected = selectedPokemonId === pick.id;
        return `<div class="stream-slot stream-slot--filled stream-spotlight-selectable${isSelected ? ' stream-spotlight-selectable--selected' : ''}" data-pokemon-id="${escapeAttr(pick.id)}" role="button" tabindex="0" title="${escapeAttr(pick.name)}" aria-label="${escapeAttr(pick.name)}" aria-pressed="${isSelected ? 'true' : 'false'}">${SpriteImg.renderSlotContent(pick.spriteUrl, {
          className: 'stream-slot__sprite',
          alt: pick.name,
          id: pick.id,
          poolData,
          wrapClass: 'sprite-slot-wrap sprite-slot-wrap--stream',
          megaLabelClass: 'sprite-mega-label sprite-mega-label--stream',
        })}</div>`;
      }
      return `<div class="stream-slot stream-slot--empty"><img class="stream-slot__ball" src="${POKEBALL}" alt=""></div>`;
    }).join('');

    const camBlock =
      index === 7
        ? '<div class="stream-player__cam view-mode-switch-anchor" id="view-mode-switch-anchor"><span class="stream-player__cam-label" aria-hidden="true">Caméra</span></div>'
        : '<div class="stream-player__cam">Caméra</div>';
    const slotsBlock = `<div class="stream-player__slots">${slots}</div>`;
    const bodyContent =
      side === 'left' ? camBlock + slotsBlock : slotsBlock + camBlock;

    const sideClass = side === 'right' ? 'stream-player--right' : 'stream-player--left';

    return `
      <article class="stream-player ${sideClass} ${isActive ? 'active' : ''}" data-player="${index}">
        <h3 class="stream-player__name">${escapeHtml(player.name)}</h3>
        <div class="stream-player__body">${bodyContent}</div>
      </article>`;
  }



  function renderStatsBars(pokemon) {

    if (!pokemon) return '';

    const bst = global.PokemonSpecies.getBaseTotal(pokemon);

    const rows = STAT_ROWS.map(({ key, label, bar }) => {

      const val = Number(pokemon[key]) || 0;

      const pct = Math.min(100, (val / STAT_MAX) * 100);

      return `

        <div class="stream-stat-row stream-stat-row--${bar}">

          <span class="stream-stat-label">${label}</span>

          <span class="stream-stat-value">${val}</span>

          <div class="stream-stat-bar"><div class="stream-stat-bar__fill stream-stat-bar__fill--${bar}" style="width:${pct}%"></div></div>

        </div>`;

    }).join('');



    const totalPct = Math.min(100, (bst / 700) * 100);

    return (

      rows +

      `

      <div class="stream-stat-row stream-stat-row--total">

        <span class="stream-stat-label">Total</span>

        <span class="stream-stat-value">${bst}</span>

        <div class="stream-stat-bar"><div class="stream-stat-bar__fill stream-stat-bar__fill--total" style="width:${totalPct}%"></div></div>

      </div>`

    );

  }



  function renderAbilitiesBlock(pokemon) {
    if (!pokemon) return '';
    const listHtml = global.PokemonSpecies.renderAbilitiesList(pokemon, {
      listClass: 'stream-ability-list',
      itemClass: 'stream-ability-list__item',
      distinguishHidden: false,
    });
    if (!listHtml) return '';
    return `
      <div class="stream-abilities">
        <h3 class="stream-abilities__title">Abilities</h3>
        ${listHtml}
      </div>`;
  }



  function renderSpotlight(pokemon) {
    const frameEl = document.getElementById('stream-spotlight-frame');
    const detailsEl = document.getElementById('stream-spotlight-details');
    if (!frameEl || !detailsEl) return;

    if (!pokemon) {
      frameEl.className = 'stream-spotlight__frame stream-spotlight--empty';
      frameEl.innerHTML =
        '<span class="stream-spotlight__placeholder">Sélection en cours…</span>';
      detailsEl.className = 'stream-spotlight-details stream-spotlight--empty';
      detailsEl.innerHTML = '';
      return;
    }

    frameEl.className = 'stream-spotlight__frame';
    frameEl.innerHTML = SpriteImg.tag(pokemon.spriteUrl, {
      className: 'stream-spotlight__sprite',
      alt: pokemon.name,
    });

    const t2 = pokemon.type2 ? renderTypeOrb(pokemon.type2) : '';
    detailsEl.className = 'stream-spotlight-details';
    detailsEl.innerHTML = `
      <h2 class="stream-spotlight__name">${escapeHtml(pokemon.name)}</h2>
      <div class="stream-spotlight__dex">${escapeHtml(pokemon.pokedexId)}</div>
      <div class="stream-spotlight__types">
        ${renderTypeOrb(pokemon.type1)}
        ${t2}
      </div>
      <div class="stream-stats">${renderStatsBars(pokemon)}</div>
      ${renderAbilitiesBlock(pokemon)}`;
  }



  function buildBanMatrix(bans) {
    const { DraftState } = global;
    const playerCount = DraftState.PLAYER_COUNT;
    const round1 = Array.from({ length: playerCount }, () => null);
    const round2 = Array.from({ length: playerCount }, () => null);

    bans.forEach((ban, index) => {
      const playerIndex =
        typeof ban.playerIndex === 'number' && ban.playerIndex >= 0 && ban.playerIndex < playerCount
          ? ban.playerIndex
          : DraftState.getBanPlayerIndex(index);
      const round = DraftState.getBanRound(index);
      if (round === 1) round1[playerIndex] = ban;
      else if (round === 2) round2[playerIndex] = ban;
    });

    return { round1, round2 };
  }

  function renderBannedCell(ban, poolData, selectedPokemonId) {
    if (!ban) {
      return `
      <div class="stream-banned__cell stream-banned__cell--empty">
        <div class="stream-banned__item stream-banned__item--empty" aria-hidden="true"></div>
      </div>`;
    }

    const pokemon = ban.pokemon;
    const isSelected = selectedPokemonId === ban.pokemonId;
    const isMega = SpriteImg.isMegaPokemon(
      { id: pokemon.id, pokemonId: ban.pokemonId, spriteUrl: pokemon.spriteUrl },
      poolData
    );
    const megaLabel = isMega
      ? '<span class="sprite-mega-label sprite-mega-label--banned">MEGA</span>'
      : '';

    return `
      <div class="stream-banned__cell">
        <div class="stream-banned__item stream-spotlight-selectable${isSelected ? ' stream-spotlight-selectable--selected' : ''}" data-pokemon-id="${escapeAttr(ban.pokemonId)}" role="button" tabindex="0" title="${escapeAttr(pokemon.name)}" aria-label="${escapeAttr(pokemon.name)}" aria-pressed="${isSelected ? 'true' : 'false'}">
          ${SpriteImg.tag(pokemon.spriteUrl)}
        </div>
        ${megaLabel}
      </div>`;
  }

  function renderBannedRow(bansByPlayer, poolData, selectedPokemonId) {
    const { DraftState } = global;
    return Array.from({ length: DraftState.PLAYER_COUNT }, (_, playerIndex) =>
      renderBannedCell(bansByPlayer[playerIndex], poolData, selectedPokemonId)
    ).join('');
  }

  function updateSpotlightSelectionHighlights(selectedPokemonId) {
    document.querySelectorAll('.stream-spotlight-selectable').forEach((el) => {
      const isSelected = !!selectedPokemonId && el.dataset.pokemonId === selectedPokemonId;
      el.classList.toggle('stream-spotlight-selectable--selected', isSelected);
      el.setAttribute('aria-pressed', isSelected ? 'true' : 'false');
    });
  }

  function renderBanned(state, poolData) {
    const list = document.getElementById('stream-banned-list');
    if (!list) return;

    const bans = state.bans || [];
    const players = state.players || [];

    if (bans.length === 0) {
      list.innerHTML = '<span class="stream-banned__empty">—</span>';
      return;
    }

    const { round1, round2 } = buildBanMatrix(bans);
    const playerCount = global.DraftState.PLAYER_COUNT;
    const headers = Array.from({ length: playerCount }, (_, index) => {
      const name = players[index]?.name || `J${index + 1}`;
      return `<div class="stream-banned__col-head" title="${escapeAttr(name)}">${escapeHtml(name)}</div>`;
    }).join('');

    const selectedPokemonId = state.selectedPokemonId || null;
    list.innerHTML = `
      <div class="stream-banned__headers">${headers}</div>
      <div class="stream-banned__row">${renderBannedRow(round1, poolData, selectedPokemonId)}</div>
      <div class="stream-banned__separator" role="separator" aria-hidden="true"></div>
      <div class="stream-banned__row">${renderBannedRow(round2, poolData, selectedPokemonId)}</div>`;
  }



  function renderTopBar(state) {

    const nowEl = document.getElementById('stream-now');

    const nextEl = document.getElementById('stream-next-name');

    const active = global.DraftState.getActivePlayerIndex(state);

    const PHASE = global.DraftState.PHASE;



    if (nowEl) {
      if (active >= 0 && state.phase === PHASE.BAN) {
        const n = state.totalBansDone + 1;
        const tour = DraftState.getBanRound(state.totalBansDone);
        nowEl.textContent = `Phase de ban - ${state.players[active].name} · Tour ${tour} · ${n}/${DraftState.TOTAL_BANS}`;
      } else if (active >= 0 && state.phase === PHASE.DRAFT) {
        const n = state.totalPicksDone + 1;
        nowEl.textContent = `Phase de choix - ${state.players[active].name} · ${n}/${DraftState.TOTAL_PICKS}`;
      } else if (state.phase === PHASE.COMPLETE) {
        const durationMs = global.DraftRecap?.computeDurationMs?.(state);
        const durationLabel = global.DraftRecap?.formatDuration?.(durationMs);
        nowEl.textContent =
          durationLabel && durationLabel !== '—'
            ? `Draft terminé · ${durationLabel}`
            : 'Draft terminé';
      } else {
        nowEl.textContent = '—';
      }
    }



    if (nextEl) {

      const nextIdx = getNextPlayerIndex(state);

      if (nextIdx >= 0 && state.players[nextIdx]) {

        nextEl.textContent = state.players[nextIdx].name;

      } else {

        nextEl.textContent = '—';

      }

    }

  }

  let timerInterval = null;
  let timerRemainingSec = turnDurationSec;
  let lastTurnKey = null;

  function getTurnKey(state) {
    const PHASE = global.DraftState.PHASE;
    if (state.phase === PHASE.BAN) return `ban-${state.totalBansDone}`;
    if (state.phase === PHASE.DRAFT) return `draft-${state.totalPicksDone}`;
    return null;
  }

  function isStreamMode() {
    return (
      typeof document !== 'undefined' &&
      document.body.classList.contains('stream-mode')
    );
  }

  function formatTimer(seconds) {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${String(s).padStart(2, '0')}`;
  }

  function stopTurnTimerInterval() {
    if (timerInterval) {
      clearInterval(timerInterval);
      timerInterval = null;
    }
  }

  function applyTimerVisual(el, remaining) {
    el.textContent = formatTimer(remaining);
    el.classList.toggle('stream-timer--warning', remaining > 0 && remaining <= 10);
    el.classList.toggle('stream-timer--expired', remaining <= 0);
  }

  function applyBannerTimerVisual(el, remaining) {
    el.textContent = formatTimer(remaining);
    el.classList.toggle('phase-banner__timer--warning', remaining > 0 && remaining <= 10);
    el.classList.toggle('phase-banner__timer--expired', remaining <= 0);
  }

  function refreshTimerDisplays() {
    const streamEl = document.getElementById('stream-timer');
    const bannerEl = document.getElementById('banner-session-timer');
    const showValues = !!lastTurnKey;

    if (streamEl) {
      if (showValues && isStreamMode()) {
        streamEl.classList.remove('hidden');
        streamEl.setAttribute('aria-hidden', 'false');
        applyTimerVisual(streamEl, timerRemainingSec);
      } else {
        streamEl.classList.add('hidden');
        streamEl.setAttribute('aria-hidden', 'true');
      }
    }

    if (bannerEl && !isStreamMode()) {
      if (showValues) {
        applyBannerTimerVisual(bannerEl, timerRemainingSec);
      } else {
        bannerEl.textContent = '—';
        bannerEl.classList.remove('phase-banner__timer--warning', 'phase-banner__timer--expired');
      }
    }
  }

  function tickTurnTimer() {
    if (!isStreamMode()) return;
    if (timerRemainingSec > 0) timerRemainingSec -= 1;
    refreshTimerDisplays();
  }

  function startTurnTimerInterval() {
    if (timerInterval || !isStreamMode() || !lastTurnKey) return;
    timerInterval = setInterval(tickTurnTimer, 1000);
  }

  function syncTurnTimerInterval() {
    if (isStreamMode() && lastTurnKey) {
      startTurnTimerInterval();
    } else {
      stopTurnTimerInterval();
    }
  }

  function resetTurnTimerForNewTurn() {
    stopTurnTimerInterval();
    timerRemainingSec = turnDurationSec;
    refreshTimerDisplays();
    syncTurnTimerInterval();
  }

  function renderTurnTimer(state) {
    const turnKey = getTurnKey(state);

    if (!turnKey) {
      stopTurnTimerInterval();
      lastTurnKey = null;
      refreshTimerDisplays();
      return;
    }

    if (turnKey !== lastTurnKey) {
      lastTurnKey = turnKey;
      resetTurnTimerForNewTurn();
      return;
    }

    refreshTimerDisplays();
    syncTurnTimerInterval();
  }

  function onTurnActionCompleted() {
    resetTurnTimerForNewTurn();
  }

  let lastRenderSnapshot = {
    teamsKey: '',
    active: -2,
    spotlightId: null,
    selectedId: null,
    bansKey: '',
    recapKey: '',
  };

  function getTeamsKey(state) {
    const names = (state.players || []).map((p) => p.name).join('\0');
    return `${names}|${JSON.stringify(state.teams)}`;
  }

  function getBansKey(state) {
    return (state.bans || []).map((b) => b.pokemonId).join(',');
  }

  function updateActivePlayerPanels(active) {
    document.querySelectorAll('.stream-player').forEach((el) => {
      el.classList.toggle('active', Number(el.dataset.player) === active);
    });
  }

  function renderPlayerSide(container, state, indices, active, side, poolData) {
    const selectedPokemonId = state.selectedPokemonId || null;
    container.innerHTML = indices
      .map((i) =>
        renderPlayerPanel(
          state.players[i],
          i,
          state.teams[i] || [],
          i === active,
          side,
          poolData,
          selectedPokemonId
        )
      )
      .join('');
  }

  function getTurnDurationSec() {
    return turnDurationSec;
  }

  function setTurnDurationSec(sec) {
    const clamped = DraftStorage?.clampTurnTimerDuration
      ? DraftStorage.clampTurnTimerDuration(sec)
      : turnDurationSec;
    turnDurationSec = clamped;
    DraftStorage?.saveTurnTimerDuration?.(clamped);
  }

  function renderRecapMode(state, poolData) {
    const PHASE = global.DraftState.PHASE;
    const isComplete = state.phase === PHASE.COMPLETE;
    const middle = document.querySelector('.stream-center__middle');
    const streamCenter = document.querySelector('.stream-center');
    const recapEl = document.getElementById('stream-recap');

    if (middle) {
      middle.classList.toggle('hidden', isComplete);
    }
    if (streamCenter) {
      streamCenter.classList.toggle('stream-center--recap', isComplete);
    }

    const draftUiIds = ['stream-spotlight-frame'];
    for (const id of draftUiIds) {
      document.getElementById(id)?.classList.toggle('hidden', isComplete);
    }

    for (const sel of ['.stream-search-panel', '.stream-stats-wrap', '.stream-actions-row']) {
      middle?.querySelector(sel)?.classList.toggle('hidden', isComplete);
    }

    if (!recapEl) return;

    recapEl.classList.toggle('hidden', !isComplete);

    if (!isComplete) {
      lastRenderSnapshot.recapKey = '';
      return;
    }

    if (!global.DraftRecap) return;

    const recap = global.DraftRecap.computeRecap(state, poolData);
    const recapKey = JSON.stringify(recap);
    if (recapKey !== lastRenderSnapshot.recapKey) {
      global.DraftRecap.renderStream(recapEl, recap);
      lastRenderSnapshot.recapKey = recapKey;
    }
  }

  function render(state, poolData) {
    const active = global.DraftState.getActivePlayerIndex(state);
    const teamsKey = getTeamsKey(state);
    const bansKey = getBansKey(state);
    const spotlightPokemon = getSpotlightPokemon(state, poolData);
    const spotlightId = spotlightPokemon?.id ?? null;

    const left = document.getElementById('stream-left');
    const right = document.getElementById('stream-right');

    if (teamsKey !== lastRenderSnapshot.teamsKey) {
      if (left) renderPlayerSide(left, state, [0, 1, 2, 3], active, 'left', poolData);
      if (right) renderPlayerSide(right, state, [4, 5, 6, 7], active, 'right', poolData);
      lastRenderSnapshot.teamsKey = teamsKey;
      lastRenderSnapshot.active = active;
    } else if (active !== lastRenderSnapshot.active) {
      updateActivePlayerPanels(active);
      lastRenderSnapshot.active = active;
    }

    if (spotlightId !== lastRenderSnapshot.spotlightId) {
      renderSpotlight(spotlightPokemon);
      lastRenderSnapshot.spotlightId = spotlightId;
    }

    const selectedId = state.selectedPokemonId || null;
    if (selectedId !== lastRenderSnapshot.selectedId) {
      updateSpotlightSelectionHighlights(selectedId);
      lastRenderSnapshot.selectedId = selectedId;
    }

    if (bansKey !== lastRenderSnapshot.bansKey) {
      renderBanned(state, poolData);
      lastRenderSnapshot.bansKey = bansKey;
    }

    renderTopBar(state);
    renderTurnTimer(state);
    renderRecapMode(state, poolData);
  }



  function getTimerRemainingSec() {
    return timerRemainingSec;
  }

  function getTimerDisplay() {
    if (!lastTurnKey) return '—';
    return formatTimer(timerRemainingSec);
  }

  global.StreamView = {

    render,

    onTurnActionCompleted,

    getTimerDisplay,

    getTimerRemainingSec,

    getTurnDurationSec,

    setTurnDurationSec,

  };

})(typeof window !== 'undefined' ? window : globalThis);

