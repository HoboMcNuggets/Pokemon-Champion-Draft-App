/**

 * Machine à états du draft Pokémon.

 */

(function (global) {

  const PLAYER_COUNT = 8;

  const BANS_PER_PLAYER = 2;

  const TOTAL_BANS = PLAYER_COUNT * BANS_PER_PLAYER;

  const PICKS_PER_PLAYER = 8;

  const TOTAL_PICKS = PLAYER_COUNT * PICKS_PER_PLAYER;



  const PHASE = {

    SETUP: 'setup',

    BAN: 'banPhase',

    DRAFT: 'draftPhase',

    COMPLETE: 'complete',

  };

  const EXPORT_FORMAT_VERSION = 1;



  function defaultPlayers() {

    return Array.from({ length: PLAYER_COUNT }, (_, i) => ({

      slot: i,

      name: `Joueur ${i + 1}`,

    }));

  }



  function createInitialState() {

    return {

      phase: PHASE.SETUP,

      players: defaultPlayers(),

      usedSpecies: [],

      bannedPokemonIds: [],

      bans: [],

      teams: Array.from({ length: PLAYER_COUNT }, () => []),

      totalBansDone: 0,

      totalPicksDone: 0,

      actionHistory: [],

      selectedPokemonId: null,

      draftStartedAt: null,

      draftCompletedAt: null,

    };

  }



  function getSnakePlayerIndex(pickNumber) {

    const round = Math.floor(pickNumber / PLAYER_COUNT);

    const pos = pickNumber % PLAYER_COUNT;

    if (round % 2 === 0) return pos;

    return PLAYER_COUNT - 1 - pos;

  }



  /** Bans : 2 tours linéaires J1→J8 (pas de snake). */

  function getBanPlayerIndex(banNumber) {

    return banNumber % PLAYER_COUNT;

  }



  function getBanRound(banNumber) {

    return Math.floor(banNumber / PLAYER_COUNT) + 1;

  }



  function getDraftRound(pickNumber) {

    return Math.floor(pickNumber / PLAYER_COUNT) + 1;

  }



  function getNextPlayerIndex(state) {

    if (state.phase === PHASE.BAN) {

      const nextBan = state.totalBansDone + 1;

      if (nextBan >= TOTAL_BANS) return -1;

      return getBanPlayerIndex(nextBan);

    }

    if (state.phase === PHASE.DRAFT) {

      const nextPick = state.totalPicksDone + 1;

      if (nextPick >= TOTAL_PICKS) return -1;

      return getSnakePlayerIndex(nextPick);

    }

    return -1;

  }



  function getActivePlayerIndex(state) {

    if (state.phase === PHASE.BAN) {

      return getBanPlayerIndex(state.totalBansDone);

    }

    if (state.phase === PHASE.DRAFT) {

      return getSnakePlayerIndex(state.totalPicksDone);

    }

    return -1;

  }



  function validatePlayerNames(players) {

    for (let i = 0; i < PLAYER_COUNT; i++) {

      const name = (players[i]?.name || '').trim();

      if (!name) return { ok: false, message: `Le nom du participant ${i + 1} est requis.` };

    }

    return { ok: true };

  }



  function canStartDraft(state, pool) {

    const names = validatePlayerNames(state.players);

    if (!names.ok) return names;

    if (!pool || !pool.pokemon || pool.pokemon.length === 0) {

      return { ok: false, message: 'Importez un pool Pokémon avant de démarrer.' };

    }

    const enabled = pool.pokemon.some((p) => p.enabled);

    if (!enabled) return { ok: false, message: 'Aucun Pokémon activé (enabled: true) dans le pool.' };

    return { ok: true };

  }



  function startDraft(state) {

    return {

      ...state,

      phase: PHASE.BAN,

      usedSpecies: [],

      bannedPokemonIds: [],

      bans: [],

      teams: Array.from({ length: PLAYER_COUNT }, () => []),

      totalBansDone: 0,

      totalPicksDone: 0,

      actionHistory: [],

      selectedPokemonId: null,

      draftStartedAt: null,

      draftCompletedAt: null,

    };

  }



  function findPokemon(pool, id) {

    return pool.pokemon.find((p) => p.id === id) || null;

  }



  function canBan(pokemon, state) {

    if (!pokemon || state.phase !== PHASE.BAN) return false;

    if (state.totalBansDone >= TOTAL_BANS) return false;

    return global.PokemonSpecies.isSelectable(pokemon, state);

  }



  function canAssignPick(pokemon, state, playerIndex) {

    if (!pokemon || state.phase !== PHASE.DRAFT) return false;

    if (playerIndex !== getActivePlayerIndex(state)) return false;

    if (playerIndex < 0 || playerIndex >= PLAYER_COUNT) return false;

    if ((state.teams[playerIndex] || []).length >= PICKS_PER_PLAYER) return false;

    return global.PokemonSpecies.isSelectable(pokemon, state);

  }



  function applyBan(state, pokemon) {

    const playerIndex = getActivePlayerIndex(state);

    const isMegaBan = pokemon.isMega === true;

    const entry = {

      playerIndex,

      pokemonId: pokemon.id,

      speciesKey: pokemon.speciesKey,

      isMega: isMegaBan,

      pokemon: {

        id: pokemon.id,

        name: pokemon.name,

        spriteUrl: pokemon.spriteUrl,

        pokedexId: pokemon.pokedexId,

      },

    };



    const totalBansDone = state.totalBansDone + 1;

    const draftStartedAt =
      state.totalBansDone === 0 && !state.draftStartedAt
        ? new Date().toISOString()
        : state.draftStartedAt;

    const usedSpecies = isMegaBan
      ? state.usedSpecies
      : [...state.usedSpecies, pokemon.speciesKey];

    const bannedPokemonIds = isMegaBan
      ? [...(state.bannedPokemonIds || []), pokemon.id]
      : state.bannedPokemonIds || [];

    let next = {

      ...state,

      usedSpecies,

      bannedPokemonIds,

      bans: [...state.bans, entry],

      totalBansDone,

      draftStartedAt,

      selectedPokemonId: null,

      actionHistory: [

        ...state.actionHistory,

        {

          kind: 'ban',

          playerIndex,

          pokemonId: pokemon.id,

          speciesKey: pokemon.speciesKey,

          isMega: isMegaBan,

        },

      ],

    };



    if (totalBansDone >= TOTAL_BANS) {

      next.phase = PHASE.DRAFT;

    }



    return next;

  }



  function assignPick(state, playerIndex, pokemon) {

    const teamSlot = [...state.teams];

    teamSlot[playerIndex] = [

      ...teamSlot[playerIndex],

      {

        id: pokemon.id,

        name: pokemon.name,

        spriteUrl: pokemon.spriteUrl,

        pokedexId: pokemon.pokedexId,

        speciesKey: pokemon.speciesKey,

      },

    ];



    const totalPicksDone = state.totalPicksDone + 1;

    let next = {

      ...state,

      teams: teamSlot,

      usedSpecies: state.usedSpecies.includes(pokemon.speciesKey)

        ? state.usedSpecies

        : [...state.usedSpecies, pokemon.speciesKey],

      totalPicksDone,

      selectedPokemonId: null,

      actionHistory: [

        ...state.actionHistory,

        {

          kind: 'pick',

          playerIndex,

          pokemonId: pokemon.id,

          speciesKey: pokemon.speciesKey,

        },

      ],

    };



    if (totalPicksDone >= TOTAL_PICKS) {

      next.phase = PHASE.COMPLETE;

      next.draftCompletedAt = new Date().toISOString();

    }



    return next;

  }



  function resolvePhaseAfterUndo(totalBansDone, totalPicksDone) {
    if (totalPicksDone >= TOTAL_PICKS) return PHASE.COMPLETE;
    if (totalPicksDone > 0 || totalBansDone >= TOTAL_BANS) return PHASE.DRAFT;
    return PHASE.BAN;
  }



  function undo(state) {

    const history = [...state.actionHistory];

    if (history.length === 0) return state;



    const last = history.pop();

    let next = { ...state, actionHistory: history, selectedPokemonId: null };



    if (last.kind === 'ban') {

      const bans = [...state.bans];

      bans.pop();

      const removedBan = state.bans[state.bans.length - 1];

      const isMegaBan = removedBan?.isMega === true;

      const usedSpecies = [...state.usedSpecies];

      if (!isMegaBan) {

        const idx = usedSpecies.lastIndexOf(last.speciesKey);

        if (idx >= 0) usedSpecies.splice(idx, 1);

      }

      let bannedPokemonIds = [...(state.bannedPokemonIds || [])];

      if (isMegaBan) {

        const idIdx = bannedPokemonIds.lastIndexOf(last.pokemonId);

        if (idIdx >= 0) bannedPokemonIds.splice(idIdx, 1);

      }



      const totalBansDone = Math.max(0, state.totalBansDone - 1);

      next.bans = bans;

      next.usedSpecies = usedSpecies;

      next.bannedPokemonIds = bannedPokemonIds;

      next.totalBansDone = totalBansDone;

      next.phase = resolvePhaseAfterUndo(totalBansDone, state.totalPicksDone);

      if (totalBansDone === 0) next.draftStartedAt = null;

    } else if (last.kind === 'pick') {

      const teams = state.teams.map((t) => [...t]);

      const team = teams[last.playerIndex];

      team.pop();

      teams[last.playerIndex] = team;



      const usedSpecies = [...state.usedSpecies];

      const stillUsed = teams.flat().some((p) => p.speciesKey === last.speciesKey);

      const stillBanned = state.bans.some(

        (b) => b.isMega !== true && b.speciesKey === last.speciesKey

      );

      if (!stillUsed && !stillBanned) {

        const idx = usedSpecies.indexOf(last.speciesKey);

        if (idx >= 0) usedSpecies.splice(idx, 1);

      }



      const totalPicksDone = Math.max(0, state.totalPicksDone - 1);

      next.teams = teams;

      next.usedSpecies = usedSpecies;

      next.totalPicksDone = totalPicksDone;

      next.phase = resolvePhaseAfterUndo(state.totalBansDone, totalPicksDone);

      if (totalPicksDone < TOTAL_PICKS) next.draftCompletedAt = null;

    } else if (last.kind === 'slotEdit') {

      const teams = state.teams.map((t) => [...t]);

      const team = teams[last.playerIndex];



      if (last.cleared && last.previousPick) {

        team.splice(last.slotIndex, 0, last.previousPick);

      } else if (last.previousPick) {

        team[last.slotIndex] = last.previousPick;

      } else if (last.slotIndex === team.length - 1) {

        team.pop();

      } else if (last.slotIndex < team.length) {

        team.splice(last.slotIndex, 1);

      }



      teams[last.playerIndex] = team;

      next.teams = teams;

      next.usedSpecies = rebuildUsedSpecies({ ...state, teams });

    }



    return next;

  }



  function resetDraft(keepPlayers) {

    const base = createInitialState();

    if (keepPlayers) {

      base.players = keepPlayers;

    }

    return base;

  }



  function setPlayerNames(state, players) {

    return { ...state, players };

  }



  function rebuildUsedSpecies(state) {

    const fromBans = (state.bans || [])

      .filter((b) => b.isMega !== true)

      .map((b) => b.speciesKey)

      .filter(Boolean);

    const fromTeams = (state.teams || [])

      .flat()

      .map((p) => p.speciesKey)

      .filter(Boolean);

    return [...new Set([...fromBans, ...fromTeams])];

  }



  function rebuildBannedPokemonIds(state) {

    return [

      ...new Set(

        (state.bans || [])

          .filter((b) => b.isMega === true && b.pokemonId)

          .map((b) => b.pokemonId)

      ),

    ];

  }



  function clonePick(pokemon) {

    return {

      id: pokemon.id,

      name: pokemon.name,

      spriteUrl: pokemon.spriteUrl,

      pokedexId: pokemon.pokedexId,

      speciesKey: pokemon.speciesKey,

    };

  }



  function setTeamSlot(state, playerIndex, slotIndex, pokemon) {

    if (playerIndex < 0 || playerIndex >= PLAYER_COUNT) return state;

    if (slotIndex < 0 || slotIndex >= PICKS_PER_PLAYER) return state;



    const teams = state.teams.map((t) => [...t]);

    const team = teams[playerIndex];



    if (pokemon === null) {

      if (!team[slotIndex]) return state;

      const previousPick = { ...team[slotIndex] };

      team.splice(slotIndex, 1);

      teams[playerIndex] = team;

      const clearedState = { ...state, teams };



      return {

        ...clearedState,

        usedSpecies: rebuildUsedSpecies(clearedState),

        selectedPokemonId: null,

        actionHistory: [

          ...state.actionHistory,

          {

            kind: 'slotEdit',

            playerIndex,

            slotIndex,

            previousPick,

            cleared: true,

          },

        ],

      };

    }



    if (!pokemon) return state;



    const previousPick = team[slotIndex] ? { ...team[slotIndex] } : null;



    if (previousPick) {

      team[slotIndex] = clonePick(pokemon);

    } else if (slotIndex === team.length) {

      team.push(clonePick(pokemon));

    } else {

      return state;

    }



    teams[playerIndex] = team;



    const nextState = { ...state, teams };



    return {

      ...nextState,

      usedSpecies: rebuildUsedSpecies(nextState),

      selectedPokemonId: null,

      actionHistory: [

        ...state.actionHistory,

        {

          kind: 'slotEdit',

          playerIndex,

          slotIndex,

          previousPick,

        },

      ],

    };

  }



  function canEditTeamSlot(state, playerIndex, slotIndex) {

    if (playerIndex < 0 || playerIndex >= PLAYER_COUNT) return false;

    if (slotIndex < 0 || slotIndex >= PICKS_PER_PLAYER) return false;

    const team = state.teams[playerIndex] || [];

    if (team[slotIndex]) return true;

    return slotIndex === team.length;

  }



  function canClearTeamSlot(state, playerIndex, slotIndex) {

    if (playerIndex < 0 || playerIndex >= PLAYER_COUNT) return false;

    if (slotIndex < 0 || slotIndex >= PICKS_PER_PLAYER) return false;

    const team = state.teams[playerIndex] || [];

    return !!team[slotIndex];

  }



  function serialize(state) {

    return JSON.parse(JSON.stringify(state));

  }



  function createExportPayload(state, meta = {}) {

    return {

      formatVersion: EXPORT_FORMAT_VERSION,

      exportedAt: new Date().toISOString(),

      leagueName: meta.leagueName ?? null,

      poolVersion: meta.poolVersion ?? null,

      state: serialize(state),

    };

  }



  function validateImportPayload(data) {

    const errors = [];

    const warnings = [];



    if (!data || typeof data !== 'object') {

      return { ok: false, errors: ['Fichier JSON invalide.'], warnings, rawState: null, meta: null };

    }



    let rawState = null;



    if (data.state && typeof data.state === 'object') {

      rawState = data.state;

      if (

        data.formatVersion != null &&

        data.formatVersion !== EXPORT_FORMAT_VERSION

      ) {

        warnings.push(

          `Version d'export ${data.formatVersion} (format actuel : ${EXPORT_FORMAT_VERSION}).`

        );

      }

    } else if (data.phase && Array.isArray(data.players)) {

      rawState = data;

      warnings.push("Format brut détecté (sans enveloppe d'export).");

    } else {

      errors.push('Fichier non reconnu : champ "state" manquant.');

      return { ok: false, errors, warnings, rawState: null, meta: null };

    }



    if (!rawState.phase) {

      errors.push('État draft : champ "phase" manquant.');

    }

    if (!Array.isArray(rawState.players) || rawState.players.length !== PLAYER_COUNT) {

      errors.push(`État draft : ${PLAYER_COUNT} joueurs requis.`);

    }

    if (!Array.isArray(rawState.teams)) {

      errors.push('État draft : champ "teams" manquant.');

    }



    const meta = {

      exportedAt: data.exportedAt ?? null,

      leagueName: data.leagueName ?? null,

      poolVersion: data.poolVersion ?? null,

      formatVersion: data.formatVersion ?? null,

    };



    return {

      ok: errors.length === 0,

      errors,

      warnings,

      rawState,

      meta,

    };

  }



  function parseImportPayload(text) {

    try {

      const data = JSON.parse(text);

      return validateImportPayload(data);

    } catch (e) {

      return {

        ok: false,

        errors: ['JSON illisible : ' + (e.message || 'erreur de syntaxe')],

        warnings: [],

        rawState: null,

        meta: null,

      };

    }

  }



  function validateStateAgainstPool(state, pool) {

    const errors = [];

    const warnings = [];



    if (!pool?.pokemon?.length) {

      warnings.push('Pokédex non chargé : compatibilité des Pokémon non vérifiée.');

      return { ok: true, errors, warnings };

    }



    const byId = new Map(pool.pokemon.map((p) => [p.id, p]));



    for (const ban of state.bans || []) {

      if (ban.pokemonId && !byId.has(ban.pokemonId)) {

        errors.push(`Ban introuvable dans le pool : ${ban.pokemonId}.`);

      }

    }



    state.teams.forEach((team, playerIndex) => {

      (team || []).forEach((pick) => {

        if (pick.id && !byId.has(pick.id)) {

          const playerName = state.players[playerIndex]?.name || `Joueur ${playerIndex + 1}`;

          errors.push(

            `Pick introuvable pour ${playerName} : ${pick.name || pick.id}.`

          );

        }

      });

    });



    return { ok: errors.length === 0, errors, warnings };

  }



  function importDraftState(rawState, pool) {

    let state = deserialize(rawState);

    state = {

      ...state,

      usedSpecies: rebuildUsedSpecies(state),

      bannedPokemonIds: rebuildBannedPokemonIds(state),

    };

    return state;

  }



  function migrateBanEntry(b, index) {

    if (!b) return null;

    const playerIndex =

      typeof b.playerIndex === 'number' && b.playerIndex >= 0 && b.playerIndex < PLAYER_COUNT

        ? b.playerIndex

        : typeof index === 'number'

          ? getBanPlayerIndex(index)

          : 0;

    return {

      playerIndex,

      pokemonId: b.pokemonId,

      speciesKey: b.speciesKey,

      isMega: b.isMega === true,

      pokemon: b.pokemon || {

        id: b.pokemonId,

        name: '',

        spriteUrl: '',

        pokedexId: '',

      },

    };

  }



  function deserialize(raw) {

    if (!raw) return createInitialState();

    const s = { ...createInitialState(), ...raw };

    s.players = s.players?.length === PLAYER_COUNT ? s.players : defaultPlayers();

    s.teams = s.teams?.length === PLAYER_COUNT

      ? s.teams

      : Array.from({ length: PLAYER_COUNT }, () => []);

    s.usedSpecies = Array.isArray(s.usedSpecies) ? s.usedSpecies : [];

    s.bannedPokemonIds = Array.isArray(s.bannedPokemonIds) ? s.bannedPokemonIds : [];

    s.bans = Array.isArray(s.bans)

      ? s.bans.map((b, i) => migrateBanEntry(b, i)).filter(Boolean)

      : [];

    s.actionHistory = Array.isArray(s.actionHistory) ? s.actionHistory : [];

    s.totalBansDone =

      typeof s.totalBansDone === 'number' ? s.totalBansDone : s.bans.length;

    s.totalPicksDone = typeof s.totalPicksDone === 'number' ? s.totalPicksDone : 0;



    if (s.phase === PHASE.BAN || s.phase === 'banPhase') {
      if (s.totalBansDone >= TOTAL_BANS) {
        s.phase = s.totalPicksDone >= TOTAL_PICKS ? PHASE.COMPLETE : PHASE.DRAFT;
      } else if (s.totalBansDone > 0 || s.bans.length > 0) {
        s.phase = PHASE.BAN;
        if (s.totalBansDone === 0) s.totalBansDone = s.bans.length;
      } else if (s.totalPicksDone > 0) {
        s.phase = PHASE.DRAFT;
      } else {
        s.phase = PHASE.SETUP;
      }
    }



    if (s.phase === PHASE.DRAFT && s.totalPicksDone >= TOTAL_PICKS) {

      s.phase = PHASE.COMPLETE;

    }



    delete s.banPlayerIndex;

    delete s.banSubStep;



    s.usedSpecies = rebuildUsedSpecies(s);

    s.bannedPokemonIds = rebuildBannedPokemonIds(s);



    return s;

  }



  global.DraftState = {

    PLAYER_COUNT,

    BANS_PER_PLAYER,

    TOTAL_BANS,

    PICKS_PER_PLAYER,

    TOTAL_PICKS,

    PHASE,

    createInitialState,

    getSnakePlayerIndex,

    getBanPlayerIndex,

    getBanRound,

    getDraftRound,

    getNextPlayerIndex,

    getActivePlayerIndex,

    validatePlayerNames,

    canStartDraft,

    startDraft,

    findPokemon,

    canBan,

    canAssignPick,

    applyBan,

    assignPick,

    undo,

    resetDraft,

    setPlayerNames,

    setTeamSlot,

    canEditTeamSlot,

    canClearTeamSlot,

    EXPORT_FORMAT_VERSION,

    createExportPayload,

    parseImportPayload,

    validateStateAgainstPool,

    importDraftState,

    serialize,

    deserialize,

  };

})(typeof window !== 'undefined' ? window : globalThis);

