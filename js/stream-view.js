/**

 * Rendu layout stream (4+4 joueurs, centre, bans manuels).

 */

(function (global) {

  const PLACEHOLDER = 'assets/sprites/placeholder.svg';
  const POKEBALL = 'assets/pokemon-ball.png';

  /** Durée du timer par tour en secondes (modifier ici si besoin). */
  const STREAM_TURN_DURATION_SEC = 60;

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



  function typeOrbClass(type) {

    if (!type) return '';

    return 'stream-type-orb type-' + String(type).toLowerCase().replace(/\s+/g, '-').replace(/é/g, 'e');

  }



  function getSpotlightPokemon(state, poolData) {
    if (!poolData || !state.selectedPokemonId) return null;
    return global.DraftState.findPokemon(poolData, state.selectedPokemonId);
  }



  function getNextPlayerIndex(state) {
    const { DraftState } = global;
    const PHASE = DraftState.PHASE;

    if (state.phase === PHASE.BAN) {
      const nextBan = state.totalBansDone + 1;
      if (nextBan >= DraftState.TOTAL_BANS) return -1;
      return DraftState.getBanPlayerIndex(nextBan);
    }

    if (state.phase === PHASE.DRAFT) {
      const nextPick = state.totalPicksDone + 1;
      if (nextPick >= DraftState.TOTAL_PICKS) return -1;
      return DraftState.getSnakePlayerIndex(nextPick);
    }

    return -1;
  }

  function renderPlayerPanel(player, index, team, isActive, side) {
    const { DraftState } = global;
    const pickCount = DraftState.PICKS_PER_PLAYER;
    const slots = Array.from({ length: pickCount }, (_, s) => {
      const pick = team[s];
      if (pick) {
        return `<div class="stream-slot stream-slot--filled"><img class="stream-slot__sprite" src="${escapeAttr(pick.spriteUrl)}" onerror="this.src='${PLACEHOLDER}'" alt="${escapeAttr(pick.name)}"></div>`;
      }
      return `<div class="stream-slot stream-slot--empty"><img class="stream-slot__ball" src="${POKEBALL}" alt=""></div>`;
    }).join('');

    const camBlock = '<div class="stream-player__cam">Caméra</div>';
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
    frameEl.innerHTML = `<img class="stream-spotlight__sprite" src="${escapeAttr(pokemon.spriteUrl)}" onerror="this.src='${PLACEHOLDER}'" alt="${escapeAttr(pokemon.name)}">`;

    const t2 = pokemon.type2
      ? `<span class="${typeOrbClass(pokemon.type2)}">${escapeHtml(pokemon.type2)}</span>`
      : '';
    detailsEl.className = 'stream-spotlight-details';
    detailsEl.innerHTML = `
      <h2 class="stream-spotlight__name">${escapeHtml(pokemon.name)}</h2>
      <div class="stream-spotlight__dex">${escapeHtml(pokemon.pokedexId)}</div>
      <div class="stream-spotlight__types">
        <span class="${typeOrbClass(pokemon.type1)}">${escapeHtml(pokemon.type1)}</span>
        ${t2}
      </div>
      <div class="stream-stats">${renderStatsBars(pokemon)}</div>`;
  }



  function renderBanned(state) {

    const list = document.getElementById('stream-banned-list');

    if (!list) return;

    const bans = state.bans || [];

    if (bans.length === 0) {

      list.innerHTML = '<span style="color:rgba(255,255,255,0.25);font-size:0.9rem">—</span>';

      return;

    }

    list.innerHTML = bans

      .map(

        (b) => `

      <div class="stream-banned__item" title="${escapeAttr(b.pokemon.name)}">

        <img src="${escapeAttr(b.pokemon.spriteUrl)}" onerror="this.src='${PLACEHOLDER}'" alt="">

      </div>`

      )

      .join('');

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
        nowEl.textContent = 'Draft terminé';
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
  let timerRemainingSec = STREAM_TURN_DURATION_SEC;
  let lastTurnKey = null;

  function getTurnKey(state) {
    const PHASE = global.DraftState.PHASE;
    if (state.phase === PHASE.BAN) return `ban-${state.totalBansDone}`;
    if (state.phase === PHASE.DRAFT) return `draft-${state.totalPicksDone}`;
    return null;
  }

  function formatTimer(seconds) {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${String(s).padStart(2, '0')}`;
  }

  function stopTurnTimer() {
    if (timerInterval) {
      clearInterval(timerInterval);
      timerInterval = null;
    }
  }

  function updateTimerDisplay(el, remaining) {
    el.textContent = formatTimer(remaining);
    el.classList.toggle('stream-timer--warning', remaining > 0 && remaining <= 10);
    el.classList.toggle('stream-timer--expired', remaining <= 0);
  }

  function startTurnTimerCountdown() {
    const el = document.getElementById('stream-timer');
    if (!el || el.classList.contains('hidden')) return;

    stopTurnTimer();
    timerRemainingSec = STREAM_TURN_DURATION_SEC;
    updateTimerDisplay(el, timerRemainingSec);
    timerInterval = setInterval(() => {
      if (timerRemainingSec > 0) timerRemainingSec -= 1;
      updateTimerDisplay(el, timerRemainingSec);
    }, 1000);
  }

  function renderTurnTimer(state) {
    const el = document.getElementById('stream-timer');
    if (!el) return;

    const streamMode =
      typeof document !== 'undefined' &&
      document.body.classList.contains('stream-mode');
    const turnKey = streamMode ? getTurnKey(state) : null;

    if (!turnKey) {
      stopTurnTimer();
      lastTurnKey = null;
      el.classList.add('hidden');
      el.setAttribute('aria-hidden', 'true');
      return;
    }

    el.classList.remove('hidden');
    el.setAttribute('aria-hidden', 'false');

    if (turnKey !== lastTurnKey) {
      lastTurnKey = turnKey;
    }

    if (!timerInterval) {
      startTurnTimerCountdown();
    }
  }

  function onTurnActionCompleted() {
    startTurnTimerCountdown();
  }



  function render(state, poolData) {

    const active = global.DraftState.getActivePlayerIndex(state);

    const left = document.getElementById('stream-left');

    const right = document.getElementById('stream-right');



    if (left) {

      left.innerHTML = [0, 1, 2, 3]

        .map((i) =>

          renderPlayerPanel(
            state.players[i],
            i,
            state.teams[i] || [],
            i === active,
            'left'
          )

        )

        .join('');

    }



    if (right) {

      right.innerHTML = [4, 5, 6, 7]

        .map((i) =>

          renderPlayerPanel(
            state.players[i],
            i,
            state.teams[i] || [],
            i === active,
            'right'
          )

        )

        .join('');

    }



    renderSpotlight(getSpotlightPokemon(state, poolData));

    renderBanned(state);

    renderTopBar(state);

    renderTurnTimer(state);

  }



  global.StreamView = {

    render,

    onTurnActionCompleted,

  };

})(typeof window !== 'undefined' ? window : globalThis);

