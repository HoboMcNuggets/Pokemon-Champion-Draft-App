/**
 * Simulation instantanée d'un draft complet (bans + picks).
 */
(function (global) {
  const { DraftState } = global;
  const PHASE = DraftState.PHASE;

  function findBanCandidate(state, poolData) {
    if (!poolData?.pokemon?.length) return null;
    return poolData.pokemon.find((p) => p.enabled && DraftState.canBan(p, state)) || null;
  }

  function findPickCandidate(state, poolData) {
    if (!poolData?.pokemon?.length) return null;
    const active = DraftState.getActivePlayerIndex(state);
    return (
      poolData.pokemon.find((p) => p.enabled && DraftState.canAssignPick(p, state, active)) ||
      null
    );
  }

  function runInstantMockDraft(state, poolData) {
    const check = DraftState.canStartDraft(state, poolData);
    if (!check.ok) {
      return { ok: false, message: check.message, state };
    }

    let next = DraftState.startDraft(state);

    while (next.phase === PHASE.BAN) {
      const candidate = findBanCandidate(next, poolData);
      if (!candidate) {
        return {
          ok: false,
          message: `Simulation interrompue : aucun candidat ban (ban ${next.totalBansDone + 1}/${DraftState.TOTAL_BANS}).`,
          state: next,
        };
      }
      next = DraftState.applyBan(next, candidate, poolData);
    }

    while (next.phase === PHASE.DRAFT) {
      const active = DraftState.getActivePlayerIndex(next);
      const candidate = findPickCandidate(next, poolData);
      if (!candidate) {
        return {
          ok: false,
          message: `Simulation interrompue : aucun candidat pick (pick ${next.totalPicksDone + 1}/${DraftState.TOTAL_PICKS}).`,
          state: next,
        };
      }
      next = DraftState.assignPick(next, active, candidate, poolData);
    }

    return {
      ok: true,
      state: { ...next, actionHistory: [] },
    };
  }

  global.MockDraft = {
    findBanCandidate,
    findPickCandidate,
    runInstantMockDraft,
  };
})(typeof window !== 'undefined' ? window : globalThis);
