/**
 * Récapitulatif de fin de draft — calculs et rendu stream.
 */
(function (global) {
  const TYPE_COLORS = {
    Normal: '#a8a878',
    Fire: '#ee8130',
    Water: '#2d6fa8',
    Grass: '#5cbd2e',
    Electric: '#8a7008',
    Ice: '#98d8d8',
    Fighting: '#c03028',
    Poison: '#a33ea1',
    Ground: '#e2bf65',
    Flying: '#a8c8e8',
    Psychic: '#f85888',
    Bug: '#6d7a12',
    Rock: '#8f7f3a',
    Ghost: '#705898',
    Dragon: '#3d4cb8',
    Dark: '#3a322c',
    Steel: '#b8b8d0',
    Fairy: '#d878c8',
    Stellar: '#3a9fd4',
  };

  function escapeHtml(s) {
    const d = document.createElement('div');
    d.textContent = s;
    return d.innerHTML;
  }

  function computeDurationMs(state) {
    const start = state.draftStartedAt ? Date.parse(state.draftStartedAt) : NaN;
    const end = state.draftCompletedAt ? Date.parse(state.draftCompletedAt) : NaN;
    if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return null;
    return end - start;
  }

  function formatDuration(ms) {
    if (ms == null || !Number.isFinite(ms) || ms < 0) return '—';
    const totalSec = Math.floor(ms / 1000);
    const h = Math.floor(totalSec / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    const s = totalSec % 60;
    if (h > 0) {
      return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    }
    return `${m}:${String(s).padStart(2, '0')}`;
  }

  function resolvePick(poolData, pick) {
    if (!pick?.id || !poolData) return null;
    return global.DraftState.findPokemon(poolData, pick.id);
  }

  function resolveTeamPokemon(poolData, picks) {
    return (picks || []).map((pick) => resolvePick(poolData, pick)).filter(Boolean);
  }

  function countDraftedTypes(state, poolData) {
    const typeCounts = {};
    for (const team of state.teams || []) {
      for (const pick of team) {
        const pokemon = resolvePick(poolData, pick);
        if (!pokemon) continue;
        [pokemon.type1, pokemon.type2]
          .filter((t) => t && String(t).trim())
          .forEach((type) => {
            const label = global.TypeDisplay?.displayLabel?.(type) || type;
            typeCounts[label] = (typeCounts[label] || 0) + 1;
          });
      }
    }
    return typeCounts;
  }

  function formatWeaknessDetail(weakness) {
    if (!weakness) return '—';
    const parts = [];
    if (weakness.weak4xCount > 0) parts.push(`${weakness.weak4xCount} ×4`);
    const x2Only = weakness.weakCount - weakness.weak4xCount;
    if (x2Only > 0) parts.push(`${x2Only} ×2`);
    return parts.length ? parts.join(', ') : '—';
  }

  function computePlayerStat(player, picks, poolData) {
    const teamPokemon = resolveTeamPokemon(poolData, picks);
    const bstTotal = teamPokemon.reduce(
      (sum, p) => sum + global.PokemonSpecies.getBaseTotal(p),
      0
    );
    const weakness = global.TypeChart.computeDominantWeakness(teamPokemon);
    return {
      name: player?.name || '—',
      bstTotal,
      resolvedCount: teamPokemon.length,
      pickCount: (picks || []).length,
      weaknessType: weakness?.type ?? null,
      weaknessScore: weakness?.score ?? 0,
      weakCount: weakness?.weakCount ?? 0,
      weak4xCount: weakness?.weak4xCount ?? 0,
    };
  }

  function computeRecap(state, poolData) {
    const durationMs = computeDurationMs(state);
    const typeCounts = countDraftedTypes(state, poolData);
    const playerStats = (state.players || []).map((player, index) =>
      computePlayerStat(player, state.teams?.[index] || [], poolData)
    );
    const typeTotal = Object.values(typeCounts).reduce((a, b) => a + b, 0);
    return {
      durationMs,
      durationLabel: formatDuration(durationMs),
      typeCounts,
      typeTotal,
      playerStats,
    };
  }

  function polarToCartesian(cx, cy, r, angleDeg) {
    const rad = ((angleDeg - 90) * Math.PI) / 180;
    return {
      x: cx + r * Math.cos(rad),
      y: cy + r * Math.sin(rad),
    };
  }

  function describeArc(cx, cy, r, startAngle, endAngle) {
    if (endAngle - startAngle >= 359.999) {
      return [
        `M ${cx - r} ${cy}`,
        `A ${r} ${r} 0 1 0 ${cx + r} ${cy}`,
        `A ${r} ${r} 0 1 0 ${cx - r} ${cy}`,
        'Z',
      ].join(' ');
    }
    const start = polarToCartesian(cx, cy, r, endAngle);
    const end = polarToCartesian(cx, cy, r, startAngle);
    const largeArc = endAngle - startAngle > 180 ? 1 : 0;
    return [
      `M ${cx} ${cy}`,
      `L ${start.x} ${start.y}`,
      `A ${r} ${r} 0 ${largeArc} 0 ${end.x} ${end.y}`,
      'Z',
    ].join(' ');
  }

  function renderPieChart(typeCounts, typeTotal) {
    const entries = Object.entries(typeCounts).sort((a, b) => {
      if (b[1] !== a[1]) return b[1] - a[1];
      return a[0].localeCompare(b[0], 'fr');
    });

    if (!entries.length || typeTotal <= 0) {
      return '<p class="stream-recap__empty">Aucun type drafté</p>';
    }

    const cx = 50;
    const cy = 50;
    const r = 42;
    let angle = 0;
    const slices = entries.map(([type, count]) => {
      const sweep = (count / typeTotal) * 360;
      const path =
        sweep >= 360
          ? describeArc(cx, cy, r, 0, 360)
          : describeArc(cx, cy, r, angle, angle + sweep);
      const fill = TYPE_COLORS[type] || '#666';
      const pct = Math.round((count / typeTotal) * 100);
      angle += sweep;
      return `<path d="${path}" fill="${fill}" class="stream-recap__pie-slice" data-type="${escapeHtml(type)}" data-pct="${pct}" data-count="${count}" tabindex="0"></path>`;
    });

    const legend = entries
      .map(([type, count]) => {
        const pct = Math.round((count / typeTotal) * 100);
        const badge = global.TypeDisplay?.renderBadge?.(type, { variant: 'orb' }) ?? escapeHtml(type);
        return `<li class="stream-recap__legend-item">
          <span class="stream-recap__legend-swatch" style="background:${TYPE_COLORS[type] || '#666'}"></span>
          ${badge}
          <span class="stream-recap__legend-meta">${count} · ${pct}%</span>
        </li>`;
      })
      .join('');

    return `
      <div class="stream-recap__pie-wrap">
        <div class="stream-recap__pie-stage">
          <svg class="stream-recap__pie" viewBox="0 0 100 100" role="img" aria-label="Répartition des types draftés">${slices.join('')}</svg>
          <div class="stream-recap__pie-tooltip" role="tooltip" aria-hidden="true"></div>
        </div>
        <ul class="stream-recap__legend">${legend}</ul>
      </div>`;
  }

  function setupPieInteractions(container) {
    const stage = container.querySelector('.stream-recap__pie-stage');
    if (!stage) return;

    const tooltip = stage.querySelector('.stream-recap__pie-tooltip');
    const slices = stage.querySelectorAll('.stream-recap__pie-slice');
    if (!tooltip || !slices.length) return;

    let activeSlice = null;

    function positionTooltip(clientX, clientY) {
      const rect = stage.getBoundingClientRect();
      const x = clientX - rect.left;
      const y = clientY - rect.top;
      tooltip.style.left = `${x}px`;
      tooltip.style.top = `${y}px`;
    }

    function showTooltip(slice, clientX, clientY) {
      if (activeSlice && activeSlice !== slice) {
        activeSlice.classList.remove('stream-recap__pie-slice--active');
      }
      activeSlice = slice;
      slice.classList.add('stream-recap__pie-slice--active');
      tooltip.textContent = `${slice.dataset.type} · ${slice.dataset.pct}%`;
      tooltip.classList.add('stream-recap__pie-tooltip--visible');
      tooltip.setAttribute('aria-hidden', 'false');
      positionTooltip(clientX, clientY);
    }

    function hideTooltip() {
      if (activeSlice) {
        activeSlice.classList.remove('stream-recap__pie-slice--active');
        activeSlice = null;
      }
      tooltip.classList.remove('stream-recap__pie-tooltip--visible');
      tooltip.setAttribute('aria-hidden', 'true');
    }

    slices.forEach((slice) => {
      slice.addEventListener('mouseenter', (e) => showTooltip(slice, e.clientX, e.clientY));
      slice.addEventListener('mousemove', (e) => positionTooltip(e.clientX, e.clientY));
      slice.addEventListener('mouseleave', hideTooltip);
      slice.addEventListener('focus', () => {
        const rect = slice.getBoundingClientRect();
        showTooltip(slice, rect.left + rect.width / 2, rect.top + rect.height / 2);
      });
      slice.addEventListener('blur', hideTooltip);
    });
  }

  function renderPlayerTable(playerStats) {
    const rows = playerStats
      .map((p) => {
        const weaknessBadge = p.weaknessType
          ? global.TypeDisplay?.renderBadge?.(p.weaknessType, { variant: 'orb' }) ?? escapeHtml(p.weaknessType)
          : '—';
        const bstLabel =
          p.resolvedCount < p.pickCount
            ? `${p.bstTotal}*`
            : String(p.bstTotal);

        return `<tr>
          <td class="stream-recap__player">${escapeHtml(p.name)}</td>
          <td class="stream-recap__bst">${bstLabel}</td>
          <td class="stream-recap__weakness">
            <span class="stream-recap__weakness-type">${weaknessBadge}</span>
          </td>
        </tr>`;
      })
      .join('');

    return `
      <div class="stream-recap__table-wrap">
        <table class="stream-recap__table">
          <thead>
            <tr>
              <th scope="col">Nom</th>
              <th scope="col">Total Stats</th>
              <th scope="col">Faiblesse</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>`;
  }

  function renderStream(container, recap) {
    if (!container || !recap) return;
    container.innerHTML = `
      <div class="stream-recap__inner">
        <header class="stream-recap__header">
          <h2 class="stream-recap__title">Récapitulatif</h2>
          <p class="stream-recap__duration">Durée totale : <strong>${escapeHtml(recap.durationLabel)}</strong></p>
        </header>
        <div class="stream-recap__columns">
          <section class="stream-recap__section stream-recap__section--types" aria-label="Types draftés">
            <h3 class="stream-recap__section-title">Types draftés</h3>
            ${renderPieChart(recap.typeCounts, recap.typeTotal)}
          </section>
          <section class="stream-recap__section stream-recap__section--teams" aria-label="Joueurs">
            <h3 class="stream-recap__section-title">Joueur</h3>
            ${renderPlayerTable(recap.playerStats)}
          </section>
        </div>
      </div>`;
    setupPieInteractions(container);
  }

  global.DraftRecap = {
    computeDurationMs,
    formatDuration,
    computeRecap,
    renderStream,
    countDraftedTypes,
    computePlayerStat,
    formatWeaknessDetail,
    TYPE_COLORS,
  };
})(typeof window !== 'undefined' ? window : globalThis);
