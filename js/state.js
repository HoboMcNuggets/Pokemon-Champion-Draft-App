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



  function getPlayerBans(state, playerIndex) {

    return (state.bans || []).filter((b) => b.playerIndex === playerIndex);

  }



  /** 'any' | 'pokemon' | 'mega' | 'none' — type de ban requis pour le prochain ban du joueur. */
  function getRequiredBanKind(state, playerIndex) {

    const playerBans = getPlayerBans(state, playerIndex);

    if (playerBans.length === 0) return 'any';

    if (playerBans.length >= BANS_PER_PLAYER) return 'none';

    const firstWasMega = playerBans[0].isMega === true;

    return firstWasMega ? 'pokemon' : 'mega';

  }



  function canBan(pokemon, state) {

    if (!pokemon || state.phase !== PHASE.BAN) return false;

    if (state.totalBansDone >= TOTAL_BANS) return false;

    if (!global.PokemonSpecies.isSelectable(pokemon, state)) return false;

    const playerIndex = getActivePlayerIndex(state);

    const requiredKind = getRequiredBanKind(state, playerIndex);

    if (requiredKind === 'none') return false;

    const isMega = pokemon.isMega === true;

    if (requiredKind === 'mega') return isMega;

    if (requiredKind === 'pokemon') return !isMega;

    return true;

  }



  function canAssignPick(pokemon, state, playerIndex) {

    if (!pokemon || state.phase !== PHASE.DRAFT) return false;

    if (playerIndex !== getActivePlayerIndex(state)) return false;

    if (playerIndex < 0 || playerIndex >= PLAYER_COUNT) return false;

    if ((state.teams[playerIndex] || []).length >= PICKS_PER_PLAYER) return false;

    return global.PokemonSpecies.isSelectable(pokemon, state);

  }



  function mergeBlockedPokemonIds(existing, ids) {

    return [...new Set([...(existing || []), ...ids])];

  }



  function applyBan(state, pokemon, pool) {

    const playerIndex = getActivePlayerIndex(state);

    const isMegaBan = pokemon.isMega === true;

    const blockedPokemonIds = isMegaBan
      ? global.PokemonSpecies.getLinkedMegaIds(pokemon, pool)
      : [pokemon.id];

    const entry = {

      playerIndex,

      pokemonId: pokemon.id,

      speciesKey: pokemon.speciesKey,

      isMega: isMegaBan,

      blockedPokemonIds: isMegaBan ? blockedPokemonIds : undefined,

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
      ? mergeBlockedPokemonIds(state.bannedPokemonIds, blockedPokemonIds)
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

          blockedPokemonIds: isMegaBan ? blockedPokemonIds : undefined,

        },

      ],

    };



    if (totalBansDone >= TOTAL_BANS) {

      next.phase = PHASE.DRAFT;

    }



    return next;

  }



  function assignPick(state, playerIndex, pokemon, pool) {

    const isMegaPick = pokemon.isMega === true;

    const blockedSiblingIds = isMegaPick
      ? global.PokemonSpecies.getLinkedMegaSiblingIds(pokemon, pool)
      : [];

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

      bannedPokemonIds: mergeBlockedPokemonIds(

        isMegaPick

          ? mergeBlockedPokemonIds(state.bannedPokemonIds, blockedSiblingIds)

          : state.bannedPokemonIds || [],

        [pokemon.id]

      ),

      totalPicksDone,

      selectedPokemonId: null,

      actionHistory: [

        ...state.actionHistory,

        {

          kind: 'pick',

          playerIndex,

          pokemonId: pokemon.id,

          speciesKey: pokemon.speciesKey,

          isMega: isMegaPick,

          blockedPokemonIds: isMegaPick ? blockedSiblingIds : undefined,

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

      const totalBansDone = Math.max(0, state.totalBansDone - 1);

      next.bans = bans;

      next.usedSpecies = usedSpecies;

      next.bannedPokemonIds = rebuildBannedPokemonIds({ ...state, bans, teams: state.teams });

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

      next.bannedPokemonIds = rebuildBannedPokemonIds({ ...state, teams });

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

      const snap = { ...state, teams };

      next.usedSpecies = rebuildUsedSpecies(snap);

      next.bannedPokemonIds = rebuildBannedPokemonIds(snap);

    } else if (last.kind === 'banEdit') {

      let bans = [...state.bans];

      const slot = findBanSlot(state, last.playerIndex, last.banRound);



      if (last.cleared) {

        if (last.previousBan) {

          bans.push(last.previousBan);

        }

      } else if (last.previousBan) {

        if (slot) bans[slot.index] = last.previousBan;

      } else if (slot) {

        bans = bans.filter((_, i) => i !== slot.index);

      }



      const totalBansDone = bans.length;

      const snap = { ...state, bans };

      next.bans = bans;

      next.totalBansDone = totalBansDone;

      next.usedSpecies = rebuildUsedSpecies(snap);

      next.bannedPokemonIds = rebuildBannedPokemonIds(snap);

      next.phase = resolvePhaseAfterUndo(totalBansDone, state.totalPicksDone);

      if (totalBansDone === 0) next.draftStartedAt = null;

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

  function remapPlayerIndex(playerIndex, indexA, indexB) {

    if (playerIndex === indexA) return indexB;

    if (playerIndex === indexB) return indexA;

    return playerIndex;

  }



  function canSwapPlayerSlots(state, indexA, indexB) {

    if (indexA < 0 || indexA >= PLAYER_COUNT) return false;

    if (indexB < 0 || indexB >= PLAYER_COUNT) return false;

    return indexA !== indexB;

  }



  function swapPlayerSlots(state, indexA, indexB) {

    if (!canSwapPlayerSlots(state, indexA, indexB)) return state;



    const players = [...state.players];

    const playerA = players[indexA];

    players[indexA] = { ...players[indexB], slot: indexA };

    players[indexB] = { ...playerA, slot: indexB };



    const teams = state.teams.map((t) => [...t]);

    const teamA = teams[indexA];

    teams[indexA] = teams[indexB];

    teams[indexB] = teamA;



    const bans = (state.bans || []).map((ban) => ({

      ...ban,

      playerIndex: remapPlayerIndex(ban.playerIndex, indexA, indexB),

    }));



    const actionHistory = (state.actionHistory || []).map((entry) => {

      if (typeof entry.playerIndex !== 'number') return entry;

      return {

        ...entry,

        playerIndex: remapPlayerIndex(entry.playerIndex, indexA, indexB),

      };

    });



    return {

      ...state,

      players,

      teams,

      bans,

      actionHistory,

    };

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



  function rebuildBannedPokemonIds(state, pool) {

    let ids = [];



    for (const ban of state.bans || []) {

      if (ban.isMega !== true || !ban.pokemonId) continue;

      if (ban.blockedPokemonIds?.length) {

        ids = mergeBlockedPokemonIds(ids, ban.blockedPokemonIds);

        continue;

      }

      if (pool) {

        const pokemon = findPokemon(pool, ban.pokemonId);

        if (pokemon) {

          ids = mergeBlockedPokemonIds(

            ids,

            global.PokemonSpecies.getLinkedMegaIds(pokemon, pool)

          );

          continue;

        }

      }

      ids = mergeBlockedPokemonIds(ids, [ban.pokemonId]);

    }



    const picks = (state.teams || []).flat();

    for (const pick of picks) {

      if (pick?.id) {

        ids = mergeBlockedPokemonIds(ids, [pick.id]);

      }

    }



    for (const pick of picks) {

      if (!global.PokemonSpecies.isMegaPickRef(pick)) continue;

      if (pool) {

        const pokemon = findPokemon(pool, pick.id);

        if (pokemon) {

          ids = mergeBlockedPokemonIds(

            ids,

            global.PokemonSpecies.getLinkedMegaSiblingIds(pokemon, pool)

          );

          continue;

        }

      }

      for (const other of picks) {

        if (other.id === pick.id) continue;

        if (!global.PokemonSpecies.isMegaPickRef(other)) continue;

        if (other.speciesKey === pick.speciesKey) {

          ids = mergeBlockedPokemonIds(ids, [other.id]);

        }

      }

    }



    return ids;

  }



  function getPoolAvailability(state, pool, options) {

    const opts = options || {};

    let teams = state.teams || [];

    if (opts.excludeSlot) {

      const { playerIndex, slotIndex } = opts.excludeSlot;

      teams = teams.map((team, i) => {

        if (i !== playerIndex) return team;

        return team.filter((_, si) => si !== slotIndex);

      });

    }

    const snapshot = { ...state, teams };

    return {

      usedSpecies: rebuildUsedSpecies(snapshot),

      bannedPokemonIds: rebuildBannedPokemonIds(snapshot, pool),

    };

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



  function setTeamSlot(state, playerIndex, slotIndex, pokemon, pool) {

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

        bannedPokemonIds: rebuildBannedPokemonIds(clearedState, pool),

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

      bannedPokemonIds: rebuildBannedPokemonIds(nextState, pool),

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



  function findBanSlot(state, playerIndex, banRound) {

    const bans = state.bans || [];

    for (let i = 0; i < bans.length; i++) {

      const pi =

        typeof bans[i].playerIndex === 'number' ? bans[i].playerIndex : getBanPlayerIndex(i);

      const round = getBanRound(i);

      if (pi === playerIndex && round === banRound) {

        return { index: i, ban: bans[i] };

      }

    }

    return null;

  }



  function getRequiredBanKindForSlot(state, playerIndex, banRound) {

    if (banRound === 1) return 'any';

    const first = findBanSlot(state, playerIndex, 1);

    if (!first) return 'none';

    return first.ban.isMega === true ? 'pokemon' : 'mega';

  }



  function getBanAvailability(state, pool, options) {

    const opts = options || {};

    let bans = [...(state.bans || [])];

    if (opts.excludeBan) {

      const { playerIndex, banRound } = opts.excludeBan;

      bans = bans.filter((ban, i) => {

        const pi =

          typeof ban.playerIndex === 'number' ? ban.playerIndex : getBanPlayerIndex(i);

        const round = getBanRound(i);

        return !(pi === playerIndex && round === banRound);

      });

    }

    const snapshot = { ...state, bans };

    return {

      usedSpecies: rebuildUsedSpecies(snapshot),

      bannedPokemonIds: rebuildBannedPokemonIds(snapshot, pool),

    };

  }



  function buildBanEntry(playerIndex, pokemon, pool) {

    const isMegaBan = pokemon.isMega === true;

    const blockedPokemonIds = isMegaBan

      ? global.PokemonSpecies.getLinkedMegaIds(pokemon, pool)

      : undefined;

    return {

      playerIndex,

      pokemonId: pokemon.id,

      speciesKey: pokemon.speciesKey,

      isMega: isMegaBan,

      blockedPokemonIds: isMegaBan ? blockedPokemonIds : undefined,

      pokemon: {

        id: pokemon.id,

        name: pokemon.name,

        spriteUrl: pokemon.spriteUrl,

        pokedexId: pokemon.pokedexId,

      },

    };

  }



  function canPickForBanSlot(pokemon, state, pool, playerIndex, banRound) {

    if (!pokemon) return false;

    const availability = getBanAvailability(state, pool, {

      excludeBan: { playerIndex, banRound },

    });

    if (!global.PokemonSpecies.isSelectable(pokemon, availability)) return false;

    const kind = getRequiredBanKindForSlot(state, playerIndex, banRound);

    const isMega = pokemon.isMega === true;

    if (kind === 'none') return false;

    if (kind === 'mega' && !isMega) return false;

    if (kind === 'pokemon' && isMega) return false;

    if (banRound === 1) {

      const round2 = findBanSlot(state, playerIndex, 2);

      if (round2 && isMega === (round2.ban.isMega === true)) return false;

    }

    return true;

  }



  function canEditBanSlot(state, playerIndex, banRound) {

    if (playerIndex < 0 || playerIndex >= PLAYER_COUNT) return false;

    if (banRound < 1 || banRound > BANS_PER_PLAYER) return false;

    if (state.phase === PHASE.SETUP) return false;

    if (findBanSlot(state, playerIndex, banRound)) return true;

    if (state.phase === PHASE.BAN && state.totalBansDone < TOTAL_BANS) {

      const nextPlayer = getBanPlayerIndex(state.totalBansDone);

      const nextRound = getBanRound(state.totalBansDone);

      return playerIndex === nextPlayer && banRound === nextRound;

    }

    return false;

  }



  function canClearBanSlot(state, playerIndex, banRound) {

    const slot = findBanSlot(state, playerIndex, banRound);

    if (!slot) return false;

    return slot.index === (state.bans || []).length - 1;

  }



  function setBanSlot(state, playerIndex, banRound, pokemon, pool) {

    if (playerIndex < 0 || playerIndex >= PLAYER_COUNT) return state;

    if (banRound < 1 || banRound > BANS_PER_PLAYER) return state;



    const existing = findBanSlot(state, playerIndex, banRound);



    if (pokemon === null) {

      if (!canClearBanSlot(state, playerIndex, banRound)) return state;

      const previousBan = { ...existing.ban };

      const bans = state.bans.filter((_, i) => i !== existing.index);

      const totalBansDone = bans.length;

      const clearedState = { ...state, bans, totalBansDone };

      return {

        ...clearedState,

        usedSpecies: rebuildUsedSpecies(clearedState),

        bannedPokemonIds: rebuildBannedPokemonIds(clearedState, pool),

        phase: resolvePhaseAfterUndo(totalBansDone, state.totalPicksDone),

        selectedPokemonId: null,

        draftStartedAt: totalBansDone === 0 ? null : state.draftStartedAt,

        actionHistory: [

          ...state.actionHistory,

          {

            kind: 'banEdit',

            playerIndex,

            banRound,

            previousBan,

            cleared: true,

          },

        ],

      };

    }



    if (!pokemon) return state;

    if (!canPickForBanSlot(pokemon, state, pool, playerIndex, banRound)) return state;



    const previousBan = existing ? { ...existing.ban } : null;

    const entry = buildBanEntry(playerIndex, pokemon, pool);



    let bans = [...(state.bans || [])];

    let totalBansDone = state.totalBansDone;



    if (existing) {

      bans[existing.index] = entry;

    } else {

      if (!canEditBanSlot(state, playerIndex, banRound)) return state;

      bans.push(entry);

      totalBansDone = bans.length;

    }



    const nextState = { ...state, bans, totalBansDone };

    let phase = state.phase;

    if (phase === PHASE.BAN && totalBansDone >= TOTAL_BANS) {

      phase = PHASE.DRAFT;

    } else if (phase === PHASE.DRAFT && totalBansDone < TOTAL_BANS) {

      phase = PHASE.BAN;

    }



    const draftStartedAt =

      state.draftStartedAt || (bans.length > 0 ? new Date().toISOString() : null);



    return {

      ...nextState,

      phase,

      draftStartedAt,

      usedSpecies: rebuildUsedSpecies(nextState),

      bannedPokemonIds: rebuildBannedPokemonIds(nextState, pool),

      selectedPokemonId: null,

      actionHistory: [

        ...state.actionHistory,

        {

          kind: 'banEdit',

          playerIndex,

          banRound,

          previousBan,

        },

      ],

    };

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

    let state = deserialize(rawState, pool);

    state = {

      ...state,

      usedSpecies: rebuildUsedSpecies(state),

      bannedPokemonIds: rebuildBannedPokemonIds(state, pool),

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



  function deserialize(raw, pool) {

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

    s.bannedPokemonIds = rebuildBannedPokemonIds(s, pool);



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

    getPlayerBans,

    getRequiredBanKind,

    canBan,

    canAssignPick,

    applyBan,

    assignPick,

    undo,

    resetDraft,

    setPlayerNames,

    canSwapPlayerSlots,

    swapPlayerSlots,

    setTeamSlot,

    canEditTeamSlot,

    canClearTeamSlot,

    findBanSlot,

    getRequiredBanKindForSlot,

    getBanAvailability,

    canPickForBanSlot,

    canEditBanSlot,

    canClearBanSlot,

    setBanSlot,

    EXPORT_FORMAT_VERSION,

    createExportPayload,

    parseImportPayload,

    validateStateAgainstPool,

    importDraftState,

    getPoolAvailability,

    serialize,

    deserialize,

  };

})(typeof window !== 'undefined' ? window : globalThis);

